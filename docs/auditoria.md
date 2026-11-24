# Auditoría de Cuadra

Corte de noviembre de 2026. Cuadra compara dos CSV de inventario y enseña qué cambió, qué falta y qué no se puede emparejar. La clave es exacta. No adivina equivalencias y no sustituye a un ERP. Este documento es la auditoría de ese producto, la crítica de lo que se podría añadir, lo que entró en este corte y lo que queda fuera.

## Cómo está hecho

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Reglas | `backend/src/cuadra/dominio` | Lee, valida, empareja, decide, exporta. No importa FastAPI ni React |
| HTTP | `backend/src/cuadra/api` | Traduce JSON. No conserva archivos |
| Contrato | `fixtures/` | CSV ficticios con el JSON esperado |
| Pantalla | `frontend/` | React 19, Vite, TypeScript, Tailwind 4 |
| Recorrido | `e2e/tests/recorrido.spec.ts` | Un camino de punta a punta con Playwright |

Los límites reales (1 MiB, 2 000 filas, 4 decimales, sesión versión 1) viven en el dominio y se repiten en la pantalla. La demostración es Ferretería La Cuadra: `deposito.csv` y `tienda.csv`, inventarios ficticios.

El dominio ya resuelve solo las filas iguales (`cuadre.py`: una igual sin decisión cuenta como resuelta). Por eso la muestra abre con 5 pendientes y 3 resueltas, no con ocho decisiones en blanco.

## Hallazgos

### Producto

La promesa es clara y poco frecuente: no emparejar «parecido», dejar la ambigüedad a la vista y exigir un motivo. Eso es lo que un reclutador puede entender en un minuto, y es lo que no hay que diluir.

El valor se escondía. Al abrir no había ficheros. Había que pulsar «Cargar demostración» y luego «Reconciliar» para ver el producto. En un móvil de 390 px los dos paneles de mapeo ocupaban la pantalla entera antes de la primera diferencia.

La exportación completa bloqueada, la parcial marcada y la sesión que exige los mismos bytes son el corazón del producto. Estaban implementados y cubiertos por tests. La pantalla los contaba en un párrafo, no los enseñaba.

### Flujos

- El botón «Reconciliar» decía «Leyendo ficheros…» también al exportar, guardar o decidir. El estado de espera mentía.
- No se podía quitar un CSV mal elegido. Había que recargar la pestaña.
- Cambiar el mapeo borraba el cuadre sin decirlo junto a la acción, y los enlaces de descarga anteriores seguían vivos. Un CSV ya bajado podía no coincidir con las decisiones de la pantalla.
- El relato de la muestra salía en un `role="alert"`. No es un error.
- Las filas iguales se marcaban «Resuelta» sin que nadie hubiera decidido. El dominio es correcto (entran solas); la palabra no lo explicaba.
- El enlace «Saltar al cuadre» apuntaba a `#cuadre`, que no existía hasta después de reconciliar.
- Asociar el error de una decisión buscando el identificador dentro del mensaje (`Tabla.tsx`) falla si una clave es prefijo de otra. La API no manda el identificador en el error.

### Diseño

La base era honesta: Fraunces, IBM Plex Sans, verde pino y cobre sobre papel. También era una hoja de formulario. Poco contraste entre secciones, mucha ayuda repetida en cada fila, y en móvil una columna interminable.

El vidrio líquido pedido no se lee sobre ese papel. El blanco puro con humo al 6–8 % cae por debajo de un contraste usable si detrás hay crema (`#f3efe6` contra blanco está en torno a 1,15:1). La receta no se toca: se cambió el fondo.

### Código

Lo fuerte está en Python: fachada estable, mensajes propios, límites en un solo sitio, fixtures como oráculo. 61 tests de dominio y API.

La pantalla era un solo estado en `App.tsx`. A este tamaño se entiende. No hacía falta un almacén nuevo.

