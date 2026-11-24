/** Puerto del dominio Python. La app no envía los CSV a ningún servidor. */

export const SCHEMA_VERSION = 1
export const MAX_BYTES = 1_048_576
export const MAX_FILAS = 2_000
export const MAX_COLUMNAS = 40
export const MAX_IDENTIFICADOR = 200
export const MAX_DESCRIPCION = 500
export const MAX_MOTIVO = 500
export const MAX_MUESTRA = 3
export const MAX_DECIMALES = 4
export const MAX_DIGITOS_ENTEROS = 12

const CANTIDAD = new RegExp(
  `^-?(?:0|[1-9]\\d{0,${MAX_DIGITOS_ENTEROS - 1}})(?:\\.\\d{1,${MAX_DECIMALES}})?$`,
)
const PELIGROSOS = ["=", "+", "-", "@", "\t", "\r", "\n"]
const PREFIJOS = PELIGROSOS

export type Fichero = "A" | "B"
export type Delimitador = "," | ";"
export type ErrorDict = {
  codigo: string
  mensaje: string
  fichero: Fichero | null
  fila: number | null
  columna: string | null
  identificador?: string
}
export type Mapeo = { identificador: string; descripcion: string; cantidad: string }
export type Decision =
  | { tipo: "elegir_A"; motivo: string }
  | { tipo: "elegir_B"; motivo: string }
  | { tipo: "cantidad_manual"; cantidad: string; motivo: string }
  | { tipo: "excluir"; motivo: string }

type Borrador = {
  fichero: string
  fila: number
  identificador: string
  descripcion_cruda: string
  cantidad_cruda: string
  descripcion: string | null
  cantidad: string | null
  clave: string | null
  columna_id: string
  errores: ErrorDict[]
}

type Fila =
  | {
      tipo: "iguales"
      identificador: string
      descripcion: string
      cantidad: string
      fila_a: number
      fila_b: number
      decision: Decision | null
    }
  | {
      tipo: "modificado_cantidad"
      identificador: string
      descripcion: string
      cantidad_a: string
      cantidad_b: string
      fila_a: number
      fila_b: number
      decision: Decision | null
    }
  | {
      tipo: "modificado_descripcion"
      identificador: string
      descripcion_a: string
      descripcion_b: string
      cantidad_a: string
      cantidad_b: string
      fila_a: number
      fila_b: number
      decision: Decision | null
    }
  | {
      tipo: "solo_en_A"
      identificador: string
      descripcion: string
      cantidad: string
      fila_a: number
      decision: Decision | null
    }
  | {
      tipo: "solo_en_B"
      identificador: string
      descripcion: string
      cantidad: string
      fila_b: number
      decision: Decision | null
    }
  | {
      tipo: "bloqueados"
      fichero: Fichero
      fila: number
      identificador: string
      descripcion_cruda: string
      cantidad_cruda: string
      errores: ErrorDict[]
    }

export function error(
  codigo: string,
  mensaje: string,
  fichero: string | null = null,
  fila: number | null = null,
  columna: string | null = null,
  identificador?: string | null,
): ErrorDict {
  const datos: ErrorDict = {
    codigo,
    mensaje,
    fichero: fichero as Fichero | null,
    fila,
    columna,
  }
  if (identificador) datos.identificador = identificador
  return datos
}

export function normalizarTexto(texto: string): string {
  return texto.startsWith("\uFEFF") ? texto.slice(1) : texto
}

