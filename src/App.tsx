import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, type AccountUser as User } from './lib/account'
import { useWorkspace, type Product, type FeeProfile as Profile, type Workspace } from './lib/workspace'
import { calculatePricing, checkPricing, type PricingInputs as Calc } from './lib/pricing'
import { passwordIsValid, passwordScore } from './lib/password'
import { cloudConfigured } from './lib/firebase'
import { formatBrazilianPhone, phoneToE164 } from './lib/phone'
import { NumericInput } from './components/NumericInput'
import { avatarImageStyle } from './lib/avatarLayout'
import { parseEmailActionQuery } from './lib/emailActions'
import { createBackup, inspectBackup, type BackupPreview } from './lib/backup'

type Page = 'overview' | 'products' | 'calculator' | 'scenarios' | 'profiles' | 'my-profile' | 'security'
type AuthView = 'login' | 'signup' | 'verify' | 'recover' | 'recover-email' | 'new-password' | 'verify-email' | 'recover-email-action' | 'action-result'
const money = (value: number | null) =>
  value === null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const pct = (value: number) => `${value.toFixed(1).replace('.', ',')}%`

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    products: <><path d="M20 13 13 20a2 2 0 0 1-2.8 0L4 13.8V4h9.8l6.2 6.2a2 2 0 0 1 0 2.8Z" /><circle cx="9" cy="9" r="1" /></>,
    calculator: <><rect x="4" y="2.5" width="16" height="19" rx="2" /><path d="M8 6.5h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4" /></>,
    scenarios: <><path d="M4 19V9M10 19V4M16 19v-7M22 19H2" /></>,
    profiles: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    arrow: <path d="m9 18 6-6-6-6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
    edit: <><path d="m4 20 4-.8L19 8.2 15.8 5 4.8 16Z" /><path d="m14 6.8 3.2 3.2" /></>,
    copy: <><rect x="8" y="8" width="11" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    phone: <><path d="M7 3h3l1.5 5-2 1.5a15 15 0 0 0 5 5l1.5-2L21 14v3a4 4 0 0 1-4 4A14 14 0 0 1 3 7a4 4 0 0 1 4-4Z" /></>,
    camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4Z" /><circle cx="12" cy="13" r="3" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const nav: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'products', label: 'Produtos' },
  { id: 'calculator', label: 'Calculadora' },
  { id: 'scenarios', label: 'Cenários' },
  { id: 'profiles', label: 'Perfis de taxas' },
]

function Logo() {
  return <div className="logo"><span className="logo-mark"><i /></span><strong>PreçoCerto</strong></div>
}

function Field({ label, value, onChange, suffix = 'R$', hint }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; hint?: string }) {
  return <label className="field">
    <span>{label}{hint && <small>{hint}</small>}</span>
    <div className="field-control">
      <em>{suffix}</em>
      <NumericInput value={value} onChange={onChange} kind={suffix === '%' ? 'percentage' : 'currency'} label={label} />
    </div>
  </label>
}

function App() {
  const account = useAccount()
  const workspace = useWorkspace(account.status, account.user.id)
  const [page, setPage] = useState<Page>('overview')
  const [authView, setAuthView] = useState<AuthView>(() => {
    const action = parseEmailActionQuery(window.location.search)
    if (action.mode === 'resetPassword') return 'new-password'
    if (action.mode === 'verifyEmail') return 'verify-email'
    if (action.mode === 'recoverEmail') return 'recover-email-action'
    return 'login'
  })
  const actionCode = parseEmailActionQuery(window.location.search).code
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

  if (account.status === 'loading') return <div className="loading-screen">Abrindo PreçoCerto…</div>
  if (account.status === 'signedOut' || account.authRecovery || actionCode || authView === 'action-result') {
    return <AuthExperience view={authView} setView={setAuthView} account={account} actionCode={actionCode} />
  }
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
    <div className="modal" role="dialog" aria-modal="true">
      <header><div><span>{product === 'new' ? 'NOVO ITEM' : 'EDITAR ITEM'}</span><h2>{product === 'new' ? 'Cadastrar produto' : form.name}</h2></div><button aria-label="Fechar" onClick={close}><Icon name="close" /></button></header>
      <div className="modal-fields">
        <label>Nome do produto<input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Vela Brisa" /></label>
        <label>Categoria<input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Casa" /></label>
        <Field label="Custo unitário" value={form.cost} onChange={v => setForm({ ...form, cost: v })} />
        <Field label="Preço de venda" value={form.price} onChange={v => setForm({ ...form, price: v })} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <footer><button className="secondary" onClick={close}>Cancelar</button><button className="primary" onClick={submit}>Salvar produto</button></footer>
    </div>
  </div>
}

