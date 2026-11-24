import { Button } from "@/components/ui/button"

import { usePanelVidrio } from "../comun/estilo/usePanelVidrio.ts"
import type { Limites, Resumen } from "../tipos.ts"
import { ResumenVisual } from "./Resumen.tsx"

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
  const megas = limites ? Math.round(limites.max_bytes / (1024 * 1024)) : 1
  return (
    <section id="cuadre" className="grid gap-4" aria-labelledby="titulo-portada">
      <div className="cabecera-portada">
        <div>
          <h2 id="titulo-portada" className="titulo-portada">
            {cargando ? "Preparando el ejemplo" : "Cuadra tu inventario en un minuto"}
          </h2>
          <p className="subtitulo">Compara dos listas y ve qué cambió, qué falta y qué no cuadra.</p>
        </div>
        <div className="acciones-hero">
          <Button type="button" onClick={onComparar} disabled={!listo || ocupado}>
            Comparar ficheros
          </Button>
          <Button type="button" variant="outline" onClick={onDemo} disabled={ocupado}>
            Probar con ejemplo
          </Button>
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
      {resumen ? <ResumenCristal resumen={resumen} /> : null}
    </section>
  )
}

function ResumenCristal({ resumen }: { resumen: Resumen }) {
  const ref = usePanelVidrio<HTMLDivElement>()
  return (
    <div ref={ref} className="vidrio-liquido panel-vidrio">
      <ResumenVisual resumen={resumen} />
    </div>
  )
}
