import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import { useAccount } from '../lib/account'
import { passwordIsValid } from '../lib/password'
import { PasswordMeter } from './PasswordMeter'
import { Logo, Icon } from './UiShared'
import { cloudConfigured } from '../lib/firebase'

export type AuthView = 'login' | 'signup' | 'verify' | 'recover' | 'recover-email' | 'new-password' | 'verify-email' | 'recover-email-action' | 'action-result'

function AuthInput({ label, type = 'text', value, onChange, error, autoComplete, placeholder }: { label: string; type?: string; value: string; onChange: (v: string) => void; error?: string; autoComplete?: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false)
  const password = type === 'password'
  return <label className={`auth-field ${error ? 'invalid' : ''}`}><span>{label}</span><div><input type={password && visible ? 'text' : type} value={value} autoComplete={autoComplete} placeholder={placeholder} onChange={e => onChange(e.target.value)} />{password && <button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)}><Icon name="eye" /></button>}</div>{error && <small>{error}</small>}</label>
}

function GoogleButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="google-button" onClick={onClick}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.7h3.4c2-1.8 3.1-4.5 3.1-7.7Z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.7c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.8A10.4 10.4 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.2 13.5a6.2 6.2 0 0 1 0-4V6.7H2.7a10.3 10.3 0 0 0 0 9.6l3.5-2.8Z"/><path fill="#EA4335" d="M12 5.2c1.5 0 3 .5 4 1.6l3-3A10 10 0 0 0 2.7 6.7l3.5 2.8C7 7 9.3 5.2 12 5.2Z"/></svg>{label}</button>
}