export async function sha256Texto(texto: string): Promise<string> {
  const data = new TextEncoder().encode(normalizarTexto(texto))
  const buf = await crypto.subtle.digest("SHA-256", data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function esCantidadCanonica(valor: string): boolean {
  if (!CANTIDAD.test(valor)) return false
  if (valor === "-0" || valor === "-0.0") return false
  if (valor.includes(".") && valor.endsWith("0")) return false
  return true
}

export function cantidadCanonica(texto: string): string | null {
  const limpio = texto.trim()
  if (!CANTIDAD.test(limpio)) return null
  let render = limpio
  if (render.includes(".")) render = render.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
  if (render === "-0" || render === "") render = "0"
  if (!esCantidadCanonica(render)) return null
  return render
}

function formulaNombre(caracter: string): string {
  const nombre: Record<string, string> = {
    "=": "=",
    "+": "+",
    "-": "-",
    "@": "@",
    "\t": "tabulación",
    "\r": "retorno de carro",
    "\n": "salto de línea",
  }
  return nombre[caracter] ?? caracter
}

function mensajeFormula(caracter: string): string {
  return `La celda empieza por un carácter de fórmula (${formulaNombre(caracter)}). Corrígelo en el origen; Cuadra no lo interpreta.`
}

function caracterFormula(raw: string): string | null {
  if (PELIGROSOS.includes(raw.slice(0, 1))) return raw.slice(0, 1)
  const sin = raw.replace(/^ +/, "")
  if (sin !== raw && PELIGROSOS.includes(sin.slice(0, 1))) return sin.slice(0, 1)
  return null
}

function contarDelimitadores(linea: string): [number, number] {
  let comas = 0
  let puntos = 0
  let entre = false
  let i = 0
  while (i < linea.length) {
    const c = linea[i]
    if (c === '"') {
      if (entre && linea[i + 1] === '"') {
        i += 2
        continue
      }
      entre = !entre
    } else if (!entre) {
      if (c === ",") comas += 1
      else if (c === ";") puntos += 1
    }
    i += 1
  }
  return [comas, puntos]
}

function resolverDelimitador(texto: string, elegido: string | null, fichero: string): [string | null, ErrorDict | null] {
  const lineas = texto.split(/\r\n|\n|\r/)
  if (lineas.length === 0 || (lineas.length === 1 && lineas[0] === "" && texto === "")) {
    return [null, error("fichero_vacio", `El fichero ${fichero} está vacío.`, fichero)]
  }
  if (!lineas.length) return [null, error("fichero_vacio", `El fichero ${fichero} está vacío.`, fichero)]
  const [comas, puntos] = contarDelimitadores(lineas[0] ?? "")
  if (elegido !== null) {
    if (elegido !== "," && elegido !== ";") {
      return [null, error("delimitador_ausente", `No se detectó coma ni punto y coma en la cabecera del fichero ${fichero}.`, fichero, 1, null)]
    }
    const propios = elegido === "," ? comas : puntos
    const ajenos = elegido === "," ? puntos : comas
    if (propios === 0 && ajenos > 0) {
      const visible = elegido === "," ? "coma" : "punto y coma"
      return [null, error("delimitador_no_coincide", `Elegiste ${visible} para el fichero ${fichero}, pero la cabecera no contiene ese delimitador fuera de comillas.`, fichero, 1, null)]
    }
    if (propios === 0) {
      return [null, error("delimitador_ausente", `No se detectó coma ni punto y coma en la cabecera del fichero ${fichero}.`, fichero, 1, null)]
    }
    return [elegido, null]
  }
  if (comas > 0 && puntos > 0) {
    return [null, error("delimitador_ambiguo", `El fichero ${fichero} usa coma y punto y coma fuera de comillas. Elige el delimitador; Cuadra no lo adivina.`, fichero, 1, null)]
  }
  if (comas > 0) return [",", null]
  if (puntos > 0) return [";", null]
  return [null, error("delimitador_ausente", `No se detectó coma ni punto y coma en la cabecera del fichero ${fichero}.`, fichero, 1, null)]
}

type Registro = { celdas: string[]; linea: number }

function registrosCsv(texto: string, delim: string): Registro[] {
  const salida: Registro[] = []
  let i = 0
  let linea = 1
  const n = texto.length
  while (i < n) {
    if (texto[i] === "\n" || (texto[i] === "\r" && texto[i + 1] !== "\n" && texto.slice(i).trim() === "")) {
      /* handled in row */
    }
    const celdas: string[] = []
    let celda = ""
    let comillas = false
    let empezado = false
    let cerrado = false
    while (i < n) {
      const c = texto[i]!
      if (comillas) {
        if (c === '"') {
          if (texto[i + 1] === '"') {
            celda += '"'
            i += 2
            continue
          }
          comillas = false
          i += 1
          continue
        }
        if (c === "\r" && texto[i + 1] === "\n") {
          linea += 1
          celda += "\r\n"
          i += 2
          continue
        }
        if (c === "\n") {
          linea += 1
          celda += "\n"
          i += 1
          continue
        }
        celda += c
        i += 1
        continue
      }
      if (c === '"') {
        comillas = true
        empezado = true
        i += 1
        continue
      }
      if (c === delim) {
        celdas.push(celda)
        celda = ""
        empezado = true
        i += 1
        continue
      }
      if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i += 1
        i += 1
        const lineaFila = linea
        linea += 1
        celdas.push(celda)
        salida.push({ celdas, linea: lineaFila })
        empezado = false
        cerrado = true
        break
      }
      celda += c
      empezado = true
      i += 1
    }
    if (!cerrado && i >= n && (empezado || celda !== "" || celdas.length > 0)) {
      celdas.push(celda)
      salida.push({ celdas, linea })
    }
  }
  return salida
}

function filaVacia(row: string[]): boolean {
  return row.length === 0 || (row.length === 1 && row[0] === "")
}

function analizarCantidad(raw: string, fichero: string, fila: number, columna: string): [string | null, string, ErrorDict | null] {
  if (["\t", "\r", "\n"].includes(raw.slice(0, 1))) {
    return [null, raw, error("formula_peligrosa", mensajeFormula(raw.slice(0, 1)), fichero, fila, columna)]
  }
  const limpio = raw.trim()
  if (limpio === "") return [null, "", error("cantidad_vacia", "La cantidad está vacía.", fichero, fila, columna)]
  const canonica = cantidadCanonica(limpio)
  if (canonica !== null) return [canonica, canonica, null]
  if (PELIGROSOS.includes(limpio.slice(0, 1))) {
    return [null, limpio, error("formula_peligrosa", mensajeFormula(limpio.slice(0, 1)), fichero, fila, columna)]
  }
  return [null, limpio, error("cantidad_invalida", `La cantidad «${limpio}» no es válida. Usa un entero o decimal con punto, signo menos opcional, sin separador de miles y con hasta 4 decimales.`, fichero, fila, columna)]
}

function analizarFila(numero: number, row: string[], fichero: string, ancho: number, indices: Record<string, number>, columnas: Record<string, string>): Borrador {
  const celda = (campo: string) => {
    const indice = indices[campo]!
    return indice >= row.length ? "" : row[indice]!
  }
  const idRaw = celda("identificador")
  const descRaw = celda("descripcion")
  const cantRaw = celda("cantidad")
  const necesario = Math.max(...Object.values(indices)) + 1
  if (row.length < necesario) {
    const ident = caracterFormula(idRaw) ? idRaw : idRaw.trim()
    const desc = caracterFormula(descRaw) ? descRaw : descRaw.trim()
    return {
      fichero, fila: numero, identificador: ident, descripcion_cruda: desc, cantidad_cruda: cantRaw.trim(),
      descripcion: null, cantidad: null, clave: null, columna_id: columnas.identificador!,
      errores: [error("fila_incompleta", `La fila ${numero} del fichero ${fichero} tiene ${row.length} columnas y la cabecera tiene ${ancho}.`, fichero, numero, null)],
    }
  }
  const errores: ErrorDict[] = []
  let identificador = ""
  let clave: string | null = null
  const peligroId = caracterFormula(idRaw)
  if (peligroId) {
    identificador = idRaw
    errores.push(error("formula_peligrosa", mensajeFormula(peligroId), fichero, numero, columnas.identificador!))
  } else {
    identificador = idRaw.trim()
    if (identificador === "") errores.push(error("identificador_vacio", "El identificador está vacío.", fichero, numero, columnas.identificador!))
    else if (identificador.length > MAX_IDENTIFICADOR) {
      clave = identificador
      errores.push(error("identificador_demasiado_largo", "El identificador supera 200 caracteres.", fichero, numero, columnas.identificador!))
    } else clave = identificador
  }
  let descripcion: string | null = null
  let descripcionCruda = ""
  const peligroDesc = caracterFormula(descRaw)
  if (peligroDesc) {
    descripcionCruda = descRaw
    errores.push(error("formula_peligrosa", mensajeFormula(peligroDesc), fichero, numero, columnas.descripcion!))
  } else {
    descripcion = descRaw.trim()
    descripcionCruda = descripcion
    if (descripcion.length > MAX_DESCRIPCION) {
      descripcion = null
      errores.push(error("descripcion_demasiado_larga", "La descripción supera 500 caracteres.", fichero, numero, columnas.descripcion!))
    }
  }
  const [cantidad, cantidadCruda, errorCantidad] = analizarCantidad(cantRaw, fichero, numero, columnas.cantidad!)
  if (errorCantidad) errores.push(errorCantidad)
  return {
    fichero, fila: numero, identificador, descripcion_cruda: descripcionCruda, cantidad_cruda: cantidadCruda,
    descripcion, cantidad, clave, columna_id: columnas.identificador!, errores,
  }
}

function validarMapeo(mapeo: Mapeo, fichero: string): ErrorDict | null {
  const campos = [mapeo.identificador, mapeo.descripcion, mapeo.cantidad]
  if (campos.some((campo) => typeof campo !== "string" || campo === "")) {
    return error("mapeo_repetido", `Las columnas de identificador, descripción y cantidad deben ser distintas en el fichero ${fichero}.`, fichero)
  }
  if (new Set(campos).size < 3) {
    return error("mapeo_repetido", `Las columnas de identificador, descripción y cantidad deben ser distintas en el fichero ${fichero}.`, fichero)
  }
  return null
}

function validarCabecera(nombres: string[], fichero: string): ErrorDict | null {
  if (nombres.some((nombre) => nombre === "")) return error("cabecera_vacia", `Hay un nombre de columna vacío en la cabecera del fichero ${fichero}.`, fichero, 1, null)
  const vistos = new Set<string>()
  for (const nombre of nombres) {
    if (vistos.has(nombre)) return error("cabecera_duplicada", `La columna «${nombre}» está repetida en la cabecera del fichero ${fichero}.`, fichero, 1, nombre)
    vistos.add(nombre)
  }
  if (nombres.length > MAX_COLUMNAS) {
    return error("demasiadas_columnas", `El fichero ${fichero} tiene ${nombres.length} columnas y el límite es ${MAX_COLUMNAS}.`, fichero, 1, null)
  }
  return null
}

function utf8Length(texto: string): number {
  return new TextEncoder().encode(texto).length
}

export function inspeccionar(csvTexto: string, delimitador: string | null = null, fichero: Fichero = "A") {
  const texto = normalizarTexto(csvTexto)
  const peso = utf8Length(texto)
  const vacio = (errores: ErrorDict[]) => ({ ok: false, delimitador: null, origen_delimitador: null, columnas: [] as string[], muestra: [] as Record<string, string>[], filas_datos: 0, errores })
  if (peso > MAX_BYTES) {
    return vacio([error("fichero_demasiado_grande", `El fichero ${fichero} pesa ${peso} bytes y el límite es ${MAX_BYTES} bytes (1 MiB).`, fichero)])
  }
  if (texto.trim() === "") return vacio([error("fichero_vacio", `El fichero ${fichero} está vacío.`, fichero)])
  const [delim, errorDelim] = resolverDelimitador(texto, delimitador, fichero)
  const origen = delimitador ? "elegido" : "detectado"
  if (errorDelim || !delim) return { ...vacio(errorDelim ? [errorDelim] : []), origen_delimitador: null }
  const registros = registrosCsv(texto, delim)
  const cabecera = registros[0]
  if (!cabecera) return { ok: false, delimitador: delim, origen_delimitador: origen, columnas: [], muestra: [], filas_datos: 0, errores: [error("sin_cabecera", `El fichero ${fichero} no tiene fila de cabecera.`, fichero)] }
  const nombres = cabecera.celdas.map((c) => c.trim())
  const mala = validarCabecera(nombres, fichero)
  if (mala) return { ok: false, delimitador: delim, origen_delimitador: origen, columnas: nombres, muestra: [], filas_datos: 0, errores: [mala] }
  const muestra: Record<string, string>[] = []
  let total = 0
  for (const row of registros.slice(1)) {
    if (filaVacia(row.celdas)) continue
    total += 1
    if (muestra.length < MAX_MUESTRA) {
      const item: Record<string, string> = {}
      nombres.forEach((nombre, i) => { item[nombre] = row.celdas[i] ?? "" })
      muestra.push(item)
    }
  }
  if (total > MAX_FILAS) {
    return { ok: false, delimitador: delim, origen_delimitador: origen, columnas: nombres, muestra, filas_datos: total, errores: [error("demasiadas_filas", `El fichero ${fichero} tiene ${total} filas de datos y el límite es ${MAX_FILAS}. Cuadra no procesa un prefijo: reduce el fichero y vuelve a importar.`, fichero)] }
  }
  return { ok: true, delimitador: delim, origen_delimitador: origen, columnas: nombres, muestra, filas_datos: total, errores: [] as ErrorDict[] }
}

function leerFichero(textoIn: string, fichero: string, mapeo: Mapeo, delimitador: string | null) {
  const texto = normalizarTexto(textoIn)
  const mapeoMal = validarMapeo(mapeo, fichero)
  if (mapeoMal) return { delimitador: null as string | null, errores: [mapeoMal], filas: [] as Borrador[], columnas: [] as string[], filas_datos: 0 }
  const peso = utf8Length(texto)
  if (peso > MAX_BYTES) {
    return { delimitador: null, errores: [error("fichero_demasiado_grande", `El fichero ${fichero} pesa ${peso} bytes y el límite es ${MAX_BYTES} bytes (1 MiB).`, fichero)], filas: [], columnas: [], filas_datos: 0 }
  }
  if (texto.trim() === "") return { delimitador: null, errores: [error("fichero_vacio", `El fichero ${fichero} está vacío.`, fichero)], filas: [], columnas: [], filas_datos: 0 }
  const [delim, errorDelim] = resolverDelimitador(texto, delimitador, fichero)
  if (errorDelim || !delim) return { delimitador: null, errores: errorDelim ? [errorDelim] : [], filas: [], columnas: [], filas_datos: 0 }
  const registros = registrosCsv(texto, delim)
  const cabecera = registros[0]
  if (!cabecera) return { delimitador: delim, errores: [error("sin_cabecera", `El fichero ${fichero} no tiene fila de cabecera.`, fichero)], filas: [], columnas: [], filas_datos: 0 }
  const nombres = cabecera.celdas.map((c) => c.trim())
  const cabeceraMal = validarCabecera(nombres, fichero)
  if (cabeceraMal) return { delimitador: delim, errores: [cabeceraMal], filas: [], columnas: nombres, filas_datos: 0 }
  const faltan: ErrorDict[] = []
  const indices: Record<string, number> = {}
  for (const campo of ["identificador", "descripcion", "cantidad"] as const) {
    const columna = mapeo[campo]
    if (!nombres.includes(columna)) {
      const lista = [...nombres].sort().join(", ")
      faltan.push(error("columna_inexistente", `La columna «${columna}» mapeada como ${campo} no existe en el fichero ${fichero}. Columnas encontradas: ${lista}.`, fichero, 1, columna))
    } else indices[campo] = nombres.indexOf(columna)
  }
  if (faltan.length) return { delimitador: delim, errores: faltan, filas: [], columnas: nombres, filas_datos: 0 }
  const crudas = registros.slice(1).filter((row) => !filaVacia(row.celdas))
  if (crudas.length > MAX_FILAS) {
    return { delimitador: delim, errores: [error("demasiadas_filas", `El fichero ${fichero} tiene ${crudas.length} filas de datos y el límite es ${MAX_FILAS}. Cuadra no procesa un prefijo: reduce el fichero y vuelve a importar.`, fichero)], filas: [], columnas: nombres, filas_datos: crudas.length }
  }
  const filas = crudas.map((row) => analizarFila(row.linea, row.celdas, fichero, nombres.length, indices, mapeo))
  return { delimitador: delim, errores: [] as ErrorDict[], filas, columnas: nombres, filas_datos: filas.length }
}

function marcarDuplicados(filas: Borrador[]) {
  const grupos = new Map<string, Borrador[]>()
  for (const fila of filas) {
    if (fila.clave === null) continue
    const grupo = grupos.get(fila.clave) ?? []
    grupo.push(fila)
    grupos.set(fila.clave, grupo)
  }
  for (const [clave, grupo] of grupos) {
    if (grupo.length < 2) continue
    const numeros = grupo.map((fila) => fila.fila).sort((a, b) => a - b)
    const mensaje = `Identificador «${clave}» duplicado en el fichero ${grupo[0]!.fichero} (filas ${numeros.join(", ")}). No se fusionan ni se comparan.`
    for (const fila of grupo) fila.errores.push(error("identificador_duplicado", mensaje, fila.fichero, fila.fila, fila.columna_id))
  }
}

function marcarCruce(filasA: Borrador[], filasB: Borrador[]) {
  const grupos = (filas: Borrador[]) => {
    const mapa = new Map<string, Borrador[]>()
    for (const fila of filas) {
      if (fila.clave === null) continue
      const grupo = mapa.get(fila.clave) ?? []
      grupo.push(fila)
      mapa.set(fila.clave, grupo)
    }
    return mapa
  }
  const gruposA = grupos(filasA)
  const gruposB = grupos(filasB)
  const inseguras = (mapa: Map<string, Borrador[]>) => new Set([...mapa].filter(([, grupo]) => grupo.length > 1 || grupo.some((fila) => fila.errores.length)).map(([clave]) => clave))
  const avisar = (origen: Borrador[], otro: Map<string, Borrador[]>, malas: Set<string>, ficheroOtro: string) => {
    for (const fila of origen) {
      if (fila.clave === null || !malas.has(fila.clave)) continue
      const grupo = otro.get(fila.clave) ?? []
      const detalle = grupo.length > 1
        ? `duplicado en las filas ${grupo.map((item) => item.fila).sort((a, b) => a - b).join(", ")}`
        : grupo.length === 1
          ? `errores en la fila ${grupo[0]!.fila}`
          : `errores en las filas ${grupo.map((item) => item.fila).sort((a, b) => a - b).join(", ")}`
      fila.errores.push(error("clave_bloqueada_en_el_otro", `No se compara: en el fichero ${ficheroOtro} la clave «${fila.clave}» está bloqueada (${detalle}).`, fila.fichero, fila.fila, fila.columna_id))
    }
  }
  avisar(filasA, gruposB, inseguras(gruposB), "B")
  avisar(filasB, gruposA, inseguras(gruposA), "A")
}

function bloqueada(fila: Borrador): Fila {
  if (fila.errores.length === 0) {
    fila.errores.push(error("fila_incompleta", `La fila ${fila.fila} del fichero ${fila.fichero} tiene 0 columnas y la cabecera tiene 0.`, fila.fichero, fila.fila, null))
  }
  return {
    tipo: "bloqueados",
    fichero: fila.fichero as Fichero,
    fila: fila.fila,
    identificador: fila.identificador,
    descripcion_cruda: fila.descripcion_cruda,
    cantidad_cruda: fila.cantidad_cruda,
    errores: fila.errores.map((item) => ({ codigo: item.codigo, mensaje: item.mensaje, fichero: item.fichero, fila: item.fila, columna: item.columna })),
  }
}

function comparar(a: Borrador, b: Borrador): Fila {
  if (a.descripcion === b.descripcion && a.cantidad === b.cantidad) {
    return { tipo: "iguales", identificador: a.clave!, descripcion: a.descripcion!, cantidad: a.cantidad!, fila_a: a.fila, fila_b: b.fila, decision: null }
  }
  if (a.descripcion === b.descripcion) {
    return { tipo: "modificado_cantidad", identificador: a.clave!, descripcion: a.descripcion!, cantidad_a: a.cantidad!, cantidad_b: b.cantidad!, fila_a: a.fila, fila_b: b.fila, decision: null }
  }
  return { tipo: "modificado_descripcion", identificador: a.clave!, descripcion_a: a.descripcion!, descripcion_b: b.descripcion!, cantidad_a: a.cantidad!, cantidad_b: b.cantidad!, fila_a: a.fila, fila_b: b.fila, decision: null }
}

function emparejar(ladoA: ReturnType<typeof leerFichero>, ladoB: ReturnType<typeof leerFichero>): Fila[] {
  const indiceB = new Map(ladoB.filas.filter((fila) => fila.clave && fila.errores.length === 0).map((fila) => [fila.clave!, fila]))
  const comparables: Fila[] = []
  const bloqueadas: Fila[] = []
  const usadas = new Set<string>()
  for (const fila of ladoA.filas) {
    if (fila.errores.length || fila.clave === null || fila.descripcion === null || fila.cantidad === null) {
      bloqueadas.push(bloqueada(fila))
      continue
    }
    const otro = indiceB.get(fila.clave)
    if (!otro) {
      comparables.push({ tipo: "solo_en_A", identificador: fila.clave, descripcion: fila.descripcion, cantidad: fila.cantidad, fila_a: fila.fila, decision: null })
      continue
    }
    usadas.add(fila.clave)
    comparables.push(comparar(fila, otro))
  }
  for (const fila of ladoB.filas) {
    if (fila.errores.length || fila.clave === null || fila.descripcion === null || fila.cantidad === null) {
      bloqueadas.push(bloqueada(fila))
      continue
    }
    if (usadas.has(fila.clave)) continue
    comparables.push({ tipo: "solo_en_B", identificador: fila.clave, descripcion: fila.descripcion, cantidad: fila.cantidad, fila_b: fila.fila, decision: null })
  }
  comparables.sort((a, b) => a.identificador < b.identificador ? -1 : a.identificador > b.identificador ? 1 : 0)
  bloqueadas.sort((a, b) => {
    if (a.tipo !== "bloqueados" || b.tipo !== "bloqueados") return 0
    const fa = a.fichero === "A" ? 0 : 1
    const fb = b.fichero === "A" ? 0 : 1
    return fa - fb || a.fila - b.fila
  })
  return [...comparables, ...bloqueadas]
}

function decisionDe(cruda: Record<string, unknown>, fila: Fila): [Decision | null, ErrorDict | null] {
  const ident = fila.identificador
  const motivoRaw = cruda.motivo
  if (typeof motivoRaw !== "string" || motivoRaw.trim() === "") {
    return [null, error("motivo_vacio", `La decisión sobre «${ident}» necesita un motivo.`, null, null, null, ident)]
  }
  const motivo = motivoRaw.trim()
  if (motivo.length > MAX_MOTIVO) return [null, error("motivo_largo", `El motivo de «${ident}» supera 500 caracteres.`, null, null, null, ident)]
  const tipo = cruda.tipo
  if (tipo !== "elegir_A" && tipo !== "elegir_B" && tipo !== "cantidad_manual" && tipo !== "excluir") {
    return [null, error("decision_tipo_desconocido", `La decisión sobre «${ident}» tiene un tipo desconocido.`, null, null, null, ident)]
  }
  if (tipo === "cantidad_manual" && fila.tipo === "modificado_descripcion") {
    return [null, error("decision_ilegal", `No puedes fijar solo la cantidad en «${ident}» porque las descripciones difieren. Elige A, elige B o excluye la fila.`, null, null, null, ident)]
  }
  let decision: Decision
  if (tipo === "elegir_A") decision = { tipo, motivo }
  else if (tipo === "elegir_B") decision = { tipo, motivo }
  else if (tipo === "excluir") decision = { tipo, motivo }
  else {
    const cant = cruda.cantidad
    if (typeof cant !== "string") return [null, error("cantidad_manual_invalida", `La cantidad manual de «${ident}» no es válida.`, null, null, null, ident)]
    const canonica = cantidadCanonica(cant)
    if (canonica === null) return [null, error("cantidad_manual_invalida", `La cantidad manual de «${ident}» no es válida.`, null, null, null, ident)]
    decision = { tipo: "cantidad_manual", cantidad: canonica, motivo }
  }
  if (fila.tipo === "solo_en_A" && decision.tipo === "elegir_B") return [null, error("decision_ilegal", `La decisión «elegir_B» no está permitida en una fila solo_en_A («${ident}»).`, null, null, null, ident)]
  if (fila.tipo === "solo_en_B" && decision.tipo === "elegir_A") return [null, error("decision_ilegal", `La decisión «elegir_A» no está permitida en una fila solo_en_B («${ident}»).`, null, null, null, ident)]
  return [decision, null]
}

function aplicarDecisiones(filas: Fila[], decisiones: Record<string, unknown>[]): [Fila[], ErrorDict[]] {
  if (decisiones.length === 0) return [filas, []]
  const errores: ErrorDict[] = []
  const conteo = new Map<string, number>()
  const preparados: [Record<string, unknown>, string | null][] = []
  for (const cruda of decisiones) {
    if (!cruda || typeof cruda !== "object") {
      preparados.push([{}, null])
      continue
    }
    const ident = cruda.identificador
    const limpio = typeof ident === "string" ? ident.trim() : null
    preparados.push([cruda, limpio])
    if (limpio) conteo.set(limpio, (conteo.get(limpio) ?? 0) + 1)
  }
  const porId = new Map(filas.filter((fila) => fila.tipo !== "bloqueados").map((fila) => [fila.identificador, fila]))
  const bloqueadas = new Set(filas.filter((fila) => fila.tipo === "bloqueados" && fila.identificador !== "").map((fila) => fila.identificador))
  const aplicadas = new Map<string, Fila>()
  const duplicadas = new Set<string>()
  for (const [cruda, ident] of preparados) {
    if (!ident) {
      const mostrado = String(cruda.identificador ?? "")
      errores.push(error("decision_desconocida", `La decisión sobre «${mostrado}» no corresponde a ninguna fila comparable.`, null, null, null, mostrado || null))
      continue
    }
    if ((conteo.get(ident) ?? 0) > 1) {
      if (!duplicadas.has(ident)) {
        duplicadas.add(ident)
        errores.push(error("decision_duplicada", `Hay más de una decisión para «${ident}».`, null, null, null, ident))
      }
      continue
    }
    if (bloqueadas.has(ident)) {
      errores.push(error("decision_en_bloqueada", `La clave «${ident}» está bloqueada. No se decide: corrige el origen y reimporta.`, null, null, null, ident))
      continue
    }
    const fila = porId.get(ident)
    if (!fila) {
      errores.push(error("decision_desconocida", `La decisión sobre «${ident}» no corresponde a ninguna fila comparable.`, null, null, null, ident))
      continue
    }
    const [decision, problema] = decisionDe(cruda, fila)
    if (problema || !decision) {
      if (problema) errores.push(problema)
      continue
    }
    aplicadas.set(ident, { ...fila, decision } as Fila)
  }
  return [filas.map((fila) => (fila.tipo !== "bloqueados" && aplicadas.has(fila.identificador) ? aplicadas.get(fila.identificador)! : fila)), errores]
}

function resumenDe(filas: Fila[]) {
  const resumen = { iguales: 0, modificados: 0, solo_en_A: 0, solo_en_B: 0, bloqueados: 0, pendientes: 0, resueltos: 0 }
  for (const fila of filas) {
    if (fila.tipo === "bloqueados") {
      resumen.bloqueados += 1
      continue
    }
    const tipo = fila.tipo === "modificado_cantidad" || fila.tipo === "modificado_descripcion" ? "modificados" : fila.tipo
    resumen[tipo] += 1
    if (fila.decision === null && fila.tipo !== "iguales") resumen.pendientes += 1
    else resumen.resueltos += 1
  }
  return resumen
}

function filaADict(fila: Fila): Record<string, unknown> {
  if (fila.tipo === "bloqueados") {
    return { tipo: "bloqueados", fichero: fila.fichero, fila: fila.fila, identificador: fila.identificador, descripcion_cruda: fila.descripcion_cruda, cantidad_cruda: fila.cantidad_cruda, errores: fila.errores }
  }
  const decision = fila.decision
    ? fila.decision.tipo === "cantidad_manual"
      ? { tipo: "cantidad_manual", cantidad: fila.decision.cantidad, motivo: fila.decision.motivo }
      : { tipo: fila.decision.tipo, motivo: fila.decision.motivo }
    : null
  const estado = fila.tipo === "iguales" || fila.decision ? "resuelta" : "pendiente"
  if (fila.tipo === "iguales") return { tipo: "iguales", identificador: fila.identificador, descripcion: fila.descripcion, cantidad: fila.cantidad, fila_a: fila.fila_a, fila_b: fila.fila_b, estado, decision }
  if (fila.tipo === "solo_en_A") return { tipo: "solo_en_A", identificador: fila.identificador, descripcion: fila.descripcion, cantidad: fila.cantidad, fila_a: fila.fila_a, estado, decision }
  if (fila.tipo === "solo_en_B") return { tipo: "solo_en_B", identificador: fila.identificador, descripcion: fila.descripcion, cantidad: fila.cantidad, fila_b: fila.fila_b, estado, decision }
  const descripcionA = fila.tipo === "modificado_cantidad" ? fila.descripcion : fila.descripcion_a
  const descripcionB = fila.tipo === "modificado_cantidad" ? fila.descripcion : fila.descripcion_b
  return {
    tipo: "modificados",
    identificador: fila.identificador,
    descripcion_a: descripcionA,
    cantidad_a: fila.cantidad_a,
    descripcion_b: descripcionB,
    cantidad_b: fila.cantidad_b,
    descripcion_difiere: descripcionA !== descripcionB,
    cantidad_difiere: fila.cantidad_a !== fila.cantidad_b,
    fila_a: fila.fila_a,
    fila_b: fila.fila_b,
    estado,
    decision,
  }
}

export function reconciliar(csvA: string, csvB: string, mapeoA: Mapeo, mapeoB: Mapeo, delimitadorA: string | null = null, delimitadorB: string | null = null, decisiones: Record<string, unknown>[] = []) {
  const ladoA = leerFichero(csvA, "A", mapeoA, delimitadorA)
  const ladoB = leerFichero(csvB, "B", mapeoB, delimitadorB)
  if (ladoA.errores.length || ladoB.errores.length) {
    return { ok: false, delimitador_a: ladoA.delimitador, delimitador_b: ladoB.delimitador, exportacion_completa_permitida: false, resumen: null, filas: [], errores: [...ladoA.errores, ...ladoB.errores], errores_decision: [] }
  }
  marcarDuplicados(ladoA.filas)
  marcarDuplicados(ladoB.filas)
  marcarCruce(ladoA.filas, ladoB.filas)
  const [filas, erroresDecision] = aplicarDecisiones(emparejar(ladoA, ladoB), decisiones)
  const resumen = resumenDe(filas)
  return {
    ok: true,
    delimitador_a: ladoA.delimitador,
    delimitador_b: ladoB.delimitador,
    exportacion_completa_permitida: resumen.pendientes === 0 && resumen.bloqueados === 0,
    resumen,
    filas: filas.map(filaADict),
    errores: [],
    errores_decision: erroresDecision,
  }
}

function neutralizar(valor: string): string {
  return PREFIJOS.some((prefijo) => valor.startsWith(prefijo)) ? `'${valor}` : valor
}
function celdaCantidad(valor: string): string {
  return valor === "" || esCantidadCanonica(valor) ? valor : neutralizar(valor)
}
function csvCampo(valor: string): string {
  return /[",\n\r]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor
}
function renderCsv(meta: string[], header: string[], filas: string[][]): string {
  const lineas = [...meta, header.map(csvCampo).join(","), ...filas.map((fila) => fila.map(csvCampo).join(","))]
  return `${lineas.join("\n")}\n`
}

type Resolucion = { incluida: boolean; origen: string; descripcion: string; cantidad: string; decision: string; motivo: string }

function datosLado(fila: Fila, lado: "A" | "B"): [number, string, string] {
  if (fila.tipo === "iguales") return [lado === "A" ? fila.fila_a : fila.fila_b, fila.descripcion, fila.cantidad]
  if (fila.tipo === "modificado_cantidad") return lado === "A" ? [fila.fila_a, fila.descripcion, fila.cantidad_a] : [fila.fila_b, fila.descripcion, fila.cantidad_b]
  if (fila.tipo === "modificado_descripcion") return lado === "A" ? [fila.fila_a, fila.descripcion_a, fila.cantidad_a] : [fila.fila_b, fila.descripcion_b, fila.cantidad_b]
  if (fila.tipo === "solo_en_A") return [fila.fila_a, fila.descripcion, fila.cantidad]
  if (fila.tipo === "solo_en_B") return [fila.fila_b, fila.descripcion, fila.cantidad]
  throw new Error("fila sin lado")
}

function resolverFila(fila: Fila): Resolucion {
  if (fila.tipo === "bloqueados") return { incluida: false, origen: "", descripcion: "", cantidad: "", decision: "", motivo: "" }
  if (!fila.decision) {
    if (fila.tipo === "iguales") return { incluida: true, origen: "igual", descripcion: fila.descripcion, cantidad: fila.cantidad, decision: "", motivo: "" }
    return { incluida: false, origen: "", descripcion: "", cantidad: "", decision: "", motivo: "" }
  }
  if (fila.decision.tipo === "excluir") return { incluida: false, origen: "", descripcion: "", cantidad: "", decision: "excluir", motivo: fila.decision.motivo }
  if (fila.decision.tipo === "cantidad_manual") {
    const descripcion = fila.tipo === "modificado_descripcion" ? "" : fila.tipo === "modificado_cantidad" || fila.tipo === "iguales" || fila.tipo === "solo_en_A" || fila.tipo === "solo_en_B" ? fila.descripcion : ""
    return { incluida: true, origen: "manual", descripcion, cantidad: fila.decision.cantidad, decision: "cantidad_manual", motivo: fila.decision.motivo }
  }
  if (fila.decision.tipo === "elegir_A") {
    const [, descripcion, cantidad] = datosLado(fila, "A")
    return { incluida: true, origen: "A", descripcion, cantidad, decision: "elegir_A", motivo: fila.decision.motivo }
  }
  const [, descripcion, cantidad] = datosLado(fila, "B")
  return { incluida: true, origen: "B", descripcion, cantidad, decision: "elegir_B", motivo: fila.decision.motivo }
}

export class ExportacionBloqueada extends Error {
  pendientes: number
  bloqueados: number
  constructor(pendientes: number, bloqueados: number) {
    super(`La exportación completa está bloqueada: ${pendientes} pendientes y ${bloqueados} bloqueados.`)
    this.pendientes = pendientes
    this.bloqueados = bloqueados
  }
}

export function exportarCuadre(csvA: string, csvB: string, mapeoA: Mapeo, mapeoB: Mapeo, delimitadorA: string | null, delimitadorB: string | null, decisiones: Record<string, unknown>[], modo: "completa" | "parcial") {
  const cuadre = reconciliar(csvA, csvB, mapeoA, mapeoB, delimitadorA, delimitadorB, decisiones)
  if (!cuadre.ok || !cuadre.resumen) throw new ExportacionBloqueada(0, 0)
  if (modo === "completa" && (cuadre.resumen.pendientes || cuadre.resumen.bloqueados)) {
    throw new ExportacionBloqueada(cuadre.resumen.pendientes, cuadre.resumen.bloqueados)
  }
  const marca = modo === "completa" ? "COMPLETA" : "PARCIAL"
  const sufijo = modo === "completa" ? "completo" : "parcial"
  const filas = reconciliarInterno(csvA, csvB, mapeoA, mapeoB, delimitadorA, delimitadorB, decisiones)
  let excluidas = 0
  const historial: string[][] = []
  const inventario: string[][] = []
  for (const fila of filas) {
    if (fila.tipo === "bloqueados") {
      historial.push([marca, fila.fichero, String(fila.fila), neutralizar(fila.identificador), neutralizar(fila.descripcion_cruda), celdaCantidad(fila.cantidad_cruda), "bloqueados", "", "", "", "no"])
      continue
    }
    const resolucion = resolverFila(fila)
    if (resolucion.incluida) inventario.push([marca, neutralizar(fila.identificador), neutralizar(resolucion.descripcion), celdaCantidad(resolucion.cantidad), resolucion.origen])
    const lados: ("A" | "B")[] = fila.tipo === "solo_en_A" ? ["A"] : fila.tipo === "solo_en_B" ? ["B"] : ["A", "B"]
    for (const lado of lados) {
      const [numero, descripcion, cantidad] = datosLado(fila, lado)
      if (resolucion.decision === "excluir") excluidas += 1
      historial.push([marca, lado, String(numero), neutralizar(fila.identificador), neutralizar(descripcion), celdaCantidad(cantidad), fila.tipo === "modificado_cantidad" || fila.tipo === "modificado_descripcion" ? "modificados" : fila.tipo, resolucion.decision, resolucion.incluida ? resolucion.cantidad : "", neutralizar(resolucion.motivo), resolucion.incluida ? "si" : "no"])
    }
  }
  inventario.sort((a, b) => (a[1]! < b[1]! ? -1 : a[1]! > b[1]! ? 1 : 0))
  historial.sort((a, b) => a[1]!.localeCompare(b[1]!) || Number(a[2]) - Number(b[2]))
  const meta = ["# cuadra_schema=1", `# cuadra_exportacion=${marca}`, `# cuadra_pendientes=${cuadre.resumen.pendientes}`, `# cuadra_bloqueados=${cuadre.resumen.bloqueados}`, `# cuadra_excluidas=${excluidas}`]
  return {
    completa: modo === "completa",
    nombre_inventario: `cuadra-inventario-${sufijo}.csv`,
    nombre_historial: `cuadra-historial-${sufijo}.csv`,
    inventario_csv: renderCsv(["# cuadra_schema=1", "# cuadra_tipo=inventario", ...meta.slice(1)], ["marca_exportacion", "identificador", "descripcion", "cantidad", "origen"], inventario),
    historial_csv: renderCsv(["# cuadra_schema=1", "# cuadra_tipo=historial", ...meta.slice(1)], ["marca_exportacion", "fichero", "fila", "identificador", "descripcion", "cantidad_original", "categoria", "decision", "cantidad_decidida", "motivo", "en_inventario"], historial),
  }
}

function reconciliarInterno(csvA: string, csvB: string, mapeoA: Mapeo, mapeoB: Mapeo, delimitadorA: string | null, delimitadorB: string | null, decisiones: Record<string, unknown>[]) {
  const ladoA = leerFichero(csvA, "A", mapeoA, delimitadorA)
  const ladoB = leerFichero(csvB, "B", mapeoB, delimitadorB)
  marcarDuplicados(ladoA.filas)
  marcarDuplicados(ladoB.filas)
  marcarCruce(ladoA.filas, ladoB.filas)
  return aplicarDecisiones(emparejar(ladoA, ladoB), decisiones)[0]
}

export async function crearSesion(csvA: string, csvB: string, mapeoA: Mapeo, mapeoB: Mapeo, nombreA: string, nombreB: string, delimitadorA: string | null, delimitadorB: string | null, decisiones: Record<string, unknown>[]) {
  const cuadre = reconciliar(csvA, csvB, mapeoA, mapeoB, delimitadorA, delimitadorB, [])
  const guardadas = decisiones.map((cruda) => {
    const ident = typeof cruda.identificador === "string" ? cruda.identificador.trim() : cruda.identificador
    const motivo = typeof cruda.motivo === "string" ? cruda.motivo.trim() : cruda.motivo
    const guardada: Record<string, unknown> = { identificador: ident, tipo: cruda.tipo, motivo }
    if (cruda.tipo === "cantidad_manual") {
      const cant = cruda.cantidad
      guardada.cantidad = typeof cant === "string" ? (cantidadCanonica(cant) ?? cant.trim()) : cant
    }
    return guardada
  }).sort((a, b) => String(a.identificador).localeCompare(String(b.identificador)))
  return {
    aplicacion: "cuadra",
    schema_version: SCHEMA_VERSION,
    fichero_a: { nombre: nombreA, sha256: await sha256Texto(csvA), delimitador: cuadre.delimitador_a || delimitadorA, mapeo: { ...mapeoA } },
    fichero_b: { nombre: nombreB, sha256: await sha256Texto(csvB), delimitador: cuadre.delimitador_b || delimitadorB, mapeo: { ...mapeoB } },
    decisiones: guardadas,
  }
}

export function serializarSesion(sesion: unknown): string {
  return `${JSON.stringify(ordenar(sesion), null, 2)}\n`
}

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar)
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.keys(valor as object).sort().map((clave) => [clave, ordenar((valor as Record<string, unknown>)[clave])]))
  }
  return valor
}

