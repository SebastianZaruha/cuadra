import { textosDe, type Idioma } from "../textosUi.ts"
import { useCookies } from "./Cookies.tsx"

export function Pie({ idioma }: { idioma: Idioma }) {
  const t = textosDe(idioma)
  const { abrir } = useCookies()
  return (
    <footer className="pie">
      <nav className="pie-nav" aria-label={idioma === "en" ? "Legal" : "Información legal"}>
        <a href={t.pieLegalHref}>{t.pieLegal}</a>
        <button type="button" className="enlace-pie" onClick={abrir}>{t.pieCookies}</button>
      </nav>
    </footer>
  )
}
