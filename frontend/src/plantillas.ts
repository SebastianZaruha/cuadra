import type { Mapeo } from "./tipos.ts"

export const CLAVE_PLANTILLAS = "cuadra-plantillas-v1"

export type Plantilla = { nombre: string; mapeo: Mapeo; coste: string }

export function interpretarPlantillas(texto: string): Plantilla[] {
  try {
    const datos = JSON.parse(texto) as unknown
    if (!Array.isArray(datos)) return []
    return datos.flatMap((item) => {
      if (!item || typeof item !== "object") return []
      const fila = item as Record<string, unknown>
      const mapeo = fila.mapeo as Record<string, unknown> | undefined
      if (typeof fila.nombre !== "string" || !mapeo) return []
      if (typeof mapeo.identificador !== "string" || typeof mapeo.descripcion !== "string" || typeof mapeo.cantidad !== "string") {
        return []
      }
      return [{
        nombre: fila.nombre.slice(0, 80),
        mapeo: {
          identificador: mapeo.identificador,
          descripcion: mapeo.descripcion,
          cantidad: mapeo.cantidad,
        },
        coste: typeof fila.coste === "string" ? fila.coste : "",
      }]
    })
  } catch {
    return []
  }
}

export function leerPlantillas(): Plantilla[] {
  try {
    return interpretarPlantillas(localStorage.getItem(CLAVE_PLANTILLAS) ?? "[]")
  } catch {
    return []
  }
}

export function guardarPlantilla(plantilla: Plantilla): Plantilla[] {
  const siguientes = [...leerPlantillas().filter((item) => item.nombre !== plantilla.nombre), plantilla]
  localStorage.setItem(CLAVE_PLANTILLAS, JSON.stringify(siguientes))
  return siguientes
}

export function plantillasGuardadas(): boolean {
  try {
    return localStorage.getItem(CLAVE_PLANTILLAS) !== null
  } catch {
    return false
  }
}

export function activarPlantillas(): void {
  if (!plantillasGuardadas()) localStorage.setItem(CLAVE_PLANTILLAS, "[]")
}

export function borrarPlantillas(): void {
  localStorage.removeItem(CLAVE_PLANTILLAS)
}
