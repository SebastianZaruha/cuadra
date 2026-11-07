import { readFileSync } from "node:fs"

import { expect, test } from "@playwright/test"

const RAIZ = new URL("../../fixtures/", import.meta.url)

test("abre Excel, elige hoja y filtra desde la gráfica", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Elegir fichero").first().setInputFiles(new URL("21-xlsx-hojas/a.xlsx", RAIZ).pathname)
  await page.getByLabel("Elegir fichero").nth(1).setInputFiles(new URL("21-xlsx-hojas/b.xlsx", RAIZ).pathname)
  await expect(page.getByText("Elige una. Cuadra no elige en silencio.").first()).toBeVisible()
  await page.getByLabel("Hoja").first().selectOption("Tienda")
  await page.getByLabel("Hoja").nth(1).selectOption("Tienda")
  await page.getByRole("button", { name: "Reconciliar" }).click()
  const tabla = page.getByRole("table", { name: "Valores de A frente a B, con la decisión de cada clave" })
  await expect(tabla.getByRole("row", { name: /H-1/ })).toBeVisible()

  const leyenda = page.getByRole("table", { name: "Equivalente de la distribución" })
  await leyenda.getByRole("button", { name: "Iguales" }).click()
  const segmento = page.getByRole("button", { name: "Iguales, 1. Filtrar la tabla." })
  await expect(segmento).toHaveAttribute("aria-pressed", "true")
  await expect(tabla.getByRole("row", { name: /H-1/ })).toBeVisible()
  await segmento.focus()
  await segmento.press("Enter")
  await expect(segmento).toHaveAttribute("aria-pressed", "false")
})

test("la demostración filtra por la dona y por la diferencia", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Cargar demostración" }).click()
  await page.getByRole("button", { name: "Reconciliar" }).click()
  await expect(page.getByText("0 de 5 conflictos resueltos.")).toBeVisible()

  const soloEnA = page.getByRole("button", { name: "Solo en A, 2. Filtrar la tabla." })
  await soloEnA.focus()
  await soloEnA.press("Enter")
  const tabla = page.getByRole("table", { name: "Valores de A frente a B, con la decisión de cada clave" })
  await expect(tabla.getByRole("row", { name: /LC-130/ })).toBeVisible()
  await expect(tabla.getByRole("row", { name: /LC-100/ })).toHaveCount(0)

  await page.getByRole("button", { name: /LC-110/ }).click()
  await expect(tabla.getByRole("row", { name: /LC-110/ })).toBeVisible()
  await expect(tabla.getByRole("row", { name: /LC-130/ })).toHaveCount(0)
})

test("JSON y CSV en Windows-1252 cuadran", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Elegir fichero").first().setInputFiles(new URL("18-json/a.json", RAIZ).pathname)
  await page.getByLabel("Elegir fichero").nth(1).setInputFiles(new URL("18-json/b.json", RAIZ).pathname)
  await page.getByRole("button", { name: "Reconciliar" }).click()
  const tabla = page.getByRole("table", { name: "Valores de A frente a B, con la decisión de cada clave" })
  await expect(tabla.getByRole("row", { name: /J-1/ })).toBeVisible()
  await expect(tabla.getByText("10.5").first()).toBeVisible()

  await page.getByLabel("Elegir fichero").first().setInputFiles(new URL("17-windows-1252/a.csv", RAIZ).pathname)
  await page.getByLabel("Elegir fichero").nth(1).setInputFiles(new URL("17-windows-1252/b.csv", RAIZ).pathname)
  await expect(page.getByText("Windows-1252").first()).toBeVisible()
  await page.getByRole("button", { name: "Reconciliar" }).click()
  await expect(tabla.getByRole("row", { name: /W-1/ })).toBeVisible()
  expect(readFileSync(new URL("17-windows-1252/a.csv", RAIZ)).includes(Buffer.from([0xf1]))).toBe(true)
})

test("ODS y TSV cuadran", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Elegir fichero").first().setInputFiles(new URL("20-ods/a.ods", RAIZ).pathname)
  await page.getByLabel("Elegir fichero").nth(1).setInputFiles(new URL("20-ods/b.ods", RAIZ).pathname)
  await page.getByRole("button", { name: "Reconciliar" }).click()
  const tabla = page.getByRole("table", { name: "Valores de A frente a B, con la decisión de cada clave" })
  await expect(tabla.getByRole("row", { name: /O-1/ })).toBeVisible()
  await expect(tabla.getByText("10.5").first()).toBeVisible()

  await page.getByLabel("Elegir fichero").first().setInputFiles(new URL("16-tabulador/a.tsv", RAIZ).pathname)
  await page.getByLabel("Elegir fichero").nth(1).setInputFiles(new URL("16-tabulador/b.tsv", RAIZ).pathname)
  await expect(page.getByText("Tabulador").first()).toBeVisible()
  await page.getByRole("button", { name: "Reconciliar" }).click()
  await expect(tabla.getByRole("row", { name: /T-1/ })).toBeVisible()
})

test("el tema noche se guarda", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Noche" }).click()
  await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro")
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro")
  await page.getByRole("button", { name: "Día" }).click()
  await expect(page.locator("html")).toHaveAttribute("data-tema", "claro")
})
