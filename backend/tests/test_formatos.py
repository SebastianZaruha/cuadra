"""Formatos nuevos: el contrato visible, no el parser por dentro."""

from __future__ import annotations

import base64
from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import Workbook, load_workbook  # noqa: F401

from cuadra.api.app import app
from cuadra.dominio.servicio import exportar, inspeccionar, reconciliar

from carga import FIXTURES, cargar_par

cliente = TestClient(app)
MAPEO = {"identificador": "sku", "descripcion": "descripcion", "cantidad": "cantidad"}


def test_varias_hojas_no_se_eligen_solas():
    datos = (FIXTURES / "21-xlsx-hojas" / "a.xlsx").read_bytes()
    otro = (FIXTURES / "21-xlsx-hojas" / "b.xlsx").read_bytes()
    vista = inspeccionar(datos, nombre="a.xlsx", fichero="A")
    assert vista["ok"] is False
    assert vista["errores"][0]["codigo"] == "hoja_requerida"
    assert vista["hojas"] == ["Notas", "Tienda"]
    sin_hoja = reconciliar(datos, otro, mapeo_a=MAPEO, mapeo_b=MAPEO, nombre_a="a.xlsx", nombre_b="b.xlsx")
    assert sin_hoja["ok"] is False
    assert sin_hoja["filas"] == []


def test_formula_de_excel_se_bloquea_y_el_pdf_no_entra():
    libro = Workbook()
    hoja = libro.active
    hoja.title = "Inventario"
    hoja.append(["sku", "descripcion", "cantidad"])
    hoja.append(["F-1", "Clavo", "=1+2"])
    buffer = BytesIO()
    libro.save(buffer)
    datos = buffer.getvalue()
    otro = "sku,descripcion,cantidad\nF-1,Clavo,3\n"
    resultado = reconciliar(datos, otro, mapeo_a=MAPEO, mapeo_b=MAPEO, nombre_a="a.xlsx")
    bloqueadas = [fila for fila in resultado["filas"] if fila["tipo"] == "bloqueados"]
    assert bloqueadas
    assert bloqueadas[0]["errores"][0]["codigo"] == "formula_peligrosa"
    pdf = reconciliar(b"%PDF-1.7\n", otro, mapeo_a=MAPEO, mapeo_b=MAPEO, nombre_a="malo.pdf")
    assert pdf["ok"] is False
    assert pdf["errores"][0]["codigo"] == "formato_no_soportado"
    assert "PDF" in pdf["errores"][0]["mensaje"]


def test_json_que_no_es_un_array_se_rechaza():
    resultado = reconciliar(b'{"sku": "A"}', b'[{"sku":"A","descripcion":"X","cantidad":1}]', mapeo_a=MAPEO, mapeo_b=MAPEO, nombre_a="a.json", nombre_b="b.json")
    assert resultado["ok"] is False
    assert resultado["errores"][0]["codigo"] == "json_no_es_lista"


def test_xlsx_parcial_lleva_cabecera_fija_y_marca():
    csv_a, csv_b, entrada, _ = cargar_par("demo")
    parcial = exportar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        modo="parcial",
        delimitador_a=entrada["delimitador_a"],
        delimitador_b=entrada["delimitador_b"],
    )
    libro = load_workbook(BytesIO(base64.b64decode(parcial["inventario_xlsx_base64"])))
    hoja = libro.active
    assert hoja["A1"].value == "PARCIAL"
    assert hoja.freeze_panes == "A3"
    assert hoja["A2"].value == "marca_exportacion"
    assert hoja["A2"].font.bold is True
    assert hoja["A3"].value == "PARCIAL"
    assert "parcial" in parcial["nombre_inventario_xlsx"]


def test_api_acepta_un_xlsx_real_en_base64():
    datos = (FIXTURES / "19-xlsx" / "a.xlsx").read_bytes()
    otro = (FIXTURES / "19-xlsx" / "b.xlsx").read_bytes()
    respuesta = cliente.post(
        "/api/reconciliar",
        json={
            "contenido_a_base64": base64.b64encode(datos).decode("ascii"),
            "contenido_b_base64": base64.b64encode(otro).decode("ascii"),
            "nombre_a": "a.xlsx",
            "nombre_b": "b.xlsx",
            "formato_a": "xlsx",
            "formato_b": "xlsx",
            "mapeo_a": MAPEO,
            "mapeo_b": MAPEO,
        },
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["ok"] is True
    assert cuerpo["resumen"]["iguales"] == 1
    assert any(fila["identificador"] == "X-1" and fila["cantidad"] == "10.5" for fila in cuerpo["filas"])
    danado = cliente.post(
        "/api/inspeccionar",
        json={"contenido_base64": base64.b64encode(b"esto no es excel").decode("ascii"), "nombre": "malo.xlsx", "fichero": "A"},
    )
    assert danado.json()["errores"][0]["codigo"] == "archivo_danado"
