import { usePanelVidrio } from "../comun/estilo/usePanelVidrio.ts"

export function Barra({ muestra, ocupado }: { muestra: boolean; ocupado: boolean }) {
  const ref = usePanelVidrio<HTMLElement>()
  return (
    <header ref={ref} className="vidrio-liquido panel-vidrio barra entrada">
      <div>
        <p className="kicker vl-humo">Inventario</p>
        <h1 className="vl-humo">Cuadra</h1>
      </div>
      <div className="barra-meta">
        {muestra ? <p className="chip-muestra">Datos de muestra</p> : null}
        <p className="estado-trabajo" role="status">
          {ocupado ? "Trabajando…" : ""}
        </p>
      </div>
    </header>
  )
}
