import type { ReactNode } from "react"

function linea(texto: string, clave: string): ReactNode[] {
  const trozos: ReactNode[] = []
  const patron = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
  let cursor = 0
  let i = 0
  for (const coincidencia of texto.matchAll(patron)) {
    const inicio = coincidencia.index ?? 0
    if (inicio > cursor) trozos.push(texto.slice(cursor, inicio))
    const token = coincidencia[0]
    if (token.startsWith("**")) {
      trozos.push(<strong key={`${clave}-${i}`}>{token.slice(2, -2)}</strong>)
    } else {
      const enlace = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (enlace) {
        const href = enlace[2]
        const externo = href.startsWith("http") || href.startsWith("mailto:")
        trozos.push(
          <a key={`${clave}-${i}`} href={href} {...(externo ? { rel: "noreferrer" } : {})}>
            {enlace[1]}
          </a>,
        )
      }
    }
    cursor = inicio + token.length
    i += 1
  }
  if (cursor < texto.length) trozos.push(texto.slice(cursor))
  return trozos
}

function tabla(filas: string[], clave: string) {
  const celdas = filas.map((fila) => fila.replace(/^\|/, "").replace(/\|$/, "").split("|").map((celda) => celda.trim()))
  const cuerpo = celdas.filter((fila) => !fila.every((celda) => /^:?-+:?$/.test(celda)))
  const [cabecera, ...resto] = cuerpo
  return (
    <div key={clave} className="legal-tabla">
      <table>
        <thead>
          <tr>
            {cabecera?.map((celda, i) => (
              <th key={i}>{linea(celda, `${clave}-h-${i}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resto.map((fila, f) => (
            <tr key={f}>
              {fila.map((celda, i) => (
                <td key={i}>{linea(celda, `${clave}-${f}-${i}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function renderMarkdown(markdown: string): ReactNode[] {
  const lineas = markdown.replace(/\r\n/g, "\n").split("\n")
  const nodos: ReactNode[] = []
  let i = 0
  let n = 0
  while (i < lineas.length) {
    const actual = lineas[i] ?? ""
    const ancla = actual.match(/^<a id="([^"]+)"><\/a>$/)
    if (ancla) {
      nodos.push(<a key={n} id={ancla[1]} />)
      i += 1
      n += 1
      continue
    }
    if (actual.startsWith("|")) {
      const filas: string[] = []
      while (i < lineas.length && (lineas[i] ?? "").startsWith("|")) {
        filas.push(lineas[i] ?? "")
        i += 1
      }
      nodos.push(tabla(filas, `t-${n}`))
      n += 1
      continue
    }
    const titulo = actual.match(/^(#{1,3}) (.+)$/)
    if (titulo) {
      const nivel = titulo[1].length
      const texto = linea(titulo[2], `h-${n}`)
      if (nivel === 1) nodos.push(<h1 key={n}>{texto}</h1>)
      else if (nivel === 2) nodos.push(<h2 key={n}>{texto}</h2>)
      else nodos.push(<h3 key={n}>{texto}</h3>)
      i += 1
      n += 1
      continue
    }
    if (actual.startsWith("- ")) {
      const items: string[] = []
      while (i < lineas.length && (lineas[i] ?? "").startsWith("- ")) {
        items.push((lineas[i] ?? "").slice(2))
        i += 1
      }
      nodos.push(
        <ul key={n}>
          {items.map((item, k) => (
            <li key={k}>{linea(item, `li-${n}-${k}`)}</li>
          ))}
        </ul>,
      )
      n += 1
      continue
    }
    if (actual.trim() === "") {
      i += 1
      continue
    }
    const parrafo: string[] = []
    while (i < lineas.length && (lineas[i] ?? "").trim() !== "" && !/^(#{1,3} |\| |- |<a id=)/.test(lineas[i] ?? "")) {
      parrafo.push(lineas[i] ?? "")
      i += 1
    }
    nodos.push(<p key={n}>{linea(parrafo.join(" "), `p-${n}`)}</p>)
    n += 1
  }
  return nodos
}
