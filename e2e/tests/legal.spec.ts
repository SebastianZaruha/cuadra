import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"

import { expect, test, type Page, type Request } from "@playwright/test"

const require = createRequire(new URL("../../frontend/package.json", import.meta.url))
const XLSX = require("xlsx") as {
  utils: { aoa_to_sheet: (rows: string[][]) => unknown; book_new: () => unknown; book_append_sheet: (book: unknown, sheet: unknown, name: string) => void }
  writeFile: (book: unknown, path: string) => void
}

const SECRETO = "TOKCUADRA9"
const NOMBRE_CSV = "tokcuadra9.csv"
const NOMBRE_XLSX = "tokcuadra9.xlsx"
const directorio = mkdtempSync(join(tmpdir(), "cuadra-legal-"))
const csv = join(directorio, NOMBRE_CSV)
const xlsx = join(directorio, NOMBRE_XLSX)
writeFileSync(csv, `sku,descripcion,cantidad\n${SECRETO},Pieza,1\n`)
const libro = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([["sku", "descripcion", "cantidad"], [SECRETO, "Pieza", "2"]]), "Hoja1")
XLSX.writeFile(libro, xlsx)

function esGoogle(url: string) {
  return /googletagmanager\.com|google-analytics\.com|\/g\/collect|\/j\/collect/.test(url)
}

function cuerpo(peticion: Request) {
  return `${peticion.url()} ${peticion.postData() ?? ""}`
}

async function cookiesGa(page: Page) {
  return (await page.context().cookies()).filter((cookie) => cookie.name.startsWith("_ga"))
}

