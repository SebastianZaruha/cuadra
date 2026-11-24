# Despliegue

Este documento no cambia dominios ni DNS. El borrador de pull request tampoco promociona producción.

## Qué publica Vercel

La raíz del proyecto, no `frontend/`, es la raíz de Vercel. `vercel.json` instala y construye el frontend y publica `frontend/dist`. No hay reescritura a `/api`. `.vercelignore` excluye la carpeta `api`, así que la función Python no se despliega. El paquete Python sigue en el repositorio para pytest.

No hace falta ninguna variable secreta. No hay base de datos. El cuadre no sale del navegador.

`VITE_GA_ID` es la única variable de analítica. En el repositorio no tiene valor. Sin un id con forma `G-…` no se muestra el banner y no se inserta ningún script. Si se rellena, el script entra solo después de Aceptar. Rechazar borra las cookies `_ga*` y corta `g/collect`. La elección dura 12 meses. No se envían nombres ni contenido de ficheros.

`/legal` y `/legal-en` son la aplicación, con anclas `#aviso-legal`, `#privacidad` y `#cookies`. Las fuentes van en el propio dominio, no desde un CDN.

## Pasos para el dueño, cuando lo apruebe

1. En Vercel, el proyecto apunta a este repositorio con la raíz en el directorio del repo. No hace falta otro comando de build.
2. El subdominio propuesto es `cuadra.sebastianzaruha.com`, el mismo esquema que Hourglass en `sebastianzaruha.com`.
3. En el DNS del dominio, un CNAME de `cuadra` al destino que indique Vercel. Este repositorio no lo crea.
4. En Vercel, añadir ese dominio al proyecto y esperar la verificación. Este borrador no se promociona.
5. No rellenar `VITE_GA_ID` hasta decidir la propiedad de GA4. `/legal` y `/legal-en` ya llevan el texto del asesor.

La app instalada como PWA sigue cuadrando sin red: el dominio viaja dentro del JavaScript.
