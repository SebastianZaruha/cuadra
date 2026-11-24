import { ResumenVisual } from "./Resumen.tsx"
import { usePanelVidrio } from "../comun/estilo/usePanelVidrio.ts"
import type { Limites, Resumen } from "../tipos.ts"

type Props = {
  limites: Limites | null
  relato: string
  muestra: boolean
  cargando: boolean
  resumen: Resumen | null
  esperandoReconciliar: boolean
  ocupado: boolean
  listo: boolean
  onComparar: () => void
  onDemo: () => void
}

export function Portada({
  limites,
  relato,
  muestra,
  cargando,
  resumen,
  esperandoReconciliar,
  ocupado,
  listo,
  onComparar,
  onDemo,
}: Props) {
  const ref = usePanelVidrio<HTMLElement>()
  const megas = limites ? Math.round(limites.max_bytes / (1024 * 1024)) : 1
  return (
    <section ref={ref} id="cuadre" className="vidrio-liquido panel-vidrio entrada" aria-labelledby="titulo-portada">
      <div className="cabecera-portada">
        <div>
          <h2 id="titulo-portada" className="vl-humo titulo-portada">
            {cargando ? "Preparando el ejemplo" : "Cuadra tu inventario en un minuto"}
          </h2>
          <p className="subtitulo">Compara dos listas y ve qué cambió, qué falta y qué no cuadra.</p>
        </div>
        <div className="acciones-hero">
          <button type="button" className="boton-primario" onClick={onComparar} disabled={!listo || ocupado}>
            Comparar ficheros
          </button>
          <button type="button" className="control" onClick={onDemo} disabled={ocupado}>
            Probar con ejemplo
          </button>
        </div>
      </div>
      {muestra && relato ? <p className="subtitulo">{relato}</p> : null}
      {esperandoReconciliar ? <p className="subtitulo">Las columnas están listas. Compara los ficheros.</p> : null}
      <details className="detalles">
        <summary>Detalles · {megas} MB · {limites ? limites.max_filas.toLocaleString("es") : "2.000"} filas</summary>
        <p>
          Cada fichero puede llegar a {megas} MB
          {limites ? ` y ${limites.max_filas.toLocaleString("es")} filas` : ""}. Los números usan punto, o coma si pides
          convertirla. La sesión guardada corresponde a esta versión
          {limites ? ` (${limites.schema_version})` : ""}.
        </p>
      </details>
      {resumen ? <ResumenVisual resumen={resumen} /> : null}
    </section>
  )
}
