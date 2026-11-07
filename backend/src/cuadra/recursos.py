"""Rutas de solo lectura. Los CSV de demostración viven en el repo, no en el servidor."""

from __future__ import annotations

import os
from pathlib import Path


def directorio_fixtures() -> Path:
    configurado = os.environ.get("CUADRA_FIXTURES")
    if configurado:
        return Path(configurado)
    return Path(__file__).resolve().parents[3] / "fixtures"


def leer_csv(path: Path) -> str:
    # newline="" para no convertir un retorno de carro interno en salto de línea.
    with path.open(encoding="utf-8", newline="") as archivo:
        return archivo.read()
