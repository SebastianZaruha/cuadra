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
  onDemo,
}: Props) {
  const ref = usePanelVidrio<HTMLElement>()
  const titulo = cargando ? "Cargando la muestra" : resumen ? "Resumen" : "Todavía no hay cuadre"
  return (
    <section ref={ref} id="cuadre" className="vidrio-liquido panel-vidrio entrada" aria-labelledby="titulo-portada">
      <div className="cabecera-portada">
        <h2 id="titulo-portada" className="vl-humo titulo-portada">
          {titulo}
        </h2>
        <button type="button" className="control" onClick={onDemo} disabled={ocupado}>
          Cargar demostración
        </button>
      </div>
      <div className="vl-apartados">
        <p className="vl-apartado">
          Compara dos exportaciones de inventario y deja a la vista lo que cambió, lo que falta y lo que no se puede
          emparejar con seguridad. No adivina claves ni sustituye a un ERP.
        </p>
        {muestra && relato ? <p className="vl-apartado">{relato}</p> : null}
        {limites ? (
          <p className="vl-apartado">
            Límites: {limites.max_bytes.toLocaleString("es")} bytes y {limites.max_filas.toLocaleString("es")} filas por
            fichero. Como mucho {limites.max_decimales} decimales. Sesión versión {limites.schema_version}.
          </p>
        ) : null}
        {cargando ? (
          <p className="vl-apartado" role="status">
            Cargando la muestra de Ferretería La Cuadra…
          </p>
        ) : null}
        {esperandoReconciliar ? (
          <p className="vl-apartado">El mapeo está listo. Reconcilia para ver las diferencias.</p>
        ) : null}
      </div>
      {resumen ? <ResumenVisual resumen={resumen} /> : null}
    </section>
  )
}
