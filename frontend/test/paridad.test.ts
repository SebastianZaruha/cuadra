import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { crearSesion, exportarCuadre, reconciliar, serializarSesion, type Mapeo } from "../src/dominio/cuadra.ts"

const fixtures = join(import.meta.dirname, "../../fixtures")

function cargar(nombre: string) {
  const base = join(fixtures, nombre)
  const entrada = JSON.parse(readFileSync(join(base, "entrada.json"), "utf8")) as {
    delimitador_a: string | null
    delimitador_b: string | null
    mapeo_a: Mapeo
    mapeo_b: Mapeo
  }
  return {
    csvA: readFileSync(join(base, "a.csv"), "utf8"),
    csvB: readFileSync(join(base, "b.csv"), "utf8"),
    entrada,
    esperado: JSON.parse(readFileSync(join(base, "esperado.json"), "utf8")),
  }
}

const nombres = readdirSync(fixtures).filter((nombre) => {
  try {
    readFileSync(join(fixtures, nombre, "esperado.json"))
    return true
  } catch {
    return false
  }
}).sort()

describe("exportación demo", () => {
  it("coincide byte a byte con el oráculo", () => {
    const base = join(fixtures, "demo")
    const csvA = readFileSync(join(base, "a.csv"), "utf8")
    const csvB = readFileSync(join(base, "b.csv"), "utf8")
    const entrada = JSON.parse(readFileSync(join(base, "entrada.json"), "utf8")) as {
      delimitador_a: string | null
      delimitador_b: string | null
      mapeo_a: Mapeo
      mapeo_b: Mapeo
    }
    const decisiones = JSON.parse(readFileSync(join(base, "decisiones.json"), "utf8"))
    const obtenido = exportarCuadre(csvA, csvB, entrada.mapeo_a, entrada.mapeo_b, entrada.delimitador_a, entrada.delimitador_b, decisiones, "completa")
    expect(obtenido.inventario_csv).toBe(readFileSync(join(base, "inventario-completo.csv"), "utf8"))
    expect(obtenido.historial_csv).toBe(readFileSync(join(base, "historial-completo.csv"), "utf8"))
  })
})

describe("sesión demo", () => {
  it("serializa igual que el dominio Python", async () => {
    const base = join(fixtures, "demo")
    const csvA = readFileSync(join(base, "a.csv"), "utf8")
    const csvB = readFileSync(join(base, "b.csv"), "utf8")
    const entrada = JSON.parse(readFileSync(join(base, "entrada.json"), "utf8")) as {
      delimitador_a: string | null
      delimitador_b: string | null
      mapeo_a: Mapeo
      mapeo_b: Mapeo
    }
    const decisiones = JSON.parse(readFileSync(join(base, "decisiones.json"), "utf8"))
    const texto = serializarSesion(
      await crearSesion(csvA, csvB, entrada.mapeo_a, entrada.mapeo_b, "deposito.csv", "tienda.csv", entrada.delimitador_a, entrada.delimitador_b, decisiones),
    )
    const python = spawnSync(
      join(import.meta.dirname, "../../backend/.venv/bin/python"),
      ["-c", `
import json
from pathlib import Path
from cuadra.dominio.servicio import crear_sesion, serializar_sesion
base = Path(${JSON.stringify(base)})
csv_a = (base / "a.csv").read_text(encoding="utf-8")
csv_b = (base / "b.csv").read_text(encoding="utf-8")
entrada = json.loads((base / "entrada.json").read_text(encoding="utf-8"))
decisiones = json.loads((base / "decisiones.json").read_text(encoding="utf-8"))
print(serializar_sesion(crear_sesion(csv_a, csv_b, mapeo_a=entrada["mapeo_a"], mapeo_b=entrada["mapeo_b"], nombre_a="deposito.csv", nombre_b="tienda.csv", decisiones=decisiones)), end="")
`],
      { cwd: join(import.meta.dirname, "../../backend"), encoding: "utf8" },
    )
    expect(python.status).toBe(0)
    expect(texto).toBe(python.stdout)
  })
})

describe("paridad con el dominio Python", () => {
  for (const nombre of nombres) {
    it(nombre, () => {
      const { csvA, csvB, entrada, esperado } = cargar(nombre)
      const obtenido = reconciliar(
        csvA,
        csvB,
        entrada.mapeo_a,
        entrada.mapeo_b,
        entrada.delimitador_a,
        entrada.delimitador_b,
      )
      expect(obtenido).toEqual(esperado)
    })
  }
})
