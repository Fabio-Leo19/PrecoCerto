import { useState } from 'react'
import {
  formatBrazilianNumber, normalizeBrazilianNumberInput,
  numberFromBrazilianInput, toEditableBrazilianNumber,
} from '../lib/numberInput'

/**
 * Campo numérico pt-BR reutilizável. Sem setinhas e sem o zero inicial fixo.
 * Formata milhares e centavos no blur sem alterar a posição do cursor
 * enquanto a pessoa digita. O estado persistido continua sendo number.
 */
export function NumericInput({ value, onChange, kind = 'currency', className, label }: {
  value: number
  onChange: (value: number) => void
  kind?: 'currency' | 'percentage'
  className?: string
  label?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  return <input
    className={className}
    type="text"
    inputMode="decimal"
    autoComplete="off"
    spellCheck={false}
    aria-label={label}
    placeholder={kind === 'currency' ? '0,00' : '0'}
    value={editing ? draft : formatBrazilianNumber(value, kind)}
    onFocus={() => {
      setDraft(toEditableBrazilianNumber(value))
      setEditing(true)
    }}
    onChange={event => {
      const next = normalizeBrazilianNumberInput(event.target.value)
      setDraft(next)
      onChange(numberFromBrazilianInput(next))
    }}
    onBlur={() => setEditing(false)}
  />
}
