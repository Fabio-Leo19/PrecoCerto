import { passwordScore } from '../lib/password'
export function PasswordMeter({ password, confirmation }: { password: string; confirmation?: string }) {
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
