import { useEffect } from "react"

import { usePanelVidrio } from "../comun/estilo/usePanelVidrio.ts"
import { Pie } from "../componentes/Pie.tsx"
import type { Idioma } from "../textosUi.ts"
import legalEn from "./legal-en.md?raw"
import legalEs from "./legal-es.md?raw"
import { renderMarkdown } from "./renderMarkdown.tsx"

export function PaginaLegal({ idioma }: { idioma: Idioma }) {
  const ref = usePanelVidrio<HTMLElement>()
  useEffect(() => {
    document.documentElement.lang = idioma === "en" ? "en" : "es"
    document.title = idioma === "en" ? "Legal and privacy · Cuadra" : "Legal y privacidad · Cuadra"
    const id = window.location.hash.replace("#", "")
    if (!id) return
    document.getElementById(id)?.scrollIntoView()
  }, [idioma])
  return (
    <>
      <div className="fondo" aria-hidden="true" />
      <div className="aplicacion">
        <header ref={ref} className="vidrio-liquido panel-vidrio barra">
          <a href="/">
            <p className="kicker">Inventario</p>
            <h1>Cuadra</h1>
          </a>
        </header>
        <article className="legal-doc superficie">
          {renderMarkdown(idioma === "en" ? legalEn : legalEs)}
        </article>
        <Pie idioma={idioma} />
      </div>
    </>
  )
}
