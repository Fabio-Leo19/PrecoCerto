/**
 * Calcula o recorte de um avatar. A margem inicial de 35% permite mover a
 * fotografia mesmo com o controle de zoom em 100%, inclusive fotos quadradas.
 * Os mesmos dados são usados pela prévia e pelos avatares após salvar.
 */
function bounded(value: number | undefined, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback
}

export function avatarTransform(horizontal = 50, vertical = 50, zoom = 100) {
  const h = bounded(horizontal, 0, 100, 50)
  const v = bounded(vertical, 0, 100, 50)
  const z = bounded(zoom, 100, 250, 100)
  const scale = 1.35 * z / 100
  const freeSpace = (scale - 1) * 100
  const offsetX = (50 - h) / 100 * freeSpace
  const offsetY = (50 - v) / 100 * freeSpace
  return { scale, offsetX, offsetY }
}

export function avatarImageStyle(horizontal?: number, vertical?: number, zoom?: number) {
  const { scale, offsetX, offsetY } = avatarTransform(horizontal, vertical, zoom)
  return {
    objectPosition: 'center center',
    transformOrigin: 'center center',
    transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale})`,
  }
}
