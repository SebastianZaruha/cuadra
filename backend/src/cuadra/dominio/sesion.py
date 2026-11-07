"""Sesión descargable. La versión y el hash se comprueban antes de fiarse de una decisión."""

from __future__ import annotations

import json

from cuadra.dominio import mensajes
from cuadra.dominio.cuadre import Cuadre, construir
from cuadra.dominio.lectura import cantidad_canonica, error, sha256_texto
from cuadra.dominio.limites import SCHEMA_VERSION

_CAMPOS = {"aplicacion", "schema_version", "fichero_a", "fichero_b", "decisiones"}
_CAMPOS_FICHERO = {"nombre", "sha256", "delimitador", "mapeo"}
_CAMPOS_MAPEO = {"identificador", "descripcion", "cantidad"}
_CAMPOS_DECISION = {"identificador", "tipo", "motivo", "cantidad"}


def crear_sesion(
    csv_a: str,
    csv_b: str,
    *,
    mapeo_a: dict,
    mapeo_b: dict,
    nombre_a: str,
    nombre_b: str,
    delimitador_a: str | None = None,
    delimitador_b: str | None = None,
    decisiones: list[dict] | None = None,
) -> dict:
    cuadre = construir(
        csv_a,
        csv_b,
        mapeo_a=mapeo_a,
        mapeo_b=mapeo_b,
        delimitador_a=delimitador_a,
        delimitador_b=delimitador_b,
    )
    guardadas = sorted(
        (_decision_para_guardar(item) for item in (decisiones or [])),
        key=lambda item: item["identificador"] if isinstance(item["identificador"], str) else "",
    )
    return {
        "aplicacion": "cuadra",
        "schema_version": SCHEMA_VERSION,
        "fichero_a": _bloque_fichero(nombre_a, csv_a, cuadre.delimitador_a or delimitador_a, mapeo_a),
        "fichero_b": _bloque_fichero(nombre_b, csv_b, cuadre.delimitador_b or delimitador_b, mapeo_b),
        "decisiones": guardadas,
    }


def serializar_sesion(sesion: dict) -> str:
    return json.dumps(sesion, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def parsear_sesion(texto: str) -> dict:
    try:
        datos = json.loads(texto)
    except json.JSONDecodeError:
        return _fracaso([error("sesion_json", mensajes.sesion_json())])
    if not isinstance(datos, dict):
        return _fracaso([error("sesion_json", mensajes.sesion_json())])
    return {"ok": True, "sesion": datos, "errores": []}


def abrir_sesion(sesion: dict, csv_a: str, csv_b: str) -> dict:
    problemas = _validar_forma(sesion)
    if problemas:
        return _fracaso(problemas)
    errores: list[dict] = []
    if sha256_texto(csv_a) != sesion["fichero_a"]["sha256"]:
        errores.append(error("sesion_hash", mensajes.sesion_hash("A"), "A"))
    if sha256_texto(csv_b) != sesion["fichero_b"]["sha256"]:
        errores.append(error("sesion_hash", mensajes.sesion_hash("B"), "B"))
    if errores:
        return _fracaso(errores)
    cuadre = construir(
        csv_a,
        csv_b,
        mapeo_a=sesion["fichero_a"]["mapeo"],
        mapeo_b=sesion["fichero_b"]["mapeo"],
        delimitador_a=sesion["fichero_a"]["delimitador"],
        delimitador_b=sesion["fichero_b"]["delimitador"],
        decisiones=sesion["decisiones"],
    )
    if not cuadre.ok:
        return _fracaso(cuadre.errores, cuadre.delimitador_a, cuadre.delimitador_b)
    # Reabrir es estricto: una decisión que no cabe rechaza el archivo entero.
    if cuadre.errores_decision:
        return _fracaso(cuadre.errores_decision, cuadre.delimitador_a, cuadre.delimitador_b)
    return cuadre.a_dict()


def _bloque_fichero(nombre: str, csv_texto: str, delimitador: str | None, mapeo: dict) -> dict:
    return {
        "nombre": nombre,
        "sha256": sha256_texto(csv_texto),
        "delimitador": delimitador,
        "mapeo": {
            "identificador": mapeo["identificador"],
            "descripcion": mapeo["descripcion"],
            "cantidad": mapeo["cantidad"],
        },
    }


def _decision_para_guardar(cruda: dict) -> dict:
    ident = cruda.get("identificador", "")
    if isinstance(ident, str):
        ident = ident.strip()
    motivo = cruda.get("motivo", "")
    if isinstance(motivo, str):
        motivo = motivo.strip()
    tipo = cruda.get("tipo")
    guardada = {"identificador": ident, "tipo": tipo, "motivo": motivo}
    if tipo == "cantidad_manual":
        cant = cruda.get("cantidad", "")
        if isinstance(cant, str):
            canonica = cantidad_canonica(cant)
            guardada["cantidad"] = canonica if canonica is not None else cant.strip()
        else:
            guardada["cantidad"] = cant
    return guardada


def _validar_forma(sesion: object) -> list[dict]:
    if not isinstance(sesion, dict):
        return [error("sesion_json", mensajes.sesion_json())]
    if "schema_version" not in sesion:
        return [error("sesion_campo", mensajes.sesion_campo("schema_version"))]
    version = sesion["schema_version"]
    if type(version) is not int or version != SCHEMA_VERSION:
        return [error("sesion_version", mensajes.sesion_version(version))]
    errores: list[dict] = []
    desconocidos = sorted(set(sesion) - _CAMPOS)
    for campo in desconocidos:
        errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido(campo)))
    for campo in ("aplicacion", "fichero_a", "fichero_b", "decisiones"):
        if campo not in sesion:
            errores.append(error("sesion_campo", mensajes.sesion_campo(campo)))
    if errores:
        return errores
    if sesion["aplicacion"] != "cuadra":
        errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido("aplicacion")))
    errores.extend(_validar_fichero(sesion.get("fichero_a"), "fichero_a"))
    errores.extend(_validar_fichero(sesion.get("fichero_b"), "fichero_b"))
    decisiones = sesion.get("decisiones")
    if not isinstance(decisiones, list):
        errores.append(error("sesion_decisiones", mensajes.sesion_decisiones_tipo()))
    else:
        for indice, decision in enumerate(decisiones):
            errores.extend(_validar_decision_forma(decision, indice))
    return errores


