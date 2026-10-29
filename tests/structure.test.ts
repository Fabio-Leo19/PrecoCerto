import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const file = (relative: string) => readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8')

test('tela de login e tela interna são importadas sob demanda', () => {
  const root = file('src/App.tsx')
  assert.match(root, /lazy\(\(\) => import\('\.\/components\/AuthExperience'\)\)/)
  assert.match(root, /lazy\(\(\) => import\('\.\/AuthenticatedApp'\)\)/)
})

test('Firestore não é importado estaticamente pela tela de login', () => {
  const auth = file('src/lib/account.ts')
  const firebase = file('src/lib/firebase.ts')
  assert.doesNotMatch(auth, /^import .* from 'firebase\/firestore'/m)
  assert.doesNotMatch(firebase, /firebase\/firestore/)
  assert.match(auth, /import\('\.\/cloudDb'\)/)
})

test('Netlify protege respostas sem interferir nos provedores de login', () => {
  const netlify = file('netlify.toml')
  assert.match(netlify, /X-Content-Type-Options = "nosniff"/)
  assert.match(netlify, /X-Frame-Options = "DENY"/)
  assert.match(netlify, /Referrer-Policy/)
})