export default function AuthExperience({ view, setView, account, actionCode }: { view: AuthView; setView: (v: AuthView) => void; account: ReturnType<typeof useAccount>; actionCode: string }) {
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
  const sendReset = () => {
    if (!validEmail) return setError('Digite um e-mail válido.')
    void run(async () => { await account.requestEmailReset(email); setSent(true) })
  }
  const saveNewPassword = () => {
    if (loading || !passwordIsValid(password) || password !== confirmation) return
    void run(async () => {
      await account.completeEmailReset(actionCode, password)
      window.history.replaceState(null, '', '/')
      setPassword(''); setConfirmation(''); setCompletedAction('resetPassword'); setView('action-result')
    })
  }
  const restoreEmail = () => {
    if (loading || !actionCode) return
    void run(async () => {
      await account.finishEmailAction(actionCode, 'recoverEmail')
      window.history.replaceState(null, '', '/')
      setCompletedAction('recoverEmail'); setView('action-result')
    })
  }
  return <div className="auth-shell">
    <aside className="auth-aside"><Logo /><div><span>PREÇO, CUSTO E CLAREZA</span><blockquote>“Decisões melhores começam quando cada número encontra seu lugar.”</blockquote><p>{cloudConfigured ? 'Sua conta sincronizada com Firebase.' : 'Modo demonstração disponível · configure o Firebase para contas reais'}</p></div></aside>
    <main className="auth-main">
      <div className="auth-mobile-logo"><Logo /></div>
      {(view === 'login' || view === 'signup') && <form className="auth-card" noValidate onSubmit={e => { e.preventDefault(); if (!loading) (view === 'login' ? login : signup)() }}>
        <span className="auth-kicker">{view === 'login' ? 'ACESSO À CONTA' : 'COMECE POR AQUI'}</span>
        <h1>{view === 'login' ? 'Bem-vindo de volta.' : 'Crie sua conta.'}</h1>
        <p>{view === 'login' ? 'Entre na sua conta e continue tomando decisões mais inteligentes.' : 'Organize seus preços e entenda o que realmente sobra em cada venda.'}</p>
        {view === 'signup' && <AuthInput label="Nome completo" value={name} onChange={setName} autoComplete="name" />}
        <AuthInput label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="voce@seunegocio.com.br" />
        <AuthInput label="Senha" type="password" value={password} onChange={setPassword} autoComplete={view === 'login' ? 'current-password' : 'new-password'} />
        {view === 'signup' && <><PasswordMeter password={password} confirmation={confirmation} /><AuthInput label="Confirmar senha" type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" /></>}
        {view === 'login' && <button type="button" className="forgot-link" onClick={() => setView('recover')}>Esqueceu sua senha?</button>}
        {(error || account.notice) && <div className="auth-error">{error || account.notice}</div>}
        <button type="submit" className="primary auth-submit" disabled={loading}>{loading ? <span className="spinner" /> : view === 'login' ? 'Entrar' : 'Criar minha conta'}</button>
        {view === 'login' && <button type="button" className="demo-access" onClick={account.enterDemo}>Explorar a demonstração sem cadastro</button>}
        <div className="auth-divider"><span>ou</span></div>
        <GoogleButton label={view === 'login' ? 'Continuar com Google' : 'Cadastrar com Google'} onClick={() => void run(account.signInGoogle)} />
        <p className="auth-switch">{view === 'login' ? 'Ainda não tem uma conta?' : 'Já possui uma conta?'} <button type="button" onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError('') }}>{view === 'login' ? 'Cadastre-se' : 'Voltar ao login'}</button></p>
      </form>}
      {view === 'verify' && <AuthStatus icon="mail" title="Confirme seu e-mail." description={<>Enviamos um link para <strong>{email}</strong>. Verifique a caixa de entrada e o spam antes de entrar.</>} note="Para reenviar o link, tente fazer login com e-mail e senha. Contas não confirmadas recebem nova solicitação, respeitando os limites do Firebase." action={<button className="primary auth-submit" onClick={() => setView('login')}>Ir para o login</button>} back={() => setView('login')} />}
      {view === 'recover' && <div className="auth-card wide"><span className="auth-kicker">RECUPERAÇÃO DE CONTA</span><h1>Vamos recuperar seu acesso.</h1><p>Use o e-mail cadastrado. O serviço não revela se o endereço pertence a uma conta.</p><div className="recovery-options"><button onClick={() => setView('recover-email')}><Icon name="mail" size={25}/><strong>Recuperar por e-mail</strong><span>Receba um link seguro no endereço cadastrado.</span><Icon name="arrow"/></button><button disabled title="Requer plano Blaze e serviço de SMS" className="disabled" onClick={() => undefined}><Icon name="phone" size={25}/><strong>Recuperar por SMS</strong><span>Indisponível no plano Spark gratuito. Requer cobrança por SMS.</span><Icon name="arrow"/></button></div><button className="back-link" onClick={() => setView('login')}>Voltar ao login</button></div>}
      {view === 'recover-email' && <form className="auth-card" noValidate onSubmit={e => { e.preventDefault(); if (!loading && !sent) sendReset() }}>
        <span className="auth-kicker">RECUPERAÇÃO SEGURA</span><h1>Recuperar por e-mail.</h1>
        <p>{sent ? 'Se o endereço corresponder a uma conta, você receberá um link. Abra-o para criar uma nova senha.' : 'Informe o e-mail cadastrado para receber um link de recuperação.'}</p>
        {!sent && <AuthInput label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@exemplo.com" />}
        {error && <div className="auth-error">{error}</div>}
        {!sent && <button type="submit" className="primary auth-submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar instruções'}</button>}
        <button type="button" className="back-link" onClick={() => setView('login')}>Voltar ao login</button>
      </form>}
      {view === 'new-password' && <div className="auth-card auth-action-card">
        <span className="auth-kicker">SEGURANÇA DA CONTA / 01</span>
        {linkStatus === 'checking' ? <AuthStatus icon="lock" title="Conferindo seu link." description="Estamos validando a solicitação de redefinição de senha." note="Esse processo pode levar alguns instantes." action={<div className="action-progress" role="status">Verificando segurança do link…</div>} back={backToLogin} />
        : linkStatus === 'invalid' ? <AuthStatus icon="lock" title="Este link não é mais válido." description="O link expirou ou já foi utilizado. Solicite um novo e-mail para recuperar seu acesso." note={error || 'Por segurança, os links de recuperação são de uso único.'} action={<button className="primary auth-submit" onClick={() => { window.history.replaceState(null, '', '/'); setView('recover-email') }}>Solicitar outro link</button>} back={backToLogin} />
        : <form noValidate onSubmit={e => { e.preventDefault(); saveNewPassword() }}>
          <h1>Escolha uma nova senha.</h1>
          <p>Proteja sua conta com uma senha de pelo menos 8 caracteres. Use algo que você ainda não tenha utilizado.</p>
          {linkEmail && <p className="action-account-hint"><Icon name="mail" size={16}/> Conta: <strong>{linkEmail}</strong></p>}
          <AuthInput label="Nova senha" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordMeter password={password} confirmation={confirmation} />
          <AuthInput label="Confirme a nova senha" type="password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="primary auth-submit" disabled={loading || !passwordIsValid(password) || password !== confirmation}>{loading ? 'Salvando...' : 'Salvar nova senha'}</button>
          <button type="button" className="back-link" onClick={backToLogin}>Voltar ao login</button>
        </form>}
      </div>}
      {view === 'verify-email' && <div className="auth-card auth-action-card">
        <span className="auth-kicker">VERIFICAÇÃO DE E-MAIL</span>
        {linkStatus === 'invalid' || !actionCode ? <AuthStatus icon="mail" title="Não foi possível confirmar." description="O link de verificação expirou ou já foi utilizado." note={error || 'Faça login novamente para solicitar uma nova mensagem de verificação.'} action={<button className="primary auth-submit" onClick={backToLogin}>Voltar ao login</button>} back={backToLogin} /> : <AuthStatus icon="mail" title="Confirmando seu e-mail." description="Estamos validando seu endereço para liberar o acesso à conta." note="Não é necessário fazer mais nada nesta tela." action={<div className="action-progress" role="status">Validando seu e-mail…</div>} back={backToLogin}/>}
      </div>}
      {view === 'recover-email-action' && <form className="auth-card auth-action-card" onSubmit={e => { e.preventDefault(); restoreEmail() }}>
        <span className="auth-kicker">SEGURANÇA DA CONTA</span>
        <h1>Restaurar e-mail anterior.</h1>
        <p>Este link solicita reverter uma alteração do endereço de e-mail. Confirme apenas se você reconhece esta solicitação.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {!actionCode && <div className="auth-error">Link inválido ou incompleto.</div>}
        <button type="submit" className="primary auth-submit" disabled={loading || !actionCode}>{loading ? 'Verificando...' : 'Restaurar meu e-mail'}</button>
        <button type="button" className="back-link" onClick={backToLogin}>Voltar ao login</button>
      </form>}
      {view === 'action-result' && <AuthStatus icon="check" title={completedAction === 'verifyEmail' ? 'E-mail confirmado!' : completedAction === 'resetPassword' ? 'Senha atualizada!' : 'E-mail restaurado!'} description={completedAction === 'verifyEmail' ? 'Seu endereço foi verificado. Agora você pode entrar e continuar usando o PreçoCerto.' : completedAction === 'resetPassword' ? 'Sua nova senha foi salva com segurança. Você já pode entrar usando ela.' : 'Seu endereço anterior foi recuperado.'} note="O PreçoCerto nunca solicita sua senha por e-mail ou SMS." action={<button className="primary auth-submit" onClick={backToLogin}>Ir para o login</button>} back={backToLogin} />}

    </main>
  </div>
}

function AuthStatus({ icon, title, description, note, action, back }: { icon: string; title: string; description: React.ReactNode; note: string; action: React.ReactNode; back: () => void }) {
  return <div className="auth-card auth-status"><span className="status-icon"><Icon name={icon} size={29}/></span><h1>{title}</h1><p>{description}</p><div className="auth-info">{note}</div>{action}<button className="back-link" onClick={back}>Voltar ao login</button></div>
}