const CAMPOS_SESION = new Set(["aplicacion", "schema_version", "fichero_a", "fichero_b", "decisiones"])
const CAMPOS_FICHERO = new Set(["nombre", "sha256", "delimitador", "mapeo"])
const CAMPOS_MAPEO = new Set(["identificador", "descripcion", "cantidad"])
const CAMPOS_DECISION = new Set(["identificador", "tipo", "motivo", "cantidad"])

function fracaso(errores: ErrorDict[], delimitadorA: string | null = null, delimitadorB: string | null = null) {
  return {
    ok: false as const,
    delimitador_a: delimitadorA,
    delimitador_b: delimitadorB,
    exportacion_completa_permitida: false,
    resumen: null,
    filas: [],
    errores,
    errores_decision: [] as ErrorDict[],
  }
}

export function parsearSesion(texto: string) {
  try {
    const datos = JSON.parse(texto) as unknown
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
      return { ok: false as const, sesion: null, errores: [error("sesion_json", "La sesión no es JSON válido.")] }
    }
    return { ok: true as const, sesion: datos as Record<string, unknown>, errores: [] as ErrorDict[] }
  } catch {
    return { ok: false as const, sesion: null, errores: [error("sesion_json", "La sesión no es JSON válido.")] }
  }
}

function extras(objeto: object, permitidos: Set<string>): string[] {
  return Object.keys(objeto).filter((clave) => !permitidos.has(clave)).sort()
}

