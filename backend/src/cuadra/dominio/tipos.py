"""Estados del cuadre.

Las decisiones ilegales no se pueden construir: el motivo vacío no existe y
``cantidad_manual`` solo admite la forma canónica del número. Qué decisión
cabe en cada categoría lo impide el tipo de la fila, no una comprobación tardía.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from cuadra.dominio.limites import MAX_DECIMALES, MAX_DIGITOS_ENTEROS, MAX_MOTIVO

# Entero o decimal con punto. Sin miles, sin coma decimal, sin signo «+»,
# sin notación científica. El «-» inicial solo es el signo de un número.
CANTIDAD_ENTRADA = re.compile(
    rf"^-?(?:0|[1-9]\d{{0,{MAX_DIGITOS_ENTEROS - 1}}})(?:\.\d{{1,{MAX_DECIMALES}}})?$"
)

Fichero = Literal["A", "B"]
Delimitador = Literal[",", ";"]
EstadoFila = Literal["pendiente", "resuelta"]


def es_cantidad_canonica(valor: str) -> bool:
    """True solo para la forma que exportamos: sin ceros de cola y sin «-0»."""
    if not CANTIDAD_ENTRADA.fullmatch(valor):
        return False
    if valor in {"-0", "-0.0"}:
        return False
    if "." in valor and valor.endswith("0"):
        return False
    return True


def _exigir_decision(decision: object, permitidas: tuple[type, ...]) -> None:
    if decision is None:
        return
    if not isinstance(decision, permitidas):
        raise ValueError("decisión no permitida en esta categoría")


def _motivo_valido(motivo: str) -> None:
    if not isinstance(motivo, str) or motivo == "" or motivo != motivo.strip():
        raise ValueError("motivo vacío o sin recortar")
    if len(motivo) > MAX_MOTIVO:
        raise ValueError("motivo demasiado largo")


@dataclass(frozen=True)
class ElegirA:
    motivo: str
    tipo: Literal["elegir_A"] = "elegir_A"

    def __post_init__(self) -> None:
        _motivo_valido(self.motivo)


@dataclass(frozen=True)
class ElegirB:
    motivo: str
    tipo: Literal["elegir_B"] = "elegir_B"

    def __post_init__(self) -> None:
        _motivo_valido(self.motivo)


@dataclass(frozen=True)
class CantidadManual:
    cantidad: str
    motivo: str
    tipo: Literal["cantidad_manual"] = "cantidad_manual"

    def __post_init__(self) -> None:
        _motivo_valido(self.motivo)
        # Guardamos la forma canónica para que «10.50» y «10.5» no sean dos estados.
        if not es_cantidad_canonica(self.cantidad):
            raise ValueError("cantidad manual no canónica")


@dataclass(frozen=True)
class Excluir:
    motivo: str
    tipo: Literal["excluir"] = "excluir"

    def __post_init__(self) -> None:
        _motivo_valido(self.motivo)


Decision = ElegirA | ElegirB | CantidadManual | Excluir
DecisionConDescripcionUnica = ElegirA | ElegirB | CantidadManual | Excluir
DecisionSoloA = ElegirA | CantidadManual | Excluir
DecisionSoloB = ElegirB | CantidadManual | Excluir
# Si las descripciones difieren, una cantidad suelta no dice qué texto sobrevive.
DecisionSinCantidadManual = ElegirA | ElegirB | Excluir


@dataclass(frozen=True)
class Mapeo:
    identificador: str
    descripcion: str
    cantidad: str


@dataclass(frozen=True)
class ErrorValidacion:
    codigo: str
    mensaje: str
    fichero: Fichero | None
    fila: int | None
    columna: str | None


@dataclass(frozen=True)
class Iguales:
    """Misma clave, misma descripción ya normalizada y misma cantidad canónica."""

    identificador: str
    descripcion: str
    cantidad: str
    fila_a: int
    fila_b: int
    decision: DecisionConDescripcionUnica | None = None
    tipo: Literal["iguales"] = "iguales"

    def __post_init__(self) -> None:
        if self.identificador == "":
            raise ValueError("los iguales tienen identificador")
        if not es_cantidad_canonica(self.cantidad):
            raise ValueError("cantidad")
        _exigir_decision(self.decision, (ElegirA, ElegirB, CantidadManual, Excluir))


@dataclass(frozen=True)
class ModificadoCantidad:
    """La descripción coincide. Se puede sustituir solo la cantidad."""

    identificador: str
    descripcion: str
    cantidad_a: str
    cantidad_b: str
    fila_a: int
    fila_b: int
    decision: DecisionConDescripcionUnica | None = None
    tipo: Literal["modificados"] = "modificados"

    def __post_init__(self) -> None:
        if self.cantidad_a == self.cantidad_b:
            raise ValueError("una fila solo de cantidad tiene cantidades distintas")
        if not es_cantidad_canonica(self.cantidad_a) or not es_cantidad_canonica(self.cantidad_b):
            raise ValueError("cantidad")
        _exigir_decision(self.decision, (ElegirA, ElegirB, CantidadManual, Excluir))


@dataclass(frozen=True)
class ModificadoDescripcion:
    """La descripción difiere. No existe el estado «cantidad manual»."""

    identificador: str
    descripcion_a: str
    descripcion_b: str
    cantidad_a: str
    cantidad_b: str
    fila_a: int
    fila_b: int
    decision: DecisionSinCantidadManual | None = None
    tipo: Literal["modificados"] = "modificados"

    def __post_init__(self) -> None:
        if self.descripcion_a == self.descripcion_b:
            raise ValueError("las descripciones deberían diferir")
        if not es_cantidad_canonica(self.cantidad_a) or not es_cantidad_canonica(self.cantidad_b):
            raise ValueError("cantidad")
        # CantidadManual no entra: no sabríamos qué descripción conservar.
        _exigir_decision(self.decision, (ElegirA, ElegirB, Excluir))


@dataclass(frozen=True)
class SoloEnA:
    identificador: str
    descripcion: str
    cantidad: str
    fila_a: int
    decision: DecisionSoloA | None = None
    tipo: Literal["solo_en_A"] = "solo_en_A"

    def __post_init__(self) -> None:
        if self.identificador == "" or not es_cantidad_canonica(self.cantidad):
            raise ValueError("solo_en_A inválido")
        _exigir_decision(self.decision, (ElegirA, CantidadManual, Excluir))


@dataclass(frozen=True)
class SoloEnB:
    identificador: str
    descripcion: str
    cantidad: str
    fila_b: int
    decision: DecisionSoloB | None = None
    tipo: Literal["solo_en_B"] = "solo_en_B"

    def __post_init__(self) -> None:
        if self.identificador == "" or not es_cantidad_canonica(self.cantidad):
            raise ValueError("solo_en_B inválido")
        _exigir_decision(self.decision, (ElegirB, CantidadManual, Excluir))


@dataclass(frozen=True)
class Bloqueada:
    """Fila de origen que no se compara. No tiene decisión: no hay nada seguro que elegir."""

    fichero: Fichero
    fila: int
    identificador: str
    descripcion_cruda: str
    cantidad_cruda: str
    errores: tuple[ErrorValidacion, ...]
    tipo: Literal["bloqueados"] = "bloqueados"

    def __post_init__(self) -> None:
        if not self.errores:
            raise ValueError("una fila bloqueada explica por qué")


FilaComparable = Iguales | ModificadoCantidad | ModificadoDescripcion | SoloEnA | SoloEnB
Fila = FilaComparable | Bloqueada
