import { useId } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { usePanelVidrio } from "../comun/estilo/usePanelVidrio.ts"
import type { Delimitador, FicheroUi, Mapeo } from "../tipos.ts"

type Props = {
  lado: "A" | "B"
  fichero: FicheroUi | null
  maxBytes: number
  ocupado: boolean
  cargando: boolean
  onArchivo: (archivo: File) => void
  onQuitar: () => void
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
  ocupado,
  cargando,
  onArchivo,
  onQuitar,
  onDelimitador,
  onMapeo,
}: Props) {
  const ref = usePanelVidrio<HTMLElement>()
  const base = useId()
  const titulo = lado === "A" ? "Fichero A" : "Fichero B"
  const retraso = lado === "A" ? "entrada entrada-2" : "entrada entrada-3"
  return (
    <section ref={ref} className={`vidrio-liquido panel-vidrio ${retraso}`} aria-labelledby={`${base}-titulo`}>
      <h2 id={`${base}-titulo`} className="vl-humo titulo-fichero">
        {titulo}
      </h2>
      <p className="vl-humo aviso-suave">
        UTF-8, hasta {maxBytes.toLocaleString("es")} bytes. La clave se compara tal cual, después de recortar espacios.
      </p>
      <div className="fila-archivo">
        <div className="archivo">
          <label htmlFor={`${base}-archivo`} className="control">
            Elegir CSV
          </label>
          <Input
            id={`${base}-archivo`}
            className="sr-only"
            type="file"
            accept=".csv,text/csv,text/plain"
            disabled={ocupado}
            onChange={(evento) => {
              const archivo = evento.target.files?.[0]
              if (archivo) onArchivo(archivo)
              evento.target.value = ""
            }}
          />
        </div>
        {fichero ? (
          <button type="button" className="control" onClick={onQuitar} disabled={ocupado}>
            Quitar fichero {lado}
          </button>
        ) : null}
      </div>
      <p className="vl-humo nombre-fichero">
        {fichero ? (
          <>
            <span className="font-medium">{fichero.nombre}</span>
            <span> · {fichero.filasDatos} filas de datos</span>
          </>
        ) : cargando ? (
          "Cargando la muestra…"
        ) : (
          `Todavía no hay fichero ${lado}.`
        )}
      </p>
      {fichero ? (
        <div className="mt-4 grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Delimitador</legend>
            <p className="aviso-suave">
              {fichero.origenDelimitador === "detectado"
                ? "Detectado en la cabecera. Cámbialo si el fichero usa el otro."
                : fichero.origenDelimitador === "elegido"
                  ? "Elegido. Cuadra no cambia esta elección en silencio."
                  : "Hay coma y punto y coma en la cabecera. Elige uno para continuar."}
            </p>
            <div className="fila-radios">
              <label className="opcion-radio">
                <input
                  type="radio"
                  name={`${base}-delimitador`}
                  value=","
                  checked={fichero.delimitador === ","}
                  onChange={() => onDelimitador(",")}
                />
                Coma
              </label>
              <label className="opcion-radio">
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
            <ul className="grid gap-1 text-sm error">
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
                  <p className="mb-1">Primeras filas, sin interpretar todavía.</p>
                  <table className="tabla-muestra">
                    <thead>
                      <tr>
                        {fichero.columnas.map((columna) => (
                          <th key={columna} scope="col">
                            {columna}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fichero.muestra.map((fila, indice) => (
                        <tr key={indice}>
                          {fichero.columnas.map((columna) => (
                            <td key={columna}>{fila[columna]}</td>
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
      ) : null}
    </section>
  )
}

export function AccionReconciliar({
  listo,
  ocupado,
  hayFicheros,
  onClick,
}: {
  listo: boolean
  ocupado: boolean
  hayFicheros: boolean
  onClick: () => void
}) {
  const ref = usePanelVidrio<HTMLDivElement>()
  return (
    <div ref={ref} className="vidrio-liquido panel-vidrio entrada entrada-4 accion-cuadrar">
      <button type="button" className="control principal" disabled={!listo || ocupado} onClick={onClick}>
        Reconciliar
      </button>
      {!ocupado && hayFicheros && !listo ? (
        <p className="vl-humo aviso-suave">Elige el delimitador y las tres columnas en los dos ficheros para reconciliar.</p>
      ) : null}
    </div>
  )
}
