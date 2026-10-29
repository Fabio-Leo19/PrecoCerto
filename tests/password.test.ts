import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordIsValid, passwordScore } from '../src/lib/password.ts'

test('o único bloqueio obrigatório é comprimento mínimo de 8 caracteres', () => {
  assert.equal(passwordIsValid('abc1234'), false)
  assert.equal(passwordIsValid('abcdefgh'), true)
  assert.equal(passwordIsValid('Abc123!x'), true)
})

test('a força orienta sem impor tipos de caracteres', () => {
  assert.equal(passwordScore(''), 0)
  assert.equal(passwordScore('abcdefgh'), 1)
  assert.equal(passwordScore('Abc123!x'), 2)
  assert.equal(passwordScore('MuitoLonga123!'), 3)
})
