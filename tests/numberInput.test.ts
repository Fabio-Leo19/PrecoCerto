import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeBrazilianNumberInput as normalize,
  numberFromBrazilianInput as parse,
  toEditableBrazilianNumber as editable,
  formatBrazilianNumber as format,
} from '../src/lib/numberInput.ts'

test('começar a digitar não preserva zero inicial', () => {
  assert.equal(normalize('025'), '25')
  assert.equal(normalize('00025'), '25')
  assert.equal(normalize('00'), '0')
  assert.equal(editable(0), '')
})

test('vírgula e centavos funcionam na digitação e no cálculo', () => {
  assert.equal(normalize('25,'), '25,')
  assert.equal(normalize('25,50'), '25,50')
  assert.equal(parse(normalize('25,50')), 25.5)
  assert.equal(normalize('0,05'), '0,05')
  assert.equal(parse(normalize('0,05')), .05)
  assert.equal(normalize('12.34'), '12,34')
})

test('colar valor monetário em pt-BR mantém milhares e centavos', () => {
  assert.equal(normalize('R$ 1.250,90'), '1250,90')
  assert.equal(parse(normalize('R$ 1.250,90')), 1250.9)
  assert.equal(normalize('1500,90'), '1500,90')
  assert.equal(format(1500.9), '1.500,90')
})

test('entrada vazia fica vazia e permite digitar novamente', () => {
  assert.equal(normalize(''), '')
  assert.equal(normalize('abcd'), '')
  assert.equal(parse(''), 0)
  assert.equal(format(0), '')
  assert.equal(normalize('0,00'), '0,00')
})

test('percentuais e valores existentes são exibidos em formato brasileiro', () => {
  assert.equal(format(12.5, 'percentage'), '12,5')
  assert.equal(format(12.5, 'currency'), '12,50')
  assert.equal(editable(79.9), '79,9')
  assert.equal(normalize('12,345'), '12,34')
})
