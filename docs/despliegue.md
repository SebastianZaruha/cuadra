# Despliegue

Este documento no cambia dominios ni DNS. El borrador de pull request tampoco promociona producción.

## Qué publica Vercel

La raíz del proyecto, no `frontend/`, es la raíz de Vercel. `vercel.json` instala y construye el frontend y publica `frontend/dist`. No hay reescritura a `/api`. `.vercelignore` excluye la carpeta `api`, así que la función Python no se despliega. El paquete Python sigue en el repositorio para pytest.

No hace falta ninguna variable secreta. No hay base de datos. El cuadre no sale del navegador.

`VITE_GA_ID` es la única variable de analítica. En el repositorio no tiene valor. Sin un id con forma `G-…` (y sin cadenas de ejemplo) no se muestra el banner y no se inserta ningún script. Si más adelante se rellena en Vercel, el script de GA4 se carga solo después de Aceptar.

`/legal` y `/legal-en` son HTML estático con «Texto legal pendiente de revisión».

## Pasos para el dueño, cuando lo apruebe

1. En Vercel, el proyecto apunta a este repositorio con la raíz en el directorio del repo. No hace falta otro comando de build.
2. El subdominio propuesto es `cuadra.sebastianzaruha.com`, el mismo esquema que Hourglass en `sebastianzaruha.com`.
3. En el DNS del dominio, un CNAME de `cuadra` al destino que indique Vercel. Este repositorio no lo crea.
4. En Vercel, añadir ese dominio al proyecto y esperar la verificación. No promocionar el despliegue de un borrador si aún no se han revisado los textos legales.
5. Sustituir el placeholder de `/legal` y `/legal-en`. Seguir sin pegar un identificador de GA4 hasta decidirlo.

La app instalada como PWA sigue cuadrando sin red: el dominio viaja dentro del JavaScript.
