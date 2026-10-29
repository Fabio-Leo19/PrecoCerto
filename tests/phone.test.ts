import test from 'node:test'
import assert from 'node:assert/strict'
import { formatBrazilianPhone, phoneToE164 } from '../src/lib/phone.ts'

test('formata celular com DDD enquanto o usuário digita', () => {
  assert.equal(formatBrazilianPhone('11990407303'), '(11) 99040-7303')
  assert.equal(formatBrazilianPhone('11'), '(11')
  assert.equal(formatBrazilianPhone('119904'), '(11) 9904')
})

test('remove o DDI do Brasil e formata telefones antigos', () => {
  assert.equal(formatBrazilianPhone('551190407303'), '(11) 9040-7303')
  assert.equal(formatBrazilianPhone('+55 (11) 99040-7303'), '(11) 99040-7303')
})

test('converte números completos em E.164, rejeita parciais', () => {
  assert.equal(phoneToE164('(11) 99040-7303'), '+5511990407303')
  assert.equal(phoneToE164('(11) 9040-7303'), '+551190407303')
  assert.equal(phoneToE164('(11) 999'), null)
})
