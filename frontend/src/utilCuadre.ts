import { diferenciaCantidad } from "./opciones.ts"
import type { Fila } from "./tipos.ts"

export function deltaFila(fila: Fila): number | null {
  if (fila.tipo !== "modificados" || !fila.cantidad_difiere) return null
  const texto = diferenciaCantidad(fila.cantidad_a, fila.cantidad_b)
  if (!texto) return null
  return Number(texto.replace("−", "-"))
}

export function dentroDeTolerancia(fila: Fila, tolerancia: number): boolean {
  if (!(tolerancia > 0) || fila.tipo !== "modificados") return false
  if (fila.descripcion_difiere) return false
  const delta = deltaFila(fila)
  return delta !== null && Math.abs(delta) <= tolerancia
}

export function valorDiferencias(
  filas: Fila[],
  costes: Map<string, number>,
): number | null {
  if (costes.size === 0) return null
  let total = 0
  let alguno = false
  for (const fila of filas) {
    const coste = costes.get(fila.identificador)
    if (coste === undefined) continue
    if (fila.tipo === "modificados" && fila.cantidad_difiere) {
      const delta = deltaFila(fila)
      if (delta === null) continue
      total += Math.abs(delta) * coste
      alguno = true
    } else if (fila.tipo === "solo_en_A" || fila.tipo === "solo_en_B") {
      const cantidad = Number(fila.cantidad)
      if (!Number.isFinite(cantidad)) continue
      total += Math.abs(cantidad) * coste
      alguno = true
    }
  }
  return alguno ? Math.round(total * 10000) / 10000 : null
}

export function csvDiferencias(filas: Fila[]): string {
  const lineas = ["identificador,tipo,cantidad_a,cantidad_b,diferencia,estado,decision,motivo"]
  for (const fila of filas) {
    if (fila.tipo === "iguales" && fila.decision === null) continue
    if (fila.tipo === "bloqueados") {
      lineas.push(csv([fila.identificador, "bloqueado", fila.cantidad_cruda, "", "", "bloqueado", "", ""]))
      continue
    }
    const a = fila.tipo === "modificados" ? fila.cantidad_a : fila.tipo === "solo_en_B" ? "" : fila.cantidad
    const b = fila.tipo === "modificados" ? fila.cantidad_b : fila.tipo === "solo_en_A" ? "" : fila.cantidad
    const delta = fila.tipo === "modificados" ? (diferenciaCantidad(fila.cantidad_a, fila.cantidad_b) ?? "") : ""
    lineas.push(csv([
      fila.identificador,
      fila.tipo,
      a,
      b,
      delta,
      fila.estado,
      fila.decision?.tipo ?? "",
      fila.decision?.motivo ?? "",
    ]))
  }
  return `${lineas.join("\n")}\n`
}

function csv(campos: string[]): string {
  return campos.map((campo) => (/[",\n]/.test(campo) ? `"${campo.replaceAll('"', '""')}"` : campo)).join(",")
}
