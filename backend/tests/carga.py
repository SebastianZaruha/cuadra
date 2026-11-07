from __future__ import annotations

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = RAIZ / "fixtures"


def _leer_lado(base: Path, lado: str) -> str | bytes:
    for extension in (".csv", ".tsv", ".json", ".xlsx", ".ods"):
        path = base / f"{lado}{extension}"
        if not path.exists():
            continue
        datos = path.read_bytes()
        if extension in {".xlsx", ".ods", ".json"}:
            return datos
        try:
            # newline no se traduce: un retorno dentro de una celda sigue ahí.
            return datos.decode("utf-8")
        except UnicodeDecodeError:
            return datos
    raise FileNotFoundError(lado)


def cargar_par(nombre: str) -> tuple[str | bytes, str | bytes, dict, dict]:
    base = FIXTURES / nombre
    entrada = json.loads((base / "entrada.json").read_text(encoding="utf-8"))
    return _leer_lado(base, "a"), _leer_lado(base, "b"), entrada, json.loads(
        (base / "esperado.json").read_text(encoding="utf-8")
    )


def nombres_fixtures() -> list[str]:
    return sorted(
        path.name
        for path in FIXTURES.iterdir()
        if path.is_dir() and (path / "esperado.json").exists()
    )
