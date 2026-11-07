"""Qué se puede decidir según la categoría, sin mirar cómo está implementado."""

from __future__ import annotations

from cuadra.dominio.limites import MAX_FILAS
from cuadra.dominio.mensajes import (
    decision_cantidad_invalida,
    decision_desconocida,
    decision_duplicada,
    decision_en_bloqueada,
    decision_ilegal,
    decision_manual_descripcion,
    decision_motivo_vacio,
)
from cuadra.dominio.servicio import leer_texto, reconciliar

from carga import cargar_par


def _base():
    csv_a, csv_b, entrada, _ = cargar_par("01-coma-basico")
    return csv_a, csv_b, entrada


def _fila(resultado: dict, identificador: str) -> dict:
    return next(fila for fila in resultado["filas"] if fila.get("identificador") == identificador)


def test_elegir_b_en_solo_en_a_queda_a_la_vista_y_no_se_aplica():
    csv_a, csv_b, entrada = _base()
    resultado = reconciliar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        decisiones=[{"identificador": "A-3", "tipo": "elegir_B", "motivo": "no hay fila B"}],
    )
    assert resultado["ok"] is True
    assert _fila(resultado, "A-3")["decision"] is None
    assert _fila(resultado, "A-3")["estado"] == "pendiente"
    assert resultado["errores_decision"] == [
        {
            "codigo": "decision_ilegal",
            "mensaje": decision_ilegal("elegir_B", "solo_en_A", "A-3"),
            "fichero": None,
            "fila": None,
            "columna": None,
        }
    ]


def test_elegir_a_en_solo_en_b_no_se_aplica():
    csv_a, csv_b, entrada = _base()
    resultado = reconciliar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        decisiones=[{"identificador": "A-4", "tipo": "elegir_A", "motivo": "no hay fila A"}],
    )
    assert _fila(resultado, "A-4")["estado"] == "pendiente"
    assert resultado["errores_decision"][0]["mensaje"] == decision_ilegal("elegir_A", "solo_en_B", "A-4")


def test_cantidad_manual_cuando_solo_cambia_el_numero():
    csv_a, csv_b, entrada = _base()
    resultado = reconciliar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        decisiones=[
            {
                "identificador": "A-2",
                "tipo": "cantidad_manual",
                "cantidad": "4.50",
                "motivo": "conteo físico",
            }
        ],
    )
    decision = _fila(resultado, "A-2")["decision"]
    assert decision == {"tipo": "cantidad_manual", "cantidad": "4.5", "motivo": "conteo físico"}
    assert _fila(resultado, "A-2")["estado"] == "resuelta"
    assert resultado["errores_decision"] == []
    assert resultado["resumen"]["pendientes"] == 2
    assert resultado["resumen"]["resueltos"] == 2


def test_cantidad_manual_rechaza_coma_decimal():
    csv_a, csv_b, entrada = _base()
    resultado = reconciliar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        decisiones=[
            {"identificador": "A-2", "tipo": "cantidad_manual", "cantidad": "4,5", "motivo": "ajuste"}
        ],
    )
    assert _fila(resultado, "A-2")["decision"] is None
    assert resultado["errores_decision"][0]["codigo"] == "cantidad_manual_invalida"
    assert resultado["errores_decision"][0]["mensaje"] == decision_cantidad_invalida("A-2")


def test_cantidad_manual_ilegal_si_las_descripciones_difieren():
    csv_a, csv_b, entrada, _ = cargar_par("demo")
    resultado = reconciliar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        decisiones=[
            {
                "identificador": "LC-140",
                "tipo": "cantidad_manual",
                "cantidad": "40",
                "motivo": "quiero un número, no el texto",
            }
        ],
    )
    assert _fila(resultado, "LC-140")["decision"] is None
    assert resultado["errores_decision"][0]["mensaje"] == decision_manual_descripcion("LC-140")


def test_motivo_en_blanco_no_resuelve_la_fila():
    csv_a, csv_b, entrada = _base()
    resultado = reconciliar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        decisiones=[{"identificador": "A-3", "tipo": "elegir_A", "motivo": "   "}],
    )
    assert _fila(resultado, "A-3")["estado"] == "pendiente"
    assert resultado["errores_decision"][0]["mensaje"] == decision_motivo_vacio("A-3")


