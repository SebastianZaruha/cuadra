"""Cada par de CSV ficticio tiene su salida esperada, escrita a mano en JSON."""

from __future__ import annotations

import pytest

from cuadra.dominio.servicio import reconciliar

from carga import cargar_par, nombres_fixtures


@pytest.mark.parametrize("nombre", nombres_fixtures())
def test_fixture_coincide_con_el_oraculo(nombre: str):
    csv_a, csv_b, entrada, esperado = cargar_par(nombre)
    obtenido = reconciliar(
        csv_a,
        csv_b,
        mapeo_a=entrada["mapeo_a"],
        mapeo_b=entrada["mapeo_b"],
        delimitador_a=entrada["delimitador_a"],
        delimitador_b=entrada["delimitador_b"],
    )
    assert obtenido == esperado
