import { Suspense, lazy, useState } from 'react'
import { useAccount } from './lib/account'
import { parseEmailActionQuery } from './lib/emailActions'
import type { AuthView } from './components/AuthExperience'

const AuthExperience = lazy(() => import('./components/AuthExperience'))
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'))

export default function App() {
  const account = useAccount()
  const [authView, setAuthView] = useState<AuthView>(() => {
    const action = parseEmailActionQuery(window.location.search)
    if (action.mode === 'resetPassword') return 'new-password'
    if (action.mode === 'verifyEmail') return 'verify-email'
    if (action.mode === 'recoverEmail') return 'recover-email-action'
    return 'login'
  })
  const actionCode = parseEmailActionQuery(window.location.search).code

  if (account.status === 'loading') return <div className="loading-screen">Abrindo PreçoCerto…</div>

  return <Suspense fallback={<div className="loading-screen">Carregando…</div>}>
    {account.status === 'signedOut' || account.authRecovery || actionCode || authView === 'action-result'
      ? <AuthExperience view={authView} setView={setAuthView} account={account} actionCode={actionCode} />
      : <AuthenticatedApp account={account} setAuthView={setAuthView} />}
  </Suspense>
}
