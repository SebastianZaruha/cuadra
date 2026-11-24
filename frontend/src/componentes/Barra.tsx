import { usePanelVidrio } from "../comun/estilo/usePanelVidrio.ts"

export function Barra({ ocupado }: { ocupado: boolean }) {
  const ref = usePanelVidrio<HTMLElement>()
  return (
    <header ref={ref} className="vidrio-liquido panel-vidrio barra entrada">
      <div>
        <p className="kicker">Inventario</p>
        <h1>Cuadra</h1>
      </div>
      <p className="estado-trabajo" role="status">
        {ocupado ? "Trabajando…" : ""}
      </p>
    </header>
  )
}