test("plan de 8 pasos del asesor", async ({ page }) => {
  const peticiones: Request[] = []
  page.on("request", (peticion) => {
    if (esGoogle(peticion.url())) peticiones.push(peticion)
  })

  await test.step("1. carga inicial sin analítica", async () => {
    await page.goto("/")
    await expect(page.getByRole("region", { name: "Cookies de analítica" }).or(page.getByText("Cookies de analítica"))).toBeVisible()
    await expect(page.getByText("Pendientes: 5.")).toBeVisible()
    expect(peticiones.filter((peticion) => peticion.url().includes("gtag/js") || peticion.url().includes("/g/collect"))).toEqual([])
    expect(await cookiesGa(page)).toEqual([])
  })

  await test.step("2. rechazar guarda la elección y no llama a Google", async () => {
    const antes = peticiones.length
    await page.getByRole("button", { name: "Rechazar" }).click()
    await expect(page.getByText("Cookies de analítica")).toBeHidden()
    await page.reload()
    await expect(page.getByText("Pendientes: 5.")).toBeVisible()
    await expect(page.getByText("Cookies de analítica")).toHaveCount(0)
    expect(peticiones.slice(antes).filter((peticion) => peticion.url().includes("gtag") || peticion.url().includes("/g/collect"))).toEqual([])
    expect(await cookiesGa(page)).toEqual([])
  })

  await test.step("3. aceptar todo carga gtag y las cookies", async () => {
    await page.getByRole("button", { name: "Configurar cookies" }).click()
    const gtag = page.waitForRequest((peticion) => peticion.url().includes("googletagmanager.com/gtag/js"))
    const collect = page.waitForRequest((peticion) => peticion.url().includes("/g/collect"))
    await page.getByRole("button", { name: "Aceptar todo" }).click()
    await gtag
    await collect
    await expect.poll(async () => (await cookiesGa(page)).map((cookie) => cookie.name).sort()).toEqual(expect.arrayContaining(["_ga"]))
    const nombres = (await cookiesGa(page)).map((cookie) => cookie.name)
    expect(nombres.some((nombre) => nombre.startsWith("_ga_"))).toBe(true)
  })

  await test.step("4. rechazar todo borra las cookies y corta g/collect", async () => {
    await page.getByRole("button", { name: "Configurar cookies" }).click()
    const antes = peticiones.filter((peticion) => peticion.url().includes("/g/collect")).length
    await page.getByRole("button", { name: "Rechazar todo" }).click()
    await expect(page.getByText("Analítica desactivada. Hemos borrado sus cookies.")).toBeVisible()
    await page.waitForTimeout(1000)
    expect(await cookiesGa(page)).toEqual([])
    expect(peticiones.filter((peticion) => peticion.url().includes("/g/collect")).length).toBe(antes)
    await expect(page.getByText("Pendientes: 5.")).toBeVisible()
  })

  await test.step("5. lo mismo desde /legal y /legal-en", async () => {
    for (const ruta of ["/legal", "/legal-en"]) {
      await page.goto(ruta)
      await page.getByRole("button", { name: ruta === "/legal" ? "Configurar cookies" : "Cookie settings" }).click()
      await page.getByRole("button", { name: ruta === "/legal" ? "Aceptar todo" : "Accept all" }).click()
      await expect.poll(async () => (await cookiesGa(page)).length).toBeGreaterThan(0)
      const antes = peticiones.filter((peticion) => peticion.url().includes("/g/collect")).length
      await page.getByRole("button", { name: ruta === "/legal" ? "Configurar cookies" : "Cookie settings" }).click()
      await page.getByRole("button", { name: ruta === "/legal" ? "Rechazar todo" : "Reject all" }).click()
      await page.waitForTimeout(800)
      expect(await cookiesGa(page)).toEqual([])
      expect(peticiones.filter((peticion) => peticion.url().includes("/g/collect")).length).toBe(antes)
    }
  })

  await test.step("6. comparar CSV y Excel no envía el fichero", async () => {
    await page.goto("/")
    await page.getByRole("button", { name: "Configurar cookies" }).click()
    await page.getByRole("button", { name: "Aceptar todo" }).click()
    const marca = peticiones.length
    await page.locator("#cuadra-archivo-a").setInputFiles(csv)
    await expect(page.getByText(NOMBRE_CSV)).toBeVisible()
    await page.locator("#cuadra-archivo-b").setInputFiles(xlsx)
    await expect(page.getByText("El Excel se convirtió a CSV en este navegador.")).toBeVisible()
    await page.getByRole("button", { name: "Comparar ficheros" }).click()
    await expect(page.getByRole("switch", { name: "Guardar borrador en este navegador" })).toBeVisible()
    const posteriores = peticiones.slice(marca)
    for (const peticion of posteriores) {
      const texto = cuerpo(peticion)
      expect(texto).not.toContain(SECRETO)
      expect(texto.toLowerCase()).not.toContain(NOMBRE_CSV)
      expect(texto.toLowerCase()).not.toContain(NOMBRE_XLSX)
    }
    const todas = peticiones.map(cuerpo).join("\n")
    expect(todas).not.toContain(SECRETO)
  })

  await test.step("7. borrador y plantillas se guardan y se borran", async () => {
    await page.getByRole("switch", { name: "Guardar borrador en este navegador" }).click()
    await page.getByRole("switch", { name: "Guardar plantillas de columnas en este navegador" }).click()
    await expect.poll(() => page.evaluate(() => ({
      borrador: localStorage.getItem("cuadra-borrador-v1") !== null,
      plantillas: localStorage.getItem("cuadra-plantillas-v1") !== null,
      cookies: localStorage.getItem("cuadra-cookies-v1") !== null,
    }))).toEqual({ borrador: true, plantillas: true, cookies: true })
    await page.getByRole("button", { name: "Borrar datos guardados" }).click()
    await page.getByRole("dialog", { name: "¿Borrar los datos guardados?" }).getByRole("button", { name: "Borrar" }).click()
    await expect.poll(() => page.evaluate(() => ({
      borrador: localStorage.getItem("cuadra-borrador-v1"),
      plantillas: localStorage.getItem("cuadra-plantillas-v1"),
      cookies: localStorage.getItem("cuadra-cookies-v1") !== null,
    }))).toEqual({ borrador: null, plantillas: null, cookies: true })
    await page.getByRole("switch", { name: "Guardar plantillas de columnas en este navegador" }).click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem("cuadra-plantillas-v1"))).not.toBeNull()
    await page.getByRole("switch", { name: "Guardar plantillas de columnas en este navegador" }).click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem("cuadra-plantillas-v1"))).toBeNull()
  })

  await test.step("8. las anclas abren el apartado", async () => {
    await page.goto("/legal#cookies")
    await expect(page.getByRole("heading", { name: "Política de cookies", exact: true })).toBeInViewport()
    await page.goto("/legal-en#privacidad")
    await expect(page.getByRole("heading", { name: "Privacy policy", exact: true })).toBeInViewport()
  })
})
