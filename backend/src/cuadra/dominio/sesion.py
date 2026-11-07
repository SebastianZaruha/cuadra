"""Sesión descargable. La versión y el hash se comprueban antes de fiarse de una decisión."""

from __future__ import annotations

import json

from cuadra.dominio import mensajes
from cuadra.dominio.cuadre import Cuadre, construir
from cuadra.dominio.lectura import cantidad_canonica, como_bytes, error, sha256_bytes, sha256_texto
from cuadra.dominio.limites import SCHEMA_VERSION, SCHEMA_VERSION_V1

_CAMPOS = {"aplicacion", "schema_version", "fichero_a", "fichero_b", "decisiones"}
_CAMPOS_FICHERO_V1 = {"nombre", "sha256", "delimitador", "mapeo"}
_CAMPOS_FICHERO_V2 = {"nombre", "sha256", "formato", "delimitador", "codificacion", "hoja", "mapeo"}
_CAMPOS_MAPEO = {"identificador", "descripcion", "cantidad"}
_CAMPOS_DECISION = {"identificador", "tipo", "motivo", "cantidad"}
_FORMATOS = {"csv", "xlsx", "ods", "json"}
_CODIFICACIONES = {"utf-8", "utf-8-sig", "windows-1252"}
_DELIMITADORES = {",", ";", "\t"}


def crear_sesion(
    csv_a: str | bytes,
    csv_b: str | bytes,
    *,
    mapeo_a: dict,
    mapeo_b: dict,
    nombre_a: str,
    nombre_b: str,
    delimitador_a: str | None = None,
    delimitador_b: str | None = None,
    formato_a: str | None = None,
    formato_b: str | None = None,
    hoja_a: str | None = None,
    hoja_b: str | None = None,
    decisiones: list[dict] | None = None,
) -> dict:
    cuadre = construir(
        csv_a,
        csv_b,
        mapeo_a=mapeo_a,
        mapeo_b=mapeo_b,
        delimitador_a=delimitador_a,
        delimitador_b=delimitador_b,
        formato_a=formato_a,
        formato_b=formato_b,
        hoja_a=hoja_a,
        hoja_b=hoja_b,
        nombre_a=nombre_a,
        nombre_b=nombre_b,
    )
    guardadas = sorted(
        (_decision_para_guardar(item) for item in (decisiones or [])),
        key=lambda item: item["identificador"] if isinstance(item["identificador"], str) else "",
    )
    return {
        "aplicacion": "cuadra",
        "schema_version": SCHEMA_VERSION,
        "fichero_a": _bloque_fichero("A", nombre_a, cuadre, mapeo_a),
        "fichero_b": _bloque_fichero("B", nombre_b, cuadre, mapeo_b),
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


def abrir_sesion(sesion: dict, csv_a: str | bytes, csv_b: str | bytes) -> dict:
    problemas = _validar_forma(sesion)
    if problemas:
        return _fracaso(problemas)
    version = sesion["schema_version"]
    datos_a = como_bytes(csv_a)
    datos_b = como_bytes(csv_b)
    errores: list[dict] = []
    if _hash_sesion(datos_a, version) != sesion["fichero_a"]["sha256"]:
        errores.append(error("sesion_hash", mensajes.sesion_hash("A"), "A"))
    if _hash_sesion(datos_b, version) != sesion["fichero_b"]["sha256"]:
        errores.append(error("sesion_hash", mensajes.sesion_hash("B"), "B"))
    if errores:
        return _fracaso(errores)
    formato_a, hoja_a, delim_a = _pista(sesion["fichero_a"], version)
    formato_b, hoja_b, delim_b = _pista(sesion["fichero_b"], version)
    cuadre = construir(
        datos_a,
        datos_b,
        mapeo_a=sesion["fichero_a"]["mapeo"],
        mapeo_b=sesion["fichero_b"]["mapeo"],
        delimitador_a=delim_a,
        delimitador_b=delim_b,
        formato_a=formato_a,
        formato_b=formato_b,
        hoja_a=hoja_a,
        hoja_b=hoja_b,
        nombre_a=sesion["fichero_a"]["nombre"],
        nombre_b=sesion["fichero_b"]["nombre"],
        decisiones=sesion["decisiones"],
    )
    if not cuadre.ok:
        return _fracaso(cuadre.errores, cuadre.delimitador_a, cuadre.delimitador_b)
    # Reabrir es estricto: una decisión que no cabe rechaza el archivo entero.
    if cuadre.errores_decision:
        return _fracaso(cuadre.errores_decision, cuadre.delimitador_a, cuadre.delimitador_b)
    return cuadre.a_dict()


def _bloque_fichero(lado: str, nombre: str, cuadre: Cuadre, mapeo: dict) -> dict:
    sufijo = lado.lower()
    formato = getattr(cuadre, f"formato_{sufijo}") or "csv"
    delimitador = getattr(cuadre, f"delimitador_{sufijo}") if formato == "csv" else None
    codificacion = getattr(cuadre, f"codificacion_{sufijo}") if formato in {"csv", "json"} else None
    hoja = getattr(cuadre, f"hoja_{sufijo}") if formato in {"xlsx", "ods"} else None
    return {
        "nombre": nombre,
        "sha256": getattr(cuadre, f"sha256_{sufijo}") or sha256_bytes(b""),
        "formato": formato,
        "delimitador": delimitador,
        "codificacion": codificacion,
        "hoja": hoja,
        "mapeo": {
            "identificador": mapeo["identificador"],
            "descripcion": mapeo["descripcion"],
            "cantidad": mapeo["cantidad"],
        },
    }


def _hash_sesion(datos: bytes, version: int) -> str | None:
    if version == SCHEMA_VERSION_V1:
        try:
            texto = datos.decode("utf-8")
        except UnicodeDecodeError:
            return None
        return sha256_texto(texto)
    return sha256_bytes(datos)


def _pista(bloque: dict, version: int) -> tuple[str, str | None, str | None]:
    if version == SCHEMA_VERSION_V1:
        return "csv", None, bloque["delimitador"]
    return bloque["formato"], bloque["hoja"], bloque["delimitador"]


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
    if type(version) is not int or version not in {SCHEMA_VERSION_V1, SCHEMA_VERSION}:
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
    errores.extend(_validar_fichero(sesion.get("fichero_a"), "fichero_a", version))
    errores.extend(_validar_fichero(sesion.get("fichero_b"), "fichero_b", version))
    decisiones = sesion.get("decisiones")
    if not isinstance(decisiones, list):
        errores.append(error("sesion_decisiones", mensajes.sesion_decisiones_tipo()))
    else:
        for indice, decision in enumerate(decisiones):
            errores.extend(_validar_decision_forma(decision, indice))
    return errores


def _validar_fichero(bloque: object, campo: str, version: int) -> list[dict]:
    if not isinstance(bloque, dict):
        return [error("sesion_campo", mensajes.sesion_campo(campo))]
    permitidos = _CAMPOS_FICHERO_V1 if version == SCHEMA_VERSION_V1 else _CAMPOS_FICHERO_V2
    errores: list[dict] = []
    for extra in sorted(set(bloque) - permitidos):
        errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido(extra)))
    for requerido in sorted(permitidos - set(bloque)):
        errores.append(error("sesion_campo", mensajes.sesion_campo(f"{campo}.{requerido}")))
    if errores:
        return errores
    lado = "A" if campo.endswith("a") else "B"
    if not isinstance(bloque["sha256"], str) or not isinstance(bloque["nombre"], str):
        errores.append(error("sesion_campo", mensajes.sesion_campo(campo)))
    if version == SCHEMA_VERSION_V1:
        if bloque["delimitador"] not in {",", ";"}:
            errores.append(error("delimitador_ausente", mensajes.delimitador_ausente(lado)))
    else:
        errores.extend(_validar_origen_v2(bloque, campo, lado))
    mapeo = bloque["mapeo"]
    if not isinstance(mapeo, dict):
        return errores + [error("sesion_campo", mensajes.sesion_campo(f"{campo}.mapeo"))]
    for extra in sorted(set(mapeo) - _CAMPOS_MAPEO):
        errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido(extra)))
    for requerido in sorted(_CAMPOS_MAPEO - set(mapeo)):
        errores.append(error("sesion_campo", mensajes.sesion_campo(f"{campo}.mapeo.{requerido}")))
    return errores


