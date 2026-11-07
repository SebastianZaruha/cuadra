"""CSV de inventario e historial. El completo no sale si queda algo sin resolver."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from io import StringIO

from cuadra.dominio.cuadre import Cuadre, resumen_de
from cuadra.dominio.errores import ExportacionBloqueada
from cuadra.dominio.tipos import (
    Bloqueada,
    CantidadManual,
    ElegirA,
    ElegirB,
    Excluir,
    Fila,
    Iguales,
    ModificadoCantidad,
    ModificadoDescripcion,
    SoloEnA,
    SoloEnB,
    es_cantidad_canonica,
)

_PREFIJOS = ("=", "+", "-", "@", "\t", "\r", "\n")


@dataclass(frozen=True)
class Resolucion:
    incluida: bool
    origen: str
    descripcion: str
    cantidad: str
    decision: str
    motivo: str


def neutralizar(valor: str) -> str:
    """Excel ejecuta una celda que empieza por =, +, -, @, tab o retorno.

    El apóstrofo la convierte en texto. Las cantidades canónicas no pasan por aquí:
    un «-2» de stock es un número, no una fórmula.
    """
    if valor.startswith(_PREFIJOS):
        return "'" + valor
    return valor


def celda_cantidad(valor: str) -> str:
    if valor == "" or es_cantidad_canonica(valor):
        return valor
    return neutralizar(valor)


def exportar_cuadre(cuadre: Cuadre, modo: str) -> dict:
    if modo not in {"completa", "parcial"}:
        raise ValueError("modo de exportación desconocido")
    if not cuadre.ok:
        raise ExportacionBloqueada(0, 0)
    resumen = resumen_de(cuadre.filas)
    if modo == "completa" and (resumen["pendientes"] or resumen["bloqueados"]):
        raise ExportacionBloqueada(resumen["pendientes"], resumen["bloqueados"])
    marca = "COMPLETA" if modo == "completa" else "PARCIAL"
    sufijo = "completo" if modo == "completa" else "parcial"
    historial, excluidas = _historial(cuadre.filas, marca)
    inventario = _inventario(cuadre.filas, marca)
    meta_base = [
        "# cuadra_schema=1",
        "# cuadra_exportacion=" + marca,
        "# cuadra_pendientes=" + str(resumen["pendientes"]),
        "# cuadra_bloqueados=" + str(resumen["bloqueados"]),
        "# cuadra_excluidas=" + str(excluidas),
    ]
    return {
        "completa": modo == "completa",
        "nombre_inventario": f"cuadra-inventario-{sufijo}.csv",
        "nombre_historial": f"cuadra-historial-{sufijo}.csv",
        "inventario_csv": _render(
            ["# cuadra_schema=1", "# cuadra_tipo=inventario", *meta_base[1:]],
            ["marca_exportacion", "identificador", "descripcion", "cantidad", "origen"],
            inventario,
        ),
        "historial_csv": _render(
            ["# cuadra_schema=1", "# cuadra_tipo=historial", *meta_base[1:]],
            [
                "marca_exportacion",
                "fichero",
                "fila",
                "identificador",
                "descripcion",
                "cantidad_original",
                "categoria",
                "decision",
                "cantidad_decidida",
                "motivo",
                "en_inventario",
            ],
            historial,
        ),
    }


def _render(meta: list[str], header: list[str], filas: list[list[str]]) -> str:
    buffer = StringIO()
    for linea in meta:
        buffer.write(linea + "\n")
    escritor = csv.writer(buffer, delimiter=",", lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    escritor.writerow(header)
    escritor.writerows(filas)
    return buffer.getvalue()


def _inventario(filas: list[Fila], marca: str) -> list[list[str]]:
    salida: list[list[str]] = []
    for fila in filas:
        if isinstance(fila, Bloqueada):
            continue
        resolucion = resolver(fila)
        if not resolucion.incluida:
            continue
        salida.append(
            [
                marca,
                neutralizar(fila.identificador),
                neutralizar(resolucion.descripcion),
                celda_cantidad(resolucion.cantidad),
                resolucion.origen,
            ]
        )
    salida.sort(key=lambda row: row[1])
    return salida


def _historial(filas: list[Fila], marca: str) -> tuple[list[list[str]], int]:
    filas_csv: list[list[str]] = []
    excluidas = 0
    for fila in filas:
        if isinstance(fila, Bloqueada):
            filas_csv.append(
                [
                    marca,
                    fila.fichero,
                    str(fila.fila),
                    neutralizar(fila.identificador),
                    neutralizar(fila.descripcion_cruda),
                    celda_cantidad(fila.cantidad_cruda),
                    "bloqueados",
                    "",
                    "",
                    "",
                    "no",
                ]
            )
            continue
        resolucion = resolver(fila)
        lados = ("A", "B") if not isinstance(fila, (SoloEnA, SoloEnB)) else (
            ("A",) if isinstance(fila, SoloEnA) else ("B",)
        )
        for lado in lados:
            numero, descripcion, cantidad = datos_lado(fila, lado)
            if resolucion.decision == "excluir":
                excluidas += 1
            filas_csv.append(
                [
                    marca,
                    lado,
                    str(numero),
                    neutralizar(fila.identificador),
                    neutralizar(descripcion),
                    celda_cantidad(cantidad),
                    fila.tipo,
                    resolucion.decision,
                    resolucion.cantidad if resolucion.incluida else "",
                    neutralizar(resolucion.motivo),
                    "si" if resolucion.incluida else "no",
                ]
            )
    filas_csv.sort(key=lambda row: (row[1], int(row[2])))
    return filas_csv, excluidas


def resolver(fila: Fila) -> Resolucion:
    if isinstance(fila, Bloqueada):
        return Resolucion(False, "", "", "", "", "")
    decision = fila.decision
    if decision is None:
        if isinstance(fila, Iguales):
            return Resolucion(True, "igual", fila.descripcion, fila.cantidad, "", "")
        return Resolucion(False, "", "", "", "", "")
    if isinstance(decision, Excluir):
        return Resolucion(False, "", "", "", "excluir", decision.motivo)
    if isinstance(decision, CantidadManual):
        return Resolucion(True, "manual", _descripcion_unica(fila), decision.cantidad, "cantidad_manual", decision.motivo)
    if isinstance(decision, ElegirA):
        _, descripcion, cantidad = datos_lado(fila, "A")
        return Resolucion(True, "A", descripcion, cantidad, "elegir_A", decision.motivo)
    assert isinstance(decision, ElegirB)
    _, descripcion, cantidad = datos_lado(fila, "B")
    return Resolucion(True, "B", descripcion, cantidad, "elegir_B", decision.motivo)


def _descripcion_unica(fila: Fila) -> str:
    if isinstance(fila, Iguales):
        return fila.descripcion
    if isinstance(fila, ModificadoCantidad):
        return fila.descripcion
    if isinstance(fila, (SoloEnA, SoloEnB)):
        return fila.descripcion
    raise ValueError("no hay una sola descripción")


def datos_lado(fila: Fila, lado: str) -> tuple[int, str, str]:
    if isinstance(fila, Iguales):
        numero = fila.fila_a if lado == "A" else fila.fila_b
        return numero, fila.descripcion, fila.cantidad
    if isinstance(fila, ModificadoCantidad):
        if lado == "A":
            return fila.fila_a, fila.descripcion, fila.cantidad_a
        return fila.fila_b, fila.descripcion, fila.cantidad_b
    if isinstance(fila, ModificadoDescripcion):
        if lado == "A":
            return fila.fila_a, fila.descripcion_a, fila.cantidad_a
        return fila.fila_b, fila.descripcion_b, fila.cantidad_b
    if isinstance(fila, SoloEnA):
        return fila.fila_a, fila.descripcion, fila.cantidad
    if isinstance(fila, SoloEnB):
        return fila.fila_b, fila.descripcion, fila.cantidad
    raise ValueError("fila sin lado")
