import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = (name: string) => readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8')
const auth = source('components/AuthExperience.tsx')
const app = source('AuthenticatedApp.tsx')
const css = source('index.css')

test('login e cadastro enviam pelo formulário nativo com Enter', () => {
  assert.match(auth, /<form className="auth-card" noValidate onSubmit=/)
  assert.match(auth, /if \(!loading\) \(view === 'login' \? login : signup\)\(\)/)
  assert.match(auth, /<button type="submit" className="primary auth-submit" disabled=\{loading\}/)
})

test('botões auxiliares do login não provocam envio', () => {
  assert.match(auth, /<button type="button" className="forgot-link"/)
  assert.match(auth, /<button type="button" className="demo-access"/)
  assert.match(auth, /<p className="auth-switch">[\s\S]*?<button type="button"/)
})

test('recuperação de senha e ações de email têm envio por Enter', () => {
  assert.match(auth, /view === 'recover-email' && <form/)
  assert.match(auth, /<form noValidate onSubmit=\{e => \{ e.preventDefault\(\); saveNewPassword\(\) \}\}>/)
  assert.match(auth, /view === 'recover-email-action' && <form/)
})

test('produto e perfil de taxas são salvos como formulários', () => {
  assert.match(app, /function ProductModal[\s\S]*?<form className="modal"[^>]+onSubmit=/)
  assert.match(app, /function ProfileModal[\s\S]*?<form className="modal"[^>]+onSubmit=/)
  assert.match(app, /<button type="submit" className="primary">Salvar produto<\/button>/)
  assert.match(app, /<button type="submit" className="primary" disabled=\{!form.name.trim\(\)\}>Salvar perfil/)
})

test('meu perfil e alteração de senha aceitam Enter e evitam salvamento simultâneo', () => {
  assert.match(app, /<form className="profile-form" onSubmit=/)
  assert.match(app, /if \(editing && !busy\) void submit\(\)/)
  assert.match(app, /<form className="modal" onSubmit=\{e => \{ e.preventDefault\(\); submitPassword\(\) \}\}>/)
  assert.match(app, /const submitPassword = \(\) => \{\s+if \(busy\) return/)
})

test('avatar usa boneco padrão para foto vazia e trata imagem quebrada', () => {
  assert.match(app, /const \[failedSrc, setFailedSrc\] = useState\(''\)/)
  assert.match(app, /const hasPhoto = Boolean\(photo && photo !== failedSrc\)/)
  assert.match(app, /onError=\{\(\) => setFailedSrc\(photo\)\}/)
  assert.match(app, /<Icon name="user" size=\{large \? 48 : 19\}/)
  assert.match(css, /\.avatar svg/)
})
