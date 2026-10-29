import assert from 'node:assert/strict'
import test from 'node:test'
import { avatarTransform, avatarImageStyle } from '../src/lib/avatarLayout.ts'

test('no zoom padrão, os controles horizontal e vertical realmente deslocam a foto', () => {
  const center = avatarTransform(50, 50, 100)
  const left = avatarTransform(0, 50, 100)
  const right = avatarTransform(100, 50, 100)
  const top = avatarTransform(50, 0, 100)
  const bottom = avatarTransform(50, 100, 100)
  assert.equal(center.offsetX, 0)
  assert.equal(center.offsetY, 0)
  assert.ok(left.offsetX > 0)
  assert.ok(right.offsetX < 0)
  assert.ok(top.offsetY > 0)
  assert.ok(bottom.offsetY < 0)
})

test('o enquadramento permanece dentro do círculo em todos os extremos', () => {
  for (const zoom of [100, 120, 150, 200, 250]) {
    for (const x of [0, 50, 100]) {
      for (const y of [0, 50, 100]) {
        const p = avatarTransform(x, y, zoom)
        const limit = (p.scale - 1) * 50
        assert.ok(Math.abs(p.offsetX) <= limit + 0.00001)
        assert.ok(Math.abs(p.offsetY) <= limit + 0.00001)
      }
    }
  }
})

test('as coordenadas do perfil determinam sempre o mesmo estilo', () => {
  assert.deepEqual(avatarImageStyle(12, 88, 165), avatarImageStyle(12, 88, 165))
  assert.notEqual(avatarImageStyle(50, 50, 100).transform, avatarImageStyle(80, 20, 100).transform)
})
