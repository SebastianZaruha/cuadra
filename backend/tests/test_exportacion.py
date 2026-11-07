"""Exportación completa, parcial y la promesa de que ninguna fila de origen se esfuma."""

from __future__ import annotations

import csv
from io import StringIO

import pytest

from cuadra.dominio.errores import ExportacionBloqueada
from cuadra.dominio.servicio import exportar, reconciliar

from carga import FIXTURES, cargar_par


def _args(nombre: str, decisiones=None):
    csv_a, csv_b, entrada, _ = cargar_par(nombre)
    return dict(
        csv_a=csv_a,
        csv_b=csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        delimitador_a=entrada.get("delimitador_a"),
        delimitador_b=entrada.get("delimitador_b"),
        formato_a=entrada.get("formato_a"),
        formato_b=entrada.get("formato_b"),
        hoja_a=entrada.get("hoja_a"),
        hoja_b=entrada.get("hoja_b"),
        nombre_a=entrada.get("nombre_a", ""),
        nombre_b=entrada.get("nombre_b", ""),
        decisiones=decisiones,
    )


def _filas_csv(texto: str) -> list[dict[str, str]]:
    lineas = [linea for linea in texto.splitlines() if linea and not linea.startswith("#")]
    return list(csv.DictReader(StringIO("\n".join(lineas) + "\n")))


def test_exportacion_completa_bloqueada_con_pendientes(demo):
    with pytest.raises(ExportacionBloqueada) as exc:
        exportar(**_args("demo"), modo="completa")
    assert exc.value.pendientes == 5
    assert exc.value.bloqueados == 0
    assert "bloqueada" in exc.value.mensaje


def test_exportacion_completa_bloqueada_con_duplicados():
    with pytest.raises(ExportacionBloqueada) as exc:
        exportar(**_args("07-duplicados"), modo="completa")
    assert exc.value.bloqueados == 3


def test_parcial_marca_nombre_y_contenido(demo):
    parcial = exportar(**_args("demo"), modo="parcial")
    assert parcial["completa"] is False
    assert "parcial" in parcial["nombre_inventario"]
    assert "parcial" in parcial["nombre_historial"]
    assert "# cuadra_exportacion=PARCIAL" in parcial["inventario_csv"]
    assert "# cuadra_exportacion=PARCIAL" in parcial["historial_csv"]
    assert "# cuadra_pendientes=5" in parcial["inventario_csv"]
    inventario = _filas_csv(parcial["inventario_csv"])
    assert inventario
    assert {fila["marca_exportacion"] for fila in inventario} == {"PARCIAL"}
    # Sin decisiones solo salen los iguales. Los pendientes no se cuelan.
    assert {fila["identificador"] for fila in inventario} == {"LC-100", "LC-120", "LC-160"}


def test_completo_coincide_byte_a_byte_con_el_oraculo(demo):
    primera = exportar(**_args("demo", demo["decisiones"]), modo="completa")
    segunda = exportar(**_args("demo", demo["decisiones"]), modo="completa")
    assert primera["inventario_csv"].encode("utf-8") == segunda["inventario_csv"].encode("utf-8")
    assert primera["historial_csv"].encode("utf-8") == segunda["historial_csv"].encode("utf-8")
    assert primera["completa"] is True
    assert primera["nombre_inventario"] == "cuadra-inventario-completo.csv"
    assert primera["nombre_historial"] == "cuadra-historial-completo.csv"
    esperado_inv = (FIXTURES / "demo" / "inventario-completo.csv").read_text(encoding="utf-8")
    esperado_his = (FIXTURES / "demo" / "historial-completo.csv").read_text(encoding="utf-8")
    assert primera["inventario_csv"] == esperado_inv
    assert primera["historial_csv"] == esperado_his


def test_ninguna_fila_desaparece_en_la_exportacion_completa(demo):
    exportado = exportar(**_args("demo", demo["decisiones"]), modo="completa")
    historial = _filas_csv(exportado["historial_csv"])
    # 7 filas de datos en A y 6 en B. La línea de cabecera no cuenta.
    assert len(historial) == 13
    incluidas = [fila for fila in historial if fila["en_inventario"] == "si"]
    excluidas = [fila for fila in historial if fila["decision"] == "excluir"]
    assert len(incluidas) + len(excluidas) == len(historial)
    assert excluidas
    assert all(fila["motivo"].strip() for fila in excluidas)
    inventario = _filas_csv(exportado["inventario_csv"])
    assert "LC-150" not in {fila["identificador"] for fila in inventario}
    assert any(fila["identificador"] == "LC-150" and fila["decision"] == "excluir" for fila in historial)


def test_bloqueados_siguen_en_el_historial_parcial():
    exportado = exportar(**_args("07-duplicados"), modo="parcial")
    historial = _filas_csv(exportado["historial_csv"])
    # A tiene 3 datos y B tiene 3.
    assert len(historial) == 6
    bloqueados = [fila for fila in historial if fila["categoria"] == "bloqueados"]
    assert len(bloqueados) == 3
    assert {fila["identificador"] for fila in bloqueados} == {"DUP"}
    assert "# cuadra_bloqueados=3" in exportado["historial_csv"]
    assert "# cuadra_exportacion=PARCIAL" in exportado["historial_csv"]


def test_neutraliza_formulas_al_exportar():
    exportado = exportar(**_args("09-formulas"), modo="parcial")
    historial = exportado["historial_csv"]
    assert "'=CMD" in historial
    assert "'+SKU" in historial
    assert "'-SKU" in historial
    assert "'@SUM" in historial
    assert "'\tTABID" in historial
    assert "'=cmd" in historial
    assert "'\r=1" in historial
    assert "'=1+1" in historial
    # El negativo válido sigue siendo un número, no una celda neutralizada.
    assert ",-2," in historial
    assert "',-2" not in historial


def test_neutraliza_el_motivo_escrito_por_la_persona(demo):
    decisiones = [
        {"identificador": "LC-110", "tipo": "elegir_B", "motivo": "=SUM(A1)"},
        {"identificador": "LC-130", "tipo": "elegir_A", "motivo": "sigue en depósito"},
        {"identificador": "LC-140", "tipo": "elegir_A", "motivo": "texto del depósito"},
        {"identificador": "LC-150", "tipo": "excluir", "motivo": "baja"},
        {"identificador": "LC-170", "tipo": "elegir_B", "motivo": "alta de tienda"},
    ]
    exportado = exportar(**_args("demo", decisiones), modo="completa")
    assert "'=SUM(A1)" in exportado["historial_csv"]
    assert "\n=SUM(A1)" not in exportado["historial_csv"]


def test_mismo_cuadre_para_el_mismo_input(demo):
    uno = reconciliar(
        demo["csv_a"],
        demo["csv_b"],
        mapeo_a=demo["entrada"]["mapeo_a"],
        mapeo_b=demo["entrada"]["mapeo_b"],
        decisiones=demo["decisiones"],
    )
    dos = reconciliar(
        demo["csv_a"],
        demo["csv_b"],
        mapeo_a=demo["entrada"]["mapeo_a"],
        mapeo_b=demo["entrada"]["mapeo_b"],
        decisiones=list(reversed(demo["decisiones"])),
    )
    # El orden de la lista de decisiones no cambia el cuadre: se ordenan por clave.
    assert uno == dos
    assert uno["exportacion_completa_permitida"] is True
    assert uno["resumen"]["pendientes"] == 0
