import type { Workspace, Product, FeeProfile } from './workspace'
import type { PricingInputs } from './pricing'

export const BACKUP_FORMAT = 'precocerto-backup'
export const BACKUP_VERSION = 1
// Firestore has a 1 MiB document limit. Leave room for metadata and document overhead.
export const MAX_BACKUP_BYTES = 850_000

export type BackupPreview = {
  data: Workspace
  exportedAt: string
  productCount: number
  profileCount: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const validNumber = (value: unknown, max = 1e9): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
const validId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const validName = (value: unknown, limit = 150): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= limit

function validateProducts(value: unknown): Product[] {
  if (!Array.isArray(value) || value.length > 4000) throw new Error('A lista de produtos do backup é inválida ou muito grande.')
  const ids = new Set<number>()
  return value.map((item: unknown, index: number) => {
    const context = `Produto ${index + 1}`
    if (!isRecord(item)) throw new Error(`${context}: registro inválido. Nenhum dado foi substituído.`)
    const detail = validName(item.name) ? ` (${String(item.name).trim()})` : ''
    if (!validId(item.id)) throw new Error(`${context}${detail}: identificador inválido. O arquivo pode ser de uma versão antiga.`)
    if (ids.has(item.id)) throw new Error(`${context}${detail}: identificador repetido. Selecione o JSON exportado mais recentemente.`)
    if (!validName(item.name)) throw new Error(`${context}: nome ausente ou acima de 150 caracteres.`)
    if (!validName(item.category)) throw new Error(`${context}${detail}: categoria ausente ou inválida.`)
    if (!validNumber(item.cost)) throw new Error(`${context}${detail}: custo inválido (precisa ser um número maior ou igual a zero).`)
    if (!validNumber(item.price)) throw new Error(`${context}${detail}: preço de venda inválido (precisa ser um número maior ou igual a zero).`)
    ids.add(item.id)
    return { id: item.id, name: item.name.trim(), category: item.category.trim(), cost: item.cost, price: item.price }
  })
}

// Versões antigas podem ter IDs iguais após duplicar produtos. Ao EXPORTAR,
// recuperamos apenas os identificadores da cópia, nunca custos ou preços.
// A IMPORTAÇÃO continua recusando registros repetidos para não perder dados.
function repairIdsForExport(products: Product[]): Product[] {
  const used = new Set<number>()
  let nextId = products.reduce((max, item) => validId(item.id) ? Math.max(max, item.id) : max, 0)
  return products.map(item => {
    let id = item.id
    if (!validId(id) || used.has(id)) {
      do { nextId++ } while (used.has(nextId))
      id = nextId
    }
    used.add(id)
    return { ...item, id }
  })
}

function validateProfiles(value: unknown): FeeProfile[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('A lista de perfis de taxas do backup é inválida ou muito grande.')
  const ids = new Set<number>()
  return value.map((item: unknown) => {
    if (!isRecord(item) || !validId(item.id) || !validName(item.name) ||
        !validNumber(item.commission) || !validNumber(item.fee) || !validNumber(item.tax) || ids.has(item.id) ||
        (item.demo !== undefined && typeof item.demo !== 'boolean')) {
      throw new Error('O backup contém perfis de taxas incompletos ou inválidos.')
    }
    ids.add(item.id)
    return { id: item.id, name: item.name.trim(), commission: item.commission, fee: item.fee, tax: item.tax, ...(item.demo === undefined ? {} : { demo: Boolean(item.demo) }) }
  })
}

function validateCalc(value: unknown): PricingInputs {
  if (!isRecord(value)) throw new Error('Os dados da calculadora estão ausentes no backup.')
  const keys: Array<keyof PricingInputs> = ['cost', 'package', 'freight', 'operational', 'fee', 'commission', 'tax', 'discount', 'desiredProfit']
  const entries = keys.map(key => {
    const v = value[key]
    if (!validNumber(v)) throw new Error(`O valor da calculadora “${key}” está ausente ou é inválido.`)
    return [key, v]
  })
  return Object.fromEntries(entries) as PricingInputs
}

export function inspectBackup(raw: unknown): BackupPreview {
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT || raw.version !== BACKUP_VERSION) {
    throw new Error('Arquivo incompatível. Selecione um backup JSON do PreçoCerto (versão 1).')
  }
  if (!isRecord(raw.data)) throw new Error('O backup não contém dados válidos.')
  const data = raw.data
  const products = validateProducts(data.products)
  const profiles = validateProfiles(data.profiles)
  const calc = validateCalc(data.calc)
  if (!validNumber(data.salePrice) || !Array.isArray(data.scenarioPrices) || data.scenarioPrices.length !== 3 ||
      !data.scenarioPrices.every(value => validNumber(value))) {
    throw new Error('Os preços e cenários do backup são inválidos.')
  }
  const exportedAt = typeof raw.exportedAt === 'string' && Number.isFinite(Date.parse(raw.exportedAt))
    ? raw.exportedAt : ''
  const workspace: Workspace = { products, profiles, calc, salePrice: data.salePrice, scenarioPrices: [...data.scenarioPrices] }
  if (new TextEncoder().encode(JSON.stringify(workspace)).length > MAX_BACKUP_BYTES) {
    throw new Error('Backup muito grande para o documento gratuito do Firestore. Limite: 850 KB de dados.')
  }
  return { data: workspace, exportedAt, productCount: products.length, profileCount: profiles.length }
}

export function createBackup(data: Workspace, exportedAt = new Date().toISOString()): string {
  // Validate before exporting too; never create a backup that cannot later be imported.
  const safeExport = { ...data, products: repairIdsForExport(data.products) }
  const content = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, data: safeExport }
  inspectBackup(content)
  return JSON.stringify(content, null, 2)
}
