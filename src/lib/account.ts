import { useEffect, useState } from 'react'
import {
  EmailAuthProvider, GoogleAuthProvider, applyActionCode, checkActionCode,
  confirmPasswordReset, createUserWithEmailAndPassword,
  linkWithPopup, onAuthStateChanged, reauthenticateWithCredential,
  reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut as firebaseSignOut, updatePassword as firebaseUpdatePassword,
  updateProfile, verifyPasswordResetCode, type User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, firebaseError } from './firebase'
import { phoneToE164 } from './phone'

export type AccountUser = {
  id?: string
  name: string
  email: string
  phone: string
  avatar?: string
  avatarPosition?: number
  avatarPositionX?: number
  avatarZoom?: number
  createdAt: string
  emailVerified?: boolean
  phoneVerified?: boolean
  googleConnected?: boolean
}

export const demoUser: AccountUser = {
  name: 'Marina Rocha', email: 'marina@exemplo.com', phone: '', createdAt: '24 de julho de 2024',
}

const demoStorage = 'precocerto:demo-user'
function getDemoUser(): AccountUser {
  try {
    const saved = localStorage.getItem(demoStorage)
    const parsed = saved ? JSON.parse(saved) as Partial<AccountUser> : {}
    return { ...demoUser, ...parsed, id: undefined, emailVerified: false, phoneVerified: false, googleConnected: false }
  } catch { return demoUser }
}

type ProfileDocument = {
  name?: string
  phone?: string
  avatar?: string
  avatarPosition?: number
  avatarPositionX?: number
  avatarZoom?: number
}

function dateLabel(date: string | undefined) {
  const parsed = new Date(date || '')
  return Number.isNaN(parsed.getTime()) ? 'data não disponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(parsed)
}

function fromAuth(firebaseUser: FirebaseUser, profile?: ProfileDocument): AccountUser {
  return {
    id: firebaseUser.uid,
    name: profile?.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
    email: firebaseUser.email || '',
    phone: profile?.phone || '',
    avatar: profile?.avatar !== undefined ? profile.avatar || undefined : firebaseUser.photoURL || undefined,
    avatarPosition: profile?.avatarPosition ?? 50,
    avatarPositionX: profile?.avatarPositionX ?? 50,
    avatarZoom: profile?.avatarZoom ?? 100,
    createdAt: dateLabel(firebaseUser.metadata.creationTime),
    emailVerified: firebaseUser.emailVerified,
    phoneVerified: false, // Spark não envia nem valida SMS.
    googleConnected: firebaseUser.providerData.some(provider => provider.providerId === 'google.com'),
  }
}

async function loadAccount(firebaseUser: FirebaseUser): Promise<AccountUser> {
  if (!db) throw new Error('O banco de dados ainda não foi configurado.')
  const snapshot = await getDoc(doc(db, 'users', firebaseUser.uid, 'data', 'profile'))
  return fromAuth(firebaseUser, snapshot.exists() ? snapshot.data() as ProfileDocument : undefined)
}

function requireCloud() {
  if (!auth || !db) throw new Error('Configure o Firebase para criar e acessar contas reais. A demonstração continua disponível.')
  return { client: auth, database: db }
}

async function shrinkPhoto(file: File): Promise<string> {
  if (file.size > 3 * 1024 * 1024) throw new Error('Escolha uma imagem de até 3 MB.')
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use uma imagem PNG, JPG ou WebP.')
  const bitmap = await createImageBitmap(file)
  try {
    // Um avatar reduzido no perfil evita Firebase Storage, que requer faturamento.
    const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('O navegador não conseguiu preparar a imagem.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.8, 0.65, 0.45]) {
      const photo = canvas.toDataURL('image/webp', quality)
      if (photo.length < 240_000) return photo
    }
    throw new Error('Esta imagem não pôde ser reduzida o suficiente. Escolha outra foto.')
  } finally { bitmap.close() }
}