def test_decision_duplicada_no_se_aplica():
    csv_a, csv_b, entrada = _base()
    resultado = reconciliar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        decisiones=[
            {"identificador": "A-3", "tipo": "elegir_A", "motivo": "primera"},
            {"identificador": "A-3", "tipo": "excluir", "motivo": "segunda"},
        ],
    )
    assert _fila(resultado, "A-3")["decision"] is None
    assert resultado["errores_decision"][0]["mensaje"] == decision_duplicada("A-3")


def test_no_se_decide_una_clave_bloqueada_ni_una_desconocida():
    csv_a, csv_b, entrada, _ = cargar_par("07-duplicados")
    resultado = reconciliar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        decisiones=[
            {"identificador": "DUP", "tipo": "elegir_A", "motivo": "me quedo con una"},
            {"identificador": "NO-ESTA", "tipo": "excluir", "motivo": "fantasía"},
        ],
    )
    codigos = [error["codigo"] for error in resultado["errores_decision"]]
    assert codigos == ["decision_en_bloqueada", "decision_desconocida"]
    assert resultado["errores_decision"][0]["mensaje"] == decision_en_bloqueada("DUP")
    assert resultado["errores_decision"][1]["mensaje"] == decision_desconocida("NO-ESTA")
    assert all(fila["tipo"] == "bloqueados" for fila in resultado["filas"] if fila["identificador"] == "DUP")


def test_excluir_un_igual_requiere_motivo_y_lo_marca_resuelto():
    csv_a, csv_b, entrada = _base()
    resultado = reconciliar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        decisiones=[{"identificador": "A-1", "tipo": "excluir", "motivo": "baja del catálogo"}],
    )
    assert _fila(resultado, "A-1")["decision"] == {
        "tipo": "excluir",
        "motivo": "baja del catálogo",
    }
    assert _fila(resultado, "A-1")["estado"] == "resuelta"


def test_linea_en_blanco_no_desplaza_el_numero_de_fila():
    csv_a = "sku,descripcion,cantidad\nA-1,Tornillo,10\n\nA-2,Tuerca,5\n"
    csv_b = "sku,descripcion,cantidad\nA-1,Tornillo,10\nA-2,Tuerca,5\n"
    mapeo = {"identificador": "sku", "descripcion": "descripcion", "cantidad": "cantidad"}
    resultado = reconciliar(csv_a, csv_b, mapeo_a=mapeo, mapeo_b=mapeo)
    assert resultado["ok"] is True
    assert _fila(resultado, "A-2")["fila_a"] == 4
    assert resultado["resumen"]["iguales"] == 2
    assert resultado["resumen"]["bloqueados"] == 0


def test_fila_de_comas_vacias_no_desaparece():
    csv_a = "sku,descripcion,cantidad\n,,\n"
    csv_b = "sku,descripcion,cantidad\nB-1,Clavo,1\n"
    mapeo = {"identificador": "sku", "descripcion": "descripcion", "cantidad": "cantidad"}
    resultado = reconciliar(csv_a, csv_b, mapeo_a=mapeo, mapeo_b=mapeo)
    bloqueadas = [fila for fila in resultado["filas"] if fila["tipo"] == "bloqueados"]
    assert len(bloqueadas) == 1
    assert bloqueadas[0]["fila"] == 2
    assert {error["codigo"] for error in bloqueadas[0]["errores"]} >= {
        "identificador_vacio",
        "cantidad_vacia",
    }


def test_demasiadas_filas_rechaza_el_fichero_entero():
    cabecera = "sku,descripcion,cantidad\n"
    cuerpo = "".join(f"K-{i},Pieza,1\n" for i in range(MAX_FILAS + 1))
    csv_b = "sku,descripcion,cantidad\nK-0,Pieza,1\n"
    mapeo = {"identificador": "sku", "descripcion": "descripcion", "cantidad": "cantidad"}
    resultado = reconciliar(cabecera + cuerpo, csv_b, mapeo_a=mapeo, mapeo_b=mapeo)
    assert resultado["ok"] is False
    assert resultado["filas"] == []
    assert resultado["errores"][0]["codigo"] == "demasiadas_filas"


