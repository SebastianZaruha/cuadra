"""Lectura de CSV. No reconcilia: solo dice qué hay en un fichero y qué le impide leerse."""

from __future__ import annotations

import csv
import hashlib
from dataclasses import dataclass, field
from decimal import Decimal
from io import StringIO

from cuadra.dominio import mensajes
from cuadra.dominio.limites import (
    MAX_BYTES,
    MAX_COLUMNAS,
    MAX_DESCRIPCION,
    MAX_FILAS,
    MAX_IDENTIFICADOR,
    MAX_MUESTRA,
)
from cuadra.dominio.tipos import CANTIDAD_ENTRADA, es_cantidad_canonica

# El salto de línea se incluye junto al retorno: al leer texto a veces uno
# se convierte en el otro, y los dos pueden activar una fórmula en Excel.
_PELIGROSOS = ("=", "+", "-", "@", "\t", "\r", "\n")


def error(
    codigo: str,
    mensaje: str,
    fichero: str | None = None,
    fila: int | None = None,
    columna: str | None = None,
) -> dict:
    return {
        "codigo": codigo,
        "mensaje": mensaje,
        "fichero": fichero,
        "fila": fila,
        "columna": columna,
    }


def normalizar_texto(texto: str) -> str:
    """Un BOM inicial no forma parte del cuadre ni del hash de la sesión."""
    if texto.startswith("\ufeff"):
        return texto[1:]
    return texto


def sha256_texto(texto: str) -> str:
    return hashlib.sha256(normalizar_texto(texto).encode("utf-8")).hexdigest()


def cantidad_canonica(texto: str) -> str | None:
    limpio = texto.strip()
    if not CANTIDAD_ENTRADA.fullmatch(limpio):
        return None
    render = format(Decimal(limpio), "f")
    if "." in render:
        render = render.rstrip("0").rstrip(".")
    if render in {"-0", ""}:
        render = "0"
    if not es_cantidad_canonica(render):
        return None
    return render


def caracter_de_formula_texto(raw: str) -> str | None:
    """En identificador y descripción el «-» inicial también es fórmula.

    En la cantidad no se usa esta función: ahí el menos es un número válido.
    """
    if raw[:1] in _PELIGROSOS:
        return raw[:1]
    sin_espacios = raw.lstrip(" ")
    if sin_espacios[:1] in _PELIGROSOS:
        return sin_espacios[:1]
    return None


def _contar_delimitadores(linea: str) -> tuple[int, int]:
    comas = 0
    puntos = 0
    entre_comillas = False
    indice = 0
    while indice < len(linea):
        caracter = linea[indice]
        if caracter == '"':
            if entre_comillas and indice + 1 < len(linea) and linea[indice + 1] == '"':
                indice += 2
                continue
            entre_comillas = not entre_comillas
        elif not entre_comillas:
            if caracter == ",":
                comas += 1
            elif caracter == ";":
                puntos += 1
        indice += 1
    return comas, puntos


def resolver_delimitador(
    texto: str,
    elegido: str | None,
    fichero: str,
) -> tuple[str | None, dict | None]:
    """La cabecera manda. Si hay coma y punto y coma, no se elige en silencio."""
    lineas = texto.splitlines()
    if not lineas:
        return None, error("fichero_vacio", mensajes.fichero_vacio(fichero), fichero)
    comas, puntos = _contar_delimitadores(lineas[0])
    if elegido is not None:
        if elegido not in {",", ";"}:
            return None, error(
                "delimitador_ausente",
                mensajes.delimitador_ausente(fichero),
                fichero,
                1,
                None,
            )
        propios = comas if elegido == "," else puntos
        ajenos = puntos if elegido == "," else comas
        if propios == 0 and ajenos > 0:
            return None, error(
                "delimitador_no_coincide",
                mensajes.delimitador_no_coincide(elegido, fichero),
                fichero,
                1,
                None,
            )
        if propios == 0:
            return None, error(
                "delimitador_ausente",
                mensajes.delimitador_ausente(fichero),
                fichero,
                1,
                None,
            )
        return elegido, None
    if comas > 0 and puntos > 0:
        return None, error(
            "delimitador_ambiguo",
            mensajes.delimitador_ambiguo(fichero),
            fichero,
            1,
            None,
        )
    if comas > 0:
        return ",", None
    if puntos > 0:
        return ";", None
    return None, error(
        "delimitador_ausente",
        mensajes.delimitador_ausente(fichero),
        fichero,
        1,
        None,
    )


