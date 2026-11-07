import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import type { Resumen } from "../tipos.ts"

type Props = {
  resumen: Resumen
  completaPermitida: boolean
  ocupado: boolean
  onExportar: (modo: "completa" | "parcial") => void
  onGuardar: () => void
  onAbrir: (archivo: File) => void
  enlaces: { nombre: string; url: string }[]
}

export function Cierre({
  resumen,
  completaPermitida,
  ocupado,
  onExportar,
  onGuardar,
  onAbrir,
  enlaces,
}: Props) {
  const aviso = completaPermitida
    ? "No quedan pendientes ni bloqueados. El inventario y el historial salen marcados como completos."
    : `Exportación completa bloqueada: ${resumen.pendientes} pendientes y ${resumen.bloqueados} bloqueados.`
  return (
    <section className="cristal grid gap-3 p-4 sm:p-6" aria-labelledby="titulo-cierre">
      <h2 id="titulo-cierre" className="titulo text-2xl">
        Cerrar el cuadre
      </h2>
      <p id="aviso-exportacion" className="text-sm">
        {aviso}
      </p>
      <div className="flex flex-wrap gap-2">
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
      </div>
      {enlaces.length > 0 ? (
        <ul className="grid gap-1 text-sm">
          {enlaces.map((enlace) => (
            <li key={enlace.nombre}>
              <a className="font-medium underline" href={enlace.url} download={enlace.nombre}>
                Descargar {enlace.nombre}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted-foreground">
        La parcial incluye solo lo ya resuelto y se marca como parcial en el nombre y en el contenido. Las filas
        pendientes y bloqueadas siguen en el historial: no desaparecen.
      </p>
      <div className="grid gap-1.5">
        <div>
          <Label
            htmlFor="abrir-sesion"
            className="w-fit cursor-pointer rounded-lg border border-input bg-background px-3 py-2"
          >
            Abrir una sesión guardada
          </Label>
          <Input
            id="abrir-sesion"
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(evento) => {
              const archivo = evento.target.files?.[0]
              if (archivo) onAbrir(archivo)
              evento.target.value = ""
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Hacen falta los mismos ficheros ya cargados. Una sesión de la versión 1 se abre y, al guardarla de nuevo, pasa a la versión 2.
        </p>
      </div>
    </section>
  )
}
