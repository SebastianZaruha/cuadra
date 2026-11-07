"""Fachada estable para los tests y para FastAPI. El dominio no importa el framework."""

from __future__ import annotations

from typing import Any

from cuadra.dominio.cuadre import construir
from cuadra.dominio.errores import ExportacionBloqueada
from cuadra.dominio.exportar import exportar_cuadre
from cuadra.dominio import mensajes
from cuadra.dominio.lectura import error, inspeccionar as _inspeccionar, normalizar_texto
from cuadra.dominio.sesion import (
    abrir_sesion as _abrir_sesion,
    crear_sesion as _crear_sesion,
    parsear_sesion as _parsear_sesion,
    serializar_sesion as _serializar_sesion,
)


def reconciliar(
    csv_a: str,
    csv_b: str,
    *,
    mapeo_a: dict[str, str],
    mapeo_b: dict[str, str],
    delimitador_a: str | None = None,
    delimitador_b: str | None = None,
    decisiones: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return construir(
        csv_a,
        csv_b,
        mapeo_a=mapeo_a,
        mapeo_b=mapeo_b,
        delimitador_a=delimitador_a,
        delimitador_b=delimitador_b,
        decisiones=decisiones,
    ).a_dict()


def exportar(
    csv_a: str,
    csv_b: str,
    *,
    mapeo_a: dict[str, str],
    mapeo_b: dict[str, str],
    modo: str,
    delimitador_a: str | None = None,
    delimitador_b: str | None = None,
    decisiones: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    cuadre = construir(
        csv_a,
        csv_b,
        mapeo_a=mapeo_a,
        mapeo_b=mapeo_b,
        delimitador_a=delimitador_a,
        delimitador_b=delimitador_b,
        decisiones=decisiones,
    )
    return exportar_cuadre(cuadre, modo)


def crear_sesion(
    csv_a: str,
    csv_b: str,
    *,
    mapeo_a: dict[str, str],
    mapeo_b: dict[str, str],
    nombre_a: str,
    nombre_b: str,
    delimitador_a: str | None = None,
    delimitador_b: str | None = None,
    decisiones: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return _crear_sesion(
        csv_a,
        csv_b,
        mapeo_a=mapeo_a,
        mapeo_b=mapeo_b,
        nombre_a=nombre_a,
        nombre_b=nombre_b,
        delimitador_a=delimitador_a,
        delimitador_b=delimitador_b,
        decisiones=decisiones,
    )


def serializar_sesion(sesion: dict[str, Any]) -> str:
    return _serializar_sesion(sesion)


def parsear_sesion(texto: str) -> dict[str, Any]:
    return _parsear_sesion(texto)


def abrir_sesion(sesion: dict[str, Any], csv_a: str, csv_b: str) -> dict[str, Any]:
    return _abrir_sesion(sesion, csv_a, csv_b)


def leer_texto(datos: bytes, *, fichero: str = "A") -> dict[str, Any]:
    try:
        texto = datos.decode("utf-8")
    except UnicodeDecodeError:
        return {
            "ok": False,
            "texto": None,
            "errores": [
                error(
                    "codificacion_invalida",
                    mensajes.codificacion_invalida(fichero),
                    fichero,
                )
            ],
        }
    return {"ok": True, "texto": normalizar_texto(texto), "errores": []}


def inspeccionar(csv: str, *, delimitador: str | None = None, fichero: str = "A") -> dict[str, Any]:
    return _inspeccionar(csv, delimitador=delimitador, fichero=fichero)


__all__ = [
    "ExportacionBloqueada",
    "abrir_sesion",
    "crear_sesion",
    "exportar",
    "inspeccionar",
    "leer_texto",
    "parsear_sesion",
    "reconciliar",
    "serializar_sesion",
]
