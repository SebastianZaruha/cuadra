export type Delimitador = "," | ";" | "\t"
export type Formato = "csv" | "xlsx" | "ods" | "json"
export type Codificacion = "utf-8" | "utf-8-sig" | "windows-1252"

export type Mapeo = {
  identificador: string
  descripcion: string
  cantidad: string
}

export type ErrorValidacion = {
  codigo: string
  mensaje: string
  fichero: "A" | "B" | null
  fila: number | null
  columna: string | null
}

export type Decision =
  | { tipo: "elegir_A"; motivo: string }
  | { tipo: "elegir_B"; motivo: string }
  | { tipo: "cantidad_manual"; cantidad: string; motivo: string }
  | { tipo: "excluir"; motivo: string }

export type DecisionEnviada = Decision & { identificador: string }

export type FilaIguales = {
  tipo: "iguales"
  identificador: string
  descripcion: string
  cantidad: string
  fila_a: number
  fila_b: number
  estado: "pendiente" | "resuelta"
  decision: Decision | null
}

export type FilaModificados = {
  tipo: "modificados"
  identificador: string
  descripcion_a: string
  cantidad_a: string
  descripcion_b: string
  cantidad_b: string
  descripcion_difiere: boolean
  cantidad_difiere: boolean
  fila_a: number
  fila_b: number
  estado: "pendiente" | "resuelta"
  decision: Decision | null
}

export type FilaSoloA = {
  tipo: "solo_en_A"
  identificador: string
  descripcion: string
  cantidad: string
  fila_a: number
  estado: "pendiente" | "resuelta"
  decision: Decision | null
}

export type FilaSoloB = {
  tipo: "solo_en_B"
  identificador: string
  descripcion: string
  cantidad: string
  fila_b: number
  estado: "pendiente" | "resuelta"
  decision: Decision | null
}

export type FilaBloqueada = {
  tipo: "bloqueados"
  fichero: "A" | "B"
  fila: number
  identificador: string
  descripcion_cruda: string
  cantidad_cruda: string
  errores: ErrorValidacion[]
}

export type Fila = FilaIguales | FilaModificados | FilaSoloA | FilaSoloB | FilaBloqueada

export type Resumen = {
  iguales: number
  modificados: number
  solo_en_A: number
  solo_en_B: number
  bloqueados: number
  pendientes: number
  resueltos: number
}

export type Resultado = {
  ok: boolean
  delimitador_a: Delimitador | null
  delimitador_b: Delimitador | null
  exportacion_completa_permitida: boolean
  resumen: Resumen | null
  filas: Fila[]
  errores: ErrorValidacion[]
  errores_decision: ErrorValidacion[]
}

export type Inspeccion = {
  ok: boolean
  formato: Formato | null
  codificacion: Codificacion | null
  delimitador: Delimitador | null
  origen_delimitador: "detectado" | "elegido" | null
  hoja: string | null
  hojas: string[]
  origen_hoja: "detectada" | "elegida" | null
  columnas: string[]
  muestra: Record<string, string>[]
  filas_datos: number
  errores: ErrorValidacion[]
}

export type Limites = {
  schema_version: number
  max_bytes: number
  max_filas: number
  max_columnas: number
  max_identificador: number
  max_descripcion: number
  max_motivo: number
  max_decimales: number
}

export type Demo = {
  nombre_a: string
  nombre_b: string
  csv_a: string
  csv_b: string
  delimitador_a: Delimitador
  delimitador_b: Delimitador
  mapeo_a: Mapeo
  mapeo_b: Mapeo
  relato: string
}

export type Exportacion = {
  completa: boolean
  nombre_inventario: string
  nombre_historial: string
  inventario_csv: string
  historial_csv: string
  nombre_inventario_xlsx: string
  nombre_historial_xlsx: string
  inventario_xlsx_base64: string
  historial_xlsx_base64: string
}

export type FicheroUi = {
  nombre: string
  texto: string | null
  contenidoBase64: string | null
  formato: Formato | null
  codificacion: Codificacion | null
  delimitador: Delimitador | ""
  origenDelimitador: "detectado" | "elegido" | null
  hoja: string | null
  hojas: string[]
  origenHoja: "detectada" | "elegida" | null
  columnas: string[]
  muestra: Record<string, string>[]
  filasDatos: number
  errores: ErrorValidacion[]
  mapeo: Mapeo
}

export type Filtro =
  | "todas"
  | "iguales"
  | "modificados"
  | "solo_en_A"
  | "solo_en_B"
  | "bloqueados"
  | "pendientes"
  | "resueltos"

export const MAPEO_VACIO: Mapeo = {
  identificador: "",
  descripcion: "",
  cantidad: "",
}
