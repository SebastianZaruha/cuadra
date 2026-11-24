/** Elección de analítica. Dura 12 meses. No guarda ficheros. */

export const CLAVE_COOKIES = "cuadra-cookies-v1"
export const VERSION_COOKIES = 1
const DOCE_MESES_MS = 365 * 24 * 60 * 60 * 1000

export type EleccionCookies = "aceptada" | "rechazada"

type Guardada = { v: number; choice: EleccionCookies; at: number }

export function eleccionVigente(texto: string | null, ahora = Date.now()): EleccionCookies | null {
  if (!texto) return null
  try {
    const datos = JSON.parse(texto) as Partial<Guardada>
    if (datos.v !== VERSION_COOKIES) return null
    if (datos.choice !== "aceptada" && datos.choice !== "rechazada") return null
    if (typeof datos.at !== "number" || ahora - datos.at > DOCE_MESES_MS) return null
    return datos.choice
  } catch {
    return null
  }
}

export function leerEleccion(ahora = Date.now()): EleccionCookies | null {
  try {
    return eleccionVigente(localStorage.getItem(CLAVE_COOKIES), ahora)
  } catch {
    return null
  }
}

export function guardarEleccion(choice: EleccionCookies, ahora = Date.now()): void {
  const guardada: Guardada = { v: VERSION_COOKIES, choice, at: ahora }
  localStorage.setItem(CLAVE_COOKIES, JSON.stringify(guardada))
}
