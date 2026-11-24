import assert from "node:assert/strict"
import { test } from "node:test"

import { interpretarBorrador } from "../src/borrador.ts"
import { eleccionVigente } from "../src/consentimiento.ts"
import { convertirComaDecimal, filasCsv, sospechaComaDecimal } from "../src/csvLocal.ts"
import { deshacer, pilaVacia, recordar, rehacer } from "../src/historial.ts"
import { interpretarPlantillas } from "../src/plantillas.ts"
import { dentroDeTolerancia } from "../src/utilCuadre.ts"
import type { Fila } from "../src/tipos.ts"

test("deshacer y rehacer recuperan la decisión anterior", () => {
  let pila = pilaVacia<string[]>()
  pila = recordar(pila, [])
  const atras = deshacer(pila, ["LC-110"])
  assert.ok(atras)
  assert.deepEqual(atras.valor, [])
  const adelante = rehacer(atras.pila, atras.valor)
  assert.ok(adelante)
  assert.deepEqual(adelante.valor, ["LC-110"])
  assert.equal(deshacer(pilaVacia<string[]>(), []), null)
})

test("la coma decimal solo cambia la columna de cantidad", () => {
  const csv = "sku;cantidad\nA-1;1,5\nA-2;2\n"
  assert.equal(sospechaComaDecimal(csv, ";", "cantidad"), true)
  const convertido = convertirComaDecimal(csv, ";", "cantidad")
  const filas = filasCsv(convertido, ";")
  assert.equal(filas[1][1], "1.5")
  assert.equal(filas[2][1], "2")
})

test("un borrador inválido no se aplica", () => {
  assert.equal(interpretarBorrador("{"), null)
  assert.equal(interpretarBorrador(JSON.stringify({ version: 2 })), null)
  const valido = interpretarBorrador(JSON.stringify({
    version: 1,
    textoA: "a",
    textoB: "b",
    mapeoA: { identificador: "sku", descripcion: "descripcion", cantidad: "cantidad" },
    mapeoB: { identificador: "sku", descripcion: "descripcion", cantidad: "cantidad" },
    decisiones: [],
  }))
  assert.ok(valido)
  assert.equal(valido.textoA, "a")
})

test("las plantillas descartan objetos incompletos", () => {
  const lista = interpretarPlantillas(JSON.stringify([
    { nombre: "Tienda", mapeo: { identificador: "sku", descripcion: "nombre", cantidad: "stock" }, coste: "precio" },
    { nombre: "Rota" },
  ]))
  assert.equal(lista.length, 1)
  assert.equal(lista[0].coste, "precio")
})

test("la tolerancia no empareja descripciones distintas ni claves distintas", () => {
  const misma: Fila = {
    tipo: "modificados",
    identificador: "A",
    descripcion_a: "Tuerca",
    descripcion_b: "Tuerca",
    cantidad_a: "10",
    cantidad_b: "10.5",
    descripcion_difiere: false,
    cantidad_difiere: true,
    fila_a: 2,
    fila_b: 2,
    estado: "pendiente",
    decision: null,
  }
  const texto: Fila = { ...misma, descripcion_b: "Tornillo", descripcion_difiere: true }
  assert.equal(dentroDeTolerancia(misma, 1), true)
  assert.equal(dentroDeTolerancia(misma, 0.4), false)
  assert.equal(dentroDeTolerancia(texto, 5), false)
  assert.equal(dentroDeTolerancia(misma, 0), false)
})

test("la elección de cookies caduca a los 12 meses", () => {
  const ahora = Date.UTC(2026, 10, 24)
  const vigente = JSON.stringify({ v: 1, choice: "aceptada", at: ahora })
  assert.equal(eleccionVigente(vigente, ahora + 364 * 24 * 60 * 60 * 1000), "aceptada")
  assert.equal(eleccionVigente(vigente, ahora + 366 * 24 * 60 * 60 * 1000), null)
  assert.equal(eleccionVigente(JSON.stringify({ v: 2, choice: "aceptada", at: ahora }), ahora), null)
  assert.equal(eleccionVigente("{", ahora), null)
})
