"""Fachada que usarán los tests y, más adelante, FastAPI.

Las firmas son el contrato. El comportamiento todavía no está: los tests de
esta fase tienen que fallar por ``NotImplementedError``, no por un import roto.
"""

from __future__ import annotations

from typing import Any


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
    raise NotImplementedError


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
    raise NotImplementedError


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
    raise NotImplementedError


def serializar_sesion(sesion: dict[str, Any]) -> str:
    raise NotImplementedError


def parsear_sesion(texto: str) -> dict[str, Any]:
    raise NotImplementedError


def abrir_sesion(sesion: dict[str, Any], csv_a: str, csv_b: str) -> dict[str, Any]:
    raise NotImplementedError


def leer_texto(datos: bytes, *, fichero: str = "A") -> dict[str, Any]:
    raise NotImplementedError


def inspeccionar(csv: str, *, delimitador: str | None = None, fichero: str = "A") -> dict[str, Any]:
    raise NotImplementedError
