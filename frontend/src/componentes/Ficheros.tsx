import { useId, useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { usePanelVidrio } from "../comun/estilo/usePanelVidrio.ts"
import { sospechaComaDecimal } from "../csvLocal.ts"
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
  coste: string
  onCoste: (columna: string) => void
  plantillas: { nombre: string }[]
  onGuardarPlantilla: (nombre: string) => void
  onAplicarPlantilla: (nombre: string) => void
  onComaDecimal: () => void
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
  coste,
  onCoste,
  plantillas,
  onGuardarPlantilla,
  onAplicarPlantilla,
  onComaDecimal,
}: Props) {
  const ref = usePanelVidrio<HTMLElement>()
  const base = useId()
  const [nombrePlantilla, setNombrePlantilla] = useState("")
  const titulo = lado === "A" ? "Fichero A" : "Fichero B"
  const retraso = lado === "A" ? "entrada entrada-2" : "entrada entrada-3"
  return (
    <section ref={ref} className={`vidrio-liquido panel-vidrio ${retraso}`} aria-labelledby={`${base}-titulo`}>
      <h2 id={`${base}-titulo`} className="vl-humo titulo-fichero">
        {titulo}
      </h2>
      <p className="subtitulo">CSV o Excel, hasta {Math.round(maxBytes / (1024 * 1024))} MB.</p>
      <details className="detalles">
        <summary>Detalles del fichero</summary>
        <p>Si no es UTF-8 se lee como Latin-1 y se avisa. La clave se compara tal cual, solo se quitan los espacios de los extremos.</p>
      </details>
      <div className="fila-archivo">
        <div className="archivo">
          <label htmlFor={lado === "A" ? "cuadra-archivo-a" : "cuadra-archivo-b"} className="boton-papel">
            Elegir CSV
          </label>
          <Input
            id={lado === "A" ? "cuadra-archivo-a" : "cuadra-archivo-b"}
            className="sr-only"
            type="file"
            accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain"
            disabled={ocupado}
            onChange={(evento) => {
              const archivo = evento.target.files?.[0]
              if (archivo) onArchivo(archivo)
              evento.target.value = ""
            }}
          />
        </div>
        {fichero ? (
          <button type="button" className="boton-papel" onClick={onQuitar} disabled={ocupado}>
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
                ? "Lo leímos en la cabecera. Cámbialo si hace falta."
                : fichero.origenDelimitador === "elegido"
                  ? "Usaremos el separador que ves marcado."
                  : "Hay coma y punto y coma. Elige uno."}
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
                  <Label className="etiqueta" htmlFor={`${base}-${campo}`}>{etiqueta}</Label>
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
              <div className="grid gap-1.5">
                <Label className="etiqueta" htmlFor={`${base}-coste`}>Coste, si quieres valorar las diferencias</Label>
                <select id={`${base}-coste`} className="campo" value={coste} onChange={(evento) => onCoste(evento.target.value)}>
                  <option value="">Sin columna de coste</option>
                  {fichero.columnas.map((columna) => (
                    <option key={columna} value={columna}>
                      {columna}
                    </option>
                  ))}
                </select>
              </div>
              {fichero.codificacion === "windows-1252" ? (
                <p className="aviso-suave">No era UTF-8. Se leyó como Windows-1252 en este navegador.</p>
              ) : null}
              {fichero.codificacion === "excel" ? (
                <p className="aviso-suave">El Excel se convirtió a CSV en este navegador. No sale del equipo.</p>
              ) : null}
              {fichero.delimitador && sospechaComaDecimal(fichero.texto, fichero.delimitador, fichero.mapeo.cantidad) ? (
                <button type="button" className="boton-papel" onClick={onComaDecimal}>
                  Convertir comas decimales de la cantidad
                </button>
              ) : null}
              <div className="controles">
                <input
                  className="campo"
                  value={nombrePlantilla}
                  onChange={(evento) => setNombrePlantilla(evento.target.value)}
                  placeholder="Nombre de plantilla"
                  aria-label={`Nombre de plantilla del fichero ${lado}`}
                />
                <button
                  type="button"
                  className="boton-papel"
                  disabled={!nombrePlantilla.trim()}
                  onClick={() => {
                    onGuardarPlantilla(nombrePlantilla.trim())
                    setNombrePlantilla("")
                  }}
                >
                  Guardar plantilla aquí
                </button>
                {plantillas.length > 0 ? (
                  <select className="campo" aria-label={`Aplicar plantilla al fichero ${lado}`} defaultValue="" onChange={(evento) => {
                    if (evento.target.value) onAplicarPlantilla(evento.target.value)
                    evento.target.value = ""
                  }}>
                    <option value="">Aplicar plantilla</option>
                    {plantillas.map((plantilla) => (
                      <option key={plantilla.nombre} value={plantilla.nombre}>
                        {plantilla.nombre}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
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
      <button type="button" className="boton-primario" disabled={!listo || ocupado} onClick={onClick}>
        Comparar ficheros
      </button>
      {!ocupado && hayFicheros && !listo ? (
        <p className="vl-humo aviso-suave">Elige el delimitador y las tres columnas en los dos ficheros para reconciliar.</p>
      ) : null}
    </div>
  )
}