function validarFichero(bloque: unknown, campo: string): ErrorDict[] {
  if (!bloque || typeof bloque !== "object" || Array.isArray(bloque)) {
    return [error("sesion_campo", `A la sesión le falta el campo «${campo}».`)]
  }
  const datos = bloque as Record<string, unknown>
  const errores: ErrorDict[] = []
  for (const extra of extras(datos, CAMPOS_FICHERO)) {
    errores.push(error("sesion_campo_desconocido", `La sesión trae un campo que Cuadra no reconoce: «${extra}».`))
  }
  for (const requerido of [...CAMPOS_FICHERO].filter((clave) => !(clave in datos)).sort()) {
    errores.push(error("sesion_campo", `A la sesión le falta el campo «${campo}.${requerido}».`))
  }
  if (errores.length) return errores
  if (datos.delimitador !== "," && datos.delimitador !== ";") {
    const lado = campo.endsWith("a") ? "A" : "B"
    errores.push(error("delimitador_ausente", `No se detectó coma ni punto y coma en la cabecera del fichero ${lado}.`, lado))
  }
  if (typeof datos.sha256 !== "string" || typeof datos.nombre !== "string") {
    errores.push(error("sesion_campo", `A la sesión le falta el campo «${campo}».`))
  }
  const mapeo = datos.mapeo
  if (!mapeo || typeof mapeo !== "object" || Array.isArray(mapeo)) {
    return [...errores, error("sesion_campo", `A la sesión le falta el campo «${campo}.mapeo».`)]
  }
  for (const extra of extras(mapeo, CAMPOS_MAPEO)) {
    errores.push(error("sesion_campo_desconocido", `La sesión trae un campo que Cuadra no reconoce: «${extra}».`))
  }
  for (const requerido of [...CAMPOS_MAPEO].filter((clave) => !(clave in (mapeo as object))).sort()) {
    errores.push(error("sesion_campo", `A la sesión le falta el campo «${campo}.mapeo.${requerido}».`))
  }
  return errores
}

