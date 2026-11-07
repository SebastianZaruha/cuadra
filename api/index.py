"""Punto de entrada de la función Python en Vercel.

No se despliega desde este repositorio: el archivo solo deja el proyecto listo.
Las rutas viven con prefijo ``/api`` y también sin él, porque la plataforma a
veces entrega la ruta ya recortada.
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "backend" / "src"))

from cuadra.api.app import app  # noqa: E402

__all__ = ["app"]
