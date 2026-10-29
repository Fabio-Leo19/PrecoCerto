/** Serializa escritas no mesmo documento para evitar resultados fora de ordem. */
export class SaveQueue {
  private tail: Promise<void> = Promise.resolve()

  add<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation)
    // Uma falha de rede não pode impedir a próxima tentativa de salvar.
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }

  idle(): Promise<void> { return this.tail }
}