function validarDecisionForma(decision: unknown, indice: number): ErrorDict[] {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    return [error("sesion_decisiones", "El campo «decisiones» de la sesión tiene que ser una lista.")]
  }
  const datos = decision as Record<string, unknown>
  const permitidas = datos.tipo === "cantidad_manual" ? CAMPOS_DECISION : new Set(["identificador", "tipo", "motivo"])
  const errores: ErrorDict[] = []
  for (const extra of extras(datos, permitidas)) {
    errores.push(error("sesion_campo_desconocido", `La sesión trae un campo que Cuadra no reconoce: «${extra}».`))
  }
  for (const requerido of ["identificador", "tipo", "motivo"]) {
    if (!(requerido in datos)) {
      errores.push(error("sesion_campo", `A la sesión le falta el campo «decisiones[${indice}].${requerido}».`))
    }
  }
  return errores
}

function validarForma(sesion: unknown): ErrorDict[] {
  if (!sesion || typeof sesion !== "object" || Array.isArray(sesion)) {
    return [error("sesion_json", "La sesión no es JSON válido.")]
  }
  const datos = sesion as Record<string, unknown>
  if (!("schema_version" in datos)) return [error("sesion_campo", "A la sesión le falta el campo «schema_version».")]
  const version = datos.schema_version
  if (typeof version !== "number" || !Number.isInteger(version) || version !== SCHEMA_VERSION) {
    return [error("sesion_version", `La sesión usa schema_version ${version} y Cuadra solo abre la versión 1.`)]
  }
  const errores: ErrorDict[] = []
  for (const campo of extras(datos, CAMPOS_SESION)) {
    errores.push(error("sesion_campo_desconocido", `La sesión trae un campo que Cuadra no reconoce: «${campo}».`))
  }
  for (const campo of ["aplicacion", "fichero_a", "fichero_b", "decisiones"]) {
    if (!(campo in datos)) errores.push(error("sesion_campo", `A la sesión le falta el campo «${campo}».`))
  }
  if (errores.length) return errores
  if (datos.aplicacion !== "cuadra") {
    errores.push(error("sesion_campo_desconocido", "La sesión trae un campo que Cuadra no reconoce: «aplicacion»."))
  }
  errores.push(...validarFichero(datos.fichero_a, "fichero_a"))
  errores.push(...validarFichero(datos.fichero_b, "fichero_b"))
  if (!Array.isArray(datos.decisiones)) {
    errores.push(error("sesion_decisiones", "El campo «decisiones» de la sesión tiene que ser una lista."))
  } else {
    datos.decisiones.forEach((decision, indice) => errores.push(...validarDecisionForma(decision, indice)))
  }
  return errores
}

