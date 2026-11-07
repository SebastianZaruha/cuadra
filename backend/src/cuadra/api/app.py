"""API sin estado: cada petición trae los ficheros y se olvida al responder."""

from __future__ import annotations

import base64
import binascii
import os

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from cuadra import __version__
from cuadra.dominio.errores import ExportacionBloqueada
from cuadra.dominio import mensajes
from cuadra.dominio.lectura import error, normalizar_texto
from cuadra.dominio.limites import (
    MAX_BYTES,
    MAX_COLUMNAS,
    MAX_DECIMALES,
    MAX_DESCRIPCION,
    MAX_FILAS,
    MAX_IDENTIFICADOR,
    MAX_MOTIVO,
    SCHEMA_VERSION,
)
from cuadra.dominio.servicio import (
    abrir_sesion,
    crear_sesion,
    exportar,
    inspeccionar,
    reconciliar,
    serializar_sesion,
)
from cuadra.recursos import directorio_fixtures, leer_csv

from cuadra.api.esquemas import ExportarIn, InspeccionarIn, ReconciliarIn, SesionAbrirIn

router = APIRouter()


def _decisiones(cuerpo: ReconciliarIn) -> list[dict]:
    salida: list[dict] = []
    for decision in cuerpo.decisiones:
        item = {
            "identificador": decision.identificador,
            "tipo": decision.tipo,
            "motivo": decision.motivo,
        }
        if decision.tipo == "cantidad_manual" and decision.cantidad is not None:
            item["cantidad"] = decision.cantidad
        salida.append(item)
    return salida


def _bytes(texto: str | None, codificado: str | None, fichero: str) -> bytes | dict:
    if codificado is not None:
        try:
            return base64.b64decode(codificado, validate=True)
        except (binascii.Error, ValueError):
            return error("base64_invalido", mensajes.base64_invalido(fichero), fichero)
    if texto is not None:
        return texto.encode("utf-8")
    return b""


def _fallo_bytes(resultado: bytes | dict) -> dict | None:
    if isinstance(resultado, dict):
        return {
            "ok": False,
            "delimitador_a": None,
            "delimitador_b": None,
            "exportacion_completa_permitida": False,
            "resumen": None,
            "filas": [],
            "errores": [resultado],
            "errores_decision": [],
        }
    return None


def _responder(resultado: dict) -> JSONResponse | dict:
    codigos = {item.get("codigo") for item in resultado.get("errores", [])}
    if "fichero_demasiado_grande" in codigos:
        return JSONResponse(status_code=413, content=resultado)
    return resultado


@router.get("/salud")
def salud() -> dict:
    return {"estado": "ok", "aplicacion": "cuadra", "version": __version__}


@router.get("/limites")
def limites() -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "max_bytes": MAX_BYTES,
        "max_filas": MAX_FILAS,
        "max_columnas": MAX_COLUMNAS,
        "max_identificador": MAX_IDENTIFICADOR,
        "max_descripcion": MAX_DESCRIPCION,
        "max_motivo": MAX_MOTIVO,
        "max_decimales": MAX_DECIMALES,
    }


@router.get("/demo")
def demo() -> dict:
    base = directorio_fixtures() / "demo"
    mapeo = {"identificador": "sku", "descripcion": "descripcion", "cantidad": "cantidad"}
    return {
        "nombre_a": "deposito.csv",
        "nombre_b": "tienda.csv",
        "csv_a": normalizar_texto(leer_csv(base / "a.csv")),
        "csv_b": normalizar_texto(leer_csv(base / "b.csv")),
        "delimitador_a": ",",
        "delimitador_b": ";",
        "mapeo_a": mapeo,
        "mapeo_b": mapeo,
        "relato": (
            "Depósito y tienda de Ferretería La Cuadra. "
            "Inventarios ficticios: no hay datos de un negocio real."
        ),
    }


@router.post("/inspeccionar", response_model=None)
def ruta_inspeccionar(cuerpo: InspeccionarIn) -> JSONResponse | dict:
    datos = _bytes(cuerpo.csv, cuerpo.contenido_base64, cuerpo.fichero)
    if isinstance(datos, dict):
        return {
            "ok": False,
            "formato": None,
            "codificacion": None,
            "delimitador": None,
            "origen_delimitador": None,
            "hoja": None,
            "hojas": [],
            "origen_hoja": None,
            "columnas": [],
            "muestra": [],
            "filas_datos": 0,
            "errores": [datos],
            "sha256": None,
        }
    return _responder(
        inspeccionar(
            datos,
            delimitador=cuerpo.delimitador,
            fichero=cuerpo.fichero,
            formato=cuerpo.formato,
            hoja=cuerpo.hoja,
            nombre=cuerpo.nombre,
        )
    )


