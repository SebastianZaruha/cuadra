import type { DecisionEnviada, Delimitador, Mapeo } from "./tipos.ts"

export const CLAVE_BORRADOR = "cuadra-borrador-v1"

export type Borrador = {
  version: 1
  nombreA: string
  textoA: string
  delimitadorA: Delimitador | ""
  mapeoA: Mapeo
  codificacionA: string
  nombreB: string
  textoB: string
  delimitadorB: Delimitador | ""
  mapeoB: Mapeo
  codificacionB: string
  decisiones: DecisionEnviada[]
  costeA: string
  costeB: string
  tolerancia: string
}

function mapeo(valor: unknown): Mapeo | null {
  if (!valor || typeof valor !== "object") return null
  const item = valor as Record<string, unknown>
  if (typeof item.identificador !== "string" || typeof item.descripcion !== "string" || typeof item.cantidad !== "string") {
    return null
  }
  return { identificador: item.identificador, descripcion: item.descripcion, cantidad: item.cantidad }
}

export function interpretarBorrador(texto: string): Borrador | null {
  try {
    const datos = JSON.parse(texto) as Record<string, unknown>
    if (datos.version !== 1) return null
    const mapeoA = mapeo(datos.mapeoA)
    const mapeoB = mapeo(datos.mapeoB)
    if (!mapeoA || !mapeoB) return null
    if (typeof datos.textoA !== "string" || typeof datos.textoB !== "string") return null
    if (!Array.isArray(datos.decisiones)) return null
    const delimitador = (valor: unknown): Delimitador | "" => (valor === "," || valor === ";" ? valor : "")
    return {
      version: 1,
      nombreA: typeof datos.nombreA === "string" ? datos.nombreA : "a.csv",
      textoA: datos.textoA,
      delimitadorA: delimitador(datos.delimitadorA),
      mapeoA,
      codificacionA: typeof datos.codificacionA === "string" ? datos.codificacionA : "utf-8",
      nombreB: typeof datos.nombreB === "string" ? datos.nombreB : "b.csv",
      textoB: datos.textoB,
      delimitadorB: delimitador(datos.delimitadorB),
      mapeoB,
      codificacionB: typeof datos.codificacionB === "string" ? datos.codificacionB : "utf-8",
      decisiones: datos.decisiones as DecisionEnviada[],
      costeA: typeof datos.costeA === "string" ? datos.costeA : "",
      costeB: typeof datos.costeB === "string" ? datos.costeB : "",
      tolerancia: typeof datos.tolerancia === "string" ? datos.tolerancia : "0",
    }
  } catch {
    return null
  }
}

export function leerBorrador(): Borrador | null {
  try {
    const texto = localStorage.getItem(CLAVE_BORRADOR)
    return texto ? interpretarBorrador(texto) : null
  } catch {
    return null
  }
}

export function guardarBorrador(borrador: Borrador): void {
  localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(borrador))
}

export function borrarBorrador(): void {
  localStorage.removeItem(CLAVE_BORRADOR)
}
