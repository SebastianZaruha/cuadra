"""Cuerpos HTTP. La validez de una decisión no se decide aquí."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class MapeoIn(BaseModel):
    identificador: str = Field(min_length=1)
    descripcion: str = Field(min_length=1)
    cantidad: str = Field(min_length=1)


class DecisionIn(BaseModel):
    identificador: str
    tipo: str
    motivo: str = ""
    cantidad: str | None = None


class ReconciliarIn(BaseModel):
    csv_a: str | None = None
    csv_b: str | None = None
    contenido_a_base64: str | None = None
    contenido_b_base64: str | None = None
    nombre_a: str = "A.csv"
    nombre_b: str = "B.csv"
    formato_a: Literal["csv", "xlsx", "ods", "json"] | None = None
    formato_b: Literal["csv", "xlsx", "ods", "json"] | None = None
    delimitador_a: Literal[",", ";", "\t"] | None = None
    delimitador_b: Literal[",", ";", "\t"] | None = None
    hoja_a: str | None = None
    hoja_b: str | None = None
    mapeo_a: MapeoIn
    mapeo_b: MapeoIn
    decisiones: list[DecisionIn] = []


class ExportarIn(ReconciliarIn):
    modo: Literal["completa", "parcial"]


class InspeccionarIn(BaseModel):
    csv: str | None = None
    contenido_base64: str | None = None
    nombre: str = ""
    formato: Literal["csv", "xlsx", "ods", "json"] | None = None
    delimitador: Literal[",", ";", "\t"] | None = None
    hoja: str | None = None
    fichero: Literal["A", "B"] = "A"


class SesionAbrirIn(BaseModel):
    sesion: dict
    csv_a: str | None = None
    csv_b: str | None = None
    contenido_a_base64: str | None = None
    contenido_b_base64: str | None = None