@router.post("/reconciliar", response_model=None)
def ruta_reconciliar(cuerpo: ReconciliarIn) -> JSONResponse | dict:
    lado_a = _bytes(cuerpo.csv_a, cuerpo.contenido_a_base64, "A")
    lado_b = _bytes(cuerpo.csv_b, cuerpo.contenido_b_base64, "B")
    fallo_a = _fallo_bytes(lado_a)
    fallo_b = _fallo_bytes(lado_b)
    if fallo_a or fallo_b:
        errores = []
        if fallo_a:
            errores.extend(fallo_a["errores"])
        if fallo_b:
            errores.extend(fallo_b["errores"])
        return {**fallo_a, "errores": errores} if fallo_a else {**fallo_b, "errores": errores}
    return _responder(
        reconciliar(
            lado_a,
            lado_b,
            mapeo_a=cuerpo.mapeo_a.model_dump(),
            mapeo_b=cuerpo.mapeo_b.model_dump(),
            delimitador_a=cuerpo.delimitador_a,
            delimitador_b=cuerpo.delimitador_b,
            formato_a=cuerpo.formato_a,
            formato_b=cuerpo.formato_b,
            hoja_a=cuerpo.hoja_a,
            hoja_b=cuerpo.hoja_b,
            nombre_a=cuerpo.nombre_a,
            nombre_b=cuerpo.nombre_b,
            decisiones=_decisiones(cuerpo),
        )
    )


@router.post("/exportar", response_model=None)
def ruta_exportar(cuerpo: ExportarIn) -> JSONResponse | dict:
    lado_a = _bytes(cuerpo.csv_a, cuerpo.contenido_a_base64, "A")
    lado_b = _bytes(cuerpo.csv_b, cuerpo.contenido_b_base64, "B")
    fallo_a = _fallo_bytes(lado_a)
    fallo_b = _fallo_bytes(lado_b)
    if fallo_a or fallo_b:
        errores = (fallo_a or {"errores": []})["errores"] + (fallo_b or {"errores": []})["errores"]
        return JSONResponse(status_code=400, content={"ok": False, "errores": errores})
    try:
        return exportar(
            lado_a,
            lado_b,
            mapeo_a=cuerpo.mapeo_a.model_dump(),
            mapeo_b=cuerpo.mapeo_b.model_dump(),
            modo=cuerpo.modo,
            delimitador_a=cuerpo.delimitador_a,
            delimitador_b=cuerpo.delimitador_b,
            formato_a=cuerpo.formato_a,
            formato_b=cuerpo.formato_b,
            hoja_a=cuerpo.hoja_a,
            hoja_b=cuerpo.hoja_b,
            nombre_a=cuerpo.nombre_a,
            nombre_b=cuerpo.nombre_b,
            decisiones=_decisiones(cuerpo),
        )
    except ExportacionBloqueada as exc:
        return JSONResponse(
            status_code=409,
            content={
                "ok": False,
                "errores": [
                    {
                        "codigo": "exportacion_bloqueada",
                        "mensaje": exc.mensaje,
                        "fichero": None,
                        "fila": None,
                        "columna": None,
                    }
                ],
                "pendientes": exc.pendientes,
                "bloqueados": exc.bloqueados,
            },
        )


@router.post("/sesion")
def ruta_sesion(cuerpo: ReconciliarIn) -> dict:
    lado_a = _bytes(cuerpo.csv_a, cuerpo.contenido_a_base64, "A")
    lado_b = _bytes(cuerpo.csv_b, cuerpo.contenido_b_base64, "B")
    fallo_a = _fallo_bytes(lado_a)
    if fallo_a or isinstance(lado_b, dict):
        return {"ok": False, "errores": (fallo_a or {"errores": []})["errores"] + ([lado_b] if isinstance(lado_b, dict) else [])}
    sesion = crear_sesion(
        lado_a,
        lado_b,
        mapeo_a=cuerpo.mapeo_a.model_dump(),
        mapeo_b=cuerpo.mapeo_b.model_dump(),
        nombre_a=cuerpo.nombre_a,
        nombre_b=cuerpo.nombre_b,
        delimitador_a=cuerpo.delimitador_a,
        delimitador_b=cuerpo.delimitador_b,
        formato_a=cuerpo.formato_a,
        formato_b=cuerpo.formato_b,
        hoja_a=cuerpo.hoja_a,
        hoja_b=cuerpo.hoja_b,
        decisiones=_decisiones(cuerpo),
    )
    return {"sesion": sesion, "nombre": "cuadra-sesion.json", "texto": serializar_sesion(sesion)}


@router.post("/sesion/abrir", response_model=None)
def ruta_abrir(cuerpo: SesionAbrirIn) -> JSONResponse | dict:
    lado_a = _bytes(cuerpo.csv_a, cuerpo.contenido_a_base64, "A")
    lado_b = _bytes(cuerpo.csv_b, cuerpo.contenido_b_base64, "B")
    fallo_a = _fallo_bytes(lado_a)
    fallo_b = _fallo_bytes(lado_b)
    if fallo_a or fallo_b:
        errores = (fallo_a or {"errores": []})["errores"] + (fallo_b or {"errores": []})["errores"]
        return {"ok": False, "errores": errores, "filas": [], "resumen": None}
    return _responder(abrir_sesion(cuerpo.sesion, lado_a, lado_b))


def crear_app() -> FastAPI:
    aplicacion = FastAPI(title="Cuadra", version=__version__)
    origenes = os.environ.get(
        "CUADRA_ORIGENES",
        "http://127.0.0.1:43123,http://localhost:43123",
    ).split(",")
    aplicacion.add_middleware(
        CORSMiddleware,
        allow_origins=[origen.strip() for origen in origenes if origen.strip()],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Con prefijo para uvicorn local y el proxy de Vite. Sin prefijo por si
    # la función de Vercel entrega la ruta ya recortada después de /api.
    aplicacion.include_router(router, prefix="/api")
    aplicacion.include_router(router)
    return aplicacion


app = crear_app()
