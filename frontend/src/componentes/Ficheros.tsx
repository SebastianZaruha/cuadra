import { useId } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import type { Delimitador, FicheroUi, Mapeo } from "../tipos.ts"

type Props = {
  lado: "A" | "B"
  fichero: FicheroUi | null
  maxBytes: number
  onArchivo: (archivo: File) => void
  onDelimitador: (delimitador: Delimitador) => void
  onMapeo: (campo: keyof Mapeo, columna: string) => void
}

const CAMPOS: { campo: keyof Mapeo; etiqueta: string }[] = [
  { campo: "identificador", etiqueta: "Identificador" },
  { campo: "descripcion", etiqueta: "Descripción" },
  { campo: "cantidad", etiqueta: "Cantidad" },
]

export function PanelFichero({
  lado,
  fichero,
  maxBytes,
  onArchivo,
  onDelimitador,
  onMapeo,
}: Props) {
  const base = useId()
  const titulo = lado === "A" ? "Fichero A" : "Fichero B"
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-labelledby={`${base}-titulo`}>
      <h2 id={`${base}-titulo`} className="font-serif text-xl">
        {titulo}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        UTF-8, hasta {maxBytes.toLocaleString("es")} bytes. La clave se compara tal cual, después de recortar espacios.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Label
          htmlFor={`${base}-archivo`}
          className="w-fit cursor-pointer rounded-lg border border-input bg-background px-3 py-2"
        >
          Elegir CSV
        </Label>
        <Input
          id={`${base}-archivo`}
          className="sr-only"
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(evento) => {
            const archivo = evento.target.files?.[0]
            if (archivo) onArchivo(archivo)
            evento.target.value = ""
          }}
        />
        <span className="text-sm text-muted-foreground">
          {fichero ? fichero.nombre : "Ningún archivo elegido"}
        </span>
      </div>
      {fichero ? (
        <div className="mt-4 grid gap-4">
          <p className="text-sm">
            <span className="font-medium">{fichero.nombre}</span>
            <span className="text-muted-foreground"> · {fichero.filasDatos} filas de datos</span>
          </p>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Delimitador</legend>
            <p className="text-sm text-muted-foreground">
              {fichero.origenDelimitador === "detectado"
                ? "Detectado en la cabecera. Cámbialo si el fichero usa el otro."
                : fichero.origenDelimitador === "elegido"
                  ? "Elegido por ti. Cuadra no cambia esta elección en silencio."
                  : "Hay coma y punto y coma en la cabecera. Elige uno para continuar."}
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${base}-delimitador`}
                  value=","
                  checked={fichero.delimitador === ","}
                  onChange={() => onDelimitador(",")}
                />
                Coma
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${base}-delimitador`}
                  value=";"
                  checked={fichero.delimitador === ";"}
                  onChange={() => onDelimitador(";")}
                />
                Punto y coma
              </label>
            </div>
          </fieldset>
          {fichero.errores.length > 0 ? (
            <ul className="grid gap-1 text-sm text-destructive">
              {fichero.errores.map((error) => (
                <li key={error.codigo + error.mensaje}>{error.mensaje}</li>
              ))}
            </ul>
          ) : null}
          {fichero.columnas.length > 0 ? (
            <div className="grid gap-3">
              {CAMPOS.map(({ campo, etiqueta }) => (
                <div key={campo} className="grid gap-1.5">
                  <Label htmlFor={`${base}-${campo}`}>{etiqueta}</Label>
                  <select
                    id={`${base}-${campo}`}
                    className="campo"
                    value={fichero.mapeo[campo]}
                    onChange={(evento) => onMapeo(campo, evento.target.value)}
                  >
                    <option value="">Elige una columna</option>
                    {fichero.columnas.map((columna) => (
                      <option key={columna} value={columna}>
                        {columna}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {fichero.muestra.length > 0 ? (
                <div className="overflow-x-auto text-sm">
                  <p className="mb-1 text-muted-foreground">Primeras filas, sin interpretar todavía.</p>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {fichero.columnas.map((columna) => (
                          <th key={columna} className="border-b border-border px-2 py-1 text-left font-medium">
                            {columna}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fichero.muestra.map((fila, indice) => (
                        <tr key={indice}>
                          {fichero.columnas.map((columna) => (
                            <td key={columna} className="border-b border-border px-2 py-1">
                              {fila[columna]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Todavía no hay fichero {lado}.</p>
      )}
    </section>
  )
}

export function BotonDemo({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button type="button" variant="secondary" onClick={onClick} disabled={disabled}>
      Cargar demostración
    </Button>
  )
}
