# Auditoría de Cuadra

Corte de noviembre de 2026. Cuadra compara dos CSV de inventario y enseña qué cambió, qué falta y qué no se puede emparejar. La clave es exacta. No adivina equivalencias y no sustituye a un ERP.

## Estado actual

El cuadre corre en el navegador. `frontend/src/dominio/cuadra.ts` porta lectura, cuadre, exportación, sesión y límites. Vitest compara cada `fixtures/*/esperado.json` y los CSV de la demo con el mismo resultado que pytest. El Python de `backend/` se queda como referencia y no se despliega: `.vercelignore` excluye `api/` y `vercel.json` ya no reescribe `/api`.

La identidad visual es la de `main`: papel `#f3efe6`, pino `#1f6b4a`, cobre, tinta `#1c2430`, Fraunces e IBM Plex Sans. Lo único añadido es el vidrio liso en la barra, los paneles de fichero, el resumen, el cierre y la paleta. Sobre papel el humo es blanco translúcido y el texto es la tinta original. El blur, el canto de 1 px y la sombra `0 18px 50px` siguen siendo los del módulo.

## Cómo está hecho

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Reglas en el navegador | `frontend/src/dominio/cuadra.ts` | Lee, valida, empareja, decide, exporta y abre la sesión |
| Referencia | `backend/src/cuadra/dominio` | La misma lógica en Python, para pytest. No importa React |
| HTTP de referencia | `backend/src/cuadra/api` | Sigue en el repo. El despliegue no lo publica |
| Contrato | `fixtures/` | CSV ficticios con el JSON esperado, compartido por pytest y Vitest |
| Pantalla | `frontend/` | React 19, Vite, TypeScript, Tailwind 4 |
| Recorrido | `e2e/tests/recorrido.spec.ts` | Playwright contra la app, sin servidor |

Los límites reales (1 MiB, 2 000 filas, 4 decimales, sesión versión 1) viven en el dominio y se repiten en la pantalla. La demostración es Ferretería La Cuadra: `deposito.csv` y `tienda.csv`, inventarios ficticios.

El dominio ya resuelve solo las filas iguales (una igual sin decisión cuenta como resuelta). Por eso la muestra abre con 5 pendientes y 3 resueltas, no con ocho decisiones en blanco.

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

La base es la original: Fraunces, IBM Plex Sans, verde pino y cobre sobre papel `#f3efe6`. Un fondo oscuro y una paleta tipo sistema se probaron y se retiraron: el dueño quería ese papel, y el vidrio encima.

El vidrio del módulo trae texto blanco y humo negro. Sobre papel eso no se lee. No se tocó el blur ni el canto: se cambian `--vl-texto` a `#1c2430` y el humo a blanco translúcido. El foco visible sigue siendo el pino.

### Código

La referencia sigue en Python: fachada estable, mensajes propios, límites en un solo sitio, fixtures como oráculo. 61 tests de dominio y API. El puerto TypeScript se comprueba contra esos mismos fixtures.

La pantalla es un solo estado en `App.tsx`. A este tamaño se entiende. No hace falta un almacén nuevo.

Había kit de más: componentes shadcn sin uso (`card`, `select`, `textarea`, `separator`), la fuente Geist en `package.json` sin usarse, y tokens de modo oscuro que nadie activaba. Borrarlos en este corte no enseña el producto y sí puede romper el tema.

Cada decisión vuelve a correr el dominio en el navegador, con los CSV que ya están en memoria. No hay cuerpo de petición.

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
- Vidrio liso (`data-vl="desenfoque"`) en la barra, los dos ficheros, el resumen, el cierre y la paleta. La tabla no es vidrio: es la tabla original sobre papel.
- Fondo papel `#f3efe6` con el radial pino del diseño original y un grano muy bajo, sin manchas de color. El acento es el pino `#1f6b4a`. Sobre papel no hay humo detrás del texto: el panel lleva un tinte blanco uniforme, recortado al radio, con canto de 1 px y una sombra corta de tinta.
- En escritorio la barra es pegajosa y el contenido pasa por debajo; la columna de ficheros también se queda. En móvil (por debajo de 1100 px) la barra no se pega, para no tapar la fila que se está leyendo. El resumen va antes que los ficheros.
- Entrada de las piezas: opacidad y 8 px, 200 ms, escalonada. Se apaga con movimiento reducido.
- «Quitar fichero A/B». Al quitar, el cuadre y las descargas se tiran.
- Una decisión nueva, un mapeo nuevo o una reconciliación invalidan los enlaces de descarga anteriores.
- Las iguales sin decisión dicen «Entra sola». Si la cantidad difiere, la celda B muestra la diferencia B − A (por ejemplo −2 en LC-110).
- La ayuda larga de cada fila está en «Cómo decidir», cerrada. La regla sigue en la página.
- Espera anunciada como «Trabajando…», no como «Leyendo ficheros…».
- Foco pino, el del diseño original, también dentro del vidrio.
- El texto «Elegido por ti» pasó a «Elegido»: el delimitador puede venir de la muestra, no de la persona.
- Deshacer y rehacer decisiones, paleta de comandos, informe imprimible y exportación de diferencias en el navegador.
- Borrador y plantillas de columnas solo si se activan, en `localStorage`.
- Excel a CSV y Latin-1 en el cliente, con aviso. La coma decimal solo si se pulsa el botón.
- Tolerancia de cantidad explícita, con motivo, sin tocar la clave. El coste, si se mapea, solo estima un valor.
- Errores de decisión con `identificador` propio.
- `/legal` y `/legal-en` con el texto del asesor, índice y anclas. GA4 solo si existe `VITE_GA_ID` con forma `G-…` y la persona acepta. Sin ese valor no hay banner ni script. La elección dura 12 meses.

