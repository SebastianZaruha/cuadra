import { useId, useLayoutEffect, useState, type RefObject } from 'react';
import { construirMapa } from './mapa';

export interface OpcionesVidrioLiquido {
  /** Cuánto se doblan los bordes, en px (Depth). Por defecto 15. */
  profundidad?: number;
  /** Anchura del anillo de refracción sobre el borde, en px (Splay). Por defecto 11. */
  borde?: number;
  /** Cuánto se alarga la caída hacia el centro, en px (Feather). Por defecto 11. */
  suavizado?: number;
  /** Forma del bisel: más alto = borde más marcado y centro más limpio (Curvature). Por defecto 2.4. */
  curvatura?: number;
  /** Radio de las esquinas en px. Si no se pasa, se lee el border-radius del elemento (o 28). */
  radio?: number;
  /** Tamaño del mapa respecto al elemento. 0.5 = mitad (más barato, se ve igual). */
  resolucion?: number;
  /**
   * Qué hacer en navegadores sin refracción (Safari, Firefox, iOS):
   *  - 'desenfoque': el mismo vidrio pero sin doblar el borde (por defecto).
   *  - 'app': no aplicar nada y dejar que mande la clase propia de la app (p. ej. .vidrio).
   */
  respaldo?: 'desenfoque' | 'app';
  /** Pon false para apagar el efecto sin desmontar nada. */
  activo?: boolean;
}

export type ModoVidrio = 'refraccion' | 'desenfoque' | 'app';

/**
 * ¿Puede este navegador usar un filtro SVG dentro de backdrop-filter?
 * Hoy solo Chromium (Chrome, Edge, Opera, Samsung Internet, WebView de Android).
 * `navigator.userAgentData` solo existe en Chromium; Chrome en iPhone es WebKit y no lo tiene.
 */
export function soportaRefraccion(): boolean {
  if (typeof window === 'undefined') return false;
  const chromium = 'userAgentData' in navigator;
  const backdrop = CSS.supports('backdrop-filter', 'blur(1px)');
  const menosTransparencia = matchMedia('(prefers-reduced-transparency: reduce)').matches;
  return chromium && backdrop && !menosTransparencia;
}

/**
 * Convierte el propio elemento (la hoja del menú) en vidrio líquido.
 * Solo pinta el fondo: no toca posición, tamaño, transform, filter ni opacity.
 *
 * Uso:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useVidrioLiquido(ref);
 *   <div ref={ref} className="hoja vidrio-liquido">…</div>
 */
export function useVidrioLiquido(
  ref: RefObject<HTMLElement | null>,
  opciones: OpcionesVidrioLiquido = {},
): ModoVidrio {
  const {
    profundidad = 15,
    borde = 11,
    suavizado = 11,
    curvatura = 2.4,
    radio,
    resolucion = 0.5,
    respaldo = 'desenfoque',
    activo = true,
  } = opciones;

  // Identificador único y válido para el filtro SVG (useId devuelve algo como «r1»).
  const idBase = 'vl-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [modo, setModo] = useState<ModoVidrio>(respaldo);

  // useLayoutEffect: así el atributo está puesto antes del primer pintado (sin parpadeo).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const refraccion = activo && soportaRefraccion();
    const modoActual: ModoVidrio = refraccion ? 'refraccion' : respaldo;
    el.dataset.vl = modoActual; // el CSS decide el aspecto según este atributo
    setModo(modoActual);
    if (!refraccion) {
      return () => {
        delete el.dataset.vl;
      };
    }

    // 1) Filtro SVG oculto en el <body>. No usamos display:none: algunos navegadores
    //    ignoran los filtros que están dentro de un SVG no renderizado.
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    const filtro = document.createElementNS(NS, 'filter');
    filtro.setAttribute('x', '0');
    filtro.setAttribute('y', '0');
    filtro.setAttribute('width', '100%');
    filtro.setAttribute('height', '100%');
    filtro.setAttribute('color-interpolation-filters', 'sRGB');
    // feImage = el mapa. feDisplacementMap = mueve el fondo según el mapa.
    const imagen = document.createElementNS(NS, 'feImage');
    imagen.setAttribute('x', '0');
    imagen.setAttribute('y', '0');
    imagen.setAttribute('preserveAspectRatio', 'none');
    imagen.setAttribute('result', 'mapa');
    const desplazar = document.createElementNS(NS, 'feDisplacementMap');
    desplazar.setAttribute('in', 'SourceGraphic');
    desplazar.setAttribute('in2', 'mapa');
    desplazar.setAttribute('scale', String(profundidad));
    desplazar.setAttribute('xChannelSelector', 'R');
    desplazar.setAttribute('yChannelSelector', 'G');
    filtro.append(imagen, desplazar);
    svg.append(filtro);
    document.body.append(svg);

    // 2) Construye (o saca de la caché) el mapa para el tamaño real del elemento.
    let version = 0;
    const actualizar = () => {
      // offsetWidth/Height = tamaño de layout; no le afectan translateY ni el blur de entrada.
      const ancho = el.offsetWidth;
      const alto = el.offsetHeight;
      if (ancho < 2 || alto < 2) return; // oculto (display:none): esperamos al siguiente resize
      const r = radio ?? (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 28);
      const url = construirMapa({ ancho, alto, radio: r, borde, suavizado, curvatura, resolucion });
      imagen.setAttribute('href', url);
      imagen.setAttribute('width', String(ancho));
      imagen.setAttribute('height', String(alto));
      // Id nuevo en cada cambio: obliga al navegador a no reutilizar el filtro viejo.
      filtro.id = `${idBase}-${++version}`;
      el.style.setProperty('--vl-filtro', `url(#${filtro.id})`);
    };
    actualizar();

    // 3) Si cambia el tamaño (girar el móvil, redimensionar), rehacemos el mapa
    //    con un pequeño retraso para no recalcularlo en cada píxel del arrastre.
    let espera = 0;
    const observador = new ResizeObserver(() => {
      clearTimeout(espera);
      espera = window.setTimeout(actualizar, 120);
    });
    observador.observe(el);

    // 4) Limpieza al desmontar o al cambiar opciones.
    return () => {
      observador.disconnect();
      clearTimeout(espera);
      svg.remove();
      el.style.removeProperty('--vl-filtro');
      delete el.dataset.vl;
    };
  }, [ref, idBase, profundidad, borde, suavizado, curvatura, radio, resolucion, respaldo, activo]);

  return modo;
}
