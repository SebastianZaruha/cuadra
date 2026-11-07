"""De bytes a una tabla de textos.

CSV se queda en ``lectura``. Aquí entran Excel, ODS y JSON, más la pista de
qué formato es un archivo. El cuadre no ve libros ni objetos: ve celdas.
"""

from __future__ import annotations

import codecs
import json
import threading
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from io import BytesIO

from cuadra.dominio import mensajes
from cuadra.dominio.limites import MAX_COLUMNAS, MAX_FILAS
from cuadra.dominio.lectura import error

_CANDADO = threading.Lock()

FORMATOS = {"csv", "xlsx", "ods", "json"}
CODIFICACIONES = {"utf-8", "utf-8-sig", "windows-1252"}


@dataclass
class Preparado:
    formato: str | None = None
    codificacion: str | None = None
    delimitador: str | None = None
    origen_delimitador: str | None = None
    hoja: str | None = None
    hojas: list[str] = field(default_factory=list)
    origen_hoja: str | None = None
    columnas: list[str] = field(default_factory=list)
    filas: list[tuple[int, list[str]]] = field(default_factory=list)
    errores: list[dict] = field(default_factory=list)
    sha256: str | None = None


def decodificar(datos: bytes) -> tuple[str, str]:
    """UTF-8, UTF-8 con BOM, o el ANSI de Excel en español.

    Windows-1252 cubre el euro y las comillas tipográficas. Cinco bytes de
    esa tabla no están definidos. Esos cinco se leen como Latin-1 para no
    rechazar un CSV que sí abre Excel. El resto de la tabla sigue siendo 1252.
    """
    if datos.startswith(b"\xef\xbb\xbf"):
        return datos.decode("utf-8-sig"), "utf-8-sig"
    try:
        return datos.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        pass
    try:
        return datos.decode("cp1252"), "windows-1252"
    except UnicodeDecodeError:
        return datos.decode("cp1252", errors="cuadra_cp1252"), "windows-1252"


def _hueco_latin1(exc: UnicodeError) -> tuple[str, int]:
    if not isinstance(exc, UnicodeDecodeError):
        raise exc
    return "".join(chr(byte) for byte in exc.object[exc.start : exc.end]), exc.end


codecs.register_error("cuadra_cp1252", _hueco_latin1)


def resolver_formato(
    datos: bytes,
    nombre: str,
    forzado: str | None,
    fichero: str,
) -> tuple[str | None, dict | None]:
    olfateado = _olfatear(datos, nombre)
    if olfateado.startswith("danado-"):
        etiqueta = "Excel .xlsx" if olfateado.endswith("xlsx") else "LibreOffice .ods"
        return None, error("archivo_danado", mensajes.archivo_danado(fichero, etiqueta), fichero)
    if forzado is not None and forzado not in FORMATOS:
        return None, error(
            "formato_no_soportado",
            mensajes.formato_no_soportado(fichero, "ese formato no está en Cuadra"),
            fichero,
        )
    if forzado and olfateado in {"xlsx", "ods", "pdf", "imagen", "xls", "zip"} and forzado != olfateado:
        return None, error(
            "formato_no_soportado",
            mensajes.formato_distinto(fichero, forzado, _etiqueta(olfateado)),
            fichero,
        )
    if forzado:
        return forzado, None
    if olfateado in {"pdf", "imagen", "xls", "zip"}:
        return None, error(
            "formato_no_soportado",
            mensajes.formato_no_soportado(fichero, _detalle_firma(olfateado)),
            fichero,
        )
    return olfateado, None


def preparar_estructurado(
    datos: bytes,
    *,
    formato: str,
    fichero: str,
    hoja: str | None,
) -> Preparado:
    if formato == "json":
        return _preparar_json(datos, fichero=fichero)
    if formato == "xlsx":
        return _preparar_xlsx(datos, fichero=fichero, hoja=hoja)
    if formato == "ods":
        return _preparar_ods(datos, fichero=fichero, hoja=hoja)
    return Preparado(
        errores=[
            error(
                "formato_no_soportado",
                mensajes.formato_no_soportado(fichero, "ese formato no está en Cuadra"),
                fichero,
            )
        ]
    )


def expandir_decimal(texto: str) -> str:
    """El decimal que escribió el archivo, sin notación científica ni ceros de cola."""
    try:
        dec = Decimal(texto)
    except InvalidOperation:
        return texto
    render = format(dec, "f")
    if "." in render:
        render = render.rstrip("0").rstrip(".")
    if render in {"-0", ""}:
        render = "0"
    return render