def _validar_fichero(bloque: object, campo: str) -> list[dict]:
    if not isinstance(bloque, dict):
        return [error("sesion_campo", mensajes.sesion_campo(campo))]
    errores: list[dict] = []
    for extra in sorted(set(bloque) - _CAMPOS_FICHERO):
        errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido(extra)))
    for requerido in sorted(_CAMPOS_FICHERO - set(bloque)):
        errores.append(error("sesion_campo", mensajes.sesion_campo(f"{campo}.{requerido}")))
    if errores:
        return errores
    if bloque["delimitador"] not in {",", ";"}:
        errores.append(
            error(
                "delimitador_ausente",
                mensajes.delimitador_ausente("A" if campo.endswith("a") else "B"),
            )
        )
    if not isinstance(bloque["sha256"], str) or not isinstance(bloque["nombre"], str):
        errores.append(error("sesion_campo", mensajes.sesion_campo(campo)))
    mapeo = bloque["mapeo"]
    if not isinstance(mapeo, dict):
        return errores + [error("sesion_campo", mensajes.sesion_campo(f"{campo}.mapeo"))]
    for extra in sorted(set(mapeo) - _CAMPOS_MAPEO):
        errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido(extra)))
    for requerido in sorted(_CAMPOS_MAPEO - set(mapeo)):
        errores.append(error("sesion_campo", mensajes.sesion_campo(f"{campo}.mapeo.{requerido}")))
    return errores


def _validar_decision_forma(decision: object, indice: int) -> list[dict]:
    if not isinstance(decision, dict):
        return [error("sesion_decisiones", mensajes.sesion_decisiones_tipo())]
    permitidas = set(_CAMPOS_DECISION)
    if decision.get("tipo") != "cantidad_manual":
        permitidas = {"identificador", "tipo", "motivo"}
    errores: list[dict] = []
    for extra in sorted(set(decision) - permitidas):
        errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido(extra)))
    for requerido in ("identificador", "tipo", "motivo"):
        if requerido not in decision:
            errores.append(error("sesion_campo", mensajes.sesion_campo(f"decisiones[{indice}].{requerido}")))
    return errores


def _fracaso(
    errores: list[dict],
    delimitador_a: str | None = None,
    delimitador_b: str | None = None,
) -> dict:
    return {
        "ok": False,
        "delimitador_a": delimitador_a,
        "delimitador_b": delimitador_b,
        "exportacion_completa_permitida": False,
        "resumen": None,
        "filas": [],
        "errores": errores,
        "errores_decision": [],
    }
