import { useEffect, useMemo, useRef, useState } from 'react'
import { Logo, Icon } from './components/UiShared'
import { PasswordMeter } from './components/PasswordMeter'
import type { AuthView } from './components/AuthExperience'
import { useAccount, type AccountUser as User } from './lib/account'
import { useWorkspace, type Product, type FeeProfile as Profile, type Workspace } from './lib/workspace'
import { calculatePricing, checkPricing, type PricingInputs as Calc } from './lib/pricing'
import { passwordIsValid } from './lib/password'
import { formatBrazilianPhone, phoneToE164 } from './lib/phone'
import { NumericInput } from './components/NumericInput'
import { avatarImageStyle } from './lib/avatarLayout'
import { createBackup, inspectBackup, type BackupPreview } from './lib/backup'

type Page = 'overview' | 'products' | 'calculator' | 'scenarios' | 'profiles' | 'my-profile' | 'security'
const money = (value: number | null) =>
  value === null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const pct = (value: number) => `${value.toFixed(1).replace('.', ',')}%`

const nav: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'products', label: 'Produtos' },
  { id: 'calculator', label: 'Calculadora' },
  { id: 'scenarios', label: 'Cenários' },
  { id: 'profiles', label: 'Perfis de taxas' },
]

function Field({ label, value, onChange, suffix = 'R$', hint }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; hint?: string }) {
  return <label className="field">
    <span>{label}{hint && <small>{hint}</small>}</span>
    <div className="field-control">
      <em>{suffix}</em>
      <NumericInput value={value} onChange={onChange} kind={suffix === '%' ? 'percentage' : 'currency'} label={label} />
    </div>
  </label>
}

function AuthenticatedApp({ account, setAuthView }: { account: ReturnType<typeof useAccount>; setAuthView: (v: AuthView) => void }) {
  const workspace = useWorkspace(account.status, account.user.id)
  const [page, setPage] = useState<Page>('overview')
  const user = account.user
  const [userMenu, setUserMenu] = useState(false)
  const { products, setProducts, profiles, setProfiles, calc, setCalc, salePrice, setSalePrice, scenarioPrices, setScenarioPrices } = workspace
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todas')
  const [productModal, setProductModal] = useState<Product | 'new' | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)
  const [profileModal, setProfileModal] = useState<Profile | 'new' | null>(null)
  const [toast, setToast] = useState('')

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }
  const go = (to: Page) => { setPage(to); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const productProfit = (p: Product) => calculatePricing({ ...calc, cost: p.cost }, p.price).profit
  const metrics = useMemo(() => {
    const profits = products.map(productProfit)
    const margins = products.map((p, i) => p.price > 0 ? profits[i] / Math.max(0.01, p.price - calc.discount) * 100 : 0)
    return {
      avgProfit: products.length ? profits.reduce((a, b) => a + b, 0) / products.length : 0,
      avgMargin: products.length ? margins.reduce((a, b) => a + b, 0) / products.length : 0,
      negatives: profits.filter(v => v < 0).length,
    }
  }, [products, calc])

  const results = useMemo(() => calculatePricing(calc, salePrice), [salePrice, calc])

  if (!workspace.ready) return <div className="loading-screen">{workspace.error || 'Carregando seus produtos e configurações…'}</div>

  return <div className="app-shell">
    <aside className="sidebar">
      <Logo />
      <nav>
        <p>ESPAÇO DE TRABALHO</p>
        {nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => go(item.id)}>
          <Icon name={item.id} /><span>{item.label}</span>
        </button>)}
      </nav>
      <button className="sidebar-foot" onClick={() => setUserMenu(!userMenu)}>
        <UserAvatar user={user} />
        <div><strong>{user.name}</strong><small>{user.email}</small></div>
        <Icon name="more" />
      </button>
      {userMenu && <UserMenu go={p => { go(p); setUserMenu(false) }} logout={() => { void account.signOut().catch(err => notify(err.message)); setAuthView('login'); setUserMenu(false) }} />}
    </aside>

    <header className="mobile-header"><Logo /><button className="mobile-user" aria-label="Abrir menu do usuário" onClick={() => setUserMenu(!userMenu)}><UserAvatar user={user} /></button>{userMenu && <UserMenu go={p => { go(p); setUserMenu(false) }} logout={() => { void account.signOut().catch(err => notify(err.message)); setAuthView('login'); setUserMenu(false) }} />}</header>

    <main>
      {workspace.error && <div className="auth-error">{workspace.error}</div>}
      {page === 'overview' && <Overview products={products} metrics={metrics} go={go} user={user} calc={calc} demo={account.status === 'demo'} />}
      {page === 'products' && <Products products={products} calc={calc} search={search} setSearch={setSearch} category={category} setCategory={setCategory} setModal={setProductModal} setDelete={setDeleteProduct} duplicate={p => { setProducts([...products, { ...p, id: Date.now() + Math.floor(Math.random() * 1000), name: `${p.name} — cópia` }]); notify('Produto duplicado') }} />}
      {page === 'calculator' && <Calculator calc={calc} setCalc={setCalc} salePrice={salePrice} setSalePrice={setSalePrice} results={results} profiles={profiles} notify={notify} saving={workspace.saving} />}
      {page === 'scenarios' && <Scenarios calc={calc} prices={scenarioPrices} setPrices={setScenarioPrices} />}
      {page === 'profiles' && <Profiles profiles={profiles} setModal={setProfileModal} backup={{ products, profiles, calc, salePrice, scenarioPrices }} restore={workspace.restore} saving={workspace.saving} notify={notify} />}
      {page === 'my-profile' && <MyProfile user={user} save={account.saveAccount} uploadAvatar={account.uploadAvatar} notify={notify} />}
      {page === 'security' && <Security user={user} demo={account.status === 'demo'} account={account} notify={notify} />}
    </main>

    <nav className="bottom-nav">{nav.slice(0, 4).map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => go(item.id)}><Icon name={item.id} /><span>{item.id === 'overview' ? 'Início' : item.label}</span></button>)}</nav>

    {productModal && <ProductModal product={productModal} close={() => setProductModal(null)} save={p => {
      setProducts(productModal === 'new' ? [...products, { ...p, id: Date.now() + Math.floor(Math.random() * 1000) }] : products.map(x => x.id === p.id ? p : x))
      setProductModal(null); notify(productModal === 'new' ? 'Produto cadastrado' : 'Alterações salvas')
    }} />}
    {profileModal && <ProfileModal profile={profileModal} close={() => setProfileModal(null)} save={p => {
      setProfiles(profileModal === 'new' ? [...profiles, { ...p, id: Date.now() }] : profiles.map(x => x.id === p.id ? p : x))
      setProfileModal(null); notify('Perfil salvo')
    }} />}
    {deleteProduct && <ConfirmModal product={deleteProduct} close={() => setDeleteProduct(null)} confirm={() => {
      setProducts(products.filter(p => p.id !== deleteProduct.id)); setDeleteProduct(null); notify('Produto excluído')
    }} />}
    {toast && <div className="toast"><Icon name="check" />{toast}</div>}
  </div>
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="page-title">
    <div>{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{action}
  </header>
}