class NumeroExcel(str):
    """El texto numérico del XML. openpyxl, si no, lo convierte a float."""

    def __new__(cls, texto: str) -> NumeroExcel:
        return str.__new__(cls, texto)

    def _decimal(self) -> Decimal:
        return Decimal(str(self))

    def __divmod__(self, other: object) -> tuple[int, float]:
        cociente, resto = divmod(self._decimal(), Decimal(str(other)))
        return int(cociente), float(resto)

    def __float__(self) -> float:
        return float(self._decimal())

    def __int__(self) -> int:
        return int(self._decimal())

    def __add__(self, other: object) -> Decimal:
        return self._decimal() + Decimal(str(other))

    def __radd__(self, other: object) -> Decimal:
        return Decimal(str(other)) + self._decimal()

    def __mul__(self, other: object) -> Decimal:
        return self._decimal() * Decimal(str(other))

    def __rmul__(self, other: object) -> Decimal:
        return Decimal(str(other)) * self._decimal()

    def __lt__(self, other: object) -> bool:
        return self._decimal() < Decimal(str(other))

    def __le__(self, other: object) -> bool:
        return self._decimal() <= Decimal(str(other))

    def __gt__(self, other: object) -> bool:
        return self._decimal() > Decimal(str(other))

    def __ge__(self, other: object) -> bool:
        return self._decimal() >= Decimal(str(other))

    def __eq__(self, other: object) -> bool:
        try:
            return self._decimal() == Decimal(str(other))
        except InvalidOperation:
            return str.__eq__(self, other)

    def __hash__(self) -> int:
        return str.__hash__(self)


def _olfatear(datos: bytes, nombre: str) -> str:
    firma = _firma(datos)
    if firma:
        return firma
    extension = _extension(nombre)
    if extension in {"xlsx", "ods"}:
        return "danado-" + extension
    if extension == "xls":
        return "xls"
    if extension == "json" or (extension not in {"csv", "tsv", "txt"} and _parece_json(datos)):
        return "json"
    return "csv"


def _firma(datos: bytes) -> str | None:
    if datos.startswith(b"%PDF-"):
        return "pdf"
    if datos.startswith(b"\x89PNG") or datos.startswith(b"\xff\xd8\xff") or datos.startswith((b"GIF87a", b"GIF89a")):
        return "imagen"
    if datos.startswith(b"\xd0\xcf\x11\xe0"):
        return "xls"
    if datos.startswith(b"PK\x03\x04") or datos.startswith(b"PK\x05\x06"):
        if b"application/vnd.oasis.opendocument.spreadsheet" in datos[:128]:
            return "ods"
        try:
            with zipfile.ZipFile(BytesIO(datos)) as archivo:
                nombres = archivo.namelist()
                if "mimetype" in nombres and b"opendocument.spreadsheet" in archivo.read("mimetype"):
                    return "ods"
                if any(nombre.startswith("xl/") for nombre in nombres):
                    return "xlsx"
        except zipfile.BadZipFile:
            return "zip"
        return "zip"
    return None


def _extension(nombre: str) -> str:
    limpio = nombre.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if "." not in limpio:
        return ""
    return limpio.rsplit(".", 1)[-1].lower()


def _parece_json(datos: bytes) -> bool:
    muestra = datos.lstrip(b"\xef\xbb\xbf \t\r\n")
    return muestra[:1] in {b"[", b"{"}


def _etiqueta(firma: str) -> str:
    return {
        "xlsx": "Excel .xlsx",
        "ods": "LibreOffice .ods",
        "pdf": "PDF",
        "imagen": "una imagen",
        "xls": "Excel antiguo .xls",
        "zip": "un comprimido",
        "csv": "CSV",
        "json": "JSON",
    }.get(firma, firma)


def _detalle_firma(firma: str) -> str:
    return {
        "pdf": "es un PDF. Cuadra no lee PDF.",
        "imagen": "es una imagen. Cuadra no lee imágenes.",
        "xls": "es un Excel antiguo (.xls). Guárdalo como .xlsx o como CSV.",
        "zip": "es un comprimido que no es Excel .xlsx ni LibreOffice .ods.",
    }.get(firma, "el formato no está soportado.")


