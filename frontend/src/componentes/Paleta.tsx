import { useEffect, useId, useState } from "react"

import { usePanelVidrio } from "../comun/estilo/usePanelVidrio.ts"

export type Orden = {
  id: string
  etiqueta: string
  detalle?: string
  disabled?: boolean
  run: () => void
}

export function Paleta({
  abierta,
  ordenes,
  onCerrar,
}: {
  abierta: boolean
  ordenes: Orden[]
  onCerrar: () => void
}) {
  if (!abierta) return null
  return <CajaPaleta ordenes={ordenes} onCerrar={onCerrar} />
}

function CajaPaleta({ ordenes, onCerrar }: { ordenes: Orden[]; onCerrar: () => void }) {
  const titulo = useId()
  const ref = usePanelVidrio<HTMLDivElement>()
  const [consulta, setConsulta] = useState("")
  const [indice, setIndice] = useState(0)
  const visibles = ordenes.filter((orden) => {
    const texto = `${orden.etiqueta} ${orden.detalle ?? ""}`.toLocaleLowerCase("es")
    return texto.includes(consulta.trim().toLocaleLowerCase("es"))
  })

  useEffect(() => {
    ref.current?.querySelector("input")?.focus()
    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault()
        onCerrar()
        return
      }
      if (evento.key === "ArrowDown") {
        evento.preventDefault()
        setIndice((actual) => Math.min(visibles.length - 1, actual + 1))
      } else if (evento.key === "ArrowUp") {
        evento.preventDefault()
        setIndice((actual) => Math.max(0, actual - 1))
      } else if (evento.key === "Enter") {
        evento.preventDefault()
        const orden = visibles[indice]
        if (orden && !orden.disabled) {
          orden.run()
          onCerrar()
        }
      } else if (evento.key === "Tab") {
        const foco = ref.current?.querySelectorAll<HTMLElement>("input, button")
        if (!foco || foco.length === 0) return
        const lista = [...foco]
        const actual = lista.indexOf(document.activeElement as HTMLElement)
        evento.preventDefault()
        const siguiente = evento.shiftKey ? (actual <= 0 ? lista.length - 1 : actual - 1) : (actual + 1) % lista.length
        lista[siguiente]?.focus()
      }
    }
    document.addEventListener("keydown", tecla)
    return () => document.removeEventListener("keydown", tecla)
  }, [indice, onCerrar, ref, visibles])

  return (
    <div className="velo" onMouseDown={onCerrar}>
      <div
        ref={ref}
        className="paleta vidrio-liquido panel-vidrio"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo}
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <h2 id={titulo} className="vl-humo titulo-fichero">
          Comandos
        </h2>
        <input
          className="campo"
          value={consulta}
          onChange={(evento) => {
            setConsulta(evento.target.value)
            setIndice(0)
          }}
          placeholder="Buscar una acción"
          aria-label="Buscar una acción"
          aria-activedescendant={visibles[indice] ? `orden-${visibles[indice].id}` : undefined}
          aria-controls="lista-ordenes"
        />
        <ul id="lista-ordenes" role="listbox" className="lista-ordenes">
          {visibles.length === 0 ? <li className="aviso-suave">Ninguna acción coincide.</li> : null}
          {visibles.map((orden, posicion) => (
            <li key={orden.id}>
              <button
                id={`orden-${orden.id}`}
                type="button"
                role="option"
                aria-selected={posicion === indice}
                className={posicion === indice ? "orden orden-activa" : "orden"}
                disabled={orden.disabled}
                onMouseEnter={() => setIndice(posicion)}
                onClick={() => {
                  orden.run()
                  onCerrar()
                }}
              >
                <span>{orden.etiqueta}</span>
                {orden.detalle ? <small>{orden.detalle}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