function ProfileModal({ profile, close, save }: { profile: Profile | 'new'; close: () => void; save: (p: Profile) => void }) {
  const [form, setForm] = useState<Profile>(profile === 'new' ? { id: 0, name: '', commission: 0, fee: 0, tax: 0 } : profile)
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="modal" role="dialog" aria-modal="true">
    <header><div><span>CONFIGURAÇÃO</span><h2>{profile === 'new' ? 'Novo perfil de taxas' : 'Editar perfil'}</h2></div><button aria-label="Fechar" onClick={close}><Icon name="close" /></button></header>
    <div className="modal-fields"><label className="full">Nome do perfil<input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Loja online" /></label>
      <Field label="Comissão" suffix="%" value={form.commission} onChange={v => setForm({ ...form, commission: v })} />
      <Field label="Tarifa fixa" value={form.fee} onChange={v => setForm({ ...form, fee: v })} />
      <Field label="Imposto estimado" suffix="%" value={form.tax} onChange={v => setForm({ ...form, tax: v })} />
    </div>
    <footer><button className="secondary" onClick={close}>Cancelar</button><button className="primary" disabled={!form.name.trim()} onClick={() => save(form)}>Salvar perfil</button></footer>
  </div></div>
}

function ConfirmModal({ product, close, confirm }: { product: Product; close: () => void; confirm: () => void }) {
  return <div className="modal-backdrop"><div className="modal confirm" role="alertdialog" aria-modal="true">
    <span className="danger-icon"><Icon name="trash" size={24} /></span><h2>Excluir “{product.name}”?</h2><p>Esta ação remove o produto da sua conta. Não será possível desfazer.</p>
    <footer><button className="secondary" onClick={close}>Manter produto</button><button className="danger-button" onClick={confirm}>Sim, excluir</button></footer>
  </div></div>
}

function UserAvatar({ user, large = false }: { user: User; large?: boolean }) {
  const initials = user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return <span className={`avatar ${large ? 'avatar-large' : ''}`}>{user.avatar ? <img src={user.avatar} alt="" style={avatarImageStyle(user.avatarPositionX, user.avatarPosition, user.avatarZoom)} /> : initials}</span>
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

function AuthInput({ label, type = 'text', value, onChange, error, autoComplete, placeholder }: { label: string; type?: string; value: string; onChange: (v: string) => void; error?: string; autoComplete?: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false)
  const password = type === 'password'
  return <label className={`auth-field ${error ? 'invalid' : ''}`}><span>{label}</span><div><input type={password && visible ? 'text' : type} value={value} autoComplete={autoComplete} placeholder={placeholder} onChange={e => onChange(e.target.value)} />{password && <button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)}><Icon name="eye" /></button>}</div>{error && <small>{error}</small>}</label>
}

function PasswordMeter({ password, confirmation }: { password: string; confirmation?: string }) {
  const score = passwordScore(password)
  const labels = ['Senha fraca', 'Senha fraca', 'Senha média', 'Senha forte']
  return <div className="password-meter">
    <div className={`meter score-${score}`}><i /><i /><i /></div><strong>{labels[score]}</strong>
    <ul>
      <li className={password.length >= 8 ? 'ok' : ''}>Pelo menos 8 caracteres</li>
      <li className={/[a-z]/.test(password) && /[A-Z]/.test(password) ? 'ok' : ''}>Letras maiúsculas e minúsculas (recomendado)</li>
      <li className={/\d/.test(password) ? 'ok' : ''}>Pelo menos um número (recomendado)</li>
      <li className={/[^A-Za-z0-9]/.test(password) ? 'ok' : ''}>Um caractere especial (recomendado)</li>
      {confirmation !== undefined && <li className={!!confirmation && password === confirmation ? 'ok' : ''}>As senhas são iguais</li>}
    </ul>
  </div>
}

function GoogleButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="google-button" onClick={onClick}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.7h3.4c2-1.8 3.1-4.5 3.1-7.7Z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.7c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.8A10.4 10.4 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.2 13.5a6.2 6.2 0 0 1 0-4V6.7H2.7a10.3 10.3 0 0 0 0 9.6l3.5-2.8Z"/><path fill="#EA4335" d="M12 5.2c1.5 0 3 .5 4 1.6l3-3A10 10 0 0 0 2.7 6.7l3.5 2.8C7 7 9.3 5.2 12 5.2Z"/></svg>{label}</button>
}