def test_fichero_demasiado_grande():
    mapeo = {"identificador": "sku", "descripcion": "descripcion", "cantidad": "cantidad"}
    csv_a = "sku,descripcion,cantidad\n" + ("A" * (1_048_576 + 1))
    csv_b = "sku,descripcion,cantidad\nB-1,Clavo,1\n"
    resultado = reconciliar(csv_a, csv_b, mapeo_a=mapeo, mapeo_b=mapeo)
    assert resultado["ok"] is False
    assert resultado["filas"] == []
    assert resultado["errores"][0]["codigo"] == "fichero_demasiado_grande"


def test_windows_1252_se_lee_y_el_pdf_no():
    datos = "sku,descripcion,cantidad\nA-1,cañón €,1\n".encode("cp1252")
    lectura = leer_texto(datos, fichero="A")
    assert lectura["ok"] is True
    assert lectura["codificacion"] == "windows-1252"
    assert "cañón €" in lectura["texto"]
    pdf = leer_texto(b"%PDF-1.4 no es un inventario", fichero="A")
    assert pdf["ok"] is False
    assert pdf["errores"][0]["codigo"] == "formato_no_soportado"


def test_cabecera_duplicada_no_adivina_columna():
    csv_a = "sku,sku,cantidad\nA-1,Tornillo,1\n"
    csv_b = "sku,descripcion,cantidad\nA-1,Tornillo,1\n"
    mapeo = {"identificador": "sku", "descripcion": "descripcion", "cantidad": "cantidad"}
    resultado = reconciliar(csv_a, csv_b, mapeo_a=mapeo, mapeo_b=mapeo)
    assert resultado["ok"] is False
    assert resultado["errores"][0]["codigo"] == "cabecera_duplicada"


def test_mapeo_con_la_misma_columna_dos_veces():
    csv_a = "sku,descripcion,cantidad\nA-1,Tornillo,1\n"
    csv_b = csv_a
    mapeo = {"identificador": "sku", "descripcion": "sku", "cantidad": "cantidad"}
    resultado = reconciliar(csv_a, csv_b, mapeo_a=mapeo, mapeo_b=mapeo)
    assert resultado["ok"] is False
    assert resultado["errores"][0]["codigo"] == "mapeo_repetido"


def test_el_bom_no_cambia_el_cuadre_y_si_el_hash_de_los_bytes():
    from cuadra.dominio.lectura import sha256_texto
    from cuadra.dominio.servicio import abrir_sesion, crear_sesion

    csv_a, csv_b, entrada, esperado = cargar_par("02-punto-y-coma")
    con_bom = "\ufeff" + csv_a
    sin = reconciliar(csv_a, csv_b, mapeo_a=entrada["mapeo_a"], mapeo_b=entrada["mapeo_b"])
    con = reconciliar(con_bom, csv_b, mapeo_a=entrada["mapeo_a"], mapeo_b=entrada["mapeo_b"])
    assert sin == con == esperado
    sesion_sin = crear_sesion(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        nombre_a="a.csv",
        nombre_b="b.csv",
    )
    sesion_con = crear_sesion(
        con_bom,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        nombre_a="a.csv",
        nombre_b="b.csv",
    )
    assert sesion_sin["schema_version"] == 2
    assert sesion_con["fichero_a"]["codificacion"] == "utf-8-sig"
    assert sesion_sin["fichero_a"]["sha256"] != sesion_con["fichero_a"]["sha256"]
    # La v1 ignoraba el BOM. Esos archivos siguen abriéndose.
    v1 = {
        "aplicacion": "cuadra",
        "schema_version": 1,
        "fichero_a": {
            "nombre": "a.csv",
            "sha256": sha256_texto(csv_a),
            "delimitador": ";",
            "mapeo": entrada["mapeo_a"],
        },
        "fichero_b": {
            "nombre": "b.csv",
            "sha256": sha256_texto(csv_b),
            "delimitador": ";",
            "mapeo": entrada["mapeo_b"],
        },
        "decisiones": [],
    }
    assert abrir_sesion(v1, con_bom, csv_b)["ok"] is True
    assert abrir_sesion(v1, csv_a, csv_b)["ok"] is True
    assert abrir_sesion(sesion_con, csv_a, csv_b)["ok"] is False
