import { chromium, expect, test } from "@playwright/test"

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
  const vistas: string[] = []
  page.on("request", (peticion) => {
    const url = peticion.url()
    if (/doubleclick|\/ads\/ga-audiences/.test(url)) anuncios.push(url)
    if (url.includes("/g/collect") && /(?:^|[?&])en=page_view(?:&|$)/.test(url)) vistas.push(url)
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Configurar", exact: true }).click()
  await page.getByRole("switch", { name: /Analítica \(Google Analytics 4/ }).check()
  await page.getByRole("button", { name: "Guardar", exact: true }).click()
  await expect.poll(() => vistas.length, { timeout: 10000 }).toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  expect(vistas).toHaveLength(1)
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
  expect(ordenes.some((orden) => orden[0] === "event" && orden[1] === "page_view")).toBe(false)
  const configsConVista = ordenes.filter((orden) => orden[0] === "config" && (orden[2] as { send_page_view?: boolean } | undefined)?.send_page_view === true)
  expect(configsConVista).toHaveLength(1)
  expect(anuncios).toEqual([])
})

test("aceptar envía un solo page_view", async ({ page }) => {
  const vistas: string[] = []
  page.on("request", (peticion) => {
    const url = peticion.url()
    if (url.includes("/g/collect") && /(?:^|[?&])en=page_view(?:&|$)/.test(url)) vistas.push(url)
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Aceptar", exact: true }).click()
  await expect.poll(() => vistas.length, { timeout: 10000 }).toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  expect(vistas).toHaveLength(1)
})

test("la cookie queda en el host cuadra y no en el dominio padre", async () => {
  const browser = await chromium.launch({
    args: ["--host-resolver-rules=MAP cuadra.sebastianzaruha.com 127.0.0.1"],
  })
  const page = await browser.newPage()
  await page.goto("http://cuadra.sebastianzaruha.com:43123/", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Aceptar", exact: true }).click()
  await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name === "_ga")).toBe(true)
  const cookies = (await page.context().cookies()).filter((cookie) => cookie.name.startsWith("_ga"))
  expect(cookies.length).toBeGreaterThan(0)
  for (const cookie of cookies) {
    expect(cookie.domain).toBe("cuadra.sebastianzaruha.com")
    expect(cookie.domain.startsWith(".")).toBe(false)
  }
  await browser.close()
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
