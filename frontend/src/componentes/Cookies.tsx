import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"

import { disableGoogleAnalytics, enableGoogleAnalytics, gaMeasurementId } from "../analitica.ts"
import { guardarEleccion, leerEleccion, type EleccionCookies } from "../consentimiento.ts"
import { textosDe, type Idioma } from "../textosUi.ts"
import { usePanelVidrio } from "../comun/estilo/usePanelVidrio.ts"

type Contexto = { abrir: () => void }

const CookiesContexto = createContext<Contexto>({ abrir: () => {} })

export function useCookies() {
  return useContext(CookiesContexto)
}

export function ProveedorCookies({ idioma, children }: { idioma: Idioma; children: ReactNode }) {
  const t = textosDe(idioma)
  const id = gaMeasurementId()
  const [eleccion, setEleccion] = useState<EleccionCookies | null>(() => leerEleccion())
  const [panel, setPanel] = useState(false)
  const [analitica, setAnalitica] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const tituloBanner = useId()
  const tituloPanel = useId()

  useEffect(() => {
    if (!id) return
    if (eleccion === "aceptada") enableGoogleAnalytics(id)
    if (eleccion === "rechazada") disableGoogleAnalytics(id)
  }, [eleccion, id])

  function aplicar(siguiente: EleccionCookies) {
    const habia = eleccion === "aceptada" || document.querySelector("script[data-cuadra-ga]")
    guardarEleccion(siguiente)
    if (siguiente === "aceptada") enableGoogleAnalytics(id)
    else disableGoogleAnalytics(id)
    setEleccion(siguiente)
    setPanel(false)
    if (siguiente === "rechazada" && habia) setMensaje(t.retirado)
    else setMensaje(t.guardado)
  }

  function abrir() {
    setAnalitica(eleccion === "aceptada")
    setMensaje("")
    setPanel(true)
  }

  return (
    <CookiesContexto.Provider value={{ abrir }}>
      {id && eleccion === null ? (
        <aside className="banner-analitica" aria-labelledby={tituloBanner}>
          <p id={tituloBanner}><strong>{t.bannerTitulo}</strong></p>
          <p>
            {t.banner} <a href={t.bannerPoliticaHref}>{t.bannerPolitica}</a>
          </p>
          <div className="botones-iguales">
            <Button type="button" variant="outline" onClick={() => aplicar("aceptada")}>{t.aceptar}</Button>
            <Button type="button" variant="outline" onClick={() => aplicar("rechazada")}>{t.rechazar}</Button>
            <Button type="button" variant="outline" onClick={abrir}>{t.configurar}</Button>
          </div>
        </aside>
      ) : null}
      {children}
      {mensaje ? <p className="aviso-cookies" role="status">{mensaje}</p> : null}
      {panel ? <Panel t={t} tituloId={tituloPanel} analitica={analitica} onAnalitica={setAnalitica} onCerrar={() => setPanel(false)} onAplicar={aplicar} /> : null}
    </CookiesContexto.Provider>
  )
}

function Panel({
  t,
  tituloId,
  analitica,
  onAnalitica,
  onCerrar,
  onAplicar,
}: {
  t: ReturnType<typeof textosDe>
  tituloId: string
  analitica: boolean
  onAnalitica: (valor: boolean) => void
  onCerrar: () => void
  onAplicar: (eleccion: EleccionCookies) => void
}) {
  const ref = usePanelVidrio<HTMLDivElement>()
  return (
    <div className="velo" onMouseDown={onCerrar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="paleta vidrio-liquido panel-vidrio"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <h2 id={tituloId} className="titulo-fichero">{t.panelTitulo}</h2>
        <p>{t.panelIntro}</p>
        <p><strong>{t.necesarias}</strong></p>
        <label className="opcion-radio">
          <input type="checkbox" role="switch" checked={analitica} onChange={(evento) => onAnalitica(evento.target.checked)} />
          <span>{t.analitica}</span>
        </label>
        <div className="botones-iguales">
          <Button type="button" variant="outline" onClick={() => onAplicar(analitica ? "aceptada" : "rechazada")}>{t.guardar}</Button>
          <Button type="button" variant="outline" onClick={() => onAplicar("aceptada")}>{t.aceptarTodo}</Button>
          <Button type="button" variant="outline" onClick={() => onAplicar("rechazada")}>{t.rechazarTodo}</Button>
        </div>
        <p><a href={t.bannerPoliticaHref}>{t.bannerPolitica}</a></p>
      </div>
    </div>
  )
}
