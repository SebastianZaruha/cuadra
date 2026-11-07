"""La sesión es un archivo versionado. Reabrirlo no inventa ni olvida decisiones."""

from __future__ import annotations

import json

import pytest

from cuadra.dominio.mensajes import (
    decision_ilegal,
    sesion_hash,
    sesion_json,
    sesion_version,
)
from cuadra.dominio.servicio import (
    abrir_sesion,
    crear_sesion,
    parsear_sesion,
    reconciliar,
    serializar_sesion,
)

from carga import cargar_par


def _sesion_demo(demo, decisiones=None):
    return crear_sesion(
        demo["csv_a"],
        demo["csv_b"],
        mapeo_a=demo["entrada"]["mapeo_a"],
        mapeo_b=demo["entrada"]["mapeo_b"],
        nombre_a="deposito.csv",
        nombre_b="tienda.csv",
        decisiones=demo["decisiones"] if decisiones is None else decisiones,
    )


def test_guardar_y_reabrir_conserva_las_decisiones(demo):
    sesion = _sesion_demo(demo)
    texto = serializar_sesion(sesion)
    assert serializar_sesion(sesion) == texto
    otra = json.loads(texto)
    abierta = abrir_sesion(otra, demo["csv_a"], demo["csv_b"])
    assert abierta["ok"] is True
    assert abierta["errores"] == []
    directo = reconciliar(
        demo["csv_a"],
        demo["csv_b"],
        mapeo_a=demo["entrada"]["mapeo_a"],
        mapeo_b=demo["entrada"]["mapeo_b"],
        decisiones=demo["decisiones"],
    )
    assert abierta["filas"] == directo["filas"]
    assert abierta["resumen"] == directo["resumen"]
    decisiones = {
        fila["identificador"]: fila["decision"]
        for fila in abierta["filas"]
        if fila["tipo"] != "bloqueados" and fila["decision"]
    }
    assert set(decisiones) == {"LC-110", "LC-130", "LC-140", "LC-150", "LC-170"}
    assert decisiones["LC-150"]["tipo"] == "excluir"
    assert decisiones["LC-110"]["motivo"] == "El conteo de tienda es el más reciente."


def test_reabrir_rechaza_otra_version(demo):
    sesion = _sesion_demo(demo)
    sesion["schema_version"] = 2
    abierta = abrir_sesion(sesion, demo["csv_a"], demo["csv_b"])
    assert abierta["ok"] is False
    assert abierta["filas"] == []
    assert abierta["errores"][0]["mensaje"] == sesion_version(2)


def test_reabrir_rechaza_csv_distinto(demo):
    sesion = _sesion_demo(demo)
    abierta = abrir_sesion(sesion, demo["csv_a"] + "\n", demo["csv_b"])
    assert abierta["ok"] is False
    assert abierta["errores"][0]["codigo"] == "sesion_hash"
    assert abierta["errores"][0]["mensaje"] == sesion_hash("A")


def test_reabrir_rechaza_decision_ilegal_sin_aplicarla(demo):
    sesion = _sesion_demo(
        demo,
        decisiones=[{"identificador": "LC-130", "tipo": "elegir_B", "motivo": "no hay B"}],
    )
    abierta = abrir_sesion(sesion, demo["csv_a"], demo["csv_b"])
    assert abierta["ok"] is False
    assert abierta["filas"] == []
    assert abierta["errores"][0]["mensaje"] == decision_ilegal("elegir_B", "solo_en_A", "LC-130")


def test_json_invalido():
    lectura = parsear_sesion("{esto no es json")
    assert lectura["ok"] is False
    assert lectura["errores"][0]["mensaje"] == sesion_json()


def test_campo_desconocido():
    csv_a, csv_b, entrada, _ = cargar_par("02-punto-y-coma")
    sesion = crear_sesion(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        nombre_a="a.csv",
        nombre_b="b.csv",
    )
    sesion["nota_interna"] = "no debería viajar"
    abierta = abrir_sesion(sesion, csv_a, csv_b)
    assert abierta["ok"] is False
    assert abierta["errores"][0]["codigo"] == "sesion_campo_desconocido"


def test_sesion_sin_decisiones_reabre_el_cuadre_inicial(demo):
    sesion = _sesion_demo(demo, decisiones=[])
    abierta = abrir_sesion(sesion, demo["csv_a"], demo["csv_b"])
    assert abierta["ok"] is True
    assert abierta["filas"] == demo["esperado"]["filas"]
    assert abierta["exportacion_completa_permitida"] is False
