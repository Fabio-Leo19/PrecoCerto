import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Estas chaves identificam o projeto web e são públicas por definição.
// A segurança dos dados vem das regras do Firestore + Firebase Auth.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const cloudConfigured = Object.values(config).every(value => typeof value === 'string' && value.trim().length > 0)
const app = cloudConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null

export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
if (auth) auth.languageCode = 'pt-BR'

export function firebaseError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Digite um endereço de e-mail válido.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.',
    'auth/weak-password': 'A senha precisa ser mais forte.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Não foi possível conectar. Confira sua internet.',
    'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Permita pop-ups.',
    'auth/operation-not-allowed': 'Habilite este tipo de login no Console do Firebase.',
    'auth/unauthorized-domain': 'Autorize o domínio deste site nas configurações de Authentication do Firebase.',
    'auth/requires-recent-login': 'Por segurança, saia e entre novamente antes de mudar a senha.',
    'auth/invalid-action-code': 'O link já foi utilizado ou é inválido. Solicite um novo.',
    'auth/expired-action-code': 'Este link expirou. Solicite um novo.',
    'auth/provider-already-linked': 'O Google já está vinculado a esta conta.',
    'auth/credential-already-in-use': 'Esta conta Google já está vinculada a outro usuário.',
    'auth/account-exists-with-different-credential': 'Este e-mail já pertence a outra forma de login. Entre usando o método original.',
    'permission-denied': 'Acesso negado. Confira as regras do Firestore e a conta usada.',
    'unavailable': 'Serviço temporariamente indisponível. Tente novamente.',
    'resource-exhausted': 'O limite gratuito de operações foi atingido. Aguarde a renovação da cota.',
  }
  return messages[code] || (error instanceof Error ? error.message : 'Ocorreu um erro inesperado.')
}
