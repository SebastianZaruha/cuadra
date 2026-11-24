import type { Delimitador } from "./tipos.ts"

export function filasCsv(texto: string, delimitador: Delimitador): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ""
  let comillas = false
  const fuente = texto.replace(/^\uFEFF/, "")
  for (let i = 0; i < fuente.length; i++) {
    const char = fuente[i]
    if (comillas) {
      if (char === '"') {
        if (fuente[i + 1] === '"') {
          celda += '"'
          i++
        } else comillas = false
      } else celda += char
      continue
    }
    if (char === '"') {
      comillas = true
      continue
    }
    if (char === delimitador) {
      fila.push(celda)
      celda = ""
      continue
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && fuente[i + 1] === "\n") i++
      fila.push(celda)
      if (fila.some((campo) => campo !== "")) filas.push(fila)
      fila = []
      celda = ""
      continue
    }
    celda += char
  }
  if (celda !== "" || fila.length > 0) {
    fila.push(celda)
    if (fila.some((campo) => campo !== "")) filas.push(fila)
  }
  return filas
}

export function serializarCsv(filas: string[][], delimitador: Delimitador): string {
  return filas
    .map((fila) =>
      fila
        .map((campo) => (/["\n\r]/.test(campo) || campo.includes(delimitador) ? `"${campo.replaceAll('"', '""')}"` : campo))
        .join(delimitador),
    )
    .join("\n")
}

function aPunto(valor: string): string | null {
  const limpio = valor.trim()
  if (/^-?\d+,\d{1,4}$/.test(limpio)) return limpio.replace(",", ".")
  if (/^-?\d{1,3}(\.\d{3})+,\d{1,4}$/.test(limpio)) return limpio.replaceAll(".", "").replace(",", ".")
  return null
}

export function sospechaComaDecimal(texto: string, delimitador: Delimitador, columna: string): boolean {
  const filas = filasCsv(texto, delimitador)
  if (filas.length < 2) return false
  const indice = filas[0].indexOf(columna)
  if (indice < 0) return false
  return filas.slice(1, 8).some((fila) => aPunto(fila[indice] ?? "") !== null)
}

export function convertirComaDecimal(texto: string, delimitador: Delimitador, columna: string): string {
  const filas = filasCsv(texto, delimitador)
  if (filas.length === 0) return texto
  const indice = filas[0].indexOf(columna)
  if (indice < 0) return texto
  for (const fila of filas.slice(1)) {
    const convertido = aPunto(fila[indice] ?? "")
    if (convertido !== null) fila[indice] = convertido
  }
  return serializarCsv(filas, delimitador)
}

export type Lectura = { texto: string; codificacion: "utf-8" | "windows-1252" | "excel" }

export function costesPorIdentificador(
  texto: string,
  delimitador: Delimitador,
  columnaId: string,
  columnaCoste: string,
): Map<string, number> {
  const salida = new Map<string, number>()
  if (!columnaCoste) return salida
  const filas = filasCsv(texto, delimitador)
  if (filas.length < 2) return salida
  const id = filas[0].indexOf(columnaId)
  const coste = filas[0].indexOf(columnaCoste)
  if (id < 0 || coste < 0) return salida
  for (const fila of filas.slice(1)) {
    const clave = (fila[id] ?? "").trim()
    const numero = Number((fila[coste] ?? "").trim().replace(",", "."))
    if (clave && Number.isFinite(numero)) salida.set(clave, numero)
  }
  return salida
}

export async function leerTextoLocal(archivo: File, maxBytes: number): Promise<Lectura> {
  if (archivo.name.toLowerCase().endsWith(".xlsx") || archivo.name.toLowerCase().endsWith(".xls")) {
    if (archivo.size > maxBytes) {
      throw new Error(`«${archivo.name}» pesa ${archivo.size} bytes y el límite es ${maxBytes} bytes.`)
    }
    const XLSX = await import("xlsx")
    const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" })
    const hoja = libro.Sheets[libro.SheetNames[0]]
    const texto = XLSX.utils.sheet_to_csv(hoja)
    return { texto, codificacion: "excel" }
  }
  if (archivo.size > maxBytes) {
    throw new Error(`«${archivo.name}» pesa ${archivo.size} bytes y el límite es ${maxBytes} bytes.`)
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  try {
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    return { texto: texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto, codificacion: "utf-8" }
  } catch {
    const texto = new TextDecoder("windows-1252").decode(bytes)
    return { texto: texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto, codificacion: "windows-1252" }
  }
}