function AuthExperience({ view, setView, account, actionCode }: { view: AuthView; setView: (v: AuthView) => void; account: ReturnType<typeof useAccount>; actionCode: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [linkStatus, setLinkStatus] = useState<'checking' | 'valid' | 'invalid'>('checking')
  const [linkEmail, setLinkEmail] = useState('')
  const [completedAction, setCompletedAction] = useState<'verifyEmail' | 'resetPassword' | 'recoverEmail'>('verifyEmail')
  // useRef previne processar o mesmo codigo duas vezes sob React.StrictMode.
  const lastResetCode = useRef('')
  const lastVerifyCode = useRef('')
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const run = async (task: () => Promise<void>) => {
    setLoading(true); setError('')
    try { await task() } catch (error) { setError(error instanceof Error ? error.message : 'Ocorreu um erro. Tente novamente.') }
    finally { setLoading(false) }
  }
  useEffect(() => { setSent(false); setError('') }, [view])
  useEffect(() => {
    if (view !== 'new-password') return
    if (!actionCode) { setLinkStatus('invalid'); return }
    if (lastResetCode.current === actionCode) return
    lastResetCode.current = actionCode
    let active = true
    setLinkStatus('checking')
    void account.checkEmailResetCode(actionCode).then(address => {
      if (!active) return
      setLinkEmail(address)
      setLinkStatus('valid')
    }).catch(err => {
      if (!active) return
      setLinkStatus('invalid')
      setError(err instanceof Error ? err.message : 'Este link expirou ou foi utilizado.')
    })
    return () => { active = false; lastResetCode.current = '' }
    // A validacao acontece somente quando muda o codigo/fluxo.
  }, [view, actionCode])
  useEffect(() => {
    if (view !== 'verify-email' || !actionCode) return
    if (lastVerifyCode.current === actionCode) return
    lastVerifyCode.current = actionCode
    setLinkStatus('checking')
    void account.finishEmailAction(actionCode, 'verifyEmail').then(() => {
      window.history.replaceState(null, '', '/')
      setCompletedAction('verifyEmail')
      setView('action-result')
    }).catch(err => {
      setLinkStatus('invalid')
      setError(err instanceof Error ? err.message : 'Não foi possível verificar o e-mail.')
    })
  }, [view, actionCode])
  const backToLogin = () => { window.history.replaceState(null, '', '/'); setView('login'); setError('') }
  const login = () => {
    if (!email || !password) return setError('Preencha o e-mail e a senha para continuar.')
    if (!validEmail) return setError('Digite um endereço de e-mail válido.')
    void run(() => account.signIn(email, password))
  }
  const signup = () => {
    if (!name.trim() || !validEmail) return setError('Preencha seu nome e um e-mail válido.')
    if (!passwordIsValid(password)) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (password !== confirmation) return setError('As senhas não são iguais.')
    void run(async () => { const hasSession = await account.signUp(name, email, password); if (!hasSession) setView('verify') })
  }
  return <div className="auth-shell">
    <aside className="auth-aside"><Logo /><div><span>PREÇO, CUSTO E CLAREZA</span><blockquote>“Decisões melhores começam quando cada número encontra seu lugar.”</blockquote><p>{cloudConfigured ? 'Sua conta sincronizada com Firebase.' : 'Modo demonstração disponível · configure o Firebase para contas reais'}</p></div></aside>
    <main className="auth-main">
      <div className="auth-mobile-logo"><Logo /></div>
      {(view === 'login' || view === 'signup') && <div className="auth-card">
        <span className="auth-kicker">{view === 'login' ? 'ACESSO À CONTA' : 'COMECE POR AQUI'}</span>
        <h1>{view === 'login' ? 'Bem-vindo de volta.' : 'Crie sua conta.'}</h1>
        <p>{view === 'login' ? 'Entre na sua conta e continue tomando decisões mais inteligentes.' : 'Organize seus preços e entenda o que realmente sobra em cada venda.'}</p>
        {view === 'signup' && <AuthInput label="Nome completo" value={name} onChange={setName} autoComplete="name" />}
        <AuthInput label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="voce@seunegocio.com.br" />
        <AuthInput label="Senha" type="password" value={password} onChange={setPassword} autoComplete={view === 'login' ? 'current-password' : 'new-password'} />
        {view === 'signup' && <><PasswordMeter password={password} confirmation={confirmation} /><AuthInput label="Confirmar senha" type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" /></>}
        {view === 'login' && <button className="forgot-link" onClick={() => setView('recover')}>Esqueceu sua senha?</button>}
        {(error || account.notice) && <div className="auth-error">{error || account.notice}</div>}
        <button className="primary auth-submit" disabled={loading} onClick={view === 'login' ? login : signup}>{loading ? <span className="spinner" /> : view === 'login' ? 'Entrar' : 'Criar minha conta'}</button>
        {view === 'login' && <button className="demo-access" onClick={account.enterDemo}>Explorar a demonstração sem cadastro</button>}
        <div className="auth-divider"><span>ou</span></div>
        <GoogleButton label={view === 'login' ? 'Continuar com Google' : 'Cadastrar com Google'} onClick={() => void run(account.signInGoogle)} />
        <p className="auth-switch">{view === 'login' ? 'Ainda não tem uma conta?' : 'Já possui uma conta?'} <button onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError('') }}>{view === 'login' ? 'Cadastre-se' : 'Voltar ao login'}</button></p>
      </div>}
      {view === 'verify' && <AuthStatus icon="mail" title="Confirme seu e-mail." description={<>Enviamos um link para <strong>{email}</strong>. Verifique a caixa de entrada e o spam antes de entrar.</>} note="Para reenviar o link, tente fazer login com e-mail e senha. Contas não confirmadas recebem nova solicitação, respeitando os limites do Firebase." action={<button className="primary auth-submit" onClick={() => setView('login')}>Ir para o login</button>} back={() => setView('login')} />}
      {view === 'recover' && <div className="auth-card wide"><span className="auth-kicker">RECUPERAÇÃO DE CONTA</span><h1>Vamos recuperar seu acesso.</h1><p>Use o e-mail cadastrado. O serviço não revela se o endereço pertence a uma conta.</p><div className="recovery-options"><button onClick={() => setView('recover-email')}><Icon name="mail" size={25}/><strong>Recuperar por e-mail</strong><span>Receba um link seguro no endereço cadastrado.</span><Icon name="arrow"/></button><button disabled title="Requer plano Blaze e serviço de SMS" className="disabled" onClick={() => undefined}><Icon name="phone" size={25}/><strong>Recuperar por SMS</strong><span>Indisponível no plano Spark gratuito. Requer cobrança por SMS.</span><Icon name="arrow"/></button></div><button className="back-link" onClick={() => setView('login')}>Voltar ao login</button></div>}
      {view === 'recover-email' && <div className="auth-card">
        <span className="auth-kicker">RECUPERAÇÃO SEGURA</span><h1>Recuperar por e-mail.</h1>
        <p>{sent ? 'Se o endereço corresponder a uma conta, você receberá um link. Abra-o para criar uma nova senha.' : 'Informe o e-mail cadastrado para receber um link de recuperação.'}</p>
        {!sent && <AuthInput label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@exemplo.com" />}
        {error && <div className="auth-error">{error}</div>}
        {!sent && <button className="primary auth-submit" disabled={loading} onClick={() => { if (!validEmail) return setError('Digite um e-mail válido.'); void run(async () => { await account.requestEmailReset(email); setSent(true) }) }}>{loading ? 'Enviando...' : 'Enviar instruções'}</button>}
        <button className="back-link" onClick={() => setView('login')}>Voltar ao login</button>
      </div>}
      {view === 'new-password' && <div className="auth-card auth-action-card">
        <span className="auth-kicker">SEGURANÇA DA CONTA / 01</span>
        {linkStatus === 'checking' ? <AuthStatus icon="lock" title="Conferindo seu link." description="Estamos validando a solicitação de redefinição de senha." note="Esse processo pode levar alguns instantes." action={<div className="action-progress" role="status">Verificando segurança do link…</div>} back={backToLogin} />
        : linkStatus === 'invalid' ? <AuthStatus icon="lock" title="Este link não é mais válido." description="O link expirou ou já foi utilizado. Solicite um novo e-mail para recuperar seu acesso." note={error || 'Por segurança, os links de recuperação são de uso único.'} action={<button className="primary auth-submit" onClick={() => { window.history.replaceState(null, '', '/'); setView('recover-email') }}>Solicitar outro link</button>} back={backToLogin} />
        : <>
          <h1>Escolha uma nova senha.</h1>
          <p>Proteja sua conta com uma senha de pelo menos 8 caracteres. Use algo que você ainda não tenha utilizado.</p>
          {linkEmail && <p className="action-account-hint"><Icon name="mail" size={16}/> Conta: <strong>{linkEmail}</strong></p>}
          <AuthInput label="Nova senha" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordMeter password={password} confirmation={confirmation} />
          <AuthInput label="Confirme a nova senha" type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="primary auth-submit" disabled={loading || !passwordIsValid(password) || password !== confirmation} onClick={() => {
            void run(async () => {
              await account.completeEmailReset(actionCode, password)
              window.history.replaceState(null, '', '/')
              setPassword(''); setConfirmation(''); setCompletedAction('resetPassword'); setView('action-result')
            })
          }}>{loading ? 'Salvando...' : 'Salvar nova senha'}</button>
          <button className="back-link" onClick={backToLogin}>Voltar ao login</button>
        </>}
      </div>}
      {view === 'verify-email' && <div className="auth-card auth-action-card">
        <span className="auth-kicker">VERIFICAÇÃO DE E-MAIL</span>
        {linkStatus === 'invalid' || !actionCode ? <AuthStatus icon="mail" title="Não foi possível confirmar." description="O link de verificação expirou ou já foi utilizado." note={error || 'Faça login novamente para solicitar uma nova mensagem de verificação.'} action={<button className="primary auth-submit" onClick={backToLogin}>Voltar ao login</button>} back={backToLogin} /> : <AuthStatus icon="mail" title="Confirmando seu e-mail." description="Estamos validando seu endereço para liberar o acesso à conta." note="Não é necessário fazer mais nada nesta tela." action={<div className="action-progress" role="status">Validando seu e-mail…</div>} back={backToLogin}/>}
      </div>}
      {view === 'recover-email-action' && <div className="auth-card auth-action-card">
        <span className="auth-kicker">SEGURANÇA DA CONTA</span>
        <h1>Restaurar e-mail anterior.</h1>
        <p>Este link solicita reverter uma alteração do endereço de e-mail. Confirme apenas se você reconhece esta solicitação.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {!actionCode && <div className="auth-error">Link inválido ou incompleto.</div>}
        <button className="primary auth-submit" disabled={loading || !actionCode} onClick={() => void run(async () => {
          await account.finishEmailAction(actionCode, 'recoverEmail')
          window.history.replaceState(null, '', '/')
          setCompletedAction('recoverEmail'); setView('action-result')
        })}>{loading ? 'Verificando...' : 'Restaurar meu e-mail'}</button>
        <button className="back-link" onClick={backToLogin}>Voltar ao login</button>
      </div>}
      {view === 'action-result' && <AuthStatus icon="check" title={completedAction === 'verifyEmail' ? 'E-mail confirmado!' : completedAction === 'resetPassword' ? 'Senha atualizada!' : 'E-mail restaurado!'} description={completedAction === 'verifyEmail' ? 'Seu endereço foi verificado. Agora você pode entrar e continuar usando o PreçoCerto.' : completedAction === 'resetPassword' ? 'Sua nova senha foi salva com segurança. Você já pode entrar usando ela.' : 'Seu endereço anterior foi recuperado.'} note="O PreçoCerto nunca solicita sua senha por e-mail ou SMS." action={<button className="primary auth-submit" onClick={backToLogin}>Ir para o login</button>} back={backToLogin} />}

    </main>
  </div>
}

function AuthStatus({ icon, title, description, note, action, back }: { icon: string; title: string; description: React.ReactNode; note: string; action: React.ReactNode; back: () => void }) {
  return <div className="auth-card auth-status"><span className="status-icon"><Icon name={icon} size={29}/></span><h1>{title}</h1><p>{description}</p><div className="auth-info">{note}</div>{action}<button className="back-link" onClick={back}>Voltar ao login</button></div>
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
      <div className="profile-form">
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
          <button className="secondary" disabled={busy} onClick={() => { setDraft(user); setSelectedFile(null); setError(''); setEditing(false) }}>Cancelar</button>
          <button className="primary" disabled={busy} onClick={() => void submit()}>{busy ? 'Salvando...' : 'Salvar alterações'}</button>
        </div>}
      </div>
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
    {dialog === 'password' && <div className="modal-backdrop"><div className="modal"><header><div><span>SEGURANÇA</span><h2>Alterar senha</h2></div><button aria-label="Fechar" onClick={close}><Icon name="close"/></button></header>
      <div className="modal-fields"><label className="full">Senha atual<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></label><label className="full">Nova senha<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)}/></label><div className="full"><PasswordMeter password={newPassword} confirmation={confirmPassword}/></div><label className="full">Confirmar nova senha<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/></label></div>
      {error && <div className="auth-error">{error}</div>}
      <footer><button className="secondary" disabled={busy} onClick={close}>Cancelar</button><button className="primary" disabled={busy} onClick={() => {
        if (!passwordIsValid(newPassword)) return setError('A senha precisa ter pelo menos 8 caracteres.')
        if (newPassword !== confirmPassword) return setError('Confirmação diferente da nova senha.')
        void act(async () => { await account.changePassword(currentPassword, newPassword); close(); notify('Senha alterada com sucesso') })
      }}>{busy ? 'Atualizando…' : 'Atualizar senha'}</button></footer></div></div>}
  </div>
}

export default App
