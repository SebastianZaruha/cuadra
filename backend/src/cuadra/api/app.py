"""API sin estado: cada petición trae los CSV y se olvida al responder."""

from __future__ import annotations

import os

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from cuadra import __version__
from cuadra.dominio.errores import ExportacionBloqueada
from cuadra.dominio.lectura import normalizar_texto
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
    return _responder(
        inspeccionar(cuerpo.csv, delimitador=cuerpo.delimitador, fichero=cuerpo.fichero)
    )


@router.post("/reconciliar", response_model=None)
def ruta_reconciliar(cuerpo: ReconciliarIn) -> JSONResponse | dict:
    return _responder(
        reconciliar(
            cuerpo.csv_a,
            cuerpo.csv_b,
            mapeo_a=cuerpo.mapeo_a.model_dump(),
            mapeo_b=cuerpo.mapeo_b.model_dump(),
            delimitador_a=cuerpo.delimitador_a,
            delimitador_b=cuerpo.delimitador_b,
            decisiones=_decisiones(cuerpo),
        )
    )


@router.post("/exportar", response_model=None)
def ruta_exportar(cuerpo: ExportarIn) -> JSONResponse | dict:
    try:
        return exportar(
            cuerpo.csv_a,
            cuerpo.csv_b,
            mapeo_a=cuerpo.mapeo_a.model_dump(),
            mapeo_b=cuerpo.mapeo_b.model_dump(),
            modo=cuerpo.modo,
            delimitador_a=cuerpo.delimitador_a,
            delimitador_b=cuerpo.delimitador_b,
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
    sesion = crear_sesion(
        cuerpo.csv_a,
        cuerpo.csv_b,
        mapeo_a=cuerpo.mapeo_a.model_dump(),
        mapeo_b=cuerpo.mapeo_b.model_dump(),
        nombre_a=cuerpo.nombre_a,
        nombre_b=cuerpo.nombre_b,
        delimitador_a=cuerpo.delimitador_a,
        delimitador_b=cuerpo.delimitador_b,
        decisiones=_decisiones(cuerpo),
    )
    return {"sesion": sesion, "nombre": "cuadra-sesion.json", "texto": serializar_sesion(sesion)}


@router.post("/sesion/abrir", response_model=None)
def ruta_abrir(cuerpo: SesionAbrirIn) -> JSONResponse | dict:
    return _responder(abrir_sesion(cuerpo.sesion, cuerpo.csv_a, cuerpo.csv_b))


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
