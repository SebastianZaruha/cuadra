import { useEffect, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import {
  ErrorCuadra,
  abrirSesion,
  blobDesdeBase64,
  exportar,
  guardarSesion,
  inspeccionar,
  leerBytes,
  leerTexto,
  mapeoListo,
  obtenerDemo,
  obtenerLimites,
  reconciliar,
} from "./api.ts"
import { Cielo } from "./componentes/Cielo.tsx"
import { Cierre } from "./componentes/Cierre.tsx"
import { BotonDemo, PanelFichero } from "./componentes/Ficheros.tsx"
import { Graficas } from "./componentes/Graficas.tsx"
import { TablaCuadre } from "./componentes/Tabla.tsx"
import { TemaControl } from "./componentes/TemaControl.tsx"
import { decisionesDesdeFilas, sugerirColumna } from "./opciones.ts"
import { aplicarTema, preferenciaGuardada, temaEfectivo, type Preferencia } from "./tema.ts"
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

function LimitesAyuda({ limites }: { limites: Limites }) {
  return (
    <span className="limites">
      <button type="button" className="pildora text-sm" aria-describedby="texto-limites">
        Límites
      </button>
      <span id="texto-limites" role="tooltip" className="globo">
        {limites.max_bytes.toLocaleString("es")} bytes y {limites.max_filas.toLocaleString("es")} filas por fichero.{" "}
        {limites.max_decimales} decimales. Sesión versión {limites.schema_version}.
      </span>
    </span>
  )
}

function armarFichero(
  base: { nombre: string; texto: string | null; contenidoBase64: string | null },
  inspeccion: Inspeccion,
  mapeoPreferido?: Mapeo,
): FicheroUi {
  const sugerido: Mapeo = {
    identificador: sugerirColumna(inspeccion.columnas, ["sku", "codigo", "id"]),
    descripcion: sugerirColumna(inspeccion.columnas, ["descripcion", "nombre"]),
    cantidad: sugerirColumna(inspeccion.columnas, ["cantidad", "stock"]),
  }
  const preferido = mapeoPreferido ?? sugerido
  const mapeo: Mapeo = {
    identificador: inspeccion.columnas.includes(preferido.identificador) ? preferido.identificador : sugerido.identificador,
    descripcion: inspeccion.columnas.includes(preferido.descripcion) ? preferido.descripcion : sugerido.descripcion,
    cantidad: inspeccion.columnas.includes(preferido.cantidad) ? preferido.cantidad : sugerido.cantidad,
  }
  return {
    nombre: base.nombre,
    texto: base.texto,
    contenidoBase64: base.contenidoBase64,
    formato: inspeccion.formato,
    codificacion: inspeccion.codificacion,
    delimitador: inspeccion.delimitador ?? "",
    origenDelimitador: inspeccion.origen_delimitador,
    hoja: inspeccion.hoja,
    hojas: inspeccion.hojas,
    origenHoja: inspeccion.origen_hoja,
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
  const [preferencia, setPreferencia] = useState<Preferencia>(() => preferenciaGuardada())
  const [relojTema, setRelojTema] = useState(0)
  const tema = relojTema >= 0 ? temaEfectivo(preferencia) : "claro"

  function reemplazarEnlaces(siguientes: { nombre: string; blob: Blob }[]) {
    const creados = siguientes.map((archivo) => ({
      nombre: archivo.nombre,
      url: URL.createObjectURL(archivo.blob),
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
    aplicarTema(preferenciaGuardada())
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const alSistema = () => {
      if (preferenciaGuardada() === "sistema") {
        aplicarTema("sistema")
        setRelojTema((valor) => valor + 1)
      }
    }
    media.addEventListener("change", alSistema)
    return () => media.removeEventListener("change", alSistema)
  }, [])

  function elegirTema(siguiente: Preferencia) {
    setPreferencia(siguiente)
    aplicarTema(siguiente)
  }

  function limpiarCuadre() {
    setResultado(null)
    setDecisiones([])
    setAviso("")
  }

  async function incorporar(
    lado: "A" | "B",
    base: { nombre: string; texto: string | null; contenidoBase64: string | null },
    opciones: { delimitador: Delimitador | null; hoja: string | null },
    mapeo?: Mapeo,
  ) {
    setOcupado(true)
    setAviso("")
    try {
      const vista = await inspeccionar({
        csv: base.texto,
        contenidoBase64: base.contenidoBase64,
        nombre: base.nombre,
        fichero: lado,
        delimitador: opciones.delimitador,
        hoja: opciones.hoja,
      })
      const fichero = armarFichero(base, vista, mapeo)
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
      const contenidoBase64 = await leerBytes(archivo, limites.max_bytes)
      await incorporar(lado, { nombre: archivo.name, texto: null, contenidoBase64 }, { delimitador: null, hoja: null })
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
        inspeccionar({
          csv: demo.csv_a,
          contenidoBase64: null,
          nombre: demo.nombre_a,
          fichero: "A",
          delimitador: demo.delimitador_a,
          hoja: null,
        }),
        inspeccionar({
          csv: demo.csv_b,
          contenidoBase64: null,
          nombre: demo.nombre_b,
          fichero: "B",
          delimitador: demo.delimitador_b,
          hoja: null,
        }),
      ])
      setFicheroA(armarFichero({ nombre: demo.nombre_a, texto: demo.csv_a, contenidoBase64: null }, vistaA, demo.mapeo_a))
      setFicheroB(armarFichero({ nombre: demo.nombre_b, texto: demo.csv_b, contenidoBase64: null }, vistaB, demo.mapeo_b))
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
        { nombre: archivos.nombre_inventario, blob: new Blob([archivos.inventario_csv], { type: "text/csv;charset=utf-8" }) },
        { nombre: archivos.nombre_historial, blob: new Blob([archivos.historial_csv], { type: "text/csv;charset=utf-8" }) },
        {
          nombre: archivos.nombre_inventario_xlsx,
          blob: blobDesdeBase64(archivos.inventario_xlsx_base64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        },
        {
          nombre: archivos.nombre_historial_xlsx,
          blob: blobDesdeBase64(archivos.historial_xlsx_base64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        },
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
      reemplazarEnlaces([{ nombre: sesion.nombre, blob: new Blob([sesion.texto], { type: "application/json" }) }])
    } catch (error) {
      setAviso(textoError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function alAbrir(archivo: File) {
    if (!ficheroA || !ficheroB || !limites) {
      setAviso("Carga primero los dos ficheros que corresponden a la sesión.")
      return
    }
    setOcupado(true)
    setAviso("")
    try {
      const texto = await leerTexto(archivo, limites.max_bytes)
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

  function ficheroListo(fichero: FicheroUi | null) {
    if (!fichero || fichero.errores.length > 0 || !mapeoListo(fichero.mapeo)) return false
    if (fichero.formato === "csv" && !fichero.delimitador) return false
    if ((fichero.formato === "xlsx" || fichero.formato === "ods") && fichero.hojas.length > 1 && !fichero.hoja) return false
    return true
  }

  const listoParaCuadrar = ficheroListo(ficheroA) && ficheroListo(ficheroB)

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6">
      <Cielo tema={tema} />
      <a href="#cuadre" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-card focus:p-2">
        Saltar al cuadre
      </a>
      <header className="cristal flex flex-wrap items-end justify-between gap-4 px-5 py-4 sm:px-7 sm:py-5">
        <div className="grid gap-1">
        <p className="ojo">Inventario</p>
        <h1 className="titulo text-[2.6rem] leading-none">Cuadra</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Compara dos inventarios. La clave es exacta. No adivina ni sustituye a un ERP.
        </p>
        </div>
        <div className="flex items-center gap-2">
          {limites ? <LimitesAyuda limites={limites} /> : null}
          <TemaControl preferencia={preferencia} onCambio={elegirTema} />
        </div>
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

      <div aria-busy={ocupado} className={resultado?.ok ? "lienzo con-resultado" : "lienzo"}>
        <section className="zona-ficheros grid gap-3" aria-labelledby="titulo-ficheros">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="titulo-ficheros" className="titulo text-2xl">
              Ficheros
            </h2>
            <BotonDemo onClick={() => void alDemo()} disabled={ocupado || !limites} />
          </div>
          {!ficheroA && !ficheroB ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay ficheros. Sube la exportación A y la B, o carga la demostración de Ferretería La Cuadra.
            </p>
          ) : null}
          <div className="rejilla-ficheros grid gap-4 lg:grid-cols-2">
            <PanelFichero
              lado="A"
              fichero={ficheroA}
              maxBytes={limites?.max_bytes ?? 1_048_576}
              onArchivo={(archivo) => void alArchivo("A", archivo)}
              onDelimitador={(delimitador) => {
                if (ficheroA) {
                  void incorporar(
                    "A",
                    { nombre: ficheroA.nombre, texto: ficheroA.texto, contenidoBase64: ficheroA.contenidoBase64 },
                    { delimitador, hoja: ficheroA.hoja },
                    ficheroA.mapeo,
                  )
                }
              }}
              onHoja={(hoja) => {
                if (ficheroA) {
                  void incorporar(
                    "A",
                    { nombre: ficheroA.nombre, texto: ficheroA.texto, contenidoBase64: ficheroA.contenidoBase64 },
                    { delimitador: ficheroA.delimitador || null, hoja },
                    ficheroA.mapeo,
                  )
                }
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
                if (ficheroB) {
                  void incorporar(
                    "B",
                    { nombre: ficheroB.nombre, texto: ficheroB.texto, contenidoBase64: ficheroB.contenidoBase64 },
                    { delimitador, hoja: ficheroB.hoja },
                    ficheroB.mapeo,
                  )
                }
              }}
              onHoja={(hoja) => {
                if (ficheroB) {
                  void incorporar(
                    "B",
                    { nombre: ficheroB.nombre, texto: ficheroB.texto, contenidoBase64: ficheroB.contenidoBase64 },
                    { delimitador: ficheroB.delimitador || null, hoja },
                    ficheroB.mapeo,
                  )
                }
              }}
              onMapeo={(campo, columna) => {
                setFicheroB((actual) => (actual ? { ...actual, mapeo: { ...actual.mapeo, [campo]: columna } } : actual))
                limpiarCuadre()
              }}
            />
          </div>
          <Button type="button" className="accion" disabled={!listoParaCuadrar || ocupado} onClick={() => void alReconciliar()}>
            {ocupado ? "Leyendo ficheros…" : "Reconciliar"}
          </Button>
        </section>

        {resultado?.ok && resultado.resumen ? (
          <div className="zona-resultado grid gap-4">
            <Graficas
              filas={resultado.filas}
              resumen={resultado.resumen}
              filtro={filtro}
              busqueda={busqueda}
              onFiltro={(siguiente) => {
                setFiltro(siguiente)
                setBusqueda("")
              }}
              onClave={(identificador) => {
                setFiltro("todas")
                setBusqueda(identificador)
              }}
            />
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
          </div>
        ) : null}
        {resultado?.ok && resultado.resumen ? (
          <div className="zona-cierre">
            <Cierre
              resumen={resultado.resumen}
              completaPermitida={resultado.exportacion_completa_permitida}
              ocupado={ocupado}
              onExportar={(modo) => void alExportar(modo)}
              onGuardar={() => void alGuardar()}
              onAbrir={(archivo) => void alAbrir(archivo)}
              enlaces={enlaces}
            />
          </div>
        ) : null}
      </div>
      <footer className="pb-8 text-sm text-muted-foreground">
        Cuadra no guarda los ficheros. Si cierras la pestaña sin descargar la sesión, el cuadre se pierde. Los números
        usan punto decimal. El Excel y el ODS se leen con ese punto, sin convertir la coma de la pantalla.
      </footer>
    </div>
  )
}
