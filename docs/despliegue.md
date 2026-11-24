# Despliegue

Este documento no cambia dominios ni DNS. El borrador de pull request tampoco promociona producción.

## Qué hay ya en el repositorio

La raíz del proyecto, no `frontend/`, es la raíz de Vercel. `vercel.json` instala y construye el frontend, publica `frontend/dist` y reescribe `/api` a la función Python `api/index.py`. No hace falta ninguna variable secreta. No hay base de datos.

Las páginas `/privacidad`, `/aviso-legal` y `/cookies`, y las mismas bajo `/en/`, son HTML estático con el aviso «Texto legal pendiente de revisión». No hay analítica: el banner aceptar/rechazar existe en el código y no se muestra mientras `MEDICION_GA4` en `frontend/src/analitica.ts` esté vacío.

## Pasos para el dueño, cuando lo apruebe

1. En Vercel, el proyecto apunta a este repositorio con la raíz en el directorio del repo. No hace falta otro comando de build.
2. El subdominio propuesto es `cuadra.sebastianzaruha.com`, el mismo esquema que Hourglass en `sebastianzaruha.com`.
3. En el DNS del dominio, un CNAME de `cuadra` al destino que indique Vercel. Este repositorio no lo crea.
4. En Vercel, añadir ese dominio al proyecto y esperar la verificación. No promocionar el despliegue de un borrador si aún no se han revisado los textos legales.
5. Sustituir el placeholder de las páginas legales. Seguir sin pegar un identificador de GA4 hasta decidirlo: con el campo vacío no se carga ningún script.

La API y el estático salen del mismo proyecto. Cada petición lleva los CSV y la función no los guarda.
