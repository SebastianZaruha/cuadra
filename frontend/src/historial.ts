export type Pila<T> = { pasado: T[]; futuro: T[] }

export function pilaVacia<T>(): Pila<T> {
  return { pasado: [], futuro: [] }
}

export function recordar<T>(pila: Pila<T>, actual: T): Pila<T> {
  return { pasado: [...pila.pasado, actual], futuro: [] }
}

export function deshacer<T>(pila: Pila<T>, actual: T): { pila: Pila<T>; valor: T } | null {
  const previo = pila.pasado.at(-1)
  if (previo === undefined) return null
  return {
    pila: { pasado: pila.pasado.slice(0, -1), futuro: [...pila.futuro, actual] },
    valor: previo,
  }
}

export function rehacer<T>(pila: Pila<T>, actual: T): { pila: Pila<T>; valor: T } | null {
  const siguiente = pila.futuro.at(-1)
  if (siguiente === undefined) return null
  return {
    pila: { pasado: [...pila.pasado, actual], futuro: pila.futuro.slice(0, -1) },
    valor: siguiente,
  }
}