Había kit de más: componentes shadcn sin uso (`card`, `select`, `textarea`, `separator`), la fuente Geist en `package.json` sin usarse, y tokens de modo oscuro que nadie activaba. Borrarlos en este corte no enseña el producto y sí puede romper el tema.

Cada decisión reenvía los dos CSV. Con el límite de 1 MiB cabe en el cuerpo de la función y mantiene la API sin estado. No es un cuello de botella dentro de las reglas publicadas.

### Rendimiento

El cuadre de la muestra es instantáneo en local. El coste nuevo es el `backdrop-filter` de unos pocos paneles, no de cada fila. El mapa SVG de desplazamiento no se ejecuta.

### Accesibilidad

Había piezas buenas: `lang="es"`, etiquetas en los controles, tabla con `caption`, filtros con `aria-pressed`, foco visible.

Fallaba el foco pino sobre el fondo nuevo, el blanco del vidrio si se dejaba el anillo verde, los botones de ~28 px en táctil, y el aviso de la muestra anunciado como alerta. En móvil la tabla ya se apilaba; los filtros se partían en varias líneas y empujaban la búsqueda.

### Robustez

El cliente y el servidor vuelven a aplicar tamaño, UTF-8 y límites. Una sesión ilegal se rechaza entera. Eso se mantiene.

No hay frontera de error en React: un fallo de render tira la página. Poco probable con este árbol, y no es lo primero que se ve.

### Pruebas

El dominio está bien cubierto. La interfaz tenía un solo recorrido, y empezaba por la pantalla vacía. No hay runner de tests unitarios en el frontend: `opciones.ts` (filtros, sugerencia de columna, diferencia de cantidades) no se prueba solo.

### Listo para enseñar

El README es mejor que la pantalla: explica reglas, límites y lo que no hace. La pantalla no lo demostraba sola. Para enseñarlo había que conocer el botón de la muestra.

## Propuesta, antes de criticarla

1. Abrir con la muestra ya cuadrada y etiquetada como ficticia.
2. Un resumen visual de los conteos reales, con entrada corta.
3. Portar el vidrio liso de Hourglass y un fondo con manchas de color.
4. Arreglar los flujos rotos o mentirosos: espera, quitar fichero, descargas viejas, iguales que «entran solas», salto al cuadre.
5. Emparejar por similitud, sugerir con un modelo, importar Excel, cuentas, colaboración, guardar el CSV en el navegador, decidir en lote, tema claro, distorsión SVG del canto, tests de frontend con un runner nuevo, reescritura optimista del estado.

## Crítica

Lo que una persona ve en el primer minuto es el punto 1, el 2 y el 3. Lo que evita una vergüenza al probarlo es el 4. El 5 casi todo choca con la frase que abre el README.

- **Similitud o un modelo.** Cuadra existe para no adivinar. Una sugerencia «probable» deshace el producto aunque se etiquete. Se rechaza.
- **Excel, PDF, OCR.** El README dice que no abre Excel. Añadirlo de verdad es otro lector, otra clase de errores y otra promesa. No cabe en un corte de pantalla.
- **Cuentas, base de datos, colaboración.** La API no guarda ficheros. Persistencia en el servidor contradice el diseño y pide secretos, dominio y despliegue, que este corte no toca.
- **`localStorage` silencioso.** «Cuadra no guarda los ficheros» dejaría de ser verdad. Un borrador opt-in sería honesto y también fácil de explicar mal. Fuera de este corte.
- **Decidir en lote.** Cada fila lleva su motivo. Un lote con un motivo copiado es una función de poder y también la forma más rápida de resolver en silencio. No es lo que se quiere enseñar primero.
- **Tema claro.** El vidrio exige texto blanco. Sobre papel claro el blanco no se lee, y la consigna era no retocar la receta. Un interruptor de tema o bien rompe el vidrio o obliga a dos fondos. No hay interruptor.
- **Distorsión SVG.** En Hourglass el canto doblado es solo Chromium. Aquí se pidió el desenfoque liso, el mismo en Chrome, Safari y Firefox, y más barato. El código del mapa queda portado y apagado.
- **Runner de tests en el frontend.** Útil, y no se ve. El recorrido de Playwright ya cubre el camino que se enseña. Montar Vitest ahora es infraestructura, no el corte.
- **Estado optimista.** La respuesta del servidor es la fuente de verdad de una decisión ilegal. Anticiparla en el cliente duplica reglas que ya viven en Python.

