// Trata apenas os parametros de acao enviados pelo Firebase Auth.
export type EmailActionMode = 'resetPassword' | 'verifyEmail' | 'recoverEmail'
export function parseEmailActionQuery(query: string): { mode: EmailActionMode | null; code: string } {
  const params = new URLSearchParams(query)
  const mode = params.get('mode')
  const code = params.get('oobCode')?.trim() || ''
  if (!code || (mode !== 'resetPassword' && mode !== 'verifyEmail' && mode !== 'recoverEmail')) {
    return { mode: null, code: '' }
  }
  return { mode, code }
}
