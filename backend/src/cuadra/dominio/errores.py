"""Errores de operación que no son una fila bloqueada."""

from __future__ import annotations

from cuadra.dominio.mensajes import exportacion_bloqueada


class ExportacionBloqueada(Exception):
    """La exportación completa exige cero pendientes y cero bloqueados."""

    def __init__(self, pendientes: int, bloqueados: int) -> None:
        self.pendientes = pendientes
        self.bloqueados = bloqueados
        self.mensaje = exportacion_bloqueada(pendientes, bloqueados)
        super().__init__(self.mensaje)