function Overview({ products, metrics, go, user, calc, demo }: { products: Product[]; metrics: { avgProfit: number; avgMargin: number; negatives: number }; go: (p: Page) => void; user: User; calc: Calc; demo: boolean }) {
  const review = products.filter(p => calculatePricing({ ...calc, cost: p.cost }, p.price).margin < 15)
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = user.name.trim().split(/\s+/)[0] || 'você'
  const currentDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)
  return <div className="page">
    {demo && <div className="demo-note"><span>AMBIENTE DE EXEMPLO</span> Os dados desta conta são demonstrativos e ficam neste dispositivo.</div>}
    <PageTitle eyebrow={currentDate.toLocaleUpperCase('pt-BR')} title={`${greeting}, ${firstName}.`} description="Aqui está o que merece sua atenção hoje." action={<button className="primary" onClick={() => go('calculator')}><Icon name="calculator" />Calcular um preço</button>} />
    <section className="metric-band">
      <div><small>PRODUTOS CADASTRADOS</small><strong>{String(products.length).padStart(2, '0')}</strong><span>no catálogo atual</span></div>
      <div><small>MARGEM MÉDIA</small><strong className="positive">{pct(metrics.avgMargin)}</strong><span>estimativa do catálogo</span></div>
      <div><small>LUCRO UNITÁRIO MÉDIO</small><strong>{money(metrics.avgProfit)}</strong><span>por item vendido</span></div>
      <div><small>MARGEM NEGATIVA</small><strong className={metrics.negatives ? 'negative' : ''}>{metrics.negatives}</strong><span>{metrics.negatives ? 'precisa de revisão' : 'tudo em ordem'}</span></div>
    </section>
    <div className="overview-grid">
      <section className="review-panel">
        <div className="section-head"><div><span>ATENÇÃO</span><h2>Produtos para revisar</h2></div><button className="text-button" onClick={() => go('products')}>Ver catálogo <Icon name="arrow" /></button></div>
        {review.length === 0 && <div className="empty-inline">Nenhum produto precisa de revisão no momento.</div>}
        {review.map(p => { const { profit, margin } = calculatePricing({ ...calc, cost: p.cost }, p.price); return <button className="review-row" key={p.id} onClick={() => go('products')}>
          <span className="product-initial">{p.name[0]}</span>
          <span><strong>{p.name}</strong><small>{p.category} · Venda {money(p.price)}</small></span>
          <span><small>LUCRO EST.</small><strong className={profit < 0 ? 'negative' : ''}>{money(profit)}</strong></span>
          <span><small>MARGEM</small><strong className={profit < 0 ? 'negative' : ''}>{pct(margin)}</strong></span>
          <Icon name="arrow" />
        </button> })}
      </section>
      <aside className="quick-calc">
        <span className="tag">ATALHO</span><Icon name="calculator" size={28} />
        <h2>O preço fecha a conta?</h2>
        <p>Simule custos, taxas e sua meta de lucro antes de publicar.</p>
        <button onClick={() => go('calculator')}>Abrir calculadora <Icon name="arrow" /></button>
      </aside>
    </div>
  </div>
}
function Products({ products, calc, search, setSearch, category, setCategory, setModal, setDelete, duplicate }: {
  products: Product[]; calc: Calc; search: string; setSearch: (s: string) => void; category: string; setCategory: (s: string) => void
  setModal: (p: Product | 'new') => void; setDelete: (p: Product) => void; duplicate: (p: Product) => void
}) {
  const categories = ['Todas', ...new Set(products.map(p => p.category))]
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && (category === 'Todas' || p.category === category))
  return <div className="page">
    <PageTitle title="Produtos" description="Acompanhe custos, preços e o resultado estimado de cada item." action={<button className="primary" onClick={() => setModal('new')}><Icon name="plus" />Cadastrar produto</button>} />
    <div className="toolbar">
      <label className="search"><Icon name="search" /><input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className="filters">{categories.map(c => <button className={category === c ? 'active' : ''} key={c} onClick={() => setCategory(c)}>{c}</button>)}</div>
      <span>{filtered.length} {filtered.length === 1 ? 'item' : 'itens'}</span>
    </div>
    {filtered.length ? <div className="product-table">
      <div className="table-row table-head"><span>PRODUTO</span><span>CUSTO</span><span>PREÇO DE VENDA</span><span>LUCRO EST.</span><span>MARGEM</span><span>OPÇÕES</span></div>
      {filtered.map(p => { const { profit, margin } = calculatePricing({ ...calc, cost: p.cost }, p.price); return <div className="table-row" key={p.id}>
        <span className="product-cell"><i>{p.name[0]}</i><span><strong>{p.name}</strong><small>{p.category}</small></span></span>
        <span data-label="Custo" className="mono">{money(p.cost)}</span>
        <span data-label="Venda" className="mono">{money(p.price)}</span>
        <span data-label="Lucro" className={`mono ${profit < 0 ? 'negative' : 'positive'}`}>{money(profit)}</span>
        <span data-label="Margem" className={`mono ${profit < 0 ? 'negative' : ''}`}>{pct(margin)}</span>
        <span className="row-actions row-actions-desktop">
          <button aria-label={`Editar ${p.name}`} title="Editar" onClick={() => setModal(p)}><Icon name="edit" /></button>
          <button aria-label={`Duplicar ${p.name}`} title="Duplicar" onClick={() => duplicate(p)}><Icon name="copy" /></button>
          <button aria-label={`Excluir ${p.name}`} title="Excluir" onClick={() => setDelete(p)}><Icon name="trash" /></button>
        </span>
        <div className="product-options-mobile">
          <details>
            <summary aria-label={`Opções para ${p.name}`}>Opções <Icon name="more" size={16}/></summary>
            <div className="product-options-dropdown">
              <button onClick={() => setModal(p)}><Icon name="edit" size={16}/>Editar</button>
              <button onClick={() => duplicate(p)}><Icon name="copy" size={16}/>Duplicar</button>
              <button className="option-delete" onClick={() => setDelete(p)}><Icon name="trash" size={16}/>Excluir</button>
            </div>
          </details>
        </div>
      </div> })}
    </div> : <div className="empty"><span><Icon name="search" size={28} /></span><h2>Nenhum produto encontrado</h2><p>Tente outro termo ou limpe os filtros para ver o catálogo.</p><button className="secondary" onClick={() => { setSearch(''); setCategory('Todas') }}>Limpar filtros</button></div>}
  </div>
}

