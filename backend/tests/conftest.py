from __future__ import annotations

import json

import pytest

from carga import FIXTURES, cargar_par


@pytest.fixture(scope="session")
def demo():
    csv_a, csv_b, entrada, esperado = cargar_par("demo")
    decisiones = json.loads((FIXTURES / "demo" / "decisiones.json").read_text(encoding="utf-8"))
    return {
        "csv_a": csv_a,
        "csv_b": csv_b,
        "entrada": entrada,
        "esperado": esperado,
        "decisiones": decisiones,
    }
