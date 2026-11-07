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
    csv_a: str
    csv_b: str
    nombre_a: str = "A.csv"
    nombre_b: str = "B.csv"
    delimitador_a: Literal[",", ";"] | None = None
    delimitador_b: Literal[",", ";"] | None = None
    mapeo_a: MapeoIn
    mapeo_b: MapeoIn
    decisiones: list[DecisionIn] = []


class ExportarIn(ReconciliarIn):
    modo: Literal["completa", "parcial"]


class InspeccionarIn(BaseModel):
    csv: str
    delimitador: Literal[",", ";"] | None = None
    fichero: Literal["A", "B"] = "A"


class SesionAbrirIn(BaseModel):
    sesion: dict
    csv_a: str
    csv_b: str
