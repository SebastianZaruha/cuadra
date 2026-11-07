"""El contrato impide representar decisiones rotas, antes de reconciliar nada."""

import pytest

from cuadra.dominio.tipos import (
    CantidadManual,
    ElegirA,
    ElegirB,
    Excluir,
    ModificadoDescripcion,
    SoloEnA,
    es_cantidad_canonica,
)


def test_motivo_vacio_no_se_puede_construir():
    with pytest.raises(ValueError):
        Excluir(motivo="")
    with pytest.raises(ValueError):
        ElegirA(motivo="   ")
    with pytest.raises(ValueError):
        ElegirB(motivo=" sin recortar ")


def test_cantidad_manual_solo_admite_forma_canonica():
    assert es_cantidad_canonica("10.5")
    assert es_cantidad_canonica("-3")
    assert es_cantidad_canonica("0")
    assert not es_cantidad_canonica("10.50")
    assert not es_cantidad_canonica("01")
    assert not es_cantidad_canonica("1,5")
    assert not es_cantidad_canonica("-0")
    assert not es_cantidad_canonica("+5")
    CantidadManual(cantidad="10.5", motivo="ajuste de estantería")
    with pytest.raises(ValueError):
        CantidadManual(cantidad="10.50", motivo="ajuste de estantería")
    with pytest.raises(ValueError):
        CantidadManual(cantidad="4", motivo="  ")


def test_modificado_de_descripcion_no_acepta_cantidad_manual():
    with pytest.raises(ValueError):
        ModificadoDescripcion(
            identificador="LC-140",
            descripcion_a="Bombilla LED 9 W",
            descripcion_b="Bombilla LED 9W",
            cantidad_a="40",
            cantidad_b="40",
            fila_a=6,
            fila_b=5,
            decision=CantidadManual(cantidad="40", motivo="no debería caber"),
        )


def test_solo_en_a_no_admite_elegir_b():
    fila = SoloEnA(identificador="LC-150", descripcion="Candado", cantidad="8", fila_a=7)
    assert not hasattr(fila, "fila_b")
    with pytest.raises(ValueError):
        SoloEnA(
            identificador="LC-150",
            descripcion="Candado",
            cantidad="8",
            fila_a=7,
            decision=ElegirB(motivo="no hay B"),
        )
