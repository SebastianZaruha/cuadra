import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

import { disableGoogleAnalytics, enableGoogleAnalytics, gaMeasurementId } from "../analitica.ts"

const CLAVE = "cuadra-analitica"

/** El banner solo existe con un Measurement ID real. El script entra al aceptar. */
export function BannerAnalitica() {
  const id = gaMeasurementId()
  const [eleccion, setEleccion] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CLAVE)
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (!id) return
    if (eleccion === "aceptada") enableGoogleAnalytics(id)
    if (eleccion === "rechazada") disableGoogleAnalytics(id)
  }, [eleccion, id])
  if (!id || eleccion) return null
  function elegir(valor: "aceptada" | "rechazada") {
    try {
      localStorage.setItem(CLAVE, valor)
    } catch {
      /* el navegador puede bloquear el almacenamiento */
    }
    setEleccion(valor)
  }
  return (
    <div className="banner-analitica" role="dialog" aria-labelledby="titulo-analitica">
      <p id="titulo-analitica">Cookies de medición</p>
      <p>Texto legal pendiente de revisión</p>
      <div className="controles">
        <Button type="button" onClick={() => elegir("aceptada")}>
          Aceptar
        </Button>
        <Button type="button" variant="outline" onClick={() => elegir("rechazada")}>
          Rechazar
        </Button>
      </div>
    </div>
  )
}
