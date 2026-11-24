import { useState } from "react"

import { MEDICION_GA4 } from "../analitica.ts"

const CLAVE = "cuadra-analitica"

/**
 * Preparado como en Hourglass: aceptar o rechazar. No se monta mientras
 * MEDICION_GA4 esté vacío, así que hoy no pide nada ni carga analítica.
 */
export function BannerAnalitica() {
  const [eleccion, setEleccion] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CLAVE)
    } catch {
      return null
    }
  })
  if (eleccion) return null
  function elegir(valor: "aceptada" | "rechazada") {
    try {
      localStorage.setItem(CLAVE, valor)
    } catch {
      /* el navegador puede bloquear el almacenamiento */
    }
    setEleccion(valor)
    if (valor === "aceptada" && MEDICION_GA4) {
      const script = document.createElement("script")
      script.src = `https://www.googletagmanager.com/gtag/js?id=${MEDICION_GA4}`
      script.async = true
      document.head.append(script)
    }
  }
  return (
    <div className="banner-analitica" role="dialog" aria-labelledby="titulo-analitica">
      <p id="titulo-analitica">Cookies de medición</p>
      <p>Texto legal pendiente de revisión</p>
      <div className="controles">
        <button type="button" className="boton-primario" onClick={() => elegir("aceptada")}>
          Aceptar
        </button>
        <button type="button" className="control" onClick={() => elegir("rechazada")}>
          Rechazar
        </button>
      </div>
    </div>
  )
}
