import test from 'node:test'
import assert from 'node:assert/strict'
import { createBackup, inspectBackup, MAX_BACKUP_BYTES } from '../src/lib/backup.ts'
import type { Workspace } from '../src/lib/workspace.ts'

const data: Workspace = {
  products: [{ id: 123, name: 'Controle Xbox', category: 'Eletrônicos', cost: 450.36, price: 350.01 }],
  profiles: [{ id: 22, name: 'Marketplace', commission: 12, fee: 3.5, tax: 4 }],
  calc: { cost: 28.4, package: 3.2, freight: 7.5, operational: 4, fee: 3.5, commission: 12, tax: 4, discount: 0, desiredProfit: 18 },
  salePrice: 79.9,
  scenarioPrices: [64.9, 74.9, 84.9],
}
const original = () => JSON.parse(createBackup(data, '2026-10-29T12:00:00.000Z')) as Record<string, any>

test('backup da versao 1 pode ser exportado e importado sem alterar os dados', () => {
  const saved = original()
  const read = inspectBackup(saved)
  assert.deepEqual(read.data, data)
  assert.equal(read.productCount, 1)
  assert.equal(read.profileCount, 1)
})
test('backup exportado pode conter listas vazias sem gerar dados demonstrativos', () => {
  const empty = { ...data, products: [], profiles: [] }
  assert.deepEqual(inspectBackup(JSON.parse(createBackup(empty))).data, empty)
})
test('arquivo que nao pertence ao PrecoCerto nao substitui dados', () => {
  assert.throws(() => inspectBackup({ format: 'outro', version: 1, data }), /incompatível/)
})
test('dados faltando sao rejeitados em vez de substituir valores por defaults', () => {
  const saved = original(); delete saved.data.calc
  assert.throws(() => inspectBackup(saved), /calculadora/)
})
test('campos invalidos, negativos e fora dos limites sao rejeitados', () => {
  const saved = original(); saved.data.products[0].cost = -40
  assert.throws(() => inspectBackup(saved), /Produto 1.*custo inválido/)
  const other = original(); other.data.scenarioPrices = [20, 30]
  assert.throws(() => inspectBackup(other), /cenários/)
})
test('IDs duplicados e nomes vazios sao rejeitados', () => {
  const saved = original(); saved.data.products.push({ ...saved.data.products[0] })
  assert.throws(() => inspectBackup(saved), /Produto 2.*identificador repetido/)
  const other = original(); other.data.profiles[0].name = ''
  assert.throws(() => inspectBackup(other), /perfis/)
})
test('backup grande demais para documento Firestore e rejeitado', () => {
  const saved = original()
  saved.data.products = Array.from({ length: 4000 }, (_, i) => ({ id: i + 1, name: `Produto ${i} ` + 'x'.repeat(150 - (`Produto ${i} `).length), category: 'Categoria ' + 'c'.repeat(130), cost: 1, price: 2 }))
  assert.ok(new TextEncoder().encode(JSON.stringify(saved.data)).length > MAX_BACKUP_BYTES)
  assert.throws(() => inspectBackup(saved), /grande/)
})


test('identificador 0 de versão antiga continua compatível sem alterar valores financeiros', () => {
  const legacy: Workspace = { ...data, products: [{ ...data.products[0], id: 0 }] }
  const imported = inspectBackup(JSON.parse(createBackup(legacy)))
  assert.deepEqual(imported.data.products, legacy.products)
})

test('exportação corrige somente identificadores de produtos repetidos, sem perder itens', () => {
  const existing: Workspace = { ...data, products: [
    { ...data.products[0], id: 1 },
    { id: 1, name: 'Cortina', category: 'Casa', cost: 50, price: 80 },
  ] }
  const exported = inspectBackup(JSON.parse(createBackup(existing)))
  assert.equal(exported.productCount, 2)
  assert.notEqual(exported.data.products[0].id, exported.data.products[1].id)
  assert.equal(exported.data.products[1].cost, 50)
  assert.equal(exported.data.products[1].price, 80)
})

test('erros de produtos indicam qual campo está com problema sem restaurar dados incompletos', () => {
  const invalid = original()
  invalid.data.products[0].category = ''
  assert.throws(() => inspectBackup(invalid), /Produto 1.*categoria/)
  invalid.data.products[0].category = 'Eletrônicos'
  invalid.data.products[0].price = '350,01'
  assert.throws(() => inspectBackup(invalid), /Produto 1.*preço de venda/)
})
