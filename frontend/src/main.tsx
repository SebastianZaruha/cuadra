import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import "@fontsource/fraunces/latin-600.css"
import "@fontsource/fraunces/latin-700.css"
import "@fontsource/ibm-plex-sans/latin-400.css"
import "@fontsource/ibm-plex-sans/latin-500.css"
import "@fontsource/ibm-plex-sans/latin-600.css"

import App from "./App.tsx"
import { ProveedorCookies } from "./componentes/Cookies.tsx"
import { PaginaLegal } from "./legal/PaginaLegal.tsx"
import { idiomaDeRuta } from "./textosUi.ts"
import "./index.css"

function Raiz() {
  const [ruta, setRuta] = useState(window.location.pathname)
  useEffect(() => {
    const ir = () => setRuta(window.location.pathname)
    const alClick = (evento: MouseEvent) => {
      const enlace = (evento.target as HTMLElement | null)?.closest("a")
      if (!enlace || enlace.target === "_blank" || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return
      const url = new URL(enlace.href, window.location.origin)
      if (url.origin !== window.location.origin) return
      if (url.pathname !== "/" && url.pathname !== "/legal" && url.pathname !== "/legal-en") return
      evento.preventDefault()
      window.history.pushState({}, "", `${url.pathname}${url.hash}`)
      setRuta(url.pathname)
      if (url.hash) requestAnimationFrame(() => document.getElementById(url.hash.slice(1))?.scrollIntoView())
      else window.scrollTo(0, 0)
    }
    window.addEventListener("popstate", ir)
    document.addEventListener("click", alClick)
    return () => {
      window.removeEventListener("popstate", ir)
      document.removeEventListener("click", alClick)
    }
  }, [])
  const idioma = idiomaDeRuta(ruta)
  return (
    <ProveedorCookies idioma={idioma}>
      {ruta === "/legal" || ruta === "/legal-en" ? <PaginaLegal idioma={idioma} /> : <App />}
    </ProveedorCookies>
  )
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js")
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
)