function Calculator({ calc, setCalc, salePrice, setSalePrice, results, profiles, notify, saving }: {
  calc: Calc; setCalc: (c: Calc) => void; salePrice: number; setSalePrice: (v: number) => void
  results: ReturnType<typeof calculatePricing>
  profiles: Profile[]; notify: (s: string) => void; saving: 'idle' | 'saving' | 'saved' | 'error'
}) {
  const update = (key: keyof Calc, value: number) => setCalc({ ...calc, [key]: value })
  const errors = checkPricing(calc, salePrice)
  const costs = [
    { label: 'Produto', value: calc.cost, color: '#d49469' },
    { label: 'Operação', value: calc.package + calc.freight + calc.operational, color: '#d8b88c' },
    { label: 'Taxas', value: results.percentageFees + calc.fee, color: '#6f8d85' },
    { label: 'Lucro', value: Math.max(0, results.profit), color: '#295c52' },
  ]
  const total = costs.reduce((a, b) => a + b.value, 0) || 1
  return <div className="page calculator-page">
    <PageTitle eyebrow="FERRAMENTA PRINCIPAL" title="Calculadora de preços" description="Ajuste os valores e veja, em tempo real, quanto realmente sobra." action={<div className={`save-state ${saving === 'saving' ? 'saving' : ''}`}><span />{saving === 'saving' ? 'Salvando...' : saving === 'error' ? 'Erro ao salvar' : saving === 'saved' ? 'Dados salvos' : 'Preparando dados'}</div>} />
    <div className="calculator-layout">
      <section className="input-sheet">
        <div className="sheet-head"><div><span>01</span><h2>Custos da venda</h2></div><p>Informe o que você paga para preparar e entregar uma unidade.</p></div>
        <div className="field-grid">
          <Field label="Custo de aquisição" value={calc.cost} onChange={v => update('cost', v)} />
          <Field label="Embalagem" value={calc.package} onChange={v => update('package', v)} />
          <Field label="Frete do vendedor" value={calc.freight} onChange={v => update('freight', v)} />
          <Field label="Custo operacional" hint="por unidade" value={calc.operational} onChange={v => update('operational', v)} />
        </div>
        <div className="sheet-head split"><div><span>02</span><h2>Taxas e objetivo</h2></div>
          <select aria-label="Aplicar perfil de taxas" onChange={e => { const p = profiles.find(x => x.id === Number(e.target.value)); if (p) setCalc({ ...calc, fee: p.fee, commission: p.commission, tax: p.tax }) }}>
            <option value="">Aplicar perfil...</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field-grid">
          <Field label="Tarifa fixa" value={calc.fee} onChange={v => update('fee', v)} />
          <Field label="Comissão estimada" value={calc.commission} suffix="%" onChange={v => update('commission', v)} />
          <Field label="Impostos estimados" value={calc.tax} suffix="%" onChange={v => update('tax', v)} />
          <Field label="Desconto do vendedor" value={calc.discount} onChange={v => update('discount', v)} />
          <Field label="Lucro desejado" value={calc.desiredProfit} onChange={v => update('desiredProfit', v)} />
        </div>
        <div className="estimate-note">Os cálculos são estimativas. Regras específicas de cada plataforma podem alterar o resultado.</div>
      </section>
      <section className="result-sheet">
        <div className="result-top"><span>SIMULAÇÃO ATUAL</span><button onClick={() => { navigator.clipboard?.writeText(`Preço ${money(salePrice)} · Lucro ${money(results.profit)} · Margem ${pct(results.margin)}`); notify('Resumo copiado') }}><Icon name="copy" /> Copiar resumo</button></div>
        <label className="sale-price"><span>PREÇO DE VENDA SIMULADO</span><div><em>R$</em><NumericInput value={salePrice} onChange={setSalePrice} label="Preço de venda simulado" /></div></label>
        {errors.map(error => <div className="validation" key={error}>{error}</div>)}
        <div className="result-hero">
          <div><small>LUCRO LÍQUIDO ESTIMADO</small><strong className={results.profit < 0 ? 'negative' : ''}>{money(results.profit)}</strong><span>{results.profit >= calc.desiredProfit ? 'Meta de lucro atingida' : `Faltam ${money(calc.desiredProfit - results.profit)} para sua meta`}</span></div>
          <div className={`margin-ring ${results.margin < 0 ? 'bad' : ''}`} style={{ '--progress': `${Math.max(0, Math.min(100, results.margin)) * 3.6}deg` } as React.CSSProperties}><span><strong>{pct(results.margin)}</strong><small>margem</small></span></div>
        </div>
        <div className="result-stats">
          <div><small>RECEITA APÓS DESCONTO</small><strong>{money(results.revenue)}</strong></div>
          <div><small>PONTO DE EQUILÍBRIO</small><strong>{money(results.breakEven)}</strong></div>
          <div className="suggested"><small>PREÇO PARA ATINGIR A META</small><strong>{money(results.suggested)}</strong><button disabled={results.suggested === null} onClick={() => { if (results.suggested !== null) setSalePrice(results.suggested) }}>Usar este preço</button></div>
        </div>
        <div className="breakdown">
          <div className="breakdown-head"><h3>Para onde vai o valor da venda</h3><span>{money(results.revenue)}</span></div>
          <div className="cost-bar">{costs.map(c => <i key={c.label} style={{ width: `${c.value / total * 100}%`, background: c.color }} />)}</div>
          <div className="legend">{costs.map(c => <div key={c.label}><i style={{ background: c.color }} /><span>{c.label}</span><strong>{money(c.value)}</strong></div>)}</div>
        </div>
      </section>
    </div>
  </div>
}

