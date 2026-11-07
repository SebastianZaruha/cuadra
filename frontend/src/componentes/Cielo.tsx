import { useState } from "react"

const NOMBRES = {
  claro: "cielo-dia",
  oscuro: "cielo-noche",
} as const

export function Cielo({ tema }: { tema: "claro" | "oscuro" }) {
  const [cargada, setCargada] = useState<string | null>(null)
  const base = NOMBRES[tema]
  const lista = cargada === base
  return (
    <div className="cielo" aria-hidden="true">
      <div className="cielo-degradado" />
      <span className="orbe orbe-a" />
      <span className="orbe orbe-b" />
      <svg className="nubes" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <filter id="nube-suave">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <g filter="url(#nube-suave)">
          <ellipse className="nube" cx="280" cy="150" rx="220" ry="70" />
          <ellipse className="nube" cx="430" cy="170" rx="160" ry="58" />
          <ellipse className="nube" cx="980" cy="120" rx="260" ry="78" />
          <ellipse className="nube" cx="1180" cy="160" rx="180" ry="60" />
          <ellipse className="nube" cx="700" cy="240" rx="240" ry="56" />
        </g>
      </svg>
      <img
        key={base}
        className={lista ? "cielo-foto lista" : "cielo-foto"}
        alt=""
        src={`/fondos/${base}.webp`}
        srcSet={`/fondos/${base}-1280.webp 1280w, /fondos/${base}.webp 2560w`}
        sizes="100vw"
        onLoad={() => setCargada(base)}
        onError={() => setCargada(null)}
      />
    </div>
  )
}
