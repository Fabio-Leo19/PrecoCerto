/** Política mínima única para cadastro, redefinição e troca de senha. */
export function passwordIsValid(value: string): boolean {
  return value.length >= 8
}

/** Pontuação indicativa, não um bloqueio para senhas >= 8 caracteres. */
export function passwordScore(value: string): number {
  if (!value) return 0
  if (value.length < 8) return 1
  const kinds = [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length
  const common = /^(12345678|123456789|password|senha123|qwerty123|11111111|abcdefgh)$/i.test(value)
  if (common) return 1
  if (value.length >= 12 && kinds >= 3) return 3
  if (kinds >= 2 || value.length >= 12) return 2
  return 1
}
