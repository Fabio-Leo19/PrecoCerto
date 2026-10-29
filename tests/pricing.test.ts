import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePricing, checkPricing, type PricingInputs } from '../src/lib/pricing.ts'

const base: PricingInputs = {
  cost: 28.4, package: 3.2, freight: 7.5, operational: 4,
  fee: 3.5, commission: 12, tax: 4, discount: 0, desiredProfit: 18,
}

test('lucro, margem e preço de equilíbrio são consistentes', () => {
  const result = calculatePricing(base, 79.9)
  assert.equal(result.profit, 20.52)
  assert.equal(result.baseCosts, 46.6)
  assert.equal(result.breakEven, 55.48)
  assert.equal(result.suggested, 76.91)
  assert.ok(calculatePricing(base, result.suggested!).profit >= base.desiredProfit)
})

test('desconto aumenta o preço necessário, sem alterar custos por unidade', () => {
  const input = { ...base, discount: 10 }
  const result = calculatePricing(input, 79.9)
  assert.equal(result.revenue, 69.9)
  assert.equal(result.breakEven, 65.48)
  assert.equal(result.suggested, 86.91)
})

test('100% de taxas impossibilita preço-alvo', () => {
  const input = { ...base, tax: 88 }
  const result = calculatePricing(input, 79.9)
  assert.equal(result.breakEven, null)
  assert.equal(result.suggested, null)
  assert.ok(checkPricing(input, 79.9).length > 0)
})

test('venda abaixo do custo produz prejuízo', () => {
  const result = calculatePricing(base, 20)
  assert.ok(result.profit < 0)
  assert.ok(result.margin < 0)
})
