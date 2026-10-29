import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEmailActionQuery } from '../src/lib/emailActions.ts'

test('interpreta links de verificacao do Firebase', () => {
  assert.deepEqual(parseEmailActionQuery('?mode=verifyEmail&oobCode=ABC123&apiKey=xyz'), { mode: 'verifyEmail', code: 'ABC123' })
})
test('aceita recuperacao de senha e de e-mail', () => {
  assert.equal(parseEmailActionQuery('?mode=resetPassword&oobCode=CODE').mode, 'resetPassword')
  assert.equal(parseEmailActionQuery('?mode=recoverEmail&oobCode=CODE').mode, 'recoverEmail')
})
test('rejeita codigo ausente e modalidades desconhecidas', () => {
  assert.deepEqual(parseEmailActionQuery('?mode=resetPassword'), { mode: null, code: '' })
  assert.deepEqual(parseEmailActionQuery('?mode=deleteAccount&oobCode=CODE'), { mode: null, code: '' })
  assert.deepEqual(parseEmailActionQuery(''), { mode: null, code: '' })
})
