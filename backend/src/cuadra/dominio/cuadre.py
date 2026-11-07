"""Empareja por clave exacta y aplica solo las decisiones que la categoría permite."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, replace

from cuadra.dominio import mensajes
from cuadra.dominio.lectura import (
    Borrador,
    FicheroCargado,
    cantidad_canonica,
    error,
    leer_fichero,
)
from cuadra.dominio.limites import MAX_MOTIVO
from cuadra.dominio.tipos import (
    Bloqueada,
    CantidadManual,
    Decision,
    ElegirA,
    ElegirB,
    ErrorValidacion,
    Excluir,
    Fila,
    Iguales,
    ModificadoCantidad,
    ModificadoDescripcion,
    SoloEnA,
    SoloEnB,
)

_TIPOS = {"elegir_A", "elegir_B", "cantidad_manual", "excluir"}


@dataclass
class Cuadre:
    ok: bool
    delimitador_a: str | None
    delimitador_b: str | None
    filas: list[Fila]
    errores: list[dict]
    errores_decision: list[dict]

    def a_dict(self) -> dict:
        if not self.ok:
            return {
                "ok": False,
                "delimitador_a": self.delimitador_a,
                "delimitador_b": self.delimitador_b,
                "exportacion_completa_permitida": False,
                "resumen": None,
                "filas": [],
                "errores": self.errores,
                "errores_decision": [],
            }
        resumen = resumen_de(self.filas)
        return {
            "ok": True,
            "delimitador_a": self.delimitador_a,
            "delimitador_b": self.delimitador_b,
            "exportacion_completa_permitida": resumen["pendientes"] == 0 and resumen["bloqueados"] == 0,
            "resumen": resumen,
            "filas": [fila_a_dict(fila) for fila in self.filas],
            "errores": [],
            "errores_decision": self.errores_decision,
        }


def construir(
    csv_a: str,
    csv_b: str,
    *,
    mapeo_a: dict,
    mapeo_b: dict,
    delimitador_a: str | None = None,
    delimitador_b: str | None = None,
    decisiones: list[dict] | None = None,
) -> Cuadre:
    lado_a = leer_fichero(csv_a, fichero="A", mapeo=mapeo_a, delimitador=delimitador_a)
    lado_b = leer_fichero(csv_b, fichero="B", mapeo=mapeo_b, delimitador=delimitador_b)
    if lado_a.errores or lado_b.errores:
        return Cuadre(
            ok=False,
            delimitador_a=lado_a.delimitador,
            delimitador_b=lado_b.delimitador,
            filas=[],
            errores=lado_a.errores + lado_b.errores,
            errores_decision=[],
        )
    _marcar_duplicados(lado_a.filas)
    _marcar_duplicados(lado_b.filas)
    # Una clave duplicada o inválida en un fichero también bloquea al otro:
    # emparejar «la primera» sería adivinar.
    _marcar_cruce(lado_a.filas, lado_b.filas)
    filas = _emparejar(lado_a, lado_b)
    filas, errores_decision = aplicar_decisiones(filas, decisiones or [])
    return Cuadre(
        ok=True,
        delimitador_a=lado_a.delimitador,
        delimitador_b=lado_b.delimitador,
        filas=filas,
        errores=[],
        errores_decision=errores_decision,
    )


def _marcar_duplicados(filas: list[Borrador]) -> None:
    grupos: dict[str, list[Borrador]] = defaultdict(list)
    for fila in filas:
        if fila.clave is not None:
            grupos[fila.clave].append(fila)
    for clave, grupo in grupos.items():
        if len(grupo) < 2:
            continue
        numeros = sorted(fila.fila for fila in grupo)
        mensaje = mensajes.identificador_duplicado(clave, grupo[0].fichero, numeros)
        for fila in grupo:
            fila.errores.append(
                error(
                    "identificador_duplicado",
                    mensaje,
                    fila.fichero,
                    fila.fila,
                    fila.columna_id,
                )
            )


def _marcar_cruce(filas_a: list[Borrador], filas_b: list[Borrador]) -> None:
    grupos_a: dict[str, list[Borrador]] = defaultdict(list)
    grupos_b: dict[str, list[Borrador]] = defaultdict(list)
    for fila in filas_a:
        if fila.clave is not None:
            grupos_a[fila.clave].append(fila)
    for fila in filas_b:
        if fila.clave is not None:
            grupos_b[fila.clave].append(fila)

    def inseguras(grupos: dict[str, list[Borrador]]) -> set[str]:
        return {
            clave
            for clave, grupo in grupos.items()
            if len(grupo) > 1 or any(fila.errores for fila in grupo)
        }

    def avisar(
        origen: list[Borrador],
        grupos_otro: dict[str, list[Borrador]],
        inseguras_otro: set[str],
        fichero_otro: str,
    ) -> None:
        for fila in origen:
            if fila.clave is None or fila.clave not in inseguras_otro:
                continue
            otro = grupos_otro[fila.clave]
            if len(otro) > 1:
                detalle = mensajes.detalle_duplicado(sorted(item.fila for item in otro))
            else:
                detalle = mensajes.detalle_errores(sorted(item.fila for item in otro))
            fila.errores.append(
                error(
                    "clave_bloqueada_en_el_otro",
                    mensajes.clave_bloqueada(fichero_otro, fila.clave, detalle),
                    fila.fichero,
                    fila.fila,
                    fila.columna_id,
                )
            )

    avisar(filas_a, grupos_b, inseguras(grupos_b), "B")
    avisar(filas_b, grupos_a, inseguras(grupos_a), "A")


def _emparejar(lado_a: FicheroCargado, lado_b: FicheroCargado) -> list[Fila]:
    indice_b = {fila.clave: fila for fila in lado_b.filas if fila.clave and not fila.errores}
    comparables: list[Fila] = []
    bloqueadas: list[Bloqueada] = []
    usadas: set[str] = set()
    for fila in lado_a.filas:
        if fila.errores or fila.clave is None or fila.descripcion is None or fila.cantidad is None:
            bloqueadas.append(_bloqueada(fila))
            continue
        otro = indice_b.get(fila.clave)
        if otro is None:
            comparables.append(
                SoloEnA(fila.clave, fila.descripcion, fila.cantidad, fila.fila)
            )
            continue
        usadas.add(fila.clave)
        comparables.append(_comparar(fila, otro))
    for fila in lado_b.filas:
        if fila.errores or fila.clave is None or fila.descripcion is None or fila.cantidad is None:
            bloqueadas.append(_bloqueada(fila))
            continue
        if fila.clave in usadas:
            continue
        comparables.append(SoloEnB(fila.clave, fila.descripcion, fila.cantidad, fila.fila))
    comparables.sort(key=lambda fila: fila.identificador)
    bloqueadas.sort(key=lambda fila: (0 if fila.fichero == "A" else 1, fila.fila))
    return comparables + bloqueadas


def _comparar(fila_a: Borrador, fila_b: Borrador) -> Fila:
    assert fila_a.clave and fila_a.descripcion is not None and fila_a.cantidad
    assert fila_b.descripcion is not None and fila_b.cantidad
    if fila_a.descripcion == fila_b.descripcion and fila_a.cantidad == fila_b.cantidad:
        return Iguales(fila_a.clave, fila_a.descripcion, fila_a.cantidad, fila_a.fila, fila_b.fila)
    if fila_a.descripcion == fila_b.descripcion:
        return ModificadoCantidad(
            fila_a.clave,
            fila_a.descripcion,
            fila_a.cantidad,
            fila_b.cantidad,
            fila_a.fila,
            fila_b.fila,
        )
    return ModificadoDescripcion(
        fila_a.clave,
        fila_a.descripcion,
        fila_b.descripcion,
        fila_a.cantidad,
        fila_b.cantidad,
        fila_a.fila,
        fila_b.fila,
    )


def _bloqueada(fila: Borrador) -> Bloqueada:
    if not fila.errores:
        fila.errores.append(
            error(
                "fila_incompleta",
                mensajes.fila_incompleta(fila.fila, fila.fichero, 0, 0),
                fila.fichero,
                fila.fila,
                None,
            )
        )
    return Bloqueada(
        fichero=fila.fichero,  # type: ignore[arg-type]
        fila=fila.fila,
        identificador=fila.identificador,
        descripcion_cruda=fila.descripcion_cruda,
        cantidad_cruda=fila.cantidad_cruda,
        errores=tuple(
            ErrorValidacion(
                codigo=item["codigo"],
                mensaje=item["mensaje"],
                fichero=item["fichero"],
                fila=item["fila"],
                columna=item["columna"],
            )
            for item in fila.errores
        ),
    )


def aplicar_decisiones(filas: list[Fila], decisiones: list[dict]) -> tuple[list[Fila], list[dict]]:
    if not decisiones:
        return filas, []
    errores: list[dict] = []
    conteo: dict[str, int] = defaultdict(int)
    preparados: list[tuple[dict, str | None]] = []
    for cruda in decisiones:
        if not isinstance(cruda, dict):
            preparados.append(({}, None))
            continue
        ident = cruda.get("identificador")
        ident_limpio = ident.strip() if isinstance(ident, str) else None
        preparados.append((cruda, ident_limpio))
        if ident_limpio:
            conteo[ident_limpio] += 1

    por_id = {
        fila.identificador: fila
        for fila in filas
        if not isinstance(fila, Bloqueada)
    }
    bloqueadas = {
        fila.identificador
        for fila in filas
        if isinstance(fila, Bloqueada) and fila.identificador != ""
    }
    aplicadas: dict[str, Fila] = {}
    duplicadas: set[str] = set()

    for cruda, ident in preparados:
        if ident is None or ident == "":
            mostrado = cruda.get("identificador", "")
            errores.append(
                error(
                    "decision_desconocida",
                    mensajes.decision_desconocida(str(mostrado)),
                )
            )
            continue
        if conteo[ident] > 1:
            if ident not in duplicadas:
                duplicadas.add(ident)
                errores.append(error("decision_duplicada", mensajes.decision_duplicada(ident)))
            continue
        if ident in bloqueadas:
            errores.append(error("decision_en_bloqueada", mensajes.decision_en_bloqueada(ident)))
            continue
        fila = por_id.get(ident)
        if fila is None:
            errores.append(error("decision_desconocida", mensajes.decision_desconocida(ident)))
            continue
        decision, problema = _decision_de(cruda, fila)
        if problema:
            errores.append(problema)
            continue
        assert decision is not None
        aplicadas[ident] = replace(fila, decision=decision)

    nuevas: list[Fila] = []
    for fila in filas:
        if not isinstance(fila, Bloqueada) and fila.identificador in aplicadas:
            nuevas.append(aplicadas[fila.identificador])
        else:
            nuevas.append(fila)
    return nuevas, errores


def _decision_de(cruda: dict, fila: Fila) -> tuple[Decision | None, dict | None]:
    ident = fila.identificador
    motivo = cruda.get("motivo", "")
    if not isinstance(motivo, str) or motivo.strip() == "":
        return None, error("motivo_vacio", mensajes.decision_motivo_vacio(ident))
    motivo = motivo.strip()
    if len(motivo) > MAX_MOTIVO:
        return None, error("motivo_largo", mensajes.motivo_largo(ident))
    tipo = cruda.get("tipo")
    if tipo not in _TIPOS:
        return None, error("decision_tipo_desconocido", mensajes.decision_tipo_desconocido(ident))
    if tipo == "cantidad_manual" and isinstance(fila, ModificadoDescripcion):
        return None, error(
            "decision_ilegal",
            mensajes.decision_manual_descripcion(ident),
        )
    if tipo == "elegir_A":
        decision: Decision = ElegirA(motivo)
    elif tipo == "elegir_B":
        decision = ElegirB(motivo)
    elif tipo == "excluir":
        decision = Excluir(motivo)
    else:
        cant = cruda.get("cantidad", "")
        if not isinstance(cant, str):
            return None, error("cantidad_manual_invalida", mensajes.decision_cantidad_invalida(ident))
        canonica = cantidad_canonica(cant)
        if canonica is None:
            return None, error("cantidad_manual_invalida", mensajes.decision_cantidad_invalida(ident))
        decision = CantidadManual(canonica, motivo)
    try:
        replace(fila, decision=decision)
    except ValueError:
        return None, error("decision_ilegal", mensajes.decision_ilegal(str(tipo), fila.tipo, ident))
    return decision, None


def resumen_de(filas: list[Fila]) -> dict[str, int]:
    resumen = {
        "iguales": 0,
        "modificados": 0,
        "solo_en_A": 0,
        "solo_en_B": 0,
        "bloqueados": 0,
        "pendientes": 0,
        "resueltos": 0,
    }
    for fila in filas:
        if isinstance(fila, Bloqueada):
            resumen["bloqueados"] += 1
            continue
        resumen[fila.tipo] += 1
        if fila.decision is None and not isinstance(fila, Iguales):
            resumen["pendientes"] += 1
        else:
            resumen["resueltos"] += 1
    return resumen


def fila_a_dict(fila: Fila) -> dict:
    if isinstance(fila, Bloqueada):
        return {
            "tipo": "bloqueados",
            "fichero": fila.fichero,
            "fila": fila.fila,
            "identificador": fila.identificador,
            "descripcion_cruda": fila.descripcion_cruda,
            "cantidad_cruda": fila.cantidad_cruda,
            "errores": [
                {
                    "codigo": item.codigo,
                    "mensaje": item.mensaje,
                    "fichero": item.fichero,
                    "fila": item.fila,
                    "columna": item.columna,
                }
                for item in fila.errores
            ],
        }
    decision = None
    if fila.decision is not None:
        if isinstance(fila.decision, CantidadManual):
            decision = {
                "tipo": "cantidad_manual",
                "cantidad": fila.decision.cantidad,
                "motivo": fila.decision.motivo,
            }
        else:
            decision = {"tipo": fila.decision.tipo, "motivo": fila.decision.motivo}
    estado = "resuelta" if isinstance(fila, Iguales) or fila.decision is not None else "pendiente"
    if isinstance(fila, Iguales):
        return {
            "tipo": "iguales",
            "identificador": fila.identificador,
            "descripcion": fila.descripcion,
            "cantidad": fila.cantidad,
            "fila_a": fila.fila_a,
            "fila_b": fila.fila_b,
            "estado": estado,
            "decision": decision,
        }
    if isinstance(fila, SoloEnA):
        return {
            "tipo": "solo_en_A",
            "identificador": fila.identificador,
            "descripcion": fila.descripcion,
            "cantidad": fila.cantidad,
            "fila_a": fila.fila_a,
            "estado": estado,
            "decision": decision,
        }
    if isinstance(fila, SoloEnB):
        return {
            "tipo": "solo_en_B",
            "identificador": fila.identificador,
            "descripcion": fila.descripcion,
            "cantidad": fila.cantidad,
            "fila_b": fila.fila_b,
            "estado": estado,
            "decision": decision,
        }
    if isinstance(fila, ModificadoCantidad):
        descripcion_a = descripcion_b = fila.descripcion
        cantidad_a, cantidad_b = fila.cantidad_a, fila.cantidad_b
    else:
        assert isinstance(fila, ModificadoDescripcion)
        descripcion_a, descripcion_b = fila.descripcion_a, fila.descripcion_b
        cantidad_a, cantidad_b = fila.cantidad_a, fila.cantidad_b
    return {
        "tipo": "modificados",
        "identificador": fila.identificador,
        "descripcion_a": descripcion_a,
        "cantidad_a": cantidad_a,
        "descripcion_b": descripcion_b,
        "cantidad_b": cantidad_b,
        "descripcion_difiere": descripcion_a != descripcion_b,
        "cantidad_difiere": cantidad_a != cantidad_b,
        "fila_a": fila.fila_a,
        "fila_b": fila.fila_b,
        "estado": estado,
        "decision": decision,
    }
