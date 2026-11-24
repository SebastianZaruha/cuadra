import demoA from "../../fixtures/demo/a.csv?raw"
import demoB from "../../fixtures/demo/b.csv?raw"

import {
  ExportacionBloqueada,
  MAX_BYTES,
  MAX_COLUMNAS,
  MAX_DECIMALES,
  MAX_DESCRIPCION,
  MAX_FILAS,
  MAX_IDENTIFICADOR,
  MAX_MOTIVO,
  SCHEMA_VERSION,
  abrirSesionLocal,
  crearSesion,
  exportarCuadre,
  inspeccionar as inspeccionarLocal,
  normalizarTexto,
  reconciliar as reconciliarLocal,
  serializarSesion,
} from "./dominio/cuadra.ts"
import type {
  DecisionEnviada,
  Delimitador,
  Demo,
  ErrorValidacion,
  Exportacion,
  FicheroUi,
  Inspeccion,
  Limites,
  Mapeo,
  Resultado,
} from "./tipos.ts"

export class ErrorCuadra extends Error {
  errores: ErrorValidacion[]
  status: number

  constructor(mensaje: string, status: number, errores: ErrorValidacion[] = []) {
    super(mensaje)
    this.status = status
    this.errores = errores
  }
}

const RELATO =
  "Depósito y tienda de Ferretería La Cuadra. Inventarios ficticios: no hay datos de un negocio real."

export async function obtenerLimites(): Promise<Limites> {
  return {
    schema_version: SCHEMA_VERSION,
    max_bytes: MAX_BYTES,
    max_filas: MAX_FILAS,
    max_columnas: MAX_COLUMNAS,
    max_identificador: MAX_IDENTIFICADOR,
    max_descripcion: MAX_DESCRIPCION,
    max_motivo: MAX_MOTIVO,
    max_decimales: MAX_DECIMALES,
  }
}

export async function obtenerDemo(): Promise<Demo> {
  const mapeo = { identificador: "sku", descripcion: "descripcion", cantidad: "cantidad" }
  return {
    nombre_a: "deposito.csv",
    nombre_b: "tienda.csv",
    csv_a: normalizarTexto(demoA),
    csv_b: normalizarTexto(demoB),
    delimitador_a: ",",
    delimitador_b: ";",
    mapeo_a: mapeo,
    mapeo_b: mapeo,
    relato: RELATO,
  }
}

export async function inspeccionar(
  csv: string,
  fichero: "A" | "B",
  delimitador: Delimitador | null,
): Promise<Inspeccion> {
  return inspeccionarLocal(csv, delimitador, fichero) as Inspeccion
}

export async function reconciliar(
  a: FicheroUi,
  b: FicheroUi,
  decisiones: DecisionEnviada[],
): Promise<Resultado> {
  return reconciliarLocal(
    a.texto,
    b.texto,
    a.mapeo,
    b.mapeo,
    a.delimitador || null,
    b.delimitador || null,
    decisiones,
  ) as Resultado
}

export async function exportar(
  a: FicheroUi,
  b: FicheroUi,
  decisiones: DecisionEnviada[],
  modo: "completa" | "parcial",
): Promise<Exportacion> {
  try {
    return exportarCuadre(
      a.texto,
      b.texto,
      a.mapeo,
      b.mapeo,
      a.delimitador || null,
      b.delimitador || null,
      decisiones,
      modo,
    )
  } catch (error) {
    if (error instanceof ExportacionBloqueada) {
      throw new ErrorCuadra(error.message, 409, [
        {
          codigo: "exportacion_bloqueada",
          mensaje: error.message,
          fichero: null,
          fila: null,
          columna: null,
        },
      ])
    }
    throw error
  }
}

export async function guardarSesion(
  a: FicheroUi,
  b: FicheroUi,
  decisiones: DecisionEnviada[],
): Promise<{ nombre: string; texto: string }> {
  const sesion = await crearSesion(
    a.texto,
    b.texto,
    a.mapeo,
    b.mapeo,
    a.nombre,
    b.nombre,
    a.delimitador || null,
    b.delimitador || null,
    decisiones,
  )
  return { nombre: "cuadra-sesion.json", texto: serializarSesion(sesion) }
}

export async function abrirSesion(sesion: unknown, a: FicheroUi, b: FicheroUi): Promise<Resultado> {
  if (!sesion || typeof sesion !== "object" || Array.isArray(sesion)) {
    return {
      ok: false,
      delimitador_a: null,
      delimitador_b: null,
      exportacion_completa_permitida: false,
      resumen: null,
      filas: [],
      errores: [
        {
          codigo: "sesion_json",
          mensaje: "La sesión no es JSON válido.",
          fichero: null,
          fila: null,
          columna: null,
        },
      ],
      errores_decision: [],
    }
  }
  return (await abrirSesionLocal(sesion as Record<string, unknown>, a.texto, b.texto)) as Resultado
}

export async function leerArchivo(archivo: File, maxBytes: number): Promise<string> {
  if (archivo.size > maxBytes) {
    throw new Error(`«${archivo.name}» pesa ${archivo.size} bytes y el límite es ${maxBytes} bytes.`)
  }
  const bytes = await archivo.arrayBuffer()
  try {
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
  } catch {
    throw new Error(`«${archivo.name}» no es UTF-8 válido.`)
  }
}

export function mapeoListo(mapeo: Mapeo): boolean {
  return Boolean(mapeo.identificador && mapeo.descripcion && mapeo.cantidad)
}
