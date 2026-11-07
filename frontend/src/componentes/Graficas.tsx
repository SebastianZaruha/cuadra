import type { Fila, Filtro, Resumen } from "../tipos.ts"

const SEGMENTOS = [
  { id: "iguales" as const, etiqueta: "Iguales" },
  { id: "modificados" as const, etiqueta: "Modificadas" },
  { id: "solo_en_A" as const, etiqueta: "Solo en A" },
  { id: "solo_en_B" as const, etiqueta: "Solo en B" },
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
                        <span aria-hidden="true" className={`marca marca-${item.id}`} />
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
              className="progreso-hecho h-full"
              style={{ width: conflictos.length ? `${(conflictosResueltos / conflictos.length) * 100}%` : "0%" }}
              aria-pressed={filtro === "resueltos"}
              onClick={() => onFiltro(filtro === "resueltos" ? "todas" : "resueltos")}
            >
              <span className="sr-only">Ver resueltos, {conflictosResueltos}</span>
            </button>
            <button
              type="button"
              className="progreso-falta h-full"
              style={{
                width: conflictos.length ? `${((conflictos.length - conflictosResueltos) / conflictos.length) * 100}%` : "100%",
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
                        <span className="barra-diff" style={{ width: `${item.porcentaje}%` }} />
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
  const size = 188
  const centro = size / 2
  const radio = 70
  const circunferencia = 2 * Math.PI * radio
  const partes = trazosDe(resumen, total, circunferencia)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="group" aria-label={`Distribución: ${texto}`}>
      <defs>
        <linearGradient id="grad-sage" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8d9d94" />
          <stop offset="100%" stopColor="#5e6e64" />
        </linearGradient>
        <linearGradient id="grad-peach" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#c4a894" />
          <stop offset="100%" stopColor="#8d6b58" />
        </linearGradient>
        <linearGradient id="grad-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9aa8b8" />
          <stop offset="100%" stopColor="#5d6d82" />
        </linearGradient>
        <linearGradient id="grad-sand" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b49a" />
          <stop offset="100%" stopColor="#8d7b62" />
        </linearGradient>
        <pattern id="tex-sage" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#6f977f" />
          <path d="M0 6 L6 0" stroke="#143026" strokeWidth="1.2" />
        </pattern>
        <pattern id="tex-peach" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#e0a48a" />
          <path d="M0 6 L6 0" stroke="#5c2e22" strokeWidth="1.2" />
        </pattern>
        <pattern id="tex-sky" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#8aafc9" />
          <circle cx="2" cy="2" r="1" fill="#102033" />
        </pattern>
        <pattern id="tex-sand" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#d4b483" />
          <path d="M0 3 H6" stroke="#4a3516" strokeWidth="1.2" />
        </pattern>
        <filter id="brillo-dona" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {total === 0 ? (
        <circle cx={centro} cy={centro} r={radio} fill="none" stroke="currentColor" opacity="0.25" strokeWidth="16" />
      ) : (
        partes.map((item) => (
          <circle
            key={item.id}
            className={`seg-${item.id}`}
            cx={centro}
            cy={centro}
            r={radio}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={item.trazo}
            transform={`rotate(${item.giro} ${centro} ${centro})`}
            filter="url(#brillo-dona)"
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
        ))
      )}
      <text x={centro} y={centro} textAnchor="middle" dominantBaseline="central" className="dona-numero" fontSize="26" fontWeight="400" fill="currentColor" style={{ pointerEvents: "none" }}>
        {total}
      </text>
    </svg>
  )
}

function trazosDe(resumen: Resumen, total: number, circunferencia: number) {
  const hueco = 0.04
  let cursor = 0
  return SEGMENTOS.flatMap((item) => {
    const valor = resumen[item.id]
    if (valor === 0 || total === 0) return []
    const fraccion = valor / total
    const largo = Math.max(fraccion - hueco, 0.03) * circunferencia
    const giro = cursor * 360 - 90
    cursor += fraccion
    return [{ ...item, valor, giro, trazo: `${largo} ${circunferencia - largo}` }]
  })
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