export async function abrirSesionLocal(sesion: Record<string, unknown>, csvA: string, csvB: string) {
  const problemas = validarForma(sesion)
  if (problemas.length) return fracaso(problemas)
  const ficheroA = sesion.fichero_a as { sha256: string; mapeo: Mapeo; delimitador: "," | ";" }
  const ficheroB = sesion.fichero_b as { sha256: string; mapeo: Mapeo; delimitador: "," | ";" }
  const errores: ErrorDict[] = []
  if ((await sha256Texto(csvA)) !== ficheroA.sha256) {
    errores.push(error("sesion_hash", "El fichero A no coincide con la sesión (el contenido cambió).", "A"))
  }
  if ((await sha256Texto(csvB)) !== ficheroB.sha256) {
    errores.push(error("sesion_hash", "El fichero B no coincide con la sesión (el contenido cambió).", "B"))
  }
  if (errores.length) return fracaso(errores)
  const cuadre = reconciliar(csvA, csvB, ficheroA.mapeo, ficheroB.mapeo, ficheroA.delimitador, ficheroB.delimitador, (sesion.decisiones as Record<string, unknown>[]) ?? [])
  if (!cuadre.ok) return fracaso(cuadre.errores, cuadre.delimitador_a, cuadre.delimitador_b)
  if (cuadre.errores_decision.length) return fracaso(cuadre.errores_decision, cuadre.delimitador_a, cuadre.delimitador_b)
  return cuadre
}
