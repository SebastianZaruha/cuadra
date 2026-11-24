import type { Resumen } from "../tipos.ts"

const PARTES: { id: keyof Pick<Resumen, "iguales" | "modificados" | "solo_en_A" | "solo_en_B" | "bloqueados">; etiqueta: string; tono: string }[] = [
  { id: "iguales", etiqueta: "Iguales", tono: "pino" },
  { id: "modificados", etiqueta: "Modificados", tono: "cobre" },
  { id: "solo_en_A", etiqueta: "Solo en A", tono: "azul" },
  { id: "solo_en_B", etiqueta: "Solo en B", tono: "ambar" },
  { id: "bloqueados", etiqueta: "Bloqueados", tono: "rojo" },
]

export function ResumenVisual({ resumen }: { resumen: Resumen }) {
  const maximo = Math.max(1, ...PARTES.map((parte) => resumen[parte.id]))
  return (
    <div>
      <p className="vl-humo resumen-cuenta">
        {resumen.pendientes} pendientes, {resumen.resueltos} resueltas y {resumen.bloqueados} bloqueadas.
      </p>
      <ul className="barras">
        {PARTES.map((parte, indice) => {
          const valor = resumen[parte.id]
          const ancho = `${Math.round((valor / maximo) * 1000) / 10}%`
          return (
            <li key={parte.id} className="fila-barra">
              <span>{parte.etiqueta}</span>
              <span className="pista" aria-hidden="true">
                <span
                  className={`relleno tono-${parte.tono}`}
                  style={{ width: ancho, animationDelay: `${indice * 45}ms` }}
                />
              </span>
              <span className="num">{valor}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
