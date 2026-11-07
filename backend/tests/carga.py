from __future__ import annotations

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = RAIZ / "fixtures"


def _leer_csv(path: Path) -> str:
    # newline="" conserva el retorno de carro dentro de una celda. Sin eso,
    # el modo universal de open() lo convierte en salto de línea y la fila se parte.
    with path.open(encoding="utf-8", newline="") as archivo:
        return archivo.read()


def cargar_par(nombre: str) -> tuple[str, str, dict, dict]:
    base = FIXTURES / nombre
    entrada = json.loads((base / "entrada.json").read_text(encoding="utf-8"))
    csv_a = _leer_csv(base / "a.csv")
    csv_b = _leer_csv(base / "b.csv")
    esperado = json.loads((base / "esperado.json").read_text(encoding="utf-8"))
    return csv_a, csv_b, entrada, esperado


def nombres_fixtures() -> list[str]:
    return sorted(
        path.name
        for path in FIXTURES.iterdir()
        if path.is_dir() and (path / "esperado.json").exists()
    )