function Scenarios({ calc, prices, setPrices }: { calc: Calc; prices: number[]; setPrices: (prices: number[]) => void }) {
  const values = prices.map(price => {
    const result = calculatePricing(calc, price)
    return { price, ...result, hits: result.profit >= calc.desiredProfit }
  })
  return <div className="page">
    <PageTitle eyebrow="COMPARAÇÃO" title="Simulação de cenários" description="Compare três preços para o mesmo produto e encontre o melhor equilíbrio." />
    <section className="scenario-intro"><div><span>CONFIGURAÇÃO EM ANÁLISE</span><h2>Simulação atual</h2><p>Custo base {money(calc.cost)} · Meta de lucro {money(calc.desiredProfit)}</p></div><span className="demo-pill">ESTIMATIVA</span></section>
    <section className="scenario-table">
      <div className="scenario-row heading"><span>MÉTRICA</span>{values.map((v, i) => <span key={i}>CENÁRIO {String.fromCharCode(65 + i)}{v.hits && <em>ATINGE A META</em>}</span>)}</div>
      <div className="scenario-row price-row"><strong>Preço de venda</strong>{prices.map((p, i) => <label key={i}><em>R$</em><NumericInput value={p} label={`Preço de venda do cenário ${String.fromCharCode(65 + i)}`} onChange={value => setPrices(prices.map((x, n) => n === i ? value : x))} /></label>)}</div>
      <div className="scenario-row"><span>Receita após desconto</span>{values.map((v, i) => <strong key={i}>{money(v.revenue)}</strong>)}</div>
      <div className="scenario-row"><span>Custos + taxas</span>{values.map((v, i) => <strong key={i}>{money(v.revenue - v.profit)}</strong>)}</div>
      <div className="scenario-row highlight"><span>Lucro estimado</span>{values.map((v, i) => <strong className={v.profit < 0 ? 'negative' : 'positive'} key={i}>{money(v.profit)}</strong>)}</div>
      <div className="scenario-row"><span>Margem</span>{values.map((v, i) => <strong key={i}>{pct(v.margin)}</strong>)}</div>
    </section>
    <p className="scenario-tip"><span>LEITURA RÁPIDA</span> O primeiro cenário destacado em verde é o menor preço que alcança sua meta atual.</p>
  </div>
}

