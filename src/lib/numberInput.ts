/**
 * Conversão de campos numéricos brasileiros.
 * A digitação mantém o separador decimal e os zeros temporários;
 * a formatação com pontos de milhar acontece apenas quando o campo perde foco.
 */
export function normalizeBrazilianNumberInput(input: string): string {
  const clean = input.replace(/[^\d,.]/g, '')
  if (!clean) return ''

  // Vírgula é o separador decimal prioritário do pt-BR. Ponto também
  // funciona ao digitar decimais, mas 1.234 é interpretado como milhar.
  const comma = clean.lastIndexOf(',')
  const dot = clean.lastIndexOf('.')
  const dotTail = dot < 0 ? '' : clean.slice(dot + 1)
  const decimalIndex = comma >= 0
    ? comma
    : dot >= 0 && (dotTail.length <= 2 || (dotTail.length > 3 && clean.indexOf('.') === dot))
      ? dot
      : -1

  const integer = (decimalIndex < 0 ? clean : clean.slice(0, decimalIndex))
    .replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  const fraction = decimalIndex < 0 ? '' : clean.slice(decimalIndex + 1).replace(/\D/g, '').slice(0, 2)
  return `${integer || '0'}${decimalIndex >= 0 ? `,${fraction}` : ''}`
}

export function numberFromBrazilianInput(input: string): number {
  if (!input) return 0
  const value = Number(input.replace(',', '.'))
  return Number.isFinite(value) ? Math.max(0, Math.min(1_000_000_000, value)) : 0
}

export function toEditableBrazilianNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return String(Math.round(value * 100) / 100).replace('.', ',')
}

export function formatBrazilianNumber(value: number, type: 'currency' | 'percentage' = 'currency'): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: type === 'currency' ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value)
}