def _preparar_json(datos: bytes, *, fichero: str) -> Preparado:
    try:
        texto, codificacion = decodificar(datos)
    except UnicodeDecodeError:
        return Preparado(
            formato="json",
            errores=[error("codificacion_invalida", mensajes.codificacion_invalida(fichero), fichero)],
        )
    try:
        datos_json = json.loads(texto, parse_float=Decimal)
    except json.JSONDecodeError:
        return Preparado(
            formato="json",
            codificacion=codificacion,
            errores=[error("json_invalido", mensajes.json_invalido(fichero), fichero)],
        )
    if not isinstance(datos_json, list):
        return Preparado(
            formato="json",
            codificacion=codificacion,
            errores=[error("json_no_es_lista", mensajes.json_no_es_lista(fichero), fichero)],
        )
    if not datos_json:
        return Preparado(
            formato="json",
            codificacion=codificacion,
            errores=[error("fichero_vacio", mensajes.json_vacio(fichero), fichero)],
        )
    columnas: list[str] = []
    objetos: list[tuple[int, dict[str, str]]] = []
    for indice, elemento in enumerate(datos_json, start=2):
        if not isinstance(elemento, dict):
            return Preparado(
                formato="json",
                codificacion=codificacion,
                errores=[error("json_fila", mensajes.json_fila(fichero, indice), fichero, indice)],
            )
        celdas_por_clave: dict[str, str] = {}
        for clave, valor in elemento.items():
            if not isinstance(clave, str):
                return Preparado(
                    formato="json",
                    codificacion=codificacion,
                    errores=[error("json_clave", mensajes.json_clave(fichero, indice), fichero, indice)],
                )
            nombre = clave.strip()
            if nombre == "":
                return Preparado(
                    formato="json",
                    codificacion=codificacion,
                    columnas=columnas,
                    errores=[error("cabecera_vacia", mensajes.cabecera_vacia(fichero), fichero, 1)],
                )
            texto_valor = _json_a_texto(valor)
            if texto_valor is None:
                return Preparado(
                    formato="json",
                    codificacion=codificacion,
                    errores=[
                        error("json_valor", mensajes.json_valor(fichero, indice, nombre), fichero, indice, nombre)
                    ],
                )
            if nombre in celdas_por_clave:
                return Preparado(
                    formato="json",
                    codificacion=codificacion,
                    columnas=columnas,
                    errores=[
                        error(
                            "cabecera_duplicada",
                            mensajes.cabecera_duplicada(nombre, fichero),
                            fichero,
                            1,
                            nombre,
                        )
                    ],
                )
            celdas_por_clave[nombre] = texto_valor
            if nombre not in columnas:
                columnas.append(nombre)
        objetos.append((indice, celdas_por_clave))
    if len(columnas) > MAX_COLUMNAS:
        return Preparado(
            formato="json",
            codificacion=codificacion,
            columnas=columnas,
            errores=[
                error(
                    "demasiadas_columnas",
                    mensajes.demasiadas_columnas(fichero, len(columnas), MAX_COLUMNAS),
                    fichero,
                    1,
                )
            ],
        )
    if len(objetos) > MAX_FILAS:
        return Preparado(
            formato="json",
            codificacion=codificacion,
            columnas=columnas,
            errores=[
                error(
                    "demasiadas_filas",
                    mensajes.demasiadas_filas(fichero, len(objetos), MAX_FILAS),
                    fichero,
                )
            ],
        )
    rectangulo = [
        (numero, [celdas.get(columna, "") for columna in columnas]) for numero, celdas in objetos
    ]
    return Preparado(
        formato="json",
        codificacion=codificacion,
        columnas=columnas,
        filas=rectangulo,
    )


def _json_a_texto(valor: object) -> str | None:
    if valor is None:
        return ""
    if isinstance(valor, bool):
        return None
    if isinstance(valor, str):
        return valor
    if isinstance(valor, int):
        return str(valor)
    if isinstance(valor, Decimal):
        return expandir_decimal(format(valor, "f"))
    if isinstance(valor, float):
        return expandir_decimal(format(valor, ".15g"))
    return None


def _elegir_hoja(
    hojas: list[str],
    hoja: str | None,
    fichero: str,
) -> tuple[str | None, str | None, dict | None]:
    if not hojas:
        return None, None, error("sin_cabecera", mensajes.sin_hojas(fichero), fichero)
    if hoja is None or hoja == "":
        if len(hojas) == 1:
            return hojas[0], "detectada", None
        return None, None, error("hoja_requerida", mensajes.hoja_requerida(fichero, hojas), fichero)
    if hoja not in hojas:
        return None, None, error("hoja_inexistente", mensajes.hoja_inexistente(fichero, hoja, hojas), fichero)
    origen = "detectada" if len(hojas) == 1 else "elegida"
    return hoja, origen, None


def _limitar_filas(filas: list[tuple[int, list[str]]], fichero: str) -> dict | None:
    if len(filas) > MAX_FILAS:
        return error("demasiadas_filas", mensajes.demasiadas_filas(fichero, len(filas), MAX_FILAS), fichero)
    return None


