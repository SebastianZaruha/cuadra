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
import { analiticaPreparada } from "./analitica.ts"
import { borrarBorrador, guardarBorrador, leerBorrador, type Borrador } from "./borrador.ts"
import { BannerAnalitica } from "./componentes/BannerAnalitica.tsx"
import { Barra } from "./componentes/Barra.tsx"
import { Cierre } from "./componentes/Cierre.tsx"
import { PanelFichero } from "./componentes/Ficheros.tsx"
import { Informe } from "./componentes/Informe.tsx"
import { Paleta, type Orden } from "./componentes/Paleta.tsx"
import { Portada } from "./componentes/Portada.tsx"
import { TablaCuadre } from "./componentes/Tabla.tsx"
import { costesPorIdentificador, convertirComaDecimal, leerTextoLocal } from "./csvLocal.ts"
import { deshacer, pilaVacia, recordar, rehacer, type Pila } from "./historial.ts"
import { decisionesDesdeFilas, sugerirColumna } from "./opciones.ts"
import { guardarPlantilla, leerPlantillas, type Plantilla } from "./plantillas.ts"
import { csvDiferencias, dentroDeTolerancia, valorDiferencias } from "./utilCuadre.ts"
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
  codificacion = "utf-8",
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
    codificacion,
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
  const [pila, setPila] = useState<Pila<DecisionEnviada[]>>(pilaVacia())
  const [borradorActivo, setBorradorActivo] = useState(false)
  const [plantillas, setPlantillas] = useState<Plantilla[]>(() => leerPlantillas())
  const [costeA, setCosteA] = useState("")
  const [costeB, setCosteB] = useState("")
  const [tolerancia, setTolerancia] = useState("0")
  const [motivoTolerancia, setMotivoTolerancia] = useState("")
  const [paletaAbierta, setPaletaAbierta] = useState(false)
  const decisionesRef = useRef(decisiones)
  const pilaRef = useRef(pila)
  useEffect(() => {
    decisionesRef.current = decisiones
    pilaRef.current = pila
  })

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
    setPila(pilaVacia())
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
    const guardado = leerBorrador()
    if (guardado) void restaurarBorrador(guardado, gen, () => vivo)
    else void cargarDemo(gen, () => vivo, false)
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    function tecla(evento: KeyboardEvent) {
      const meta = evento.metaKey || evento.ctrlKey
      if (meta && evento.key.toLowerCase() === "k") {
        evento.preventDefault()
        setPaletaAbierta((abierta) => !abierta)
        return
      }
      if (!meta || evento.key.toLowerCase() !== "z" || paletaAbierta) return
      const etiqueta = (evento.target as HTMLElement | null)?.tagName
      if (etiqueta === "INPUT" || etiqueta === "TEXTAREA" || etiqueta === "SELECT") return
      evento.preventDefault()
      if (evento.shiftKey) aplicarHistorial(rehacer(pilaRef.current, decisionesRef.current))
      else aplicarHistorial(deshacer(pilaRef.current, decisionesRef.current))
    }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [paletaAbierta])

  useEffect(() => {
    if (!borradorActivo || !ficheroA || !ficheroB) return
    const borrador: Borrador = {
      version: 1,
      nombreA: ficheroA.nombre,
      textoA: ficheroA.texto,
      delimitadorA: ficheroA.delimitador,
      mapeoA: ficheroA.mapeo,
      codificacionA: ficheroA.codificacion,
      nombreB: ficheroB.nombre,
      textoB: ficheroB.texto,
      delimitadorB: ficheroB.delimitador,
      mapeoB: ficheroB.mapeo,
      codificacionB: ficheroB.codificacion,
      decisiones,
      costeA,
      costeB,
      tolerancia,
    }
    guardarBorrador(borrador)
  }, [borradorActivo, ficheroA, ficheroB, decisiones, costeA, costeB, tolerancia])

  async function incorporar(
    lado: "A" | "B",
    nombre: string,
    texto: string,
    delimitador: Delimitador | null,
    mapeo: Mapeo | undefined,
    gen: number,
    codificacion = "utf-8",
  ) {
    setOcupado(true)
    setAviso("")
    try {
      const vista = await inspeccionar(texto, lado, delimitador)
      if (generacion.current !== gen) return
      const fichero = armarFichero(nombre, texto, vista, mapeo, codificacion)
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
      setAviso("Todavía no están los límites. Reintenta en un momento.")
      return
    }
    try {
      const leido = await leerTextoLocal(archivo, limites.max_bytes)
      const gen = ++generacion.current
      setMuestra(false)
      setRelato("")
      await incorporar(lado, archivo.name.replace(/\.xlsx?$/i, ".csv"), leido.texto, null, undefined, gen, leido.codificacion)
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

  function aplicarHistorial(paso: { pila: Pila<DecisionEnviada[]>; valor: DecisionEnviada[] } | null) {
    if (!paso) return
    setPila(paso.pila)
    setDecisiones(paso.valor)
    void alReconciliar(paso.valor)
  }

  function alDeshacer() {
    aplicarHistorial(deshacer(pilaRef.current, decisionesRef.current))
  }

  function alRehacer() {
    aplicarHistorial(rehacer(pilaRef.current, decisionesRef.current))
  }

  async function alDecision(decision: DecisionEnviada) {
    setPila((actual) => recordar(actual, decisionesRef.current))
    const siguientes = [...decisionesRef.current.filter((item) => item.identificador !== decision.identificador), decision]
    setDecisiones(siguientes)
    await alReconciliar(siguientes)
  }

  async function restaurarBorrador(guardado: Borrador, gen: number, sigue: () => boolean) {
    const actual = () => sigue() && generacion.current === gen
    setOcupado(true)
    setCargandoMuestra(true)
    setBorradorActivo(true)
    setCosteA(guardado.costeA)
    setCosteB(guardado.costeB)
    setTolerancia(guardado.tolerancia)
    try {
      const [vistaA, vistaB] = await Promise.all([
        inspeccionar(guardado.textoA, "A", guardado.delimitadorA || null),
        inspeccionar(guardado.textoB, "B", guardado.delimitadorB || null),
      ])
      if (!actual()) return
      const a = armarFichero(guardado.nombreA, guardado.textoA, vistaA, guardado.mapeoA, guardado.codificacionA)
      const b = armarFichero(guardado.nombreB, guardado.textoB, vistaB, guardado.mapeoB, guardado.codificacionB)
      const cuadre = await reconciliar(a, b, guardado.decisiones)
      if (!actual()) return
      setFicheroA(a)
      setFicheroB(b)
      setMuestra(false)
      setRelato("")
      setResultado(cuadre)
      setDecisiones(cuadre.ok ? decisionesDesdeFilas(cuadre.filas) : guardado.decisiones)
      setAviso("Borrador local restaurado. Los CSV están solo en este navegador.")
    } catch (error) {
      if (!actual()) return
      setFalloMuestra(textoError(error))
    } finally {
      if (actual()) {
        setOcupado(false)
        setCargandoMuestra(false)
      }
    }
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
  const toleranciaNumero = Number(tolerancia.replace(",", "."))
  const filasVisibles = resultado?.ok ? resultado.filas : []
  const dentro = filasVisibles.filter((fila) => dentroDeTolerancia(fila, toleranciaNumero) && fila.tipo !== "bloqueados" && fila.estado === "pendiente")
  const costes = new Map<string, number>()
  if (ficheroA?.delimitador && costeA) {
    for (const [clave, numero] of costesPorIdentificador(ficheroA.texto, ficheroA.delimitador, ficheroA.mapeo.identificador, costeA)) {
      costes.set(clave, numero)
    }
  }
  if (ficheroB?.delimitador && costeB) {
    for (const [clave, numero] of costesPorIdentificador(ficheroB.texto, ficheroB.delimitador, ficheroB.mapeo.identificador, costeB)) {
      if (!costes.has(clave)) costes.set(clave, numero)
    }
  }
  const valor = valorDiferencias(filasVisibles, costes)

  function aceptarTolerancia() {
    const motivo = motivoTolerancia.trim()
    if (!motivo || dentro.length === 0) return
    setPila((actual) => recordar(actual, decisionesRef.current))
    const siguientes = [...decisionesRef.current]
    for (const fila of dentro) {
      if (fila.tipo === "bloqueados") continue
      const indice = siguientes.findIndex((item) => item.identificador === fila.identificador)
      const decision: DecisionEnviada = { identificador: fila.identificador, tipo: "elegir_A", motivo }
      if (indice >= 0) siguientes[indice] = decision
      else siguientes.push(decision)
    }
    setDecisiones(siguientes)
    void alReconciliar(siguientes)
  }

  function descargarDiferencias() {
    const contenido = csvDiferencias(filasVisibles)
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }))
    const enlace = document.createElement("a")
    enlace.href = url
    enlace.download = "cuadra-diferencias.csv"
    enlace.click()
    URL.revokeObjectURL(url)
  }

  const ordenes: Orden[] = [
    { id: "demo", etiqueta: "Probar con ejemplo", run: alDemo },
    { id: "a", etiqueta: "Subir fichero A", run: () => document.getElementById("cuadra-archivo-a")?.click() },
    { id: "b", etiqueta: "Subir fichero B", run: () => document.getElementById("cuadra-archivo-b")?.click() },
    { id: "pendientes", etiqueta: "Ver pendientes", run: () => setFiltro("pendientes") },
    { id: "buscar", etiqueta: "Ir a la búsqueda", run: () => document.getElementById("cuadre")?.scrollIntoView() },
    {
      id: "completa",
      etiqueta: "Exportar inventario completo",
      disabled: !resultado?.exportacion_completa_permitida || ocupado,
      run: () => void alExportar("completa"),
    },
    { id: "parcial", etiqueta: "Exportar parcial", disabled: !hayCuadre || ocupado, run: () => void alExportar("parcial") },
    { id: "diferencias", etiqueta: "Descargar diferencias", disabled: !hayCuadre, run: descargarDiferencias },
    { id: "imprimir", etiqueta: "Imprimir informe", disabled: !hayCuadre, run: () => window.print() },
    { id: "deshacer", etiqueta: "Deshacer", disabled: pila.pasado.length === 0, run: alDeshacer },
    { id: "rehacer", etiqueta: "Rehacer", disabled: pila.futuro.length === 0, run: alRehacer },
    {
      id: "borrador",
      etiqueta: borradorActivo ? "Borrar borrador local" : "Activar borrador en este navegador",
      run: () => {
        if (borradorActivo) {
          borrarBorrador()
          setBorradorActivo(false)
          setAviso("Borrador borrado de este navegador.")
        } else setBorradorActivo(true)
      },
    },
  ]

  return (
    <>
      <div className="fondo" aria-hidden="true" />
      <div className="aplicacion">
        <a href="#cuadre" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[#f4f1ea] focus:p-2 focus:text-[#1c2430]">
          Saltar al cuadre
        </a>
        <a href="#ficheros" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[#f4f1ea] focus:p-2 focus:text-[#1c2430]">
          Ir a los ficheros
        </a>
        <Barra ocupado={ocupado} />
        {analiticaPreparada() ? <BannerAnalitica /> : null}
        <Paleta abierta={paletaAbierta} ordenes={ordenes} onCerrar={() => setPaletaAbierta(false)} />
        <main id="contenido" aria-busy={ocupado} className="grid gap-4">
          {falloLimites ? (
            <Alert variant="destructive" className="alerta-clara">
              <AlertTitle>No se pudieron leer los límites</AlertTitle>
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
                listo={listoParaCuadrar}
                onComparar={() => void alReconciliar()}
                onDemo={alDemo}
              />
              {hayCuadre && resultado?.ok && resultado.resumen ? (
                <>
                  <section className="superficie herramientas">
                    <div className="controles">
                      <button type="button" className="boton-papel" onClick={alDeshacer} disabled={pila.pasado.length === 0}>
                        Deshacer
                      </button>
                      <button type="button" className="boton-papel" onClick={alRehacer} disabled={pila.futuro.length === 0}>
                        Rehacer
                      </button>
                      <button type="button" className="boton-papel" onClick={() => setPaletaAbierta(true)}>
                        Comandos
                      </button>
                    </div>
                    <div className="controles">
                      <label className="aviso-suave" htmlFor="tolerancia">
                        Tolerancia de cantidad
                      </label>
                      <input
                        id="tolerancia"
                        className="campo campo-corto"
                        inputMode="decimal"
                        value={tolerancia}
                        onChange={(evento) => setTolerancia(evento.target.value)}
                      />
                      <input
                        className="campo"
                        value={motivoTolerancia}
                        onChange={(evento) => setMotivoTolerancia(evento.target.value)}
                        placeholder="Motivo para conservar A"
                        aria-label="Motivo para aceptar la tolerancia"
                      />
                      <button type="button" className="boton-papel" disabled={dentro.length === 0 || !motivoTolerancia.trim()} onClick={aceptarTolerancia}>
                        Conservar A dentro de la tolerancia ({dentro.length})
                      </button>
                    </div>
                    <p className="aviso-suave">
                      La tolerancia no cambia la clave: solo marca filas con la misma descripción y una diferencia de
                      cantidad de hasta N. El motivo es obligatorio.
                      {valor !== null ? ` Valor estimado de las diferencias: ${valor}.` : ""}
                    </p>
                    <div className="controles">
                      <button type="button" className="boton-papel" onClick={() => setBorradorActivo(true)} disabled={borradorActivo}>
                        Activar borrador en este navegador
                      </button>
                      <button
                        type="button"
                        className="boton-papel"
                        onClick={() => {
                          borrarBorrador()
                          setBorradorActivo(false)
                          setAviso("Borrador borrado de este navegador.")
                        }}
                        disabled={!borradorActivo && !leerBorrador()}
                      >
                        Borrar borrador
                      </button>
                    </div>
                    {borradorActivo ? (
                      <p role="status">Borrador local activo. Los CSV no salen de este navegador.</p>
                    ) : null}
                  </section>
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
                    onImprimir={() => window.print()}
                    onDiferencias={descargarDiferencias}
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
                coste={costeA}
                onCoste={setCosteA}
                plantillas={plantillas}
                onGuardarPlantilla={(nombre) => {
                  if (!ficheroA) return
                  setPlantillas(guardarPlantilla({ nombre, mapeo: ficheroA.mapeo, coste: costeA }))
                }}
                onAplicarPlantilla={(nombre) => {
                  const plantilla = plantillas.find((item) => item.nombre === nombre)
                  if (!plantilla) return
                  setCosteA(plantilla.coste)
                  setFicheroA((actual) => (actual ? { ...actual, mapeo: plantilla.mapeo } : actual))
                  limpiarCuadre()
                }}
                onComaDecimal={() => {
                  if (!ficheroA?.delimitador) return
                  const texto = convertirComaDecimal(ficheroA.texto, ficheroA.delimitador, ficheroA.mapeo.cantidad)
                  const gen = ++generacion.current
                  void incorporar("A", ficheroA.nombre, texto, ficheroA.delimitador || null, ficheroA.mapeo, gen, ficheroA.codificacion)
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
                coste={costeB}
                onCoste={setCosteB}
                plantillas={plantillas}
                onGuardarPlantilla={(nombre) => {
                  if (!ficheroB) return
                  setPlantillas(guardarPlantilla({ nombre, mapeo: ficheroB.mapeo, coste: costeB }))
                }}
                onAplicarPlantilla={(nombre) => {
                  const plantilla = plantillas.find((item) => item.nombre === nombre)
                  if (!plantilla) return
                  setCosteB(plantilla.coste)
                  setFicheroB((actual) => (actual ? { ...actual, mapeo: plantilla.mapeo } : actual))
                  limpiarCuadre()
                }}
                onComaDecimal={() => {
                  if (!ficheroB?.delimitador) return
                  const texto = convertirComaDecimal(ficheroB.texto, ficheroB.delimitador, ficheroB.mapeo.cantidad)
                  const gen = ++generacion.current
                  void incorporar("B", ficheroB.nombre, texto, ficheroB.delimitador || null, ficheroB.mapeo, gen, ficheroB.codificacion)
                }}
              />
            </aside>
          </div>
        </main>
        <footer className="pie">
          <p>
            El cuadre ocurre en este navegador: los ficheros no se envían a ningún servidor. Si cierras la pestaña sin
            descargar la sesión ni activar el borrador, el cuadre se pierde. La clave se compara tal cual. La coma
            decimal solo se convierte si lo pides.
          </p>
          <nav className="pie-nav" aria-label="Información legal">
            <a href="/legal">Información legal</a>
            <a href="/legal-en">Legal notice</a>
          </nav>
        </footer>
      </div>
      <Informe resumen={resultado?.resumen ?? null} filas={filasVisibles} valor={valor} />
    </>
  )
}
