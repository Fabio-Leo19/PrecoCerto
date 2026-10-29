/** Máscara nacional para telefones brasileiros com DDD. */
export function digitsOfBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  // Aceita também +55 ou 55 colado antes do DDD (10 ou 11 dígitos locais).
  return (digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits).slice(0, 11)
}

export function formatBrazilianPhone(value: string): string {
  const number = digitsOfBrazilianPhone(value)
  if (!number) return ''
  if (number.length <= 2) return `(${number}`
  const area = number.slice(0, 2)
  const local = number.slice(2)
  if (local.length <= 4) return `(${area}) ${local}`
  const prefixLength = local.length > 8 ? 5 : 4
  return `(${area}) ${local.slice(0, prefixLength)}-${local.slice(prefixLength)}`
}

export function phoneToE164(value: string): string | null {
  const number = digitsOfBrazilianPhone(value)
  return number.length === 10 || number.length === 11 ? `+55${number}` : null
}
