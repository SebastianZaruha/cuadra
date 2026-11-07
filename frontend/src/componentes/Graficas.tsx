import type { Fila, Filtro, Resumen } from "../tipos.ts"

const SEGMENTOS = [
  { id: "iguales" as const, etiqueta: "Iguales", color: "var(--color-iguales)", patron: "solido" },
  { id: "modificados" as const, etiqueta: "Modificadas", color: "var(--color-modificadas)", patron: "rayas" },
  { id: "solo_en_A" as const, etiqueta: "Solo en A", color: "var(--color-solo-a)", patron: "puntos" },
  { id: "solo_en_B" as const, etiqueta: "Solo en B", color: "var(--color-solo-b)", patron: "lineas" },
]

type Props = {
  filas: Fila[]
  resumen: Resumen
  filtro: Filtro
  busqueda: string
  onFiltro: (filtro: Filtro) => void
  onClave: (identificador: string) => void
}

export function Graficas({ filas, resumen, filtro, busqueda, onFiltro, onClave }: Props) {
  const conflictos = filas.filter(
    (fila) => fila.tipo === "modificados" || fila.tipo === "solo_en_A" || fila.tipo === "solo_en_B",
  )
  const conflictosResueltos = conflictos.filter((fila) => fila.estado === "resuelta").length
  const diferencias = diferenciasTop(filas)
  const textoDonut = SEGMENTOS.map((item) => `${resumen[item.id]} ${item.etiqueta.toLocaleLowerCase("es")}`).join(", ")

  return (
    <section className="cristal grid gap-5 p-4 sm:p-6" aria-labelledby="titulo-resumen">
      <h2 id="titulo-resumen" className="titulo text-2xl">
        Resumen
      </h2>
      <div className="grid gap-5 lg:grid-cols-2">
        <figure className="grid gap-3">
          <figcaption className="text-sm font-medium">Distribución del cuadre</figcaption>
          <div className="flex flex-wrap items-center gap-4">
            <Donut
              resumen={resumen}
              filtro={filtro}
              texto={textoDonut}
              onElegir={(id) => onFiltro(filtro === id ? "todas" : id)}
            />
            <table className="text-sm">
              <caption className="sr-only">Equivalente de la distribución</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Grupo</th>
                  <th scope="col">Filas</th>
                </tr>
              </thead>
              <tbody>
                {SEGMENTOS.map((item) => (
                  <tr key={item.id}>
                    <th scope="row" className="pr-4 text-left font-medium">
                      <button
                        type="button"
                        aria-pressed={filtro === item.id}
                        className="inline-flex items-center gap-2"
                        onClick={() => onFiltro(filtro === item.id ? "todas" : item.id)}
                      >
                        <Marca color={item.color} patron={item.patron} />
                        {item.etiqueta}
                      </button>
                    </th>
                    <td className="nums text-right">{resumen[item.id]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
        <div className="grid content-start gap-3">
          <p id="texto-progreso" className="text-sm font-medium">
            {conflictos.length === 0
              ? "No hay conflictos que resolver."
              : `${conflictosResueltos} de ${conflictos.length} conflictos resueltos.`}
          </p>
          <div className="progreso-pista flex" role="group" aria-labelledby="texto-progreso">
            <button
              type="button"
              className="h-full"
              style={{
                width: conflictos.length ? `${(conflictosResueltos / conflictos.length) * 100}%` : "0%",
                background: "var(--color-iguales)",
              }}
              aria-pressed={filtro === "resueltos"}
              onClick={() => onFiltro(filtro === "resueltos" ? "todas" : "resueltos")}
            >
              <span className="sr-only">Ver resueltos, {conflictosResueltos}</span>
            </button>
            <button
              type="button"
              className="h-full"
              style={{
                width: conflictos.length ? `${((conflictos.length - conflictosResueltos) / conflictos.length) * 100}%` : "100%",
                background: "var(--color-modificadas)",
              }}
              aria-pressed={filtro === "pendientes"}
              onClick={() => onFiltro(filtro === "pendientes" ? "todas" : "pendientes")}
            >
              <span className="sr-only">Ver pendientes, {conflictos.length - conflictosResueltos}</span>
            </button>
          </div>
          <table className="text-sm">
            <caption className="sr-only">Equivalente de la barra de conflictos</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Estado</th>
                <th scope="col">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="text-left font-medium">Resueltos</th>
                <td className="nums">{conflictosResueltos}</td>
              </tr>
              <tr>
                <th scope="row" className="text-left font-medium">Pendientes</th>
                <td className="nums">{conflictos.length - conflictosResueltos}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid gap-3">
        <h3 className="text-sm font-medium">Mayor diferencia de cantidad</h3>
        {diferencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguna clave está en los dos ficheros con cantidades distintas.</p>
        ) : (
          <>
            <ul className="grid gap-2">
              {diferencias.map((item) => {
                const activo = busqueda === item.identificador
                return (
                  <li key={item.identificador}>
                    <button
                      type="button"
                      aria-pressed={activo}
                      className="grid w-full grid-cols-[7rem_1fr_auto] items-center gap-3 text-left text-sm"
                      onClick={() => onClave(activo ? "" : item.identificador)}
                    >
                      <span className="truncate font-medium">{item.identificador}</span>
                      <span className="barra-pista">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${item.porcentaje}%`,
                            background: "repeating-linear-gradient(135deg, var(--color-modificadas), var(--color-modificadas) 4px, color-mix(in srgb, var(--color-modificadas) 55%, white) 4px, color-mix(in srgb, var(--color-modificadas) 55%, white) 7px)",
                          }}
                        />
                      </span>
                      <span className="nums">{item.texto}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <details className="text-sm">
              <summary>Tabla de diferencias</summary>
            <table className="mt-2">
              <caption className="sr-only">Equivalente de las diferencias de cantidad</caption>
              <thead>
                <tr>
                  <th scope="col" className="pr-3 text-left">Clave</th>
                  <th scope="col" className="pr-3 text-right">En A</th>
                  <th scope="col" className="pr-3 text-right">En B</th>
                  <th scope="col" className="text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {diferencias.map((item) => (
                  <tr key={item.identificador}>
                    <th scope="row" className="pr-3 text-left font-medium">{item.identificador}</th>
                    <td className="nums pr-3 text-right">{item.cantidadA}</td>
                    <td className="nums pr-3 text-right">{item.cantidadB}</td>
                    <td className="nums text-right">{item.texto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </details>
          </>
        )}
      </div>
    </section>
  )
}

function Marca({ color, patron }: { color: string; patron: string }) {
  const fondo =
    patron === "rayas"
      ? `repeating-linear-gradient(135deg, ${color}, ${color} 3px, transparent 3px, transparent 5px)`
      : patron === "puntos"
        ? `radial-gradient(circle, ${color} 1.5px, transparent 1.7px)`
        : patron === "lineas"
          ? `repeating-linear-gradient(${color}, ${color} 2px, transparent 2px, transparent 4px)`
          : color
  return <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ background: fondo, color }} />
}

function Donut({
  resumen,
  filtro,
  texto,
  onElegir,
}: {
  resumen: Resumen
  filtro: Filtro
  texto: string
  onElegir: (id: (typeof SEGMENTOS)[number]["id"]) => void
}) {
  const total = SEGMENTOS.reduce((suma, item) => suma + resumen[item.id], 0)
  const size = 196
  const centro = size / 2
  const radio = 74
  const hueco = 46
  const arcos = arcosDe(resumen, total)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="group" aria-label={`Distribución: ${texto}`}>
      <defs>
        <pattern id="rayas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="6" height="6" fill="var(--color-modificadas)" />
          <rect width="3" height="6" fill="color-mix(in srgb, var(--color-modificadas) 55%, white)" />
        </pattern>
        <pattern id="puntos" width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="var(--color-solo-a)" />
          <circle cx="2" cy="2" r="1.2" fill="white" opacity="0.7" />
        </pattern>
        <pattern id="lineas" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="var(--color-solo-b)" />
          <rect y="3" width="6" height="2" fill="white" opacity="0.45" />
        </pattern>
      </defs>
      {total === 0 ? (
        <circle cx={centro} cy={centro} r={radio} fill="none" stroke="currentColor" opacity="0.2" strokeWidth="22" />
      ) : (
        arcos.map((item) => {
          const relleno = item.patron === "solido" ? item.color : `url(#${item.patron})`
          return (
            <path
              key={item.id}
              d={item.valor === total ? anillo(centro, radio, hueco) : sector(centro, radio, hueco, item.inicio, item.fin)}
              fill={relleno}
              fillRule="evenodd"
              stroke="var(--cristal-solido)"
              strokeWidth="1.5"
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              aria-label={`${item.etiqueta}, ${item.valor}. Filtrar la tabla.`}
              aria-pressed={filtro === item.id}
              onClick={() => onElegir(item.id)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" || evento.key === " ") {
                  evento.preventDefault()
                  onElegir(item.id)
                }
              }}
            />
          )
        })
      )}
      <text x={centro} y={centro} textAnchor="middle" dominantBaseline="middle" className="nums" fontSize="18" fill="currentColor" style={{ pointerEvents: "none" }}>
        {total}
      </text>
    </svg>
  )
}

function arcosDe(resumen: Resumen, total: number) {
  let cursor = -Math.PI / 2
  return SEGMENTOS.flatMap((item) => {
    const valor = resumen[item.id]
    if (valor === 0 || total === 0) return []
    const inicio = cursor
    const fin = cursor + (valor / total) * Math.PI * 2
    cursor = fin
    return [{ ...item, valor, inicio, fin }]
  })
}

function anillo(cx: number, r: number, hueco: number): string {
  return `M ${cx - r} ${cx} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 M ${cx - hueco} ${cx} a ${hueco} ${hueco} 0 1 1 ${hueco * 2} 0 a ${hueco} ${hueco} 0 1 1 ${-hueco * 2} 0`
}

function sector(cx: number, r: number, hueco: number, inicio: number, fin: number): string {
  const punto = (angulo: number, radio: number) => [cx + radio * Math.cos(angulo), cx + radio * Math.sin(angulo)]
  const [x0, y0] = punto(inicio, r)
  const [x1, y1] = punto(fin, r)
  const [x2, y2] = punto(fin, hueco)
  const [x3, y3] = punto(inicio, hueco)
  const grande = fin - inicio > Math.PI ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${grande} 1 ${x1} ${y1} L ${x2} ${y2} A ${hueco} ${hueco} 0 ${grande} 0 ${x3} ${y3} Z`
}

function escala(cantidad: string): bigint {
  const negativo = cantidad.startsWith("-")
  const limpio = negativo ? cantidad.slice(1) : cantidad
  const [entera, fraccion = ""] = limpio.split(".")
  const valor = BigInt(entera || "0") * 10000n + BigInt((fraccion + "0000").slice(0, 4))
  return negativo ? -valor : valor
}

function textoEscala(valor: bigint): string {
  const negativo = valor < 0n
  const absoluto = negativo ? -valor : valor
  const entera = absoluto / 10000n
  const fraccion = (absoluto % 10000n).toString().padStart(4, "0").replace(/0+$/, "")
  const cuerpo = fraccion ? `${entera}.${fraccion}` : `${entera}`
  return negativo ? `-${cuerpo}` : cuerpo
}

function diferenciasTop(filas: Fila[]) {
  const items = filas.flatMap((fila) => {
    if (fila.tipo !== "modificados" || !fila.cantidad_difiere) return []
    const delta = escala(fila.cantidad_a) - escala(fila.cantidad_b)
    const absoluto = delta < 0n ? -delta : delta
    return [{ identificador: fila.identificador, cantidadA: fila.cantidad_a, cantidadB: fila.cantidad_b, absoluto, texto: textoEscala(delta) }]
  })
  items.sort((a, b) => (a.absoluto === b.absoluto ? a.identificador.localeCompare(b.identificador, "es") : a.absoluto > b.absoluto ? -1 : 1))
  const top = items.slice(0, 10)
  const maximo = top[0]?.absoluto ?? 1n
  return top.map((item) => ({
    ...item,
    porcentaje: maximo === 0n ? 0 : Number((item.absoluto * 100n) / maximo),
  }))
}