def _validar_origen_v2(bloque: dict, campo: str, lado: str) -> list[dict]:
    errores: list[dict] = []
    formato = bloque["formato"]
    if formato not in _FORMATOS:
        errores.append(
            error("formato_no_soportado", mensajes.formato_no_soportado(lado, "ese formato no está en la sesión"), lado)
        )
        return errores
    if formato == "csv":
        if bloque["delimitador"] not in _DELIMITADORES:
            errores.append(error("delimitador_ausente", mensajes.delimitador_ausente(lado)))
        if bloque["codificacion"] not in _CODIFICACIONES:
            errores.append(error("sesion_campo", mensajes.sesion_campo(f"{campo}.codificacion")))
        if bloque["hoja"] is not None:
            errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido("hoja")))
    elif formato == "json":
        if bloque["delimitador"] is not None:
            errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido("delimitador")))
        if bloque["codificacion"] not in _CODIFICACIONES:
            errores.append(error("sesion_campo", mensajes.sesion_campo(f"{campo}.codificacion")))
        if bloque["hoja"] is not None:
            errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido("hoja")))
    else:
        if bloque["delimitador"] is not None or bloque["codificacion"] is not None:
            errores.append(error("sesion_campo_desconocido", mensajes.sesion_campo_desconocido("delimitador")))
        if not isinstance(bloque["hoja"], str) or bloque["hoja"] == "":
            errores.append(error("sesion_campo", mensajes.sesion_campo(f"{campo}.hoja")))
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