def _fila_vacia(row: list[str]) -> bool:
    # Una línea en blanco llega como [] . ``,,`` llega con tres celdas y sí es una fila.
    return len(row) == 0 or (len(row) == 1 and row[0] == "")


@dataclass
class Borrador:
    fichero: str
    fila: int
    identificador: str
    descripcion_cruda: str
    cantidad_cruda: str
    descripcion: str | None
    cantidad: str | None
    clave: str | None
    columna_id: str
    errores: list[dict] = field(default_factory=list)


@dataclass
class FicheroCargado:
    delimitador: str | None
    errores: list[dict]
    filas: list[Borrador]
    columnas: list[str] = field(default_factory=list)
    filas_datos: int = 0


def _validar_mapeo(mapeo: dict, fichero: str) -> dict | None:
    campos = ("identificador", "descripcion", "cantidad")
    if not isinstance(mapeo, dict) or any(
        not isinstance(mapeo.get(campo), str) or mapeo.get(campo) == "" for campo in campos
    ):
        return error("mapeo_repetido", mensajes.mapeo_repetido(fichero), fichero)
    if len({mapeo["identificador"], mapeo["descripcion"], mapeo["cantidad"]}) < 3:
        return error("mapeo_repetido", mensajes.mapeo_repetido(fichero), fichero)
    return None


def _cabecera(nombres: list[str], fichero: str) -> dict | None:
    if any(nombre == "" for nombre in nombres):
        return error("cabecera_vacia", mensajes.cabecera_vacia(fichero), fichero, 1, None)
    vistos: set[str] = set()
    for nombre in nombres:
        if nombre in vistos:
            return error(
                "cabecera_duplicada",
                mensajes.cabecera_duplicada(nombre, fichero),
                fichero,
                1,
                nombre,
            )
        vistos.add(nombre)
    if len(nombres) > MAX_COLUMNAS:
        return error(
            "demasiadas_columnas",
            mensajes.demasiadas_columnas(fichero, len(nombres), MAX_COLUMNAS),
            fichero,
            1,
            None,
        )
    return None


def _analizar_cantidad(raw: str, fichero: str, fila: int, columna: str) -> tuple[str | None, str, dict | None]:
    if raw[:1] in {"\t", "\r", "\n"}:
        return None, raw, error("formula_peligrosa", mensajes.formula(raw[:1]), fichero, fila, columna)
    limpio = raw.strip()
    if limpio == "":
        return None, "", error("cantidad_vacia", mensajes.cantidad_vacia(), fichero, fila, columna)
    canonica = cantidad_canonica(limpio)
    if canonica is not None:
        return canonica, canonica, None
    if limpio[:1] in _PELIGROSOS:
        return None, limpio, error(
            "formula_peligrosa",
            mensajes.formula(limpio[:1]),
            fichero,
            fila,
            columna,
        )
    return None, limpio, error(
        "cantidad_invalida",
        mensajes.cantidad_invalida(limpio),
        fichero,
        fila,
        columna,
    )


