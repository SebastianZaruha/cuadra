from __future__ import annotations

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = RAIZ / "fixtures"


def cargar_par(nombre: str) -> tuple[str, str, dict, dict]:
    base = FIXTURES / nombre
    entrada = json.loads((base / "entrada.json").read_text(encoding="utf-8"))
    csv_a = (base / "a.csv").read_text(encoding="utf-8")
    csv_b = (base / "b.csv").read_text(encoding="utf-8")
    esperado = json.loads((base / "esperado.json").read_text(encoding="utf-8"))
    return csv_a, csv_b, entrada, esperado


def nombres_fixtures() -> list[str]:
    return sorted(
        path.name
        for path in FIXTURES.iterdir()
        if path.is_dir() and (path / "esperado.json").exists()
    )
