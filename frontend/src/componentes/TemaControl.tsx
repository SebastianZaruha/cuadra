import { Monitor, Moon, Sun } from "lucide-react"

import type { Preferencia } from "../tema.ts"

const OPCIONES: { id: Preferencia; etiqueta: string; Icono: typeof Sun }[] = [
  { id: "claro", etiqueta: "Día", Icono: Sun },
  { id: "oscuro", etiqueta: "Noche", Icono: Moon },
  { id: "sistema", etiqueta: "Sistema", Icono: Monitor },
]

export function TemaControl({
  preferencia,
  onCambio,
}: {
  preferencia: Preferencia
  onCambio: (preferencia: Preferencia) => void
}) {
  return (
    <div className="tema" role="group" aria-label="Apariencia">
      {OPCIONES.map((opcion) => (
        <button
          key={opcion.id}
          type="button"
          aria-label={opcion.etiqueta}
          aria-pressed={preferencia === opcion.id}
          title={opcion.etiqueta}
          className="tema-opcion"
          onClick={() => onCambio(opcion.id)}
        >
          <opcion.Icono size={16} strokeWidth={1.6} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
