import { expect, test } from "@playwright/test"

test("una elección de más de 12 meses vuelve a mostrar el banner", async ({ page }) => {
  await page.addInitScript(() => {
    const ahora = Date.now()
    const hace = ahora - 400 * 24 * 60 * 60 * 1000
    localStorage.setItem(
      "cuadra-cookies-v1",
      JSON.stringify({
        v: 1,
        choice: "aceptada",
        at: hace,
        hasta: new Date(hace + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    )
  })
  await page.goto("/")
  await expect(page.getByText("Cookies de analítica")).toBeVisible()
})

test("una elección vigente no muestra el banner", async ({ page }) => {
  await page.addInitScript(() => {
    const ahora = Date.now()
    localStorage.setItem(
      "cuadra-cookies-v1",
      JSON.stringify({
        v: 1,
        choice: "rechazada",
        at: ahora,
        hasta: new Date(ahora + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    )
  })
  await page.goto("/")
  await expect(page.getByText("Pendientes: 5.")).toBeVisible()
  await expect(page.getByText("Cookies de analítica")).toHaveCount(0)
})

test("guardar la analítica en el panel envía config y page_view", async ({ page }) => {
  const anuncios: string[] = []
  page.on("request", (peticion) => {
    if (/doubleclick|\/ads\/ga-audiences/.test(peticion.url())) anuncios.push(peticion.url())
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Configurar", exact: true }).click()
  await page.getByRole("switch", { name: /Analítica \(Google Analytics 4/ }).check()
  const collect = page.waitForRequest((peticion) => peticion.url().includes("/g/collect"))
  await page.getByRole("button", { name: "Guardar", exact: true }).click()
  await collect
  const ordenes = await page.evaluate(() =>
    (window.dataLayer ?? []).map((entrada) => Array.from(entrada as ArrayLike<unknown>)),
  )
  const config = ordenes.find((orden) => orden[0] === "config")
  expect(config?.[2]).toMatchObject({
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: "none",
    send_page_view: true,
  })
  expect(ordenes.some((orden) => orden[0] === "event" && orden[1] === "page_view")).toBe(true)
  expect(anuncios).toEqual([])
})

test("rechazar intenta borrar _ga y la cookie residual del dominio padre", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    const escritos: string[] = []
    const proto = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() {
        return proto?.get?.call(document) ?? ""
      },
      set(valor: string) {
        escritos.push(valor)
        proto?.set?.call(document, valor)
      },
    })
    ;(window as unknown as { __cookies: string[] }).__cookies = escritos
  })
  await page.getByRole("button", { name: "Rechazar" }).click()
  const escritos = await page.evaluate(() => (window as unknown as { __cookies: string[] }).__cookies)
  expect(escritos.some((linea) => linea.startsWith("_ga="))).toBe(true)
  expect(escritos.some((linea) => linea.startsWith("_ga_KR0J1VBPLH="))).toBe(true)
  expect(escritos.some((linea) => linea.includes("domain=.sebastianzaruha.com"))).toBe(true)
  expect(escritos.some((linea) => linea.startsWith("_ga=") && !linea.includes("domain="))).toBe(true)
})
