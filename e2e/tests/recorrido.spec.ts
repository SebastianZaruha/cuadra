import { readFileSync } from "node:fs"

import { expect, type Page, test } from "@playwright/test"

const INVENTARIO = readFileSync(new URL("../../fixtures/demo/inventario-completo.csv", import.meta.url), "utf8")
const HISTORIAL = readFileSync(new URL("../../fixtures/demo/historial-completo.csv", import.meta.url), "utf8")

function filaDe(page: Page, identificador: string) {
  return page
    .getByRole("table", { name: "Valores de A frente a B, con la decisión de cada clave" })
    .getByRole("row", { name: new RegExp(`\\b${identificador}\\b`) })
}

async function decidir(page: Page, identificador: string, etiqueta: string, motivo: string) {
  const fila = filaDe(page, identificador)
  await fila.getByLabel("Decisión").selectOption({ label: etiqueta })
  await fila.getByLabel("Motivo").fill(motivo)
  await fila.getByRole("button", { name: "Guardar decisión" }).click()
  await expect(fila.getByLabel("Motivo")).toHaveValue(motivo)
}

test("recorre la demostración, exporta y reabre la sesión", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Cuadra" })).toBeVisible()
  await expect(page.getByText("Todavía no hay ficheros")).toBeVisible()

  await page.getByRole("button", { name: "Cargar demostración" }).click()
  await expect(page.getByRole("button", { name: "Reconciliar" })).toBeEnabled()
  await page.getByRole("button", { name: "Reconciliar" }).click()
  await expect(page.getByText("Pendientes: 5.")).toBeVisible()
  await expect(filaDe(page, "LC-110")).toBeVisible()
  await expect(filaDe(page, "LC-170")).toBeVisible()

  const completo = page.getByRole("button", { name: "Exportar inventario completo" })
  await expect(completo).toBeDisabled()
  await expect(page.getByText(/Exportación completa bloqueada: 5 pendientes/)).toBeVisible()

  await page.getByRole("button", { name: "Exportar parcial" }).click()
  const inventarioParcial = page.getByRole("link", { name: "Descargar cuadra-inventario-parcial.csv" })
  const historialParcial = page.getByRole("link", { name: "Descargar cuadra-historial-parcial.csv" })
  const descargaInventarioParcial = page.waitForEvent("download")
  await inventarioParcial.click()
  const archivoParcial = await descargaInventarioParcial
  expect(archivoParcial.suggestedFilename()).toContain("parcial")
  expect(readFileSync((await archivoParcial.path())!, "utf8")).toContain("# cuadra_exportacion=PARCIAL")
  const descargaHistorialParcial = page.waitForEvent("download")
  await historialParcial.click()
  expect(readFileSync((await (await descargaHistorialParcial).path())!, "utf8")).toContain("PARCIAL")

  await decidir(page, "LC-110", "Conservar B", "El conteo de tienda es el más reciente.")
  await decidir(page, "LC-130", "Conservar A", "Sigue en el depósito y se conserva.")
  await decidir(page, "LC-140", "Conservar A", "Unificamos la descripción con el depósito.")
  await decidir(page, "LC-150", "Excluir", "Muestra dañada; no entra al inventario final.")
  await decidir(page, "LC-170", "Conservar B", "Alta nueva registrada en tienda.")

  await expect(page.getByText("Pendientes: 0.")).toBeVisible()
  await expect(completo).toBeEnabled()

  await completo.click()
  const descargaInventario = page.waitForEvent("download")
  await page.getByRole("link", { name: "Descargar cuadra-inventario-completo.csv" }).click()
  expect(readFileSync((await (await descargaInventario).path())!, "utf8")).toBe(INVENTARIO)
  const descargaHistorial = page.waitForEvent("download")
  await page.getByRole("link", { name: "Descargar cuadra-historial-completo.csv" }).click()
  expect(readFileSync((await (await descargaHistorial).path())!, "utf8")).toBe(HISTORIAL)

  await page.getByRole("button", { name: "Guardar sesión" }).click()
  const descargaSesion = page.waitForEvent("download")
  await page.getByRole("link", { name: "Descargar cuadra-sesion.json" }).click()
  const sesion = await descargaSesion
  const rutaSesion = (await sesion.path())!

  await page.reload()
  await page.getByRole("button", { name: "Cargar demostración" }).click()
  await expect(page.getByRole("button", { name: "Reconciliar" })).toBeEnabled()
  await page.getByRole("button", { name: "Reconciliar" }).click()
  await expect(page.getByText("Pendientes: 5.")).toBeVisible()
  await page.getByLabel("Abrir una sesión guardada").setInputFiles(rutaSesion)
  await expect(page.getByText("Pendientes: 0.")).toBeVisible()
  const excluida = filaDe(page, "LC-150")
  await expect(excluida.getByLabel("Decisión")).toHaveValue("excluir")
  await expect(excluida.getByLabel("Motivo")).toHaveValue("Muestra dañada; no entra al inventario final.")
  await expect(completo).toBeEnabled()
})