def _analizar_fila(
    numero: int,
    row: list[str],
    *,
    fichero: str,
    ancho: int,
    indices: dict[str, int],
    columnas: dict[str, str],
) -> Borrador:
    def celda(campo: str) -> str:
        indice = indices[campo]
        if indice >= len(row):
            return ""
        return row[indice]

    id_raw = celda("identificador")
    desc_raw = celda("descripcion")
    cant_raw = celda("cantidad")
    necesario = max(indices.values()) + 1
    if len(row) < necesario:
        ident = id_raw if caracter_de_formula_texto(id_raw) else id_raw.strip()
        desc = desc_raw if caracter_de_formula_texto(desc_raw) else desc_raw.strip()
        return Borrador(
            fichero=fichero,
            fila=numero,
            identificador=ident,
            descripcion_cruda=desc,
            cantidad_cruda=cant_raw.strip(),
            descripcion=None,
            cantidad=None,
            clave=None,
            columna_id=columnas["identificador"],
            errores=[
                error(
                    "fila_incompleta",
                    mensajes.fila_incompleta(numero, fichero, len(row), ancho),
                    fichero,
                    numero,
                    None,
                )
            ],
        )

    errores: list[dict] = []
    peligro_id = caracter_de_formula_texto(id_raw)
    if peligro_id:
        identificador = id_raw
        clave = None
        errores.append(
            error(
                "formula_peligrosa",
                mensajes.formula(peligro_id),
                fichero,
                numero,
                columnas["identificador"],
            )
        )
    else:
        identificador = id_raw.strip()
        if identificador == "":
            clave = None
            errores.append(
                error(
                    "identificador_vacio",
                    mensajes.identificador_vacio(),
                    fichero,
                    numero,
                    columnas["identificador"],
                )
            )
        elif len(identificador) > MAX_IDENTIFICADOR:
            clave = identificador
            errores.append(
                error(
                    "identificador_demasiado_largo",
                    mensajes.identificador_largo(),
                    fichero,
                    numero,
                    columnas["identificador"],
                )
            )
        else:
            clave = identificador

    peligro_desc = caracter_de_formula_texto(desc_raw)
    if peligro_desc:
        descripcion_cruda = desc_raw
        descripcion = None
        errores.append(
            error(
                "formula_peligrosa",
                mensajes.formula(peligro_desc),
                fichero,
                numero,
                columnas["descripcion"],
            )
        )
    else:
        descripcion = desc_raw.strip()
        descripcion_cruda = descripcion
        if len(descripcion) > MAX_DESCRIPCION:
            descripcion = None
            errores.append(
                error(
                    "descripcion_demasiado_larga",
                    mensajes.descripcion_larga(),
                    fichero,
                    numero,
                    columnas["descripcion"],
                )
            )

    cantidad, cantidad_cruda, error_cantidad = _analizar_cantidad(
        cant_raw,
        fichero,
        numero,
        columnas["cantidad"],
    )
    if error_cantidad:
        errores.append(error_cantidad)
    return Borrador(
        fichero=fichero,
        fila=numero,
        identificador=identificador,
        descripcion_cruda=descripcion_cruda,
        cantidad_cruda=cantidad_cruda,
        descripcion=descripcion,
        cantidad=cantidad,
        clave=clave,
        columna_id=columnas["identificador"],
        errores=errores,
    )


