import type { Preferencia } from "../tema.ts"

const OPCIONES: { id: Preferencia; etiqueta: string }[] = [
  { id: "claro", etiqueta: "Día" },
  { id: "oscuro", etiqueta: "Noche" },
  { id: "sistema", etiqueta: "Sistema" },
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
          aria-pressed={preferencia === opcion.id}
          className="tema-opcion"
          onClick={() => onCambio(opcion.id)}
        >
          {opcion.etiqueta}
        </button>
      ))}
    </div>
  )
}
