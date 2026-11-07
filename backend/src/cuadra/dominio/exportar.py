"""CSV y Excel del inventario y del historial. El completo no sale si queda algo sin resolver."""

from __future__ import annotations

import base64
import csv
from dataclasses import dataclass
from io import BytesIO, StringIO

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
        "nombre_inventario_xlsx": f"cuadra-inventario-{sufijo}.xlsx",
        "nombre_historial_xlsx": f"cuadra-historial-{sufijo}.xlsx",
        "inventario_xlsx_base64": _xlsx_b64(
            marca,
            "Inventario",
            ["marca_exportacion", "identificador", "descripcion", "cantidad", "origen"],
            inventario,
        ),
        "historial_xlsx_base64": _xlsx_b64(
            marca,
            "Historial",
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


def _xlsx_b64(marca: str, titulo: str, cabecera: list[str], filas: list[list[str]]) -> str:
    return base64.b64encode(_libro_xlsx(marca, titulo, cabecera, filas)).decode("ascii")


def _libro_xlsx(marca: str, titulo: str, cabecera: list[str], filas: list[list[str]]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.page import PageMargins

    libro = Workbook()
    hoja = libro.active
    hoja.title = titulo
    fila_cabecera = 1
    if marca == "PARCIAL":
        hoja.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(cabecera))
        aviso = hoja.cell(1, 1, "PARCIAL")
        aviso.font = Font(bold=True, color="FFF7F3EA", size=14)
        aviso.fill = PatternFill("solid", fgColor="FF8A5A12")
        aviso.alignment = Alignment(horizontal="left", vertical="center")
        hoja.row_dimensions[1].height = 26
        fila_cabecera = 2
        hoja.sheet_properties.tabColor = "8A5A12"
    else:
        hoja.sheet_properties.tabColor = "1F6B4A"
    relleno = PatternFill("solid", fgColor="FF1F6B4A")
    fuente = Font(bold=True, color="FFF7F3EA")
    for columna, nombre in enumerate(cabecera, 1):
        celda = hoja.cell(fila_cabecera, columna, nombre)
        celda.font = fuente
        celda.fill = relleno
        celda.alignment = Alignment(horizontal="left", vertical="center")
    cantidades = {"cantidad", "cantidad_original", "cantidad_decidida"}
    for indice, fila in enumerate(filas, fila_cabecera + 1):
        for columna, valor in enumerate(fila, 1):
            celda = hoja.cell(indice, columna)
            nombre = cabecera[columna - 1]
            if nombre in cantidades:
                celda.value = _valor_numerico(valor)
                if isinstance(celda.value, (int, float)) and not isinstance(celda.value, bool):
                    celda.number_format = "0.####"
            else:
                celda.value = valor
            if marca == "PARCIAL" and nombre == "marca_exportacion":
                celda.font = Font(bold=True, color="FF8A5A12")
    hoja.freeze_panes = f"A{fila_cabecera + 1}"
    ultima = fila_cabecera + len(filas)
    hoja.auto_filter.ref = f"A{fila_cabecera}:{get_column_letter(len(cabecera))}{max(ultima, fila_cabecera)}"
    hoja.page_setup.orientation = "landscape"
    hoja.page_setup.fitToPage = True
    hoja.page_setup.fitToWidth = 1
    hoja.page_setup.fitToHeight = 0
    hoja.page_setup.paperSize = hoja.PAPERSIZE_A4
    hoja.page_margins = PageMargins(left=0.5, right=0.5, top=0.6, bottom=0.6)
    hoja.sheet_view.showGridLines = False
    hoja.oddHeader.left.text = "Cuadra"
    hoja.oddHeader.right.text = marca
    hoja.print_title_rows = f"{fila_cabecera}:{fila_cabecera}"
    for columna, nombre in enumerate(cabecera, 1):
        ancho = len(nombre) + 2
        for fila in filas[:80]:
            ancho = max(ancho, min(42, len(str(fila[columna - 1])) + 2))
        hoja.column_dimensions[get_column_letter(columna)].width = max(ancho, 12)
    buffer = BytesIO()
    libro.save(buffer)
    return buffer.getvalue()


def _valor_numerico(valor: str) -> str | int | float:
    if not es_cantidad_canonica(valor):
        return valor
    if "." not in valor:
        return int(valor)
    numero = float(valor)
    from cuadra.dominio.formatos import expandir_decimal

    if expandir_decimal(format(numero, ".15g")) == valor:
        return numero
    return valor


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
