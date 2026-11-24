import { useLayoutEffect, type RefObject } from 'react';
import { useVidrioLiquido, type OpcionesVidrioLiquido } from './useVidrioLiquido';
import { vigilarMovimiento } from './movimiento';

/**
 * Vidrio de las hojas: desenfoque gaussiano suave, sin escarcha, sin grano y sin color propio
 * (como la referencia de la app del tiempo). El aspecto está en vidrio-liquido.css.
 *
 * DISTORSION = «vidrio grueso»: en Chromium (Chrome, Edge, Chrome y WebView de Android) el
 * fondo se dobla un poco en el canto con un filtro SVG; en el centro casi nada. Safari y
 * Firefox no admiten el filtro y se quedan con el vidrio liso (respaldo 'desenfoque').
 * Mientras la hoja entra o sale, el filtro se quita (movimiento.ts + data-vl-mov en el CSS).
 * Pon false para tener el vidrio liso en todos los navegadores.
 */
export const DISTORSION = true;

/** Números del canto doblado (mapa.ts): solo en la franja del borde. */
export const GRUESO: OpcionesVidrioLiquido = {
  profundidad: 14, // cuánto se desplaza el fondo en el canto, px
  borde: 14, // anchura de la franja que dobla, px
  suavizado: 10, // caída hacia el centro, px
  curvatura: 2.4, // alto = centro más limpio
};

export const HOJA: OpcionesVidrioLiquido = {
  respaldo: 'desenfoque',
  activo: DISTORSION,
  ...GRUESO,
};

/** El mismo vidrio para todas las hojas. No copia el efecto en cada panel. */
export function useHojaVidrio(ref: RefObject<HTMLElement | null>, activo = true) {
  const encendido = activo && DISTORSION;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !encendido) return;
    return vigilarMovimiento(el);
  }, [ref, encendido]);
  return useVidrioLiquido(ref, { ...HOJA, activo: encendido });
}
