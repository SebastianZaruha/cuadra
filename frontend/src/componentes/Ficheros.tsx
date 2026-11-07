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
  onHoja: (hoja: string) => void
  onMapeo: (campo: keyof Mapeo, columna: string) => void
}

const CAMPOS: { campo: keyof Mapeo; etiqueta: string }[] = [
  { campo: "identificador", etiqueta: "Identificador" },
  { campo: "descripcion", etiqueta: "Descripción" },
  { campo: "cantidad", etiqueta: "Cantidad" },
]

const DELIMITADORES: { valor: Delimitador; etiqueta: string }[] = [
  { valor: ",", etiqueta: "Coma" },
  { valor: ";", etiqueta: "Punto y coma" },
  { valor: "\t", etiqueta: "Tabulador" },
]

export function PanelFichero({ lado, fichero, maxBytes, onArchivo, onDelimitador, onHoja, onMapeo }: Props) {
  const base = useId()
  const titulo = lado === "A" ? "Fichero A" : "Fichero B"
  return (
    <section className="cristal p-4 sm:p-5" aria-labelledby={`${base}-titulo`}>
      <h2 id={`${base}-titulo`} className="titulo text-xl">
        {titulo}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">CSV, Excel, ODS o JSON. Hasta {maxBytes.toLocaleString("es")} bytes.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Label htmlFor={`${base}-archivo`} className="pildora inline-flex cursor-pointer items-center">
          Elegir fichero
        </Label>
        <Input
          id={`${base}-archivo`}
          className="sr-only"
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.ods,.json,text/csv,text/plain,application/json"
          onChange={(evento) => {
            const archivo = evento.target.files?.[0]
            if (archivo) onArchivo(archivo)
            evento.target.value = ""
          }}
        />
        <span className="text-sm text-muted-foreground">{fichero ? fichero.nombre : "Ningún archivo elegido"}</span>
      </div>
      {fichero ? (
        <div className="mt-4 grid gap-4">
          <p className="text-sm">
            <span className="font-medium">{fichero.nombre}</span>
            <span className="text-muted-foreground">
              {" "}
              · {etiquetaFormato(fichero)} · {fichero.filasDatos} filas de datos
            </span>
          </p>
          {fichero.formato === "csv" ? (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Delimitador</legend>
              <p className="text-sm text-muted-foreground">
                {fichero.origenDelimitador === "elegido"
                  ? "Elegido por ti. Cuadra no cambia esta elección en silencio."
                  : fichero.origenDelimitador === "detectado"
                    ? "Detectado en la cabecera."
                    : "Hay más de un delimitador en la cabecera. Elige uno para continuar."}
              </p>
              <div className="flex flex-wrap gap-4">
                {DELIMITADORES.map((opcion) => (
                  <label key={opcion.etiqueta} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`${base}-delimitador`}
                      value={opcion.valor}
                      checked={fichero.delimitador === opcion.valor}
                      onChange={() => onDelimitador(opcion.valor)}
                    />
                    {opcion.etiqueta}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {fichero.hojas.length > 1 ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`${base}-hoja`}>Hoja</Label>
              <select
                id={`${base}-hoja`}
                className="campo"
                value={fichero.hoja ?? ""}
                onChange={(evento) => onHoja(evento.target.value)}
              >
                <option value="">Elige una hoja</option>
                {fichero.hojas.map((hoja) => (
                  <option key={hoja} value={hoja}>
                    {hoja}
                  </option>
                ))}
              </select>
            </div>
          ) : fichero.hoja ? (
            <p className="text-sm text-muted-foreground">Hoja: {fichero.hoja}</p>
          ) : null}
          {fichero.errores.length > 0 ? (
            <ul className="grid gap-1 text-sm text-destructive">
              {fichero.errores.map((error) => (
                <li key={error.codigo + error.mensaje}>{error.mensaje}</li>
              ))}
            </ul>
          ) : null}
          {fichero.columnas.length > 0 ? (
            <details
              key={`${fichero.nombre}-${fichero.filasDatos}-${fichero.hoja ?? ""}`}
              className="baldosa px-3 py-2"
              open={CAMPOS.some((campo) => !fichero.mapeo[campo.campo])}
            >
            <summary className="cursor-pointer text-sm font-medium">Columnas y vista previa</summary>
            <div className="mt-3 grid gap-3">
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
                            <td key={columna} className="nums border-b border-border px-2 py-1">
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
            </details>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Todavía no hay fichero {lado}.</p>
      )}
    </section>
  )
}

function etiquetaFormato(fichero: FicheroUi): string {
  const formato =
    fichero.formato === "xlsx"
      ? "Excel"
      : fichero.formato === "ods"
        ? "LibreOffice"
        : fichero.formato === "json"
          ? "JSON"
          : "CSV"
  if (fichero.codificacion === "windows-1252") return `${formato} · Windows-1252`
  if (fichero.codificacion === "utf-8-sig") return `${formato} · UTF-8 con BOM`
  if (fichero.codificacion === "utf-8") return `${formato} · UTF-8`
  return formato
}

export function BotonDemo({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button type="button" variant="secondary" onClick={onClick} disabled={disabled}>
      Cargar demostración
    </Button>
  )
}