Quitar un fichero y mostrar «B − A» no son otro producto: deshacen un callejón y hacen legible un número que ya estaba en la fila.

## Qué entró en este corte

- La muestra de Ferretería La Cuadra se carga y se cuadra al abrir. El relato del API dice que son inventarios ficticios. Si el API falla, se dice; no hay números inventados en el cliente.
- Resumen con barras de iguales, modificados, solo en A, solo en B y bloqueados. Los datos son `resumen`. La barra crece al entrar (~560 ms, escalonada). Con `prefers-reduced-motion: reduce` no hay animación.
- Vidrio liso (`data-vl="desenfoque"`) en la barra, los dos ficheros, la acción de reconciliar, el resumen y el cierre. La tabla no es vidrio: es una superficie oscura, densa, con su propio texto.
- Fondo `#0b0b0c` con una sola luz cálida muy baja, fuera de cuadro, y grano fino. Sin manchas de color ni animación. El acento de las acciones es el pino `#1f6b4a`. El vidrio sigue en desenfoque; el canto y la sombra larga se afinan en la pantalla, no en el módulo.
- En escritorio la barra es pegajosa y el contenido pasa por debajo; la columna de ficheros también se queda. En móvil (por debajo de 1100 px) la barra no se pega, para no tapar la fila que se está leyendo. El resumen va antes que los ficheros.
- Entrada de las piezas: opacidad y 8 px, 200 ms, escalonada. Se apaga con movimiento reducido.
- «Quitar fichero A/B». Al quitar, el cuadre y las descargas se tiran.
- Una decisión nueva, un mapeo nuevo o una reconciliación invalidan los enlaces de descarga anteriores.
- Las iguales sin decisión dicen «Entra sola». Si la cantidad difiere, la celda B muestra la diferencia B − A (por ejemplo −2 en LC-110).
- La ayuda larga de cada fila está en «Cómo decidir», cerrada. La regla sigue en la página.
- Espera anunciada como «Trabajando…», no como «Leyendo ficheros…».
- Foco crema en la superficie y blanco dentro del vidrio. Controles de al menos 44 px. Filtros en una fila con desplazamiento horizontal en pantallas estrechas.
- El texto «Elegido por ti» pasó a «Elegido»: el delimitador puede venir de la muestra, no de la persona.
- Deshacer y rehacer decisiones, paleta de comandos, informe imprimible y exportación de diferencias en el navegador.
- Borrador y plantillas de columnas solo si se activan, en `localStorage`.
- Excel a CSV y Latin-1 en el cliente, con aviso. La coma decimal solo si se pulsa el botón.
- Tolerancia de cantidad explícita, con motivo, sin tocar la clave. El coste, si se mapea, solo estima un valor.
- Errores de decisión con `identificador` propio.
- Páginas `/privacidad`, `/aviso-legal` y `/cookies` (y `/en/…`) con el placeholder «Texto legal pendiente de revisión». Sin analítica: el banner está en el código y no se muestra.

Quedan fuera, con motivo: cuadre de 50 000 filas (el tope real es 2 000 filas y 1 MiB, y cada decisión reenvía los dos CSV bajo el límite de 4,5 MB de Vercel); cuadre offline (las reglas están solo en Python); tolerancia de precio dentro del dominio (no hay columna de precio en el contrato).

## Qué se rechazó, y por qué

