import { useEffect, useState } from "react"

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
import { Cierre } from "./componentes/Cierre.tsx"
import { BotonDemo, PanelFichero } from "./componentes/Ficheros.tsx"
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

function armarFichero(
  nombre: string,
  texto: string,
  inspeccion: Inspeccion,
  mapeoPreferido?: Mapeo,
): FicheroUi {
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
  const [limites, setLimites] = useState<Limites | null>(null)
  const [falloLimites, setFalloLimites] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState("")
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

  async function cargarLimites() {
    setFalloLimites("")
    try {
      setLimites(await obtenerLimites())
    } catch (error) {
      setFalloLimites(textoError(error))
    }
  }

  useEffect(() => {
    void cargarLimites()
  }, [])

  function limpiarCuadre() {
    setResultado(null)
    setDecisiones([])
    setAviso("")
  }

  async function incorporar(lado: "A" | "B", nombre: string, texto: string, delimitador: Delimitador | null, mapeo?: Mapeo) {
    setOcupado(true)
    setAviso("")
    try {
      const vista = await inspeccionar(texto, lado, delimitador)
      const fichero = armarFichero(nombre, texto, vista, mapeo)
      if (lado === "A") setFicheroA(fichero)
      else setFicheroB(fichero)
      limpiarCuadre()
    } catch (error) {
      setAviso(textoError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function alArchivo(lado: "A" | "B", archivo: File) {
    if (!limites) return
    try {
      const texto = await leerArchivo(archivo, limites.max_bytes)
      await incorporar(lado, archivo.name, texto, null)
    } catch (error) {
      setAviso(textoError(error))
    }
  }

  async function alDemo() {
    setOcupado(true)
    setAviso("")
    try {
      const demo = await obtenerDemo()
      const [vistaA, vistaB] = await Promise.all([
        inspeccionar(demo.csv_a, "A", demo.delimitador_a),
        inspeccionar(demo.csv_b, "B", demo.delimitador_b),
      ])
      setFicheroA(armarFichero(demo.nombre_a, demo.csv_a, vistaA, demo.mapeo_a))
      setFicheroB(armarFichero(demo.nombre_b, demo.csv_b, vistaB, demo.mapeo_b))
      setResultado(null)
      setDecisiones([])
      setAviso(demo.relato)
    } catch (error) {
      setAviso(textoError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function alReconciliar(siguientes = decisiones) {
    if (!ficheroA || !ficheroB) return
    setOcupado(true)
    setAviso("")
    try {
      const cuadre = await reconciliar(ficheroA, ficheroB, siguientes)
      setResultado(cuadre)
      if (cuadre.ok) {
        setDecisiones(decisionesDesdeFilas(cuadre.filas))
      } else {
        setAviso(cuadre.errores.map((error) => error.mensaje).join(" "))
      }
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
    if (!ficheroA || !ficheroB || !limites) {
      setAviso("Carga primero los dos CSV que corresponden a la sesión.")
      return
    }
    setOcupado(true)
    setAviso("")
    try {
      const texto = await leerArchivo(archivo, limites.max_bytes)
      let sesion: unknown
      try {
        sesion = JSON.parse(texto)
      } catch {
        throw new Error("La sesión no es JSON válido.")
      }
      const cuadre = await abrirSesion(sesion, ficheroA, ficheroB)
      setResultado(cuadre)
      if (!cuadre.ok) {
        setAviso(cuadre.errores.map((error) => error.mensaje).join(" "))
        return
      }
      setDecisiones(decisionesDesdeFilas(cuadre.filas))
      setAviso("Sesión reabierta. Las decisiones quedaron como en el archivo.")
    } catch (error) {
      setAviso(textoError(error))
    } finally {
      setOcupado(false)
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

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6">
      <a href="#cuadre" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-card focus:p-2">
        Saltar al cuadre
      </a>
      <header className="grid gap-2">
        <p className="text-sm font-medium tracking-wide text-[#1f6b4a] uppercase">Inventario</p>
        <h1 className="font-serif text-4xl leading-none sm:text-5xl">Cuadra</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Compara dos exportaciones de inventario y deja a la vista lo que cambió, lo que falta y lo que no se puede
          emparejar con seguridad. No adivina claves ni sustituye a un ERP.
        </p>
        {limites ? (
          <p className="text-sm">
            Límites: {limites.max_bytes.toLocaleString("es")} bytes y {limites.max_filas.toLocaleString("es")} filas por
            fichero. Como mucho {limites.max_decimales} decimales. Sesión versión {limites.schema_version}.
          </p>
        ) : null}
      </header>

      {falloLimites ? (
        <Alert variant="destructive">
          <AlertTitle>Sin conexión con el servidor</AlertTitle>
          <AlertDescription>
            {falloLimites}
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void cargarLimites()}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {aviso ? (
        <Alert>
          <AlertTitle>Aviso</AlertTitle>
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      ) : null}

      <div aria-busy={ocupado} className="grid gap-6">
        <section className="grid gap-3" aria-labelledby="titulo-ficheros">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="titulo-ficheros" className="font-serif text-2xl">
              Ficheros
            </h2>
            <BotonDemo onClick={() => void alDemo()} disabled={ocupado || !limites} />
          </div>
          {!ficheroA && !ficheroB ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay ficheros. Sube la exportación A y la B, o carga la demostración de Ferretería La Cuadra.
            </p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <PanelFichero
              lado="A"
              fichero={ficheroA}
              maxBytes={limites?.max_bytes ?? 1_048_576}
              onArchivo={(archivo) => void alArchivo("A", archivo)}
              onDelimitador={(delimitador) => {
                if (ficheroA) void incorporar("A", ficheroA.nombre, ficheroA.texto, delimitador, ficheroA.mapeo)
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
              onArchivo={(archivo) => void alArchivo("B", archivo)}
              onDelimitador={(delimitador) => {
                if (ficheroB) void incorporar("B", ficheroB.nombre, ficheroB.texto, delimitador, ficheroB.mapeo)
              }}
              onMapeo={(campo, columna) => {
                setFicheroB((actual) => (actual ? { ...actual, mapeo: { ...actual.mapeo, [campo]: columna } } : actual))
                limpiarCuadre()
              }}
            />
          </div>
          <Button type="button" disabled={!listoParaCuadrar || ocupado} onClick={() => void alReconciliar()}>
            {ocupado ? "Leyendo ficheros…" : "Reconciliar"}
          </Button>
        </section>

        {resultado?.ok && resultado.resumen ? (
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
      <footer className="pb-8 text-sm text-muted-foreground">
        Cuadra no guarda los ficheros. Si cierras la pestaña sin descargar la sesión, el cuadre se pierde. Los números
        usan punto decimal; las descripciones se recortan solo en los extremos y se comparan tal cual.
      </footer>
    </div>
  )
}
