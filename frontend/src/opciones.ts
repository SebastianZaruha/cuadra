import type { DecisionEnviada, Fila, Filtro } from "./tipos.ts"

export const ETIQUETA_FILTRO: { id: Filtro; etiqueta: string }[] = [
  { id: "todas", etiqueta: "Todas" },
  { id: "pendientes", etiqueta: "Pendientes" },
  { id: "resueltos", etiqueta: "Resueltos" },
  { id: "iguales", etiqueta: "Iguales" },
  { id: "modificados", etiqueta: "Modificados" },
  { id: "solo_en_A", etiqueta: "Solo en A" },
  { id: "solo_en_B", etiqueta: "Solo en B" },
  { id: "bloqueados", etiqueta: "Bloqueados" },
]

export function etiquetaCategoria(fila: Fila): string {
  switch (fila.tipo) {
    case "iguales":
      return "Iguales"
    case "modificados":
      return "Modificado"
    case "solo_en_A":
      return "Solo en A"
    case "solo_en_B":
      return "Solo en B"
    case "bloqueados":
      return "Bloqueado"
  }
}

export function ayudaFila(fila: Fila): string {
  switch (fila.tipo) {
    case "solo_en_A":
      return "Solo está en A. Puedes conservarla, indicar otra cantidad (la descripción sigue siendo la de A) o excluirla. No hay fila B."
    case "solo_en_B":
      return "Solo está en B. Puedes conservarla, indicar otra cantidad (la descripción sigue siendo la de B) o excluirla. No hay fila A."
    case "iguales":
      return "Coinciden y entran solas al inventario. Si las excluyes o cambias la cantidad, el motivo es obligatorio."
    case "modificados":
      return fila.descripcion_difiere
        ? "La descripción difiere. Elige A, elige B o excluye. Una cantidad suelta no dice qué texto conservar."
        : "Cambia la cantidad y la descripción es la misma. Puedes quedarte con A, con B, escribir una cantidad o excluir."
    case "bloqueados":
      return "No se fusiona ni se compara. Corrige el fichero de origen y vuelve a importarlo, o reinicia la sesión."
  }
}

export type OpcionDecision = { valor: DecisionEnviada["tipo"]; etiqueta: string; activa: boolean }

export function opcionesDecision(fila: Fila): OpcionDecision[] {
  if (fila.tipo === "bloqueados") return []
  const manual = !(fila.tipo === "modificados" && fila.descripcion_difiere)
  return [
    { valor: "elegir_A", etiqueta: "Conservar A", activa: fila.tipo !== "solo_en_B" },
    { valor: "elegir_B", etiqueta: "Conservar B", activa: fila.tipo !== "solo_en_A" },
    { valor: "cantidad_manual", etiqueta: "Cantidad manual", activa: manual },
    { valor: "excluir", etiqueta: "Excluir", activa: true },
  ]
}

export function pasaFiltro(fila: Fila, filtro: Filtro, busqueda: string): boolean {
  if (filtro === "pendientes" && (fila.tipo === "bloqueados" || fila.estado !== "pendiente")) return false
  if (filtro === "resueltos" && (fila.tipo === "bloqueados" || fila.estado !== "resuelta")) return false
  if (filtro !== "todas" && filtro !== "pendientes" && filtro !== "resueltos" && fila.tipo !== filtro) {
    return false
  }
  const aguja = busqueda.trim().toLocaleLowerCase("es")
  if (!aguja) return true
  const textos = textosBusqueda(fila).map((texto) => texto.toLocaleLowerCase("es"))
  return textos.some((texto) => texto.includes(aguja))
}

function textosBusqueda(fila: Fila): string[] {
  if (fila.tipo === "bloqueados") {
    return [fila.identificador, fila.descripcion_cruda, fila.cantidad_cruda]
  }
  if (fila.tipo === "modificados") {
    return [fila.identificador, fila.descripcion_a, fila.descripcion_b, fila.cantidad_a, fila.cantidad_b]
  }
  return [fila.identificador, fila.descripcion, fila.cantidad]
}

export function decisionesDesdeFilas(filas: Fila[]): DecisionEnviada[] {
  const salida: DecisionEnviada[] = []
  for (const fila of filas) {
    if (fila.tipo === "bloqueados" || fila.decision === null) continue
    salida.push({ identificador: fila.identificador, ...fila.decision })
  }
  return salida
}

export function sugerirColumna(columnas: string[], candidatos: string[]): string {
  return candidatos.find((candidato) => columnas.includes(candidato)) ?? ""
}
