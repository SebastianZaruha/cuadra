import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { usePanelVidrio } from "../comun/estilo/usePanelVidrio.ts"
import type { Resumen } from "../tipos.ts"

type Props = {
  resumen: Resumen
  completaPermitida: boolean
  ocupado: boolean
  onExportar: (modo: "completa" | "parcial") => void
  onGuardar: () => void
  onAbrir: (archivo: File) => void
  enlaces: { nombre: string; url: string }[]
  onImprimir: () => void
  onDiferencias: () => void
}

export function Cierre({
  resumen,
  completaPermitida,
  ocupado,
  onExportar,
  onGuardar,
  onAbrir,
  enlaces,
  onImprimir,
  onDiferencias,
}: Props) {
  const ref = usePanelVidrio<HTMLElement>()
  const aviso = completaPermitida
    ? "No quedan pendientes ni bloqueados. El inventario y el historial salen marcados como completos."
    : `Exportación completa bloqueada: ${resumen.pendientes} pendientes y ${resumen.bloqueados} bloqueados.`
  return (
    <section
      ref={ref}
      className="vidrio-liquido panel-vidrio entrada entrada-5"
      aria-labelledby="titulo-cierre"
    >
      <h2 id="titulo-cierre" className="vl-humo titulo-fichero">
        Cerrar el cuadre
      </h2>
      <div className="vl-apartados">
        <p id="aviso-exportacion" className="vl-apartado">
          {aviso}
        </p>
        <p className="vl-apartado">
          La parcial incluye solo lo ya resuelto y se marca como parcial en el nombre y en el contenido. Las filas
          pendientes y bloqueadas siguen en el historial: no desaparecen.
        </p>
      </div>
      <div className="controles mt-4">
        <Button
          type="button"
          disabled={!completaPermitida || ocupado}
          aria-describedby="aviso-exportacion"
          onClick={() => onExportar("completa")}
        >
          Exportar inventario completo
        </Button>
        <Button type="button" variant="outline" disabled={ocupado} onClick={() => onExportar("parcial")}>
          Exportar parcial
        </Button>
        <Button type="button" variant="secondary" disabled={ocupado} onClick={onGuardar}>
          Guardar sesión
        </Button>
        <Button type="button" variant="outline" onClick={onImprimir}>
          Imprimir informe
        </Button>
        <Button type="button" variant="outline" onClick={onDiferencias}>
          Descargar diferencias
        </Button>
      </div>
      {enlaces.length > 0 ? (
        <ul className="mt-3 grid gap-1">
          {enlaces.map((enlace) => (
            <li key={enlace.nombre}>
              <a className="enlace-descarga" href={enlace.url} download={enlace.nombre}>
                Descargar {enlace.nombre}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="vl-apartados mt-4">
        <div className="vl-apartado">
          <div className="archivo">
            <Label htmlFor="abrir-sesion" className="boton-papel">
              Abrir una sesión guardada
            </Label>
            <Input
              id="abrir-sesion"
              className="sr-only"
              type="file"
              accept="application/json,.json"
              disabled={ocupado}
              onChange={(evento) => {
                const archivo = evento.target.files?.[0]
                if (archivo) onAbrir(archivo)
                evento.target.value = ""
              }}
            />
          </div>
          <p className="aviso-suave">
            Hacen falta los mismos CSV ya cargados. Si el contenido o la versión no cuadran, la sesión se rechaza.
          </p>
        </div>
      </div>
    </section>
  )
}