Quedan fuera, con motivo: cuadre de 50 000 filas (el tope publicado sigue siendo 2 000 filas y 1 MiB; subirlo cambia el producto, no solo el transporte) y tolerancia de precio dentro del dominio (el coste de la pantalla es una estimación).

## Qué se rechazó, y por qué

| Idea | Por qué no |
| --- | --- |
| Emparejar por parecido o con un modelo | Contradice la razón del programa |
| Excel, PDF, OCR | Otra promesa y otro lector |
| Cuentas, colaboración, guardar en el servidor | Rompe la API sin estado y pide despliegue |
| Borrador automático | Haría falso «no guarda los ficheros». El que hay es opt-in y se puede borrar |
| Decisiones en lote | El motivo es por fila; el lote invita a resolver sin mirar |
| Interruptor claro/oscuro | El papel es la identidad. El vidrio lleva tinta oscura y un tinte blanco uniforme, sin segundo tema |
| Filtro SVG de canto | Pedido explícito el desenfoque liso, igual en los tres motores |
| Reescritura optimista distinta del dominio | El cliente ahora es el dominio. Anticipar otra vez duplicaría las reglas |
| Métricas, clientes o testimonios inventados | No hay esos datos |

## Hoja de ruta

Ordenado por lo que más cambiaría el uso real, no por lo más vistoso.

1. **Sugerir columnas sin exigir mayúsculas ni acentos.** Solo en la pantalla. La comparación del cuadre sigue siendo exacta.
2. **Más de 2 000 filas.** El tope sigue siendo 2 000 filas y 1 MiB por fichero, ahora en el navegador. Subir a 50 000 filas es un cambio de producto y de memoria, no un botón.
3. **Tolerancia de precio en el dominio.** El coste de la pantalla es una estimación. Meter el precio en el emparejamiento cambiaría el contrato.
4. **Ajustes de la propiedad de GA4 en el administrador de Google** (conservación, Signals, términos). El código no puede hacerlos.
5. **Podar** Geist y componentes de UI que nadie monta.

## Vidrio

El módulo está copiado en `frontend/src/comun/estilo/vidrio-liquido/` (CSS, `hoja.ts`, `mapa.ts`, `movimiento.ts`, `useVidrioLiquido.ts`, `index.ts`). Cuadra lo usa con `activo: false` y respaldo `desenfoque` (`usePanelVidrio.ts`).

Comprobado en Chromium, en un panel real:

- `data-vl` es `desenfoque`. No hay filtro SVG en el documento y no hay `mix-blend-mode` en los hijos.
- Fondo del panel transparente, texto `#1c2430`, radio 0,9 rem como las tarjetas originales.
- Sombra interior `rgb(170,170,170)` con alfa 0,45 en el canto, 0,65 arriba y 0,3 abajo, más `0 18px 50px rgba(0,0,0,.18)`. Esas dos las pone el módulo; la pantalla no las sustituye.
- `backdrop-filter: blur(clamp(6px, 0.6vw, 12px))` y el prefijo `-webkit-`.
- Humo blanco translúcido (`--vl-humo` y `--vl-humo-texto`) para que la tinta oscura cumpla AA sobre papel.
- `prefers-reduced-transparency` sube el blur a 24 px y el tinte uniforme, sin manchas detrás de las letras.
- Sin `backdrop-filter`, el panel cae a papel sólido `#fbf8f3` al 96 %. El `rgba(0,0,0,.62)` del módulo servía para texto blanco; con tinta oscura dejaría el texto ilegible. Safari y Firefox modernos pintan el mismo desenfoque. El canto doblado no se enciende.