export function useAccount() {
  const [status, setStatus] = useState<'loading' | 'signedOut' | 'demo' | 'cloud'>('loading')
  const [user, setUser] = useState<AccountUser>(getDemoUser)
  const [notice, setNotice] = useState('')
  const [authRecovery, setAuthRecovery] = useState(false)
  const [pendingPhone] = useState('')

  useEffect(() => {
    if (!auth) { setStatus('signedOut'); return }
    let current = true
    let revision = 0
    const unsubscribe = onAuthStateChanged(auth, firebaseUser => {
      const currentRevision = ++revision
      if (!firebaseUser || !firebaseUser.emailVerified) {
        setStatus('signedOut')
        return
      }
      void loadAccount(firebaseUser).then(account => {
        if (!current || revision !== currentRevision || auth?.currentUser?.uid !== firebaseUser.uid) return
        setUser(account)
        setNotice('')
        setStatus('cloud')
      }).catch(error => {
        if (!current || revision !== currentRevision) return
        setNotice(`Não foi possível abrir sua conta: ${firebaseError(error)}`)
        setStatus('signedOut')
      })
    })
    return () => { current = false; unsubscribe() }
  }, [])

  async function signIn(email: string, password: string) {
    const { client } = requireCloud()
    try {
      const credential = await signInWithEmailAndPassword(client, email.trim(), password)
      await reload(credential.user)
      if (!credential.user.emailVerified) {
        let feedback = 'Confirme o e-mail antes de entrar. Enviamos uma nova mensagem de verificação.'
        try { await sendEmailVerification(credential.user) }
        catch { feedback = 'Confirme o e-mail antes de entrar. Se não recebeu o link, aguarde alguns minutos e tente novamente.' }
        await firebaseSignOut(client)
        throw new Error(feedback)
      }
      // A confirmação pode ter ocorrido desde a última sessão; força um token novo
      // antes de consultar o Firestore, cujas regras exigem e-mail verificado.
      await credential.user.getIdToken(true)
      setUser(await loadAccount(credential.user))
      setNotice('')
      setStatus('cloud')
    } catch (error) { throw new Error(firebaseError(error)) }
  }

  async function signUp(name: string, email: string, password: string) {
    const { client } = requireCloud()
    try {
      const credential = await createUserWithEmailAndPassword(client, email.trim(), password)
      try {
        await updateProfile(credential.user, { displayName: name.trim() })
        await sendEmailVerification(credential.user)
      } finally {
        await firebaseSignOut(client)
      }
      return false // Só entra depois de confirmar e-mail.
    } catch (error) { throw new Error(firebaseError(error)) }
  }

  async function signInGoogle() {
    const { client } = requireCloud()
    try { await signInWithPopup(client, new GoogleAuthProvider()) }
    catch (error) { throw new Error(firebaseError(error)) }
  }

  async function signOut() {
    if (status === 'demo') { setStatus('signedOut'); return }
    if (auth) await firebaseSignOut(auth)
    setStatus('signedOut')
  }

  async function saveAccount(changes: Pick<AccountUser, 'name' | 'phone' | 'avatar' | 'avatarPosition' | 'avatarPositionX' | 'avatarZoom'>) {
    if (!changes.name.trim()) throw new Error('Informe seu nome completo.')
    const phone = changes.phone.trim() ? phoneToE164(changes.phone) || '' : ''
    if (changes.phone.trim() && !phone) throw new Error('Informe um telefone completo com DDD.')
    if (status === 'demo') {
      const changed = { ...user, ...changes }
      localStorage.setItem(demoStorage, JSON.stringify(changed))
      setUser(changed)
      return
    }
    const { client, database } = requireCloud()
    const signedUser = client.currentUser
    if (!signedUser || !signedUser.emailVerified) throw new Error('Faça login antes de editar seu perfil.')
    const profile: ProfileDocument = {
      name: changes.name.trim(), phone,
      avatar: changes.avatar || '',
      avatarPosition: changes.avatarPosition ?? 50,
      avatarPositionX: changes.avatarPositionX ?? 50,
      avatarZoom: changes.avatarZoom ?? 100,
    }
    try {
      await setDoc(doc(database, 'users', signedUser.uid, 'data', 'profile'), profile)
      await updateProfile(signedUser, { displayName: profile.name || '' })
      setUser(fromAuth(signedUser, profile))
    } catch (error) { throw new Error(firebaseError(error)) }
  }

  async function uploadAvatar(file: File) { return shrinkPhoto(file) }

  async function requestEmailReset(email: string) {
    const { client } = requireCloud()
    try { await sendPasswordResetEmail(client, email.trim()) }
    catch (error) { throw new Error(firebaseError(error)) }
  }

  async function checkEmailResetCode(code: string): Promise<string> {
    const { client } = requireCloud()
    try { return await verifyPasswordResetCode(client, code) }
    catch (error) { throw new Error(firebaseError(error)) }
  }

  async function completeEmailReset(code: string, next: string) {
    const { client } = requireCloud()
    try {
      await verifyPasswordResetCode(client, code)
      await confirmPasswordReset(client, code, next)
    } catch (error) { throw new Error(firebaseError(error)) }
  }

  async function finishEmailAction(code: string, type: 'verifyEmail' | 'recoverEmail') {
    const { client } = requireCloud()
    try {
      const verified = await checkActionCode(client, code)
      if (type === 'verifyEmail' && verified.operation !== 'VERIFY_EMAIL') throw new Error('Este link não serve para verificar e-mail.')
      if (type === 'recoverEmail' && verified.operation !== 'RECOVER_EMAIL') throw new Error('Este link não serve para recuperar e-mail.')
      await applyActionCode(client, code)
    } catch (error) { throw new Error(firebaseError(error)) }
  }

  async function resendConfirmation() {
    const { client } = requireCloud()
    if (!client.currentUser) throw new Error('Volte ao login, digite e-mail e senha. Um novo link será enviado se a conta não estiver confirmada.')
    try { await sendEmailVerification(client.currentUser) }
    catch (error) { throw new Error(firebaseError(error)) }
  }

  async function changePassword(current: string, next: string) {
    const { client } = requireCloud()
    const firebaseUser = client.currentUser
    if (!firebaseUser?.email) throw new Error('Faça login para alterar a senha.')
    if (!firebaseUser.providerData.some(p => p.providerId === 'password')) throw new Error('Esta conta usa o Google. Altere sua senha diretamente na conta Google.')
    try {
      await reauthenticateWithCredential(firebaseUser, EmailAuthProvider.credential(firebaseUser.email, current))
      await firebaseUpdatePassword(firebaseUser, next)
    } catch (error) { throw new Error(firebaseError(error)) }
  }

  async function linkGoogle() {
    const { client } = requireCloud()
    if (!client.currentUser) throw new Error('Faça login primeiro.')
    try {
      await linkWithPopup(client.currentUser, new GoogleAuthProvider())
      setUser(await loadAccount(client.currentUser))
    } catch (error) { throw new Error(firebaseError(error)) }
  }

  return {
    status, user, notice, authRecovery, setAuthRecovery, pendingPhone,
    enterDemo: () => { setUser(getDemoUser()); setStatus('demo') },
    signIn, signUp, signInGoogle, signOut, saveAccount, uploadAvatar,
    requestEmailReset, checkEmailResetCode, completeEmailReset, finishEmailAction, resendConfirmation, changePassword, linkGoogle,
  }
}
