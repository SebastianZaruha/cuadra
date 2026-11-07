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

async function leerJson<T>(respuesta: Response): Promise<T> {
  const cuerpo = (await respuesta.json()) as T & { errores?: ErrorValidacion[] }
  if (!respuesta.ok && respuesta.status !== 409) {
    const mensaje = cuerpo.errores?.[0]?.mensaje ?? `El servidor respondió ${respuesta.status}.`
    throw new ErrorCuadra(mensaje, respuesta.status, cuerpo.errores ?? [])
  }
  return cuerpo
}

export async function obtenerLimites(): Promise<Limites> {
  const respuesta = await fetch("/api/limites")
  if (!respuesta.ok) {
    throw new ErrorCuadra("No se pudieron leer los límites.", respuesta.status)
  }
  return (await respuesta.json()) as Limites
}

export async function obtenerDemo(): Promise<Demo> {
  const respuesta = await fetch("/api/demo")
  if (!respuesta.ok) {
    throw new ErrorCuadra("No se pudo cargar la demostración.", respuesta.status)
  }
  return (await respuesta.json()) as Demo
}

export async function inspeccionar(
  csv: string,
  fichero: "A" | "B",
  delimitador: Delimitador | null,
): Promise<Inspeccion> {
  const respuesta = await fetch("/api/inspeccionar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv, fichero, delimitador }),
  })
  return leerJson<Inspeccion>(respuesta)
}

function cuerpoCuadre(
  a: FicheroUi,
  b: FicheroUi,
  decisiones: DecisionEnviada[],
  extra: Record<string, unknown> = {},
) {
  return {
    csv_a: a.texto,
    csv_b: b.texto,
    nombre_a: a.nombre,
    nombre_b: b.nombre,
    delimitador_a: a.delimitador || null,
    delimitador_b: b.delimitador || null,
    mapeo_a: a.mapeo,
    mapeo_b: b.mapeo,
    decisiones,
    ...extra,
  }
}

export async function reconciliar(
  a: FicheroUi,
  b: FicheroUi,
  decisiones: DecisionEnviada[],
): Promise<Resultado> {
  const respuesta = await fetch("/api/reconciliar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpoCuadre(a, b, decisiones)),
  })
  return leerJson<Resultado>(respuesta)
}

export async function exportar(
  a: FicheroUi,
  b: FicheroUi,
  decisiones: DecisionEnviada[],
  modo: "completa" | "parcial",
): Promise<Exportacion> {
  const respuesta = await fetch("/api/exportar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpoCuadre(a, b, decisiones, { modo })),
  })
  if (respuesta.status === 409) {
    const cuerpo = (await respuesta.json()) as { errores: ErrorValidacion[] }
    throw new ErrorCuadra(cuerpo.errores[0]?.mensaje ?? "Exportación bloqueada.", 409, cuerpo.errores)
  }
  return leerJson<Exportacion>(respuesta)
}

export async function guardarSesion(
  a: FicheroUi,
  b: FicheroUi,
  decisiones: DecisionEnviada[],
): Promise<{ nombre: string; texto: string }> {
  const respuesta = await fetch("/api/sesion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpoCuadre(a, b, decisiones)),
  })
  return leerJson<{ nombre: string; texto: string }>(respuesta)
}

export async function abrirSesion(
  sesion: unknown,
  a: FicheroUi,
  b: FicheroUi,
): Promise<Resultado> {
  const respuesta = await fetch("/api/sesion/abrir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sesion, csv_a: a.texto, csv_b: b.texto }),
  })
  return leerJson<Resultado>(respuesta)
}

export async function leerArchivo(archivo: File, maxBytes: number): Promise<string> {
  if (archivo.size > maxBytes) {
    throw new Error(
      `«${archivo.name}» pesa ${archivo.size} bytes y el límite es ${maxBytes} bytes.`,
    )
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