def leer_fichero(texto: str, *, fichero: str, mapeo: dict, delimitador: str | None) -> FicheroCargado:
    texto = normalizar_texto(texto)
    mapeo_mal = _validar_mapeo(mapeo, fichero)
    if mapeo_mal:
        return FicheroCargado(None, [mapeo_mal], [])
    peso = len(texto.encode("utf-8"))
    if peso > MAX_BYTES:
        return FicheroCargado(
            None,
            [
                error(
                    "fichero_demasiado_grande",
                    mensajes.fichero_demasiado_grande(fichero, peso, MAX_BYTES),
                    fichero,
                )
            ],
            [],
        )
    if texto.strip() == "":
        return FicheroCargado(None, [error("fichero_vacio", mensajes.fichero_vacio(fichero), fichero)], [])

    delim, error_delim = resolver_delimitador(texto, delimitador, fichero)
    if error_delim or delim is None:
        return FicheroCargado(None, [error_delim] if error_delim else [], [])

    lector = csv.reader(StringIO(texto), delimiter=delim)
    try:
        cabecera = next(lector)
    except StopIteration:
        return FicheroCargado(delim, [error("sin_cabecera", mensajes.sin_cabecera(fichero), fichero)], [])
    nombres = [celda.strip() for celda in cabecera]
    cabecera_mal = _cabecera(nombres, fichero)
    if cabecera_mal:
        return FicheroCargado(delim, [cabecera_mal], [], columnas=nombres)

    faltan: list[dict] = []
    indices: dict[str, int] = {}
    for campo in ("identificador", "descripcion", "cantidad"):
        columna = mapeo[campo]
        if columna not in nombres:
            faltan.append(
                error(
                    "columna_inexistente",
                    mensajes.columna_inexistente(columna, campo, fichero, nombres),
                    fichero,
                    1,
                    columna,
                )
            )
        else:
            indices[campo] = nombres.index(columna)
    if faltan:
        return FicheroCargado(delim, faltan, [], columnas=nombres)

    crudas: list[tuple[int, list[str]]] = []
    for row in lector:
        if _fila_vacia(row):
            continue
        crudas.append((lector.line_num, row))
    if len(crudas) > MAX_FILAS:
        return FicheroCargado(
            delim,
            [
                error(
                    "demasiadas_filas",
                    mensajes.demasiadas_filas(fichero, len(crudas), MAX_FILAS),
                    fichero,
                )
            ],
            [],
            columnas=nombres,
            filas_datos=len(crudas),
        )
    filas = [
        _analizar_fila(
            numero,
            row,
            fichero=fichero,
            ancho=len(nombres),
            indices=indices,
            columnas={campo: mapeo[campo] for campo in ("identificador", "descripcion", "cantidad")},
        )
        for numero, row in crudas
    ]
    return FicheroCargado(delim, [], filas, columnas=nombres, filas_datos=len(filas))


def inspeccionar(csv_texto: str, *, delimitador: str | None = None, fichero: str = "A") -> dict:
    """Vista previa para mapear columnas, antes de reconciliar."""
    texto = normalizar_texto(csv_texto)
    peso = len(texto.encode("utf-8"))
    if peso > MAX_BYTES:
        return _inspeccion(
            False,
            None,
            None,
            [],
            [],
            0,
            [
                error(
                    "fichero_demasiado_grande",
                    mensajes.fichero_demasiado_grande(fichero, peso, MAX_BYTES),
                    fichero,
                )
            ],
        )
    if texto.strip() == "":
        return _inspeccion(
            False,
            None,
            None,
            [],
            [],
            0,
            [error("fichero_vacio", mensajes.fichero_vacio(fichero), fichero)],
        )
    delim, error_delim = resolver_delimitador(texto, delimitador, fichero)
    origen = "elegido" if delimitador else "detectado"
    if error_delim or delim is None:
        return _inspeccion(False, None, None, [], [], 0, [error_delim] if error_delim else [])
    lector = csv.reader(StringIO(texto), delimiter=delim)
    try:
        cabecera = next(lector)
    except StopIteration:
        return _inspeccion(
            False,
            delim,
            origen,
            [],
            [],
            0,
            [error("sin_cabecera", mensajes.sin_cabecera(fichero), fichero)],
        )
    nombres = [celda.strip() for celda in cabecera]
    cabecera_mal = _cabecera(nombres, fichero)
    if cabecera_mal:
        return _inspeccion(False, delim, origen, nombres, [], 0, [cabecera_mal])
    muestra: list[dict[str, str]] = []
    total = 0
    for row in lector:
        if _fila_vacia(row):
            continue
        total += 1
        if len(muestra) < MAX_MUESTRA:
            muestra.append(
                {nombres[i]: (row[i] if i < len(row) else "") for i in range(len(nombres))}
            )
    if total > MAX_FILAS:
        return _inspeccion(
            False,
            delim,
            origen,
            nombres,
            muestra,
            total,
            [error("demasiadas_filas", mensajes.demasiadas_filas(fichero, total, MAX_FILAS), fichero)],
        )
    return _inspeccion(True, delim, origen, nombres, muestra, total, [])


def _inspeccion(ok, delimitador, origen, columnas, muestra, filas_datos, errores) -> dict:
    return {
        "ok": ok,
        "delimitador": delimitador,
        "origen_delimitador": origen,
        "columnas": columnas,
        "muestra": muestra,
        "filas_datos": filas_datos,
        "errores": errores,
    }
