"""La API no guarda ficheros: responde al cuerpo y se olvida."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from cuadra.api.app import app
from cuadra.dominio.limites import MAX_BYTES, MAX_FILAS
from carga import FIXTURES, cargar_par

cliente = TestClient(app)
MAPEO = {"identificador": "sku", "descripcion": "descripcion", "cantidad": "cantidad"}


def _demo():
    csv_a, csv_b, entrada, _ = cargar_par("demo")
    decisiones = json.loads((FIXTURES / "demo" / "decisiones.json").read_text(encoding="utf-8"))
    return csv_a, csv_b, entrada, decisiones


def _cuerpo(csv_a, csv_b, entrada, decisiones=None, **extra):
    return {
        "csv_a": csv_a,
        "csv_b": csv_b,
        "nombre_a": "deposito.csv",
        "nombre_b": "tienda.csv",
        "delimitador_a": entrada["delimitador_a"],
        "delimitador_b": entrada["delimitador_b"],
        "mapeo_a": entrada["mapeo_a"],
        "mapeo_b": entrada["mapeo_b"],
        "decisiones": decisiones or [],
        **extra,
    }


def test_salud_y_limites():
    salud = cliente.get("/api/salud")
    assert salud.status_code == 200
    assert salud.json()["aplicacion"] == "cuadra"
    limites = cliente.get("/api/limites")
    assert limites.status_code == 200
    cuerpo = limites.json()
    assert cuerpo["max_bytes"] == MAX_BYTES == 1_048_576
    assert cuerpo["max_filas"] == MAX_FILAS == 2_000
    assert cuerpo["schema_version"] == 1


def test_demo_trae_los_dos_inventarios_ficticios():
    respuesta = cliente.get("/api/demo")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert "LC-100" in cuerpo["csv_a"]
    assert "LC-170" in cuerpo["csv_b"]
    assert cuerpo["delimitador_a"] == ","
    assert cuerpo["delimitador_b"] == ";"
    assert not cuerpo["csv_a"].startswith("\ufeff")


def test_reconciliar_demo_deja_la_exportacion_completa_bloqueada():
    csv_a, csv_b, entrada, _ = _demo()
    respuesta = cliente.post("/api/reconciliar", json=_cuerpo(csv_a, csv_b, entrada))
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["resumen"]["pendientes"] == 5
    assert cuerpo["exportacion_completa_permitida"] is False


def test_exportar_completo_responde_409_y_el_parcial_va_marcado():
    csv_a, csv_b, entrada, _ = _demo()
    bloqueada = cliente.post(
        "/api/exportar",
        json=_cuerpo(csv_a, csv_b, entrada, modo="completa"),
    )
    assert bloqueada.status_code == 409
    assert bloqueada.json()["errores"][0]["codigo"] == "exportacion_bloqueada"
    parcial = cliente.post(
        "/api/exportar",
        json=_cuerpo(csv_a, csv_b, entrada, modo="parcial"),
    )
    assert parcial.status_code == 200
    cuerpo = parcial.json()
    assert "parcial" in cuerpo["nombre_inventario"]
    assert "PARCIAL" in cuerpo["inventario_csv"]
    assert "# cuadra_exportacion=PARCIAL" in cuerpo["historial_csv"]


def test_con_decisiones_el_completo_sale_y_la_sesion_lo_reabre():
    csv_a, csv_b, entrada, decisiones = _demo()
    completo = cliente.post(
        "/api/exportar",
        json=_cuerpo(csv_a, csv_b, entrada, decisiones, modo="completa"),
    )
    assert completo.status_code == 200
    assert completo.json()["nombre_inventario"] == "cuadra-inventario-completo.csv"
    assert completo.json()["inventario_csv"] == (FIXTURES / "demo" / "inventario-completo.csv").read_text(
        encoding="utf-8"
    )
    sesion = cliente.post("/api/sesion", json=_cuerpo(csv_a, csv_b, entrada, decisiones))
    assert sesion.status_code == 200
    abierta = cliente.post(
        "/api/sesion/abrir",
        json={"sesion": sesion.json()["sesion"], "csv_a": csv_a, "csv_b": csv_b},
    )
    assert abierta.status_code == 200
    filas = {fila["identificador"]: fila for fila in abierta.json()["filas"] if "identificador" in fila}
    assert filas["LC-150"]["decision"]["tipo"] == "excluir"
    assert filas["LC-150"]["decision"]["motivo"] == "Muestra dañada; no entra al inventario final."
    assert abierta.json()["exportacion_completa_permitida"] is True


def test_abrir_sesion_con_version_desconocida_se_rechaza():
    csv_a, csv_b, entrada, decisiones = _demo()
    sesion = cliente.post("/api/sesion", json=_cuerpo(csv_a, csv_b, entrada, decisiones)).json()["sesion"]
    sesion["schema_version"] = 99
    abierta = cliente.post(
        "/api/sesion/abrir",
        json={"sesion": sesion, "csv_a": csv_a, "csv_b": csv_b},
    )
    assert abierta.status_code == 200
    assert abierta.json()["ok"] is False
    assert "99" in abierta.json()["errores"][0]["mensaje"]


def test_fichero_grande_responde_413():
    csv_b = "sku,descripcion,cantidad\nB-1,Clavo,1\n"
    enorme = "sku,descripcion,cantidad\n" + ("A" * (MAX_BYTES + 1))
    respuesta = cliente.post(
        "/api/reconciliar",
        json={
            "csv_a": enorme,
            "csv_b": csv_b,
            "mapeo_a": MAPEO,
            "mapeo_b": MAPEO,
        },
    )
    assert respuesta.status_code == 413
    assert respuesta.json()["errores"][0]["codigo"] == "fichero_demasiado_grande"


def test_delimitador_ambiguo_no_se_adivina():
    csv_a, csv_b, entrada, _ = cargar_par("10-delimitador-ambiguo")
    respuesta = cliente.post("/api/reconciliar", json=_cuerpo(csv_a, csv_b, entrada))
    assert respuesta.status_code == 200
    assert respuesta.json()["ok"] is False
    assert respuesta.json()["errores"][0]["codigo"] == "delimitador_ambiguo"
