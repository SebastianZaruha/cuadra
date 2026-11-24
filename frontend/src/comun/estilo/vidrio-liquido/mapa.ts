// Genera el "mapa de desplazamiento": una imagen donde cada píxel dice
// hacia dónde hay que mover lo que se ve detrás del vidrio.
//   - Canal R = desplazamiento en X, canal G = desplazamiento en Y.
//   - 128 significa "no mover". Por encima o por debajo, mover en un sentido u otro.
// Solo hay deformación en una franja junto al borde; el centro queda neutro,
// así que solo calculamos los píxeles de esa franja (mucho más barato).

export interface ParametrosMapa {
  ancho: number; // px CSS del elemento
  alto: number;
  radio: number; // radio de las esquinas en px CSS
  borde: number; // "splay": anchura del anillo sobre el borde
  suavizado: number; // "feather": cuánto se alarga la caída hacia dentro
  curvatura: number; // forma del bisel (pow)
  resolucion: number; // 0.5 = el mapa se calcula a la mitad de tamaño
}

const INTENSIDAD = 0.8; // el BOOST de la web original
const NEUTRO = 128;

// Caché: si el tamaño y los valores no cambian, reutilizamos la imagen.
const cache = new Map<string, string>();
const MAX_CACHE = 20;

export function construirMapa(p: ParametrosMapa): string {
  const clave = [p.ancho, p.alto, p.radio, p.borde, p.suavizado, p.curvatura, p.resolucion].join(':');
  const guardado = cache.get(clave);
  if (guardado) return guardado;

  const inicio = performance.now();
  // Todo se escala a la resolución del mapa (el navegador lo estira luego al tamaño real).
  const k = p.resolucion;
  const w = Math.max(2, Math.round(p.ancho * k));
  const h = Math.max(2, Math.round(p.alto * k));
  const radio = Math.min(p.radio * k, w / 2, h / 2);
  const borde = p.borde * k;
  const franja = (p.borde + p.suavizado) * k; // hasta dónde llega la deformación hacia dentro

  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const px = img.data;
  px.fill(NEUTRO); // R, G, B y A a 128...
  for (let i = 3; i < px.length; i += 4) px[i] = 255; // ...y alfa opaco

  // Distancia con signo al borde de un rectángulo redondeado (negativa = dentro).
  const mx = w / 2;
  const my = h / 2;
  const distancia = (x: number, y: number) => {
    const qx = Math.abs(x - mx) - (mx - radio);
    const qy = Math.abs(y - my) - (my - radio);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radio;
  };

  // Margen en el que puede haber deformación (la franja o la esquina, lo que sea mayor).
  const margen = Math.ceil(Math.max(franja, radio)) + 1;

  for (let y = 0; y < h; y++) {
    const filaDelBorde = y < margen || y >= h - margen;
    for (let x = 0; x < w; x++) {
      // En el centro no hay nada que calcular: saltamos al otro lado de la fila.
      if (!filaDelBorde && x === margen && w - margen > x) x = w - margen;
      const cx = x + 0.5;
      const cy = y + 0.5;
      const s = distancia(cx, cy);
      if (s < -franja) continue;

      // Normal hacia fuera (dirección en la que "crece" la distancia).
      const gx = distancia(cx + 1, cy) - distancia(cx - 1, cy);
      const gy = distancia(cx, cy + 1) - distancia(cx, cy - 1);
      const largo = Math.hypot(gx, gy) || 1;

      // Fuerza: 1 en el borde y cae suave hacia dentro (smootherstep + curvatura).
      const alcance = s < 0 ? franja : borde;
      let f = Math.max(0, 1 - Math.abs(s) / alcance);
      f = f * f * f * (f * (f * 6 - 15) + 10);
      f = Math.pow(f, p.curvatura);

      // Restamos la normal: se toma el fondo de MÁS ADENTRO, como una lente.
      const i = (y * w + x) * 4;
      px[i] = clamp(127.5 - (gx / largo) * f * 127 * INTENSIDAD);
      px[i + 1] = clamp(127.5 - (gy / largo) * f * 127 * INTENSIDAD);
    }
  }

  ctx.putImageData(img, 0, 0);
  const url = lienzo.toDataURL('image/png');
  // Aparece en DevTools → Performance → Timings, para ver cuánto cuesta.
  performance.measure('vidrio-liquido:mapa', { start: inicio, end: performance.now() });
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(clave, url);
  return url;
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}