function Profiles({ profiles, setModal, backup, restore, saving, notify }: {
  profiles: Profile[]
  setModal: (p: Profile | 'new') => void
  backup: Workspace
  restore: (value: unknown) => Promise<void>
  saving: 'idle' | 'saving' | 'saved' | 'error'
  notify: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [backupError, setBackupError] = useState('')
  const [pendingBackup, setPendingBackup] = useState<BackupPreview | null>(null)
  const [importing, setImporting] = useState(false)

  const download = (): boolean => {
    try {
      const content = createBackup(backup)
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `precocerto-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1500)
      notify('Backup gerado. Guarde o arquivo em local seguro.')
      return true
    } catch (caught) {
      setBackupError(caught instanceof Error ? caught.message : 'Não foi possível exportar seus dados.')
      return false
    }
  }

  const importFile = async (file?: File) => {
    if (!file) return
    setBackupError('')
    setPendingBackup(null)
    if (file.size > 1024 * 1024) { setBackupError('O arquivo excede 1 MB.'); return }
    try {
      const preview = inspectBackup(JSON.parse(await file.text()) as unknown)
      setPendingBackup(preview)
    } catch (caught) {
      setBackupError(caught instanceof Error ? caught.message : 'O arquivo não é um backup válido.')
    }
  }

  const confirmRestore = async () => {
    if (!pendingBackup || importing) return
    if (saving === 'saving') {
      setBackupError('Aguarde o salvamento atual terminar antes de restaurar.')
      return
    }
    if (!window.confirm('ATENÇÃO: isto substituirá TODOS os produtos, perfis de taxas e simulações desta conta. Continuar?')) return
    setBackupError('')
    // Preserve the current workspace before overwriting any data.
    if (!download()) return
    setImporting(true)
    try {
      await restore({ format: 'precocerto-backup', version: 1, exportedAt: pendingBackup.exportedAt, data: pendingBackup.data })
      setPendingBackup(null)
      notify('Backup restaurado e salvo com sucesso.')
    } catch (caught) {
      setBackupError(caught instanceof Error ? caught.message : 'Falha ao salvar a restauração.')
    } finally { setImporting(false) }
  }

  return <div className="page">
    <PageTitle title="Perfis de taxas" description="Salve combinações de taxas para aplicar rapidamente nas simulações." action={<button className="primary" onClick={() => setModal('new')}><Icon name="plus" />Novo perfil</button>} />
    <div className="info-banner"><strong>Você define as regras.</strong> Não presumimos taxas oficiais de nenhuma plataforma. Revise os percentuais conforme seu contrato.</div>
    <div className="profile-list">
      {profiles.map(p => <button className="profile-row" key={p.id} onClick={() => setModal(p)}>
        <span className="profile-symbol">%</span><span className="profile-name"><strong>{p.name}</strong><small>{p.demo ? 'Perfil ilustrativo · ' : ''}Atualizado localmente</small></span>
        <span><small>COMISSÃO</small><strong>{pct(p.commission)}</strong></span>
        <span><small>TARIFA FIXA</small><strong>{money(p.fee)}</strong></span>
        <span><small>IMPOSTO EST.</small><strong>{pct(p.tax)}</strong></span>
        {p.demo && <em>EXEMPLO</em>}<Icon name="arrow" />
      </button>)}
    </div>
    <section className="data-backup">
      <div><span className="section-label">SEGURANÇA DOS DADOS</span><h2>Seu backup, nas suas mãos.</h2><p>Exporte seus produtos, taxas e simulações para um arquivo JSON. A importação substitui esses dados na conta atual, mas não altera o login ou a foto de perfil. Guarde o arquivo em local privado.</p></div>
      <div className="backup-actions">
        <button type="button" className="primary" onClick={download}>Exportar meus dados</button>
        <button type="button" className="secondary" disabled={importing} onClick={() => inputRef.current?.click()}>Importar backup</button>
      </div>
      <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }}/>
      {pendingBackup && <div className="backup-preview" role="region" aria-label="Prévia do backup">
        <div><span className="section-label">CONFERIR RESTAURAÇÃO</span><h3>Revise antes de substituir</h3>
          <p>Este arquivo contém <strong>{pendingBackup.productCount} produtos</strong> e <strong>{pendingBackup.profileCount} perfis de taxas</strong>, além dos valores da calculadora e dos cenários.</p>
          <p>{pendingBackup.exportedAt ? `Exportado em ${new Date(pendingBackup.exportedAt).toLocaleString('pt-BR')}.` : 'Data de exportação indisponível.'} Os dados atuais desta conta serão substituídos. Uma cópia será baixada automaticamente antes da restauração.</p>
        </div>
        <div className="backup-actions"><button type="button" className="secondary" disabled={importing} onClick={() => setPendingBackup(null)}>Cancelar</button>
          <button type="button" className="danger-button" disabled={importing || saving === 'saving'} onClick={() => { void confirmRestore() }}>{importing ? 'Salvando…' : 'Confirmar restauração'}</button></div>
      </div>}
      {backupError && <p className="auth-error" role="alert">{backupError}</p>}
    </section>
  </div>
}

function ProductModal({ product, close, save }: { product: Product | 'new'; close: () => void; save: (p: Product) => void }) {
  const [form, setForm] = useState<Product>(product === 'new' ? { id: 0, name: '', category: '', cost: 0, price: 0 } : product)
  const [error, setError] = useState('')
  const submit = () => {
    if (!form.name.trim() || !form.category.trim()) return setError('Preencha o nome e a categoria do produto.')
    if (form.price <= 0) return setError('Informe um preço de venda maior que zero.')
    save(form)
  }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
    <form className="modal" role="dialog" aria-modal="true" onSubmit={e => { e.preventDefault(); submit() }}>
      <header><div><span>{product === 'new' ? 'NOVO ITEM' : 'EDITAR ITEM'}</span><h2>{product === 'new' ? 'Cadastrar produto' : form.name}</h2></div><button type="button" aria-label="Fechar" onClick={close}><Icon name="close" /></button></header>
      <div className="modal-fields">
        <label>Nome do produto<input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Vela Brisa" /></label>
        <label>Categoria<input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Casa" /></label>
        <Field label="Custo unitário" value={form.cost} onChange={v => setForm({ ...form, cost: v })} />
        <Field label="Preço de venda" value={form.price} onChange={v => setForm({ ...form, price: v })} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <footer><button type="button" className="secondary" onClick={close}>Cancelar</button><button type="submit" className="primary">Salvar produto</button></footer>
    </form>
  </div>
}

function ProfileModal({ profile, close, save }: { profile: Profile | 'new'; close: () => void; save: (p: Profile) => void }) {
  const [form, setForm] = useState<Profile>(profile === 'new' ? { id: 0, name: '', commission: 0, fee: 0, tax: 0 } : profile)
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><form className="modal" role="dialog" aria-modal="true" onSubmit={e => { e.preventDefault(); if (form.name.trim()) save(form) }}>
    <header><div><span>CONFIGURAÇÃO</span><h2>{profile === 'new' ? 'Novo perfil de taxas' : 'Editar perfil'}</h2></div><button type="button" aria-label="Fechar" onClick={close}><Icon name="close" /></button></header>
    <div className="modal-fields"><label className="full">Nome do perfil<input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Loja online" /></label>
      <Field label="Comissão" suffix="%" value={form.commission} onChange={v => setForm({ ...form, commission: v })} />
      <Field label="Tarifa fixa" value={form.fee} onChange={v => setForm({ ...form, fee: v })} />
      <Field label="Imposto estimado" suffix="%" value={form.tax} onChange={v => setForm({ ...form, tax: v })} />
    </div>
    <footer><button type="button" className="secondary" onClick={close}>Cancelar</button><button type="submit" className="primary" disabled={!form.name.trim()}>Salvar perfil</button></footer>
  </form></div>
}

function ConfirmModal({ product, close, confirm }: { product: Product; close: () => void; confirm: () => void }) {
  return <div className="modal-backdrop"><div className="modal confirm" role="alertdialog" aria-modal="true">
    <span className="danger-icon"><Icon name="trash" size={24} /></span><h2>Excluir “{product.name}”?</h2><p>Esta ação remove o produto da sua conta. Não será possível desfazer.</p>
    <footer><button className="secondary" onClick={close}>Manter produto</button><button className="danger-button" onClick={confirm}>Sim, excluir</button></footer>
  </div></div>
}

function UserAvatar({ user, large = false }: { user: User; large?: boolean }) {
  // Se a foto estiver ausente ou o link expirar, mostramos um desenho neutro.
  // Guardar a URL que falhou faz uma nova foto aparecer normalmente, sem recarregar.
  const [failedSrc, setFailedSrc] = useState('')
  const photo = typeof user.avatar === 'string' ? user.avatar.trim() : ''
  const hasPhoto = Boolean(photo && photo !== failedSrc)
  return <span className={`avatar ${large ? 'avatar-large' : ''}`} role="img" aria-label={hasPhoto ? 'Foto de perfil' : 'Avatar padrão'}>
    {hasPhoto ? <img src={photo} alt="" onError={() => setFailedSrc(photo)} style={avatarImageStyle(user.avatarPositionX, user.avatarPosition, user.avatarZoom)} />
      : <Icon name="user" size={large ? 48 : 19} />}
  </span>
}

function UserMenu({ go, logout }: { go: (p: Page) => void; logout: () => void }) {
  return <div className="user-menu">
    <span>MINHA CONTA</span>
    <button onClick={() => go('my-profile')}><Icon name="user" />Meu perfil</button>
    <button onClick={() => go('my-profile')}><Icon name="profiles" />Configurações da conta</button>
    <button onClick={() => go('security')}><Icon name="lock" />Segurança</button>
    <button className="logout" onClick={logout}><Icon name="logout" />Sair da conta</button>
  </div>
}

function MyProfile({ user, save, uploadAvatar, notify }: {
  user: User
  save: (u: Pick<User, 'name' | 'phone' | 'avatar' | 'avatarPosition' | 'avatarPositionX' | 'avatarZoom'>) => Promise<void>
  uploadAvatar: (file: File) => Promise<string>
  notify: (s: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(user)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!editing) setDraft(user) }, [user, editing])

  const choose = (file?: File) => {
    if (!file) return
    if (file.size > 3 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Use uma imagem JPG, PNG ou WebP de até 3 MB.')
      return
    }
    setSelectedFile(file)
    setError('')
    const reader = new FileReader()
    reader.onload = () => setDraft(current => ({
      ...current,
      avatar: String(reader.result),
      avatarPosition: 50,
      avatarPositionX: 50,
      avatarZoom: 100,
    }))
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    if (!draft.name.trim()) { setError('O nome não pode ficar vazio.'); return }
    if (draft.phone.trim() && !phoneToE164(draft.phone)) {
      setError('Informe um telefone com DDD completo, ou deixe em branco.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const avatar = selectedFile ? await uploadAvatar(selectedFile) : draft.avatar
      await save({
        name: draft.name.trim(),
        phone: formatBrazilianPhone(draft.phone),
        avatar,
        avatarPosition: draft.avatarPosition ?? 50,
        avatarPositionX: draft.avatarPositionX ?? 50,
        avatarZoom: draft.avatarZoom ?? 100,
      })
      setSelectedFile(null)
      setEditing(false)
      notify('Perfil e foto atualizados. O telefone fica salvo como contato, sem verificação por SMS.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="page">
    <PageTitle eyebrow="CONTA PESSOAL" title="Meu perfil" description="Revise seus dados e como você aparece no PreçoCerto."
      action={!editing ? <button className="primary" onClick={() => setEditing(true)}><Icon name="edit"/>Editar perfil</button> : undefined}/>
    <section className="account-sheet">
      <div className="photo-panel">
        <UserAvatar user={draft} large/>
        <h2>{draft.name}</h2>
        <p>{draft.email}</p>
        <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e => {
          choose(e.target.files?.[0])
          e.currentTarget.value = ''
        }}/>
        {editing && <>
          <button className="secondary" onClick={() => fileRef.current?.click()}><Icon name="camera"/>Selecionar imagem</button>
          {draft.avatar && <div className="photo-editor">
            <label className="photo-adjust">Zoom <strong>{draft.avatarZoom ?? 100}%</strong>
              <input aria-label="Zoom da foto" type="range" min="100" max="250" step="5" value={draft.avatarZoom ?? 100}
                onChange={e => setDraft(current => ({ ...current, avatarZoom: Number(e.target.value) }))}/>
            </label>
            <label className="photo-adjust">Posição horizontal
              <input aria-label="Posição horizontal da foto" type="range" min="0" max="100" value={draft.avatarPositionX ?? 50}
                onChange={e => setDraft(current => ({ ...current, avatarPositionX: Number(e.target.value) }))}/>
            </label>
            <label className="photo-adjust">Posição vertical
              <input aria-label="Posição vertical da foto" type="range" min="0" max="100" value={draft.avatarPosition ?? 50}
                onChange={e => setDraft(current => ({ ...current, avatarPosition: Number(e.target.value) }))}/>
            </label>
            <button className="remove-photo" onClick={() => { setDraft({ ...draft, avatar: undefined }); setSelectedFile(null) }}>Remover foto</button>
          </div>}
        </>}
        <small>JPG, PNG ou WebP, até 3 MB. A prévia muda ao ajustar e é mantida após salvar.</small>
      </div>
      <form className="profile-form" onSubmit={e => { e.preventDefault(); if (editing && !busy) void submit() }}>
        <div className="account-section-head"><div><span>INFORMAÇÕES PESSOAIS</span><h2>Seus dados</h2></div><em>Conta criada em {user.createdAt}</em></div>
        <label>Nome completo<input disabled={!editing} value={draft.name} onChange={e => setDraft({ ...draft, name:e.target.value })}/></label>
        <label>E-mail {user.emailVerified && <span className="verified-badge">Verificado</span>}<input disabled value={draft.email}/></label>
        <label>Telefone <small>opcional; contato salvo sem confirmação por SMS no plano gratuito</small>
          <input type="tel" inputMode="tel" autoComplete="tel" disabled={!editing}
            value={formatBrazilianPhone(draft.phone)}
            onChange={e => setDraft({ ...draft, phone: formatBrazilianPhone(e.target.value) })}
            placeholder="(11) 99999-9999"/>
        </label>
        {error && <div className="auth-error">{error}</div>}
        {editing && <div className="profile-actions">
          <button type="button" className="secondary" disabled={busy} onClick={() => { setDraft(user); setSelectedFile(null); setError(''); setEditing(false) }}>Cancelar</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar alterações'}</button>
        </div>}
      </form>
    </section>
  </div>
}

function Security({ user, demo, account, notify }: { user: User; demo: boolean; account: ReturnType<typeof useAccount>; notify: (s: string) => void }) {
  const [dialog, setDialog] = useState<'password' | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const act = async (task: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await task() } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.') }
    finally { setBusy(false) }
  }
  const close = () => { setDialog(null); setError(''); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }
  const submitPassword = () => {
    if (busy) return
    if (!passwordIsValid(newPassword)) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (newPassword !== confirmPassword) return setError('Confirmação diferente da nova senha.')
    void act(async () => { await account.changePassword(currentPassword, newPassword); close(); notify('Senha alterada com sucesso') })
  }
  const rows = [
    { icon:'mail', title:'Endereço de e-mail', detail:user.email, status:user.emailVerified ? 'Verificado' : 'Aguardando confirmação', ok:user.emailVerified, action:'Confirmar' },
    { icon:'phone', title:'Telefone', detail:formatBrazilianPhone(user.phone) || 'Nenhum telefone informado', status:'Sem verificação por SMS', ok:false, action:'Editar no perfil' },
    { icon:'lock', title:'Senha', detail:'Credencial da conta', status:demo ? 'Demonstração' : 'Protegida', ok:!demo, action:'Alterar senha' },
  ]
  return <div className="page"><PageTitle eyebrow="PROTEÇÃO DA CONTA" title="Segurança" description="Gerencie credenciais, verificações e métodos de acesso."/>
    {demo && <div className="demo-note"><span>DEMONSTRAÇÃO</span> Login e alteração de senha exigem configurar o Firebase. SMS continua opcional e exige um plano com cobrança.</div>}
    <div className="security-grid"><section><div className="section-label">DADOS DE ACESSO</div>
      {rows.map(row => <div className="security-row" key={row.title}><span><Icon name={row.icon}/></span><div><strong>{row.title}</strong><p>{row.detail}</p></div><em className={row.ok ? 'ok' : ''}>{row.status}</em>
        <button disabled={demo || row.title === 'Telefone' || (row.title === 'Endereço de e-mail' && Boolean(user.emailVerified))} onClick={() => {
          if (row.title === 'Senha') { setDialog('password'); return }
          void act(async () => { await account.resendConfirmation(); notify('E-mail de confirmação solicitado') })
        }}>{row.action}</button></div>)}
    </section><section><div className="section-label">MÉTODOS VINCULADOS</div>
      <div className="security-row"><span className="google-mini">G</span><div><strong>Google</strong><p>Entre com sua conta Google</p></div><em className={user.googleConnected ? 'ok' : ''}>{user.googleConnected ? 'Conectado' : 'Não conectado'}</em><button disabled={demo || Boolean(user.googleConnected)} onClick={() => void act(async () => { await account.linkGoogle() })}>{user.googleConnected ? 'Vinculado' : 'Conectar'}</button></div>
      <div className="security-note"><Icon name="lock"/><p>E-mail e Google usam Firebase Authentication. SMS não está incluído no plano gratuito Spark. Os telefones são armazenados apenas como contato, nunca como identidade verificada.</p></div>
      {error && !dialog && <div className="auth-error">{error}</div>}
    </section></div>
    {dialog === 'password' && <div className="modal-backdrop"><form className="modal" onSubmit={e => { e.preventDefault(); submitPassword() }}><header><div><span>SEGURANÇA</span><h2>Alterar senha</h2></div><button type="button" aria-label="Fechar" onClick={close}><Icon name="close"/></button></header>
      <div className="modal-fields"><label className="full">Senha atual<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></label><label className="full">Nova senha<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)}/></label><div className="full"><PasswordMeter password={newPassword} confirmation={confirmPassword}/></div><label className="full">Confirmar nova senha<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/></label></div>
      {error && <div className="auth-error">{error}</div>}
      <footer><button type="button" className="secondary" disabled={busy} onClick={close}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Atualizando…' : 'Atualizar senha'}</button></footer></form></div>}
  </div>
}

export default AuthenticatedApp