def _cabecera_de(filas_crudas: list[tuple[int, list[str]]], fichero: str) -> tuple[list[str], list[tuple[int, list[str]]], dict | None]:
    if not filas_crudas:
        return [], [], error("sin_cabecera", mensajes.sin_cabecera(fichero), fichero)
    _, cabecera_cruda = filas_crudas[0]
    cabecera = [celda.strip() for celda in cabecera_cruda]
    while cabecera and cabecera[-1] == "":
        cabecera = cabecera[:-1]
    if len(cabecera) > MAX_COLUMNAS:
        return cabecera, [], error(
            "demasiadas_columnas",
            mensajes.demasiadas_columnas(fichero, len(cabecera), MAX_COLUMNAS),
            fichero,
            filas_crudas[0][0],
        )
    datos = []
    for numero, celdas in filas_crudas[1:]:
        recortadas = celdas[: len(cabecera)]
        if len(recortadas) < len(cabecera):
            recortadas = recortadas + [""] * (len(cabecera) - len(recortadas))
        datos.append((numero, recortadas))
    return cabecera, datos, None


def _preparar_xlsx(datos: bytes, *, fichero: str, hoja: str | None) -> Preparado:
    import openpyxl
    from openpyxl.utils.exceptions import InvalidFileException
    from openpyxl.worksheet import _reader as lector

    original = lector._cast_number

    def conservar(valor: str) -> NumeroExcel:
        return NumeroExcel(valor)

    try:
        with _CANDADO:
            lector._cast_number = conservar
            try:
                libro = openpyxl.load_workbook(BytesIO(datos), data_only=False, read_only=False)
            except (InvalidFileException, zipfile.BadZipFile, KeyError, ValueError, OSError):
                return Preparado(
                    formato="xlsx",
                    errores=[error("archivo_danado", mensajes.archivo_danado(fichero, "Excel .xlsx"), fichero)],
                )
            try:
                hojas = list(libro.sheetnames)
                elegida, origen, fallo = _elegir_hoja(hojas, hoja, fichero)
                if fallo or elegida is None:
                    return Preparado(formato="xlsx", hojas=hojas, errores=[fallo] if fallo else [])
                hoja_ws = libro[elegida]
                crudas: list[tuple[int, list[str]]] = []
                for fila in hoja_ws.iter_rows():
                    if not fila:
                        continue
                    celdas = [_texto_excel(celda.value) for celda in fila]
                    while celdas and celdas[-1] == "":
                        celdas.pop()
                    if not celdas:
                        continue
                    crudas.append((fila[0].row, celdas))
            finally:
                libro.close()
    finally:
        lector._cast_number = original

    columnas, filas, fallo_cabecera = _cabecera_de(crudas, fichero)
    if fallo_cabecera:
        return Preparado(formato="xlsx", hoja=elegida, hojas=hojas, origen_hoja=origen, columnas=columnas, errores=[fallo_cabecera])
    exceso = _limitar_filas(filas, fichero)
    if exceso:
        return Preparado(
            formato="xlsx",
            hoja=elegida,
            hojas=hojas,
            origen_hoja=origen,
            columnas=columnas,
            errores=[exceso],
        )
    return Preparado(
        formato="xlsx",
        hoja=elegida,
        hojas=hojas,
        origen_hoja=origen,
        columnas=columnas,
        filas=filas,
    )


def _texto_excel(valor: object) -> str:
    if valor is None:
        return ""
    if isinstance(valor, bool):
        return "TRUE" if valor else "FALSE"
    if isinstance(valor, NumeroExcel):
        return expandir_decimal(str(valor))
    if isinstance(valor, int):
        return str(valor)
    if isinstance(valor, float):
        return expandir_decimal(format(valor, ".15g"))
    if isinstance(valor, datetime):
        if valor.time() == time(0, 0):
            return valor.date().isoformat()
        return valor.isoformat(sep=" ")
    if isinstance(valor, date):
        return valor.isoformat()
    if isinstance(valor, time):
        return valor.isoformat()
    if isinstance(valor, Decimal):
        return expandir_decimal(format(valor, "f"))
    return str(valor)


