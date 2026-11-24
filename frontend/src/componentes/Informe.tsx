import { etiquetaCategoria } from "../opciones.ts"
import type { Fila, Resumen } from "../tipos.ts"

export function Informe({
  resumen,
  filas,
  valor,
}: {
  resumen: Resumen | null
  filas: Fila[]
  valor: number | null
}) {
  return (
    <section className="informe-impreso">
      <h1>Cuadra</h1>
      <p>Informe de conciliación. La clave es exacta. Este papel no sustituye al CSV de exportación.</p>
      {resumen ? (
        <p>
          Iguales {resumen.iguales}. Modificados {resumen.modificados}. Solo en A {resumen.solo_en_A}. Solo en B{" "}
          {resumen.solo_en_B}. Bloqueados {resumen.bloqueados}. Pendientes {resumen.pendientes}. Resueltos{" "}
          {resumen.resueltos}.
        </p>
      ) : null}
      {valor !== null ? <p>Valor estimado de las diferencias, con la columna de coste: {valor}.</p> : null}
      <table>
        <thead>
          <tr>
            <th>Clave</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Decisión</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.tipo === "bloqueados" ? `${fila.fichero}-${fila.fila}-${fila.identificador}` : `${fila.tipo}-${fila.identificador}`}>
              <td>{fila.identificador || "(vacío)"}</td>
              <td>{etiquetaCategoria(fila)}</td>
              <td>{fila.tipo === "bloqueados" ? "Bloqueado" : fila.estado}</td>
              <td>{fila.tipo === "bloqueados" ? "" : (fila.decision?.tipo ?? "")}</td>
              <td>{fila.tipo === "bloqueados" ? fila.errores.map((error) => error.mensaje).join(" ") : (fila.decision?.motivo ?? "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
