import test from 'node:test'
import assert from 'node:assert/strict'
import { SaveQueue } from '../src/lib/saveQueue.ts'

test('gravações não se sobrepõem e conservam a ordem', async () => {
  const queue = new SaveQueue()
  const events: string[] = []
  let finishFirst!: () => void
  const gate = new Promise<void>(resolve => { finishFirst = resolve })
  const one = queue.add(async () => { events.push('começou 1'); await gate; events.push('terminou 1') })
  const two = queue.add(async () => { events.push('começou 2'); events.push('terminou 2') })
  await Promise.resolve()
  assert.deepEqual(events, ['começou 1'])
  finishFirst()
  await Promise.all([one, two])
  assert.deepEqual(events, ['começou 1', 'terminou 1', 'começou 2', 'terminou 2'])
})

test('uma falha não bloqueia a gravação seguinte', async () => {
  const queue = new SaveQueue()
  await assert.rejects(queue.add(async () => { throw new Error('sem conexão') }), /sem conexão/)
  assert.equal(await queue.add(async () => 'salvou'), 'salvou')
})

test('idle aguarda a última gravação da fila', async () => {
  const queue = new SaveQueue()
  let finish!: () => void
  const gate = new Promise<void>(resolve => { finish = resolve })
  let idle = false
  const item = queue.add(async () => { await gate })
  const waiting = queue.idle().then(() => { idle = true })
  await Promise.resolve()
  assert.equal(idle, false)
  finish()
  await Promise.all([item, waiting])
  assert.equal(idle, true)
})
