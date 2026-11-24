/**
 * Google Analytics 4 solo entra en la página después de aceptarlo.
 * Mismo patrón que Hourglass: un id vacío o de ejemplo no carga nada.
 * La variable es VITE_GA_ID y en el repositorio no tiene valor.
 */

const GA_HOST = "https://www.googletagmanager.com/gtag/js"

type Gtag = {
  (...args: unknown[]): void
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

export function gaMeasurementId(raw = import.meta.env.VITE_GA_ID): string | null {
  const id = raw?.trim() ?? ""
  if (!/^G-[A-Z0-9]+$/i.test(id)) return null
  if (/x{4,}/i.test(id)) return null
  return id
}

export function analiticaPreparada(): boolean {
  return gaMeasurementId() !== null
}

function disableFlag(id: string): string {
  return `ga-disable-${id}`
}

export function gaCookieClearDomains(hostname: string): readonly string[] {
  const host = hostname.trim().toLowerCase()
  const domains = new Set<string>(["", "cuadra.sebastianzaruha.com", ".cuadra.sebastianzaruha.com", "sebastianzaruha.com", ".sebastianzaruha.com"])
  if (!host) return [...domains]
  domains.add(host)
  domains.add(`.${host}`)
  if (host.startsWith("www.")) domains.add(host.slice(4))
  const labels = host.split(".").filter(Boolean)
  const ip = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")
  if (!ip && labels.length >= 3) {
    for (let i = 1; i <= labels.length - 2; i += 1) {
      const parent = labels.slice(i).join(".")
      domains.add(parent)
      domains.add(`.${parent}`)
    }
  }
  return [...domains]
}

export function gaCookieClearPaths(pathname: string): readonly string[] {
  const paths = new Set<string>(["/"])
  const clean = (pathname.split("?")[0] ?? "/").split("#")[0] ?? "/"
  const normalized = clean.startsWith("/") ? clean : `/${clean}`
  let acc = ""
  for (const bit of normalized.split("/").filter(Boolean)) {
    acc += `/${bit}`
    paths.add(acc)
    paths.add(`${acc}/`)
  }
  return [...paths]
}

function nombresGa(measurementId?: string | null): string[] {
  const names = new Set<string>(["_ga", "_gid", "_gat"])
  if (measurementId?.startsWith("G-")) names.add(`_ga_${measurementId.slice(2)}`)
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim() ?? ""
    if (name.startsWith("_ga") || name.startsWith("_gid") || name.startsWith("_gat")) names.add(name)
  }
  return [...names]
}

export function deleteGaCookies(measurementId?: string | null): void {
  const paths = gaCookieClearPaths(location.pathname || "/")
  const domains = gaCookieClearDomains(location.hostname || "")
  const secure = location.protocol === "https:" ? [false, true] : [false]
  for (const name of nombresGa(measurementId)) {
    for (const domain of domains) {
      const domainAttr = domain ? `; domain=${domain}` : ""
      for (const path of paths) {
        for (const isSecure of secure) {
          const secureAttr = isSecure ? "; Secure" : ""
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${domainAttr}${secureAttr}`
        }
      }
    }
  }
}

let loadedId: string | null = null
let scriptActivo = false
let quitarBloqueo: (() => void) | null = null

function esCollect(url: string): boolean {
  return /\/g\/collect(?:[?#]|$)/.test(url) || /\/j\/collect(?:[?#]|$)/.test(url)
}

function urlDe(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  return input.url
}

function bloquearCollect(): void {
  if (quitarBloqueo) return
  const pasos: Array<() => void> = []
  if (typeof window.fetch === "function") {
    const original = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (esCollect(urlDe(input))) return Promise.resolve(new Response(null, { status: 204 }))
      return original(input, init)
    }
    pasos.push(() => {
      window.fetch = original
    })
  }
  if (typeof navigator.sendBeacon === "function") {
    const original = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (esCollect(String(url))) return true
      return original(url, data)
    }
    pasos.push(() => {
      navigator.sendBeacon = original
    })
  }
  const XHR = window.XMLHttpRequest
  if (XHR) {
    const proto = XHR.prototype
    const originalOpen = proto.open
    const originalSend = proto.send
    proto.open = function open(this: XMLHttpRequest, method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
      ;(this as XMLHttpRequest & { __cuadra?: string }).__cuadra = String(url)
      return originalOpen.call(this, method, url, async ?? true, username, password)
    } as typeof proto.open
    proto.send = function send(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      const url = (this as XMLHttpRequest & { __cuadra?: string }).__cuadra ?? ""
      if (esCollect(url)) return
      return originalSend.call(this, body)
    } as typeof proto.send
    pasos.push(() => {
      proto.open = originalOpen
      proto.send = originalSend
    })
  }
  quitarBloqueo = () => {
    for (const paso of pasos) paso()
    quitarBloqueo = null
  }
}

function permitirCollect(): void {
  quitarBloqueo?.()
}

export function enableGoogleAnalytics(id: string | null): void {
  if (!id) return
  permitirCollect()
  ;(window as unknown as Record<string, boolean>)[disableFlag(id)] = false
  if (loadedId === id) return
  loadedId = id
  window.dataLayer = window.dataLayer ?? []
  window.gtag = function gtag() {
    // gtag.js exige Arguments. Un rest Array no cuenta como comando.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments)
  }
  window.gtag("js", new Date())
  window.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
  window.gtag("config", id, {
    cookie_domain: "none",
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: `${location.origin}${location.pathname}`,
  })
  const script = document.createElement("script")
  script.async = true
  script.src = `${GA_HOST}?id=${encodeURIComponent(id)}`
  script.dataset.cuadraGa = id
  script.onload = () => {
    scriptActivo = true
  }
  document.head.appendChild(script)
}

export function disableGoogleAnalytics(id: string | null): void {
  if (id) (window as unknown as Record<string, boolean>)[disableFlag(id)] = true
  bloquearCollect()
  if (scriptActivo && typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    })
  }
  deleteGaCookies(id)
  document.querySelectorAll("script[data-cuadra-ga]").forEach((node) => node.remove())
  document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').forEach((node) => node.remove())
  scriptActivo = false
  loadedId = null
  window.gtag = function gtagSilencio() {
    /* Consentimiento retirado: no se encola ni se envía. */
  }
}
