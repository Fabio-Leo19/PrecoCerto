/** Cálculos estimados por unidade, sem antecipar regras tributárias de marketplaces. */
export type PricingInputs = {
  cost: number
  package: number
  freight: number
  operational: number
  fee: number
  commission: number
  tax: number
  discount: number
  desiredProfit: number
}

export type PricingResult = {
  revenue: number
  percentageFees: number
  baseCosts: number
  profit: number
  margin: number
  breakEven: number | null
  suggested: number | null
}

const cents = (amount: number): number => Math.round((amount + Number.EPSILON) * 100) / 100
const minimumPrice = (amount: number): number => Math.ceil((amount - 1e-9) * 100) / 100

export function calculatePricing(input: PricingInputs, price: number): PricingResult {
  const salePrice = Number.isFinite(price) ? Math.max(0, price) : 0
  const discount = Math.max(0, input.discount)
  const revenue = cents(Math.max(0, salePrice - discount))
  const percentage = (input.commission + input.tax) / 100
  const percentageFees = cents(revenue * percentage)
  const baseCosts = cents(input.cost + input.package + input.freight + input.operational + input.fee)
  const profit = cents(revenue - percentageFees - baseCosts)
  const margin = revenue > 0 ? profit / revenue * 100 : 0
  const retainedFraction = 1 - percentage

  // P = desconto + (custos + lucro desejado) / (1 - taxas%)
  // Se 100% ou mais da receita é consumida por taxas, não há preço viável.
  const breakEven = retainedFraction > 0 ? minimumPrice(discount + baseCosts / retainedFraction) : null
  const suggested = retainedFraction > 0
    ? minimumPrice(discount + (baseCosts + input.desiredProfit) / retainedFraction)
    : null

  return { revenue, percentageFees, baseCosts, profit, margin, breakEven, suggested }
}

export function checkPricing(input: PricingInputs, price: number): string[] {
  const fields = Object.values(input)
  const errors: string[] = []
  if (!Number.isFinite(price) || price < 0 || fields.some(n => !Number.isFinite(n) || n < 0)) {
    errors.push('Valores precisam ser números válidos e não negativos.')
  }
  if (price <= input.discount) errors.push('O preço de venda deve ser maior que o desconto.')
  if (input.commission + input.tax >= 100) errors.push('Comissão e impostos somados devem ser menores que 100%.')
  return errors
}