def _preparar_ods(datos: bytes, *, fichero: str, hoja: str | None) -> Preparado:
    from odf.namespaces import OFFICENS, TABLENS
    from odf.opendocument import load

    try:
        documento = load(BytesIO(datos))
    except Exception:
        return Preparado(
            formato="ods",
            errores=[error("archivo_danado", mensajes.archivo_danado(fichero, "LibreOffice .ods"), fichero)],
        )
    # load() devuelve Element genérico, no la subclase Table. El nombre del tag sí es estable.
    tablas = [nodo for nodo in documento.spreadsheet.childNodes if _qname(nodo) == (TABLENS, "table")]
    hojas = [tabla.getAttribute("name") or f"Hoja {indice}" for indice, tabla in enumerate(tablas, start=1)]
    elegida, origen, fallo = _elegir_hoja(hojas, hoja, fichero)
    if fallo or elegida is None:
        return Preparado(formato="ods", hojas=hojas, errores=[fallo] if fallo else [])
    tabla = tablas[hojas.index(elegida)]
    crudas: list[tuple[int, list[str]]] = []
    numero = 1
    for fila in tabla.childNodes:
        if _qname(fila) != (TABLENS, "table-row"):
            continue
        repetidas = _entero(fila.getAttrNS(TABLENS, "number-rows-repeated"), 1)
        celdas = _celdas_ods(fila, OFFICENS, TABLENS)
        while celdas and celdas[-1] == "":
            celdas.pop()
        if not celdas:
            numero += repetidas
            continue
        if repetidas > MAX_FILAS + 1:
            repetidas = MAX_FILAS + 2
        for _ in range(repetidas):
            crudas.append((numero, list(celdas)))
            numero += 1
            if len(crudas) > MAX_FILAS + 1:
                break
        if len(crudas) > MAX_FILAS + 1:
            break
    columnas, filas, fallo_cabecera = _cabecera_de(crudas, fichero)
    if fallo_cabecera:
        return Preparado(formato="ods", hoja=elegida, hojas=hojas, origen_hoja=origen, columnas=columnas, errores=[fallo_cabecera])
    exceso = _limitar_filas(filas, fichero)
    if exceso:
        return Preparado(
            formato="ods",
            hoja=elegida,
            hojas=hojas,
            origen_hoja=origen,
            columnas=columnas,
            errores=[exceso],
        )
    return Preparado(
        formato="ods",
        hoja=elegida,
        hojas=hojas,
        origen_hoja=origen,
        columnas=columnas,
        filas=filas,
    )


def _qname(nodo: object) -> tuple[str, str] | None:
    nombre = getattr(nodo, "qname", None)
    if isinstance(nombre, tuple) and len(nombre) == 2:
        return nombre
    return None


def _celdas_ods(fila: object, officens: str, tablens: str) -> list[str]:
    celdas: list[str] = []
    for nodo in fila.childNodes:  # type: ignore[attr-defined]
        if _qname(nodo) != (tablens, "table-cell"):
            continue
        texto = _texto_ods(nodo, officens, tablens)
        veces = _entero(nodo.getAttrNS(tablens, "number-columns-repeated"), 1)
        if texto == "" and veces > MAX_COLUMNAS:
            break
        if len(celdas) + veces > MAX_COLUMNAS + 1 and texto != "":
            celdas.extend([texto] * (MAX_COLUMNAS + 2 - len(celdas)))
            break
        celdas.extend([texto] * max(veces, 1))
    return celdas


def _texto_ods(celda: object, officens: str, tablens: str) -> str:
    formula = celda.getAttrNS(tablens, "formula")  # type: ignore[attr-defined]
    if formula:
        cuerpo = formula[3:] if formula.startswith("of:") else formula
        if not cuerpo.startswith("="):
            cuerpo = "=" + cuerpo
        return cuerpo
    tipo = celda.getAttrNS(officens, "value-type")  # type: ignore[attr-defined]
    if tipo in {"float", "currency", "percentage"}:
        valor = celda.getAttrNS(officens, "value")  # type: ignore[attr-defined]
        if valor:
            return expandir_decimal(valor)
    if tipo == "boolean":
        valor = celda.getAttrNS(officens, "boolean-value")  # type: ignore[attr-defined]
        return "TRUE" if valor == "true" else "FALSE"
    if tipo == "date":
        return celda.getAttrNS(officens, "date-value") or _texto_visible(celda)  # type: ignore[attr-defined]
    return _texto_visible(celda)


def _texto_visible(celda: object) -> str:
    partes: list[str] = []
    for nodo in celda.childNodes:  # type: ignore[attr-defined]
        if getattr(nodo, "data", None):
            partes.append(nodo.data)
        for hijo in getattr(nodo, "childNodes", []):
            dato = getattr(hijo, "data", None)
            if dato:
                partes.append(dato)
    return "".join(partes)


def _entero(valor: str | None, por_defecto: int) -> int:
    if not valor:
        return por_defecto
    try:
        return int(valor)
    except ValueError:
        return por_defecto