| Idea | Por qué no |
| --- | --- |
| Emparejar por parecido o con un modelo | Contradice la razón del programa |
| Excel, PDF, OCR | Otra promesa y otro lector |
| Cuentas, colaboración, guardar en el servidor | Rompe la API sin estado y pide despliegue |
| Borrador automático | Haría falso «no guarda los ficheros». El que hay es opt-in y se puede borrar |
| Decisiones en lote | El motivo es por fila; el lote invita a resolver sin mirar |
| Tema claro o interruptor | El blanco del vidrio no se lee sobre papel; la receta no se negocia |
| Filtro SVG de canto | Pedido explícito el desenfoque liso, igual en los tres motores |
| Vitest en este corte | No se ve; el recorrido e2e cubre lo que se enseña |
| Reescritura optimista | Duplica reglas que ya están en Python |
| Métricas, clientes o testimonios inventados | No hay esos datos |

## Hoja de ruta

Ordenado por lo que más cambiaría el uso real, no por lo más vistoso.

1. **Sugerir columnas sin exigir mayúsculas ni acentos.** Solo en la pantalla. La comparación del cuadre sigue siendo exacta.
2. **Más de 2 000 filas.** Hoy el tope es 2 000 filas y 1 MiB por fichero. Cada decisión reenvía los dos CSV y Vercel limita el cuerpo a 4,5 MB. Subir a 50 000 filas pide otro transporte, no un botón.
3. **Cuadre sin API.** Las reglas están solo en Python. El service worker cachea el cascarón; sin red no hay un cuadre nuevo.
4. **Tolerancia de precio en el dominio.** El coste de la pantalla es una estimación. Meter el precio en el emparejamiento cambiaría el contrato.
5. **Textos legales definitivos.** Las rutas existen. El asesor aún no ha entregado el texto.
6. **Podar** Geist y componentes de UI que nadie monta.

## Vidrio

El módulo está copiado en `frontend/src/comun/estilo/vidrio-liquido/` (CSS, `hoja.ts`, `mapa.ts`, `movimiento.ts`, `useVidrioLiquido.ts`, `index.ts`). Cuadra lo usa con `activo: false` y respaldo `desenfoque` (`usePanelVidrio.ts`).

Comprobado en Chromium, en un panel real:

- `data-vl` es `desenfoque`. No hay filtro SVG en el documento y no hay `mix-blend-mode` en los hijos.
- Fondo del panel transparente, texto blanco, radio 30 px.
- Sombra interior `rgb(170,170,170)` con alfa 0,45 en el canto, 0,65 arriba y 0,3 abajo, más `0 18px 50px rgba(0,0,0,.18)`.
- `backdrop-filter: blur(8.64px)` a 1440 px de ancho, dentro de `clamp(6px, 0.6vw, 12px)`. El CSS incluye también `-webkit-backdrop-filter`.
- El texto largo va en tarjetas al 6 % (`--vl-humo-texto`), radio 16 px y 14 px de separación. Los botones usan la clase `control`: sin borde, humo 8 %, hover +8 % de blanco, activo (`aria-pressed`) +20 % y peso 600.
- `prefers-reduced-transparency` sube el blur a 24 px y el humo a 50 % (está en el CSS del módulo; no se pudo emular con Playwright en esta máquina).
- Sin `backdrop-filter`, el propio CSS pone `rgba(0,0,0,.62)`. Se forzó esa caída en una captura: el texto blanco sigue leyéndose. Safari y Firefox modernos pintan el mismo desenfoque; no reciben un canto doblado distinto porque ese camino está apagado. En un motor viejo sin `backdrop-filter` verían el panel sólido.

El esquema claro del módulo (`.app[data-scheme='light']`) no se activa. Sus humos son los mismos 8 % y 6 %. Activarlo no arreglaría un fondo de papel, así que el fondo se dejó oscuro a propósito.
