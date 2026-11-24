import { useEffect, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import {
  ErrorCuadra,
  abrirSesion,
  exportar,
  guardarSesion,
  inspeccionar,
  leerArchivo,
  mapeoListo,
  obtenerDemo,
  obtenerLimites,
  reconciliar,
} from "./api.ts"
import { Barra } from "./componentes/Barra.tsx"
import { Cierre } from "./componentes/Cierre.tsx"
import { AccionReconciliar, PanelFichero } from "./componentes/Ficheros.tsx"
import { Portada } from "./componentes/Portada.tsx"
import { TablaCuadre } from "./componentes/Tabla.tsx"
import { decisionesDesdeFilas, sugerirColumna } from "./opciones.ts"
import type {
  DecisionEnviada,
  Delimitador,
  FicheroUi,
  Filtro,
  Inspeccion,
  Limites,
  Mapeo,
  Resultado,
} from "./tipos.ts"

function armarFichero(nombre: string, texto: string, inspeccion: Inspeccion, mapeoPreferido?: Mapeo): FicheroUi {
  const sugerido: Mapeo = {
    identificador: sugerirColumna(inspeccion.columnas, ["sku", "codigo", "id"]),
    descripcion: sugerirColumna(inspeccion.columnas, ["descripcion", "nombre"]),
    cantidad: sugerirColumna(inspeccion.columnas, ["cantidad", "stock"]),
  }
  const base = mapeoPreferido ?? sugerido
  const mapeo: Mapeo = {
    identificador: inspeccion.columnas.includes(base.identificador) ? base.identificador : sugerido.identificador,
    descripcion: inspeccion.columnas.includes(base.descripcion) ? base.descripcion : sugerido.descripcion,
    cantidad: inspeccion.columnas.includes(base.cantidad) ? base.cantidad : sugerido.cantidad,
  }
  return {
    nombre,
    texto,
    delimitador: inspeccion.delimitador ?? "",
    origenDelimitador: inspeccion.origen_delimitador,
    columnas: inspeccion.columnas,
    muestra: inspeccion.muestra,
    filasDatos: inspeccion.filas_datos,
    errores: inspeccion.errores,
    mapeo,
  }
}

function textoError(error: unknown): string {
  if (error instanceof ErrorCuadra) return error.message
  if (error instanceof Error) return error.message
  return "No se pudo completar la operación."
}

export default function App() {
  const generacion = useRef(0)
  const [limites, setLimites] = useState<Limites | null>(null)
  const [falloLimites, setFalloLimites] = useState("")
  const [falloMuestra, setFalloMuestra] = useState("")
  const [ocupado, setOcupado] = useState(true)
  const [cargandoMuestra, setCargandoMuestra] = useState(true)
  const [aviso, setAviso] = useState("")
  const [relato, setRelato] = useState("")
  const [muestra, setMuestra] = useState(false)
  const [ficheroA, setFicheroA] = useState<FicheroUi | null>(null)
  const [ficheroB, setFicheroB] = useState<FicheroUi | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [decisiones, setDecisiones] = useState<DecisionEnviada[]>([])
  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [busqueda, setBusqueda] = useState("")
  const [enlaces, setEnlaces] = useState<{ nombre: string; url: string }[]>([])

  function reemplazarEnlaces(siguientes: { nombre: string; contenido: string; tipo: string }[]) {
    const creados = siguientes.map((archivo) => ({
      nombre: archivo.nombre,
      url: URL.createObjectURL(new Blob([archivo.contenido], { type: archivo.tipo })),
    }))
    setEnlaces((anteriores) => {
      for (const enlace of anteriores) URL.revokeObjectURL(enlace.url)
      return creados
    })
  }

  function limpiarCuadre() {
    setResultado(null)
    setDecisiones([])
    setAviso("")
    reemplazarEnlaces([])
  }

  async function cargarLimites() {
    setFalloLimites("")
    try {
      setLimites(await obtenerLimites())
    } catch (error) {
      setFalloLimites(textoError(error))
    }
  }

  async function cargarDemo(gen: number, sigue: () => boolean = () => true, preparar = true) {
    const actual = () => sigue() && generacion.current === gen
    if (preparar) {
      setOcupado(true)
      setCargandoMuestra(true)
      setAviso("")
      setFalloMuestra("")
      setResultado(null)
      setDecisiones([])
      reemplazarEnlaces([])
    }
    try {
      const demo = await obtenerDemo()
      if (!actual()) return
      const [vistaA, vistaB] = await Promise.all([
        inspeccionar(demo.csv_a, "A", demo.delimitador_a),
        inspeccionar(demo.csv_b, "B", demo.delimitador_b),
      ])
      if (!actual()) return
      const a = armarFichero(demo.nombre_a, demo.csv_a, vistaA, demo.mapeo_a)
      const b = armarFichero(demo.nombre_b, demo.csv_b, vistaB, demo.mapeo_b)
      const cuadre = await reconciliar(a, b, [])
      if (!actual()) return
      setFicheroA(a)
      setFicheroB(b)
      setMuestra(true)
      setRelato(demo.relato)
      setResultado(cuadre)
      if (cuadre.ok) setDecisiones(decisionesDesdeFilas(cuadre.filas))
      else setAviso(cuadre.errores.map((error) => error.mensaje).join(" "))
    } catch (error) {
      if (!actual()) return
      setMuestra(false)
      setRelato("")
      setFalloMuestra(textoError(error))
    } finally {
      if (actual()) {
        setOcupado(false)
        setCargandoMuestra(false)
      }
    }
  }

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const datos = await obtenerLimites()
        if (vivo) setLimites(datos)
      } catch (error) {
        if (vivo) setFalloLimites(textoError(error))
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    let vivo = true
    const gen = ++generacion.current
    void cargarDemo(gen, () => vivo, false)
    return () => {
      vivo = false
    }
  }, [])

  async function incorporar(
    lado: "A" | "B",
    nombre: string,
    texto: string,
    delimitador: Delimitador | null,
    mapeo: Mapeo | undefined,
    gen: number,
  ) {
    setOcupado(true)
    setAviso("")
    try {
      const vista = await inspeccionar(texto, lado, delimitador)
      if (generacion.current !== gen) return
      const fichero = armarFichero(nombre, texto, vista, mapeo)
      if (lado === "A") setFicheroA(fichero)
      else setFicheroB(fichero)
      limpiarCuadre()
    } catch (error) {
      if (generacion.current !== gen) return
      setAviso(textoError(error))
    } finally {
      if (generacion.current === gen) setOcupado(false)
    }
  }

  async function alArchivo(lado: "A" | "B", archivo: File) {
    if (!limites) {
      setAviso("Todavía no están los límites del servidor. Reintenta en un momento.")
      return
    }
    try {
      const texto = await leerArchivo(archivo, limites.max_bytes)
      const gen = ++generacion.current
      setMuestra(false)
      setRelato("")
      await incorporar(lado, archivo.name, texto, null, undefined, gen)
    } catch (error) {
      setAviso(textoError(error))
    }
  }

  function quitar(lado: "A" | "B") {
    generacion.current += 1
    setMuestra(false)
    setRelato("")
    if (lado === "A") setFicheroA(null)
    else setFicheroB(null)
    limpiarCuadre()
  }

  function alDemo() {
    const gen = ++generacion.current
    void cargarDemo(gen)
  }

  async function alReconciliar(siguientes = decisiones) {
    if (!ficheroA || !ficheroB) return
    setOcupado(true)
    setAviso("")
    reemplazarEnlaces([])
    try {
      const cuadre = await reconciliar(ficheroA, ficheroB, siguientes)
      setResultado(cuadre)
      if (cuadre.ok) setDecisiones(decisionesDesdeFilas(cuadre.filas))
      else setAviso(cuadre.errores.map((error) => error.mensaje).join(" "))
    } catch (error) {
      setAviso(textoError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function alDecision(decision: DecisionEnviada) {
    const siguientes = [...decisiones.filter((item) => item.identificador !== decision.identificador), decision]
    setDecisiones(siguientes)
    await alReconciliar(siguientes)
  }

  async function alExportar(modo: "completa" | "parcial") {
    if (!ficheroA || !ficheroB) return
    setOcupado(true)
    setAviso("")
    try {
      const archivos = await exportar(ficheroA, ficheroB, decisiones, modo)
      reemplazarEnlaces([
        { nombre: archivos.nombre_inventario, contenido: archivos.inventario_csv, tipo: "text/csv;charset=utf-8" },
        { nombre: archivos.nombre_historial, contenido: archivos.historial_csv, tipo: "text/csv;charset=utf-8" },
      ])
    } catch (error) {
      setAviso(textoError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function alGuardar() {
    if (!ficheroA || !ficheroB) return
    setOcupado(true)
    setAviso("")
    try {
      const sesion = await guardarSesion(ficheroA, ficheroB, decisiones)
      reemplazarEnlaces([{ nombre: sesion.nombre, contenido: sesion.texto, tipo: "application/json" }])
    } catch (error) {
      setAviso(textoError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function alAbrir(archivo: File) {
    const gen = ++generacion.current
    if (!ficheroA || !ficheroB || !limites) {
      setAviso("Carga primero los dos CSV que corresponden a la sesión.")
      return
    }
    setOcupado(true)
    setAviso("")
    reemplazarEnlaces([])
    try {
      const texto = await leerArchivo(archivo, limites.max_bytes)
      if (generacion.current !== gen) return
      let sesion: unknown
      try {
        sesion = JSON.parse(texto)
      } catch {
        throw new Error("La sesión no es JSON válido.")
      }
      const cuadre = await abrirSesion(sesion, ficheroA, ficheroB)
      if (generacion.current !== gen) return
      setResultado(cuadre)
      if (!cuadre.ok) {
        setAviso(cuadre.errores.map((error) => error.mensaje).join(" "))
        return
      }
      setDecisiones(decisionesDesdeFilas(cuadre.filas))
      setAviso("Sesión reabierta. Las decisiones quedaron como en el archivo.")
    } catch (error) {
      if (generacion.current !== gen) return
      setAviso(textoError(error))
    } finally {
      if (generacion.current === gen) setOcupado(false)
    }
  }

  const listoParaCuadrar = Boolean(
    ficheroA &&
      ficheroB &&
      ficheroA.delimitador &&
      ficheroB.delimitador &&
      ficheroA.errores.length === 0 &&
      ficheroB.errores.length === 0 &&
      mapeoListo(ficheroA.mapeo) &&
      mapeoListo(ficheroB.mapeo),
  )
  const hayCuadre = Boolean(resultado?.ok && resultado.resumen)
  const esperandoReconciliar = listoParaCuadrar && resultado === null && !cargandoMuestra && !ocupado

  return (
    <>
      <div className="fondo" aria-hidden="true">
        <span className="blob blob-pino" />
        <span className="blob blob-cobre" />
        <span className="blob blob-ambar" />
        <span className="blob blob-azul" />
      </div>
      <div className="aplicacion">
        <a href="#cuadre" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[#f4f1ea] focus:p-2 focus:text-[#1c2430]">
          Saltar al cuadre
        </a>
        <a href="#ficheros" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[#f4f1ea] focus:p-2 focus:text-[#1c2430]">
          Ir a los ficheros
        </a>
        <Barra muestra={muestra} ocupado={ocupado} />
        <main id="contenido" aria-busy={ocupado} className="grid gap-4">
          {falloLimites ? (
            <Alert variant="destructive" className="alerta-clara">
              <AlertTitle>Sin conexión con el servidor</AlertTitle>
              <AlertDescription>
                {falloLimites}
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void cargarLimites()}>
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {falloMuestra ? (
            <Alert variant="destructive" className="alerta-clara">
              <AlertTitle>No se pudo cargar la muestra</AlertTitle>
              <AlertDescription>{falloMuestra}</AlertDescription>
            </Alert>
          ) : null}
          {aviso ? (
            <Alert className="alerta-clara">
              <AlertTitle>Aviso</AlertTitle>
              <AlertDescription>{aviso}</AlertDescription>
            </Alert>
          ) : null}
          <div className="rejilla" data-con-cuadre={hayCuadre ? "si" : "no"}>
            <div className="columna-cuadre">
              <Portada
                limites={limites}
                relato={relato}
                muestra={muestra}
                cargando={cargandoMuestra}
                resumen={hayCuadre ? resultado?.resumen ?? null : null}
                esperandoReconciliar={esperandoReconciliar}
                ocupado={ocupado}
                onDemo={alDemo}
              />
              {hayCuadre && resultado?.ok && resultado.resumen ? (
                <>
                  <TablaCuadre
                    filas={resultado.filas}
                    resumen={resultado.resumen}
                    erroresDecision={resultado.errores_decision}
                    filtro={filtro}
                    busqueda={busqueda}
                    onFiltro={setFiltro}
                    onBusqueda={setBusqueda}
                    onDecision={(decision) => void alDecision(decision)}
                    guardando={ocupado}
                  />
                  <Cierre
                    resumen={resultado.resumen}
                    completaPermitida={resultado.exportacion_completa_permitida}
                    ocupado={ocupado}
                    onExportar={(modo) => void alExportar(modo)}
                    onGuardar={() => void alGuardar()}
                    onAbrir={(archivo) => void alAbrir(archivo)}
                    enlaces={enlaces}
                  />
                </>
              ) : null}
            </div>
            <aside id="ficheros" className="columna" aria-labelledby="titulo-ficheros">
              <h2 id="titulo-ficheros" className="sr-only">
                Ficheros
              </h2>
              <PanelFichero
                lado="A"
                fichero={ficheroA}
                maxBytes={limites?.max_bytes ?? 1_048_576}
                ocupado={ocupado}
                cargando={cargandoMuestra}
                onArchivo={(archivo) => void alArchivo("A", archivo)}
                onQuitar={() => quitar("A")}
                onDelimitador={(delimitador) => {
                  if (!ficheroA) return
                  const gen = ++generacion.current
                  void incorporar("A", ficheroA.nombre, ficheroA.texto, delimitador, ficheroA.mapeo, gen)
                }}
                onMapeo={(campo, columna) => {
                  setFicheroA((actual) => (actual ? { ...actual, mapeo: { ...actual.mapeo, [campo]: columna } } : actual))
                  limpiarCuadre()
                }}
              />
              <PanelFichero
                lado="B"
                fichero={ficheroB}
                maxBytes={limites?.max_bytes ?? 1_048_576}
                ocupado={ocupado}
                cargando={cargandoMuestra}
                onArchivo={(archivo) => void alArchivo("B", archivo)}
                onQuitar={() => quitar("B")}
                onDelimitador={(delimitador) => {
                  if (!ficheroB) return
                  const gen = ++generacion.current
                  void incorporar("B", ficheroB.nombre, ficheroB.texto, delimitador, ficheroB.mapeo, gen)
                }}
                onMapeo={(campo, columna) => {
                  setFicheroB((actual) => (actual ? { ...actual, mapeo: { ...actual.mapeo, [campo]: columna } } : actual))
                  limpiarCuadre()
                }}
              />
              <AccionReconciliar
                listo={listoParaCuadrar}
                ocupado={ocupado}
                hayFicheros={Boolean(ficheroA || ficheroB)}
                onClick={() => void alReconciliar()}
              />
            </aside>
          </div>
        </main>
        <footer className="pie">
          Cuadra no guarda los ficheros. Si cierras la pestaña sin descargar la sesión, el cuadre se pierde. Los números
          usan punto decimal; las descripciones se recortan solo en los extremos y se comparan tal cual.
        </footer>
      </div>
    </>
  )
}
