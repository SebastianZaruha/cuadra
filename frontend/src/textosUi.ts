/** Textos de interfaz del asesor. No parafrasear. */

export type Idioma = "es" | "en"

export function idiomaDeRuta(pathname = window.location.pathname): Idioma {
  return pathname === "/legal-en" ? "en" : "es"
}

const textos = {
  es: {
    pieLegal: "Legal y privacidad",
    pieLegalHref: "/legal#aviso-legal",
    pieCookies: "Configurar cookies",
    avisoFicheros: "Tus ficheros se procesan en tu navegador; no se suben a ningún servidor.",
    avisoFicherosMas: "Más información",
    avisoFicherosHref: "/legal#privacidad",
    borradorEtiqueta: "Guardar borrador en este navegador",
    borradorAyuda:
      "Guarda la comparación en curso (incluidos los datos de tus ficheros) solo en este navegador para que puedas retomarla. No se envía a ningún servidor. Puedes borrarla cuando quieras.",
    borradorAviso: "No lo actives en un ordenador compartido.",
    plantillasEtiqueta: "Guardar plantillas de columnas en este navegador",
    plantillasAyuda:
      "Recuerda qué columna de tus ficheros corresponde a cada campo para no tener que elegirlas otra vez. Solo se guardan los nombres de las columnas, en este navegador.",
    borrar: "Borrar datos guardados",
    borrarTitulo: "¿Borrar los datos guardados?",
    borrarTexto: "Se eliminarán el borrador y las plantillas de columnas de este navegador. No se puede deshacer.",
    borrarConfirmar: "Borrar",
    borrarCancelar: "Cancelar",
    borrarHecho: "Datos borrados de este navegador.",
    borrarVacio: "No hay datos guardados en este navegador.",
    borrarMas: "Más información",
    borrarMasHref: "/legal#cookies",
    resultadoCorto: "Resultado orientativo. Revísalo antes de ajustar tu stock o tomar decisiones.",
    resultadoLargoAntes:
      "Cuadra compara los datos tal como están en los ficheros y por coincidencia exacta de la clave. Los errores de formato, espacios, códigos duplicados o columnas mal elegidas pueden alterar el resultado. Comprueba las diferencias antes de actuar.",
    resultadoLargoEnlace: "Condiciones",
    resultadoLargoHref: "/legal#aviso-legal",
    bannerTitulo: "Cookies de analítica",
    banner:
      "Con tu permiso, usamos Google Analytics para saber cuántas personas usan Cuadra y cómo, mediante cookies. Google puede tratar estos datos fuera de la UE. Tus ficheros nunca se envían. Puedes cambiar tu elección cuando quieras en «Configurar cookies».",
    bannerPolitica: "Política de cookies",
    bannerPoliticaHref: "/legal#cookies",
    aceptar: "Aceptar",
    rechazar: "Rechazar",
    configurar: "Configurar",
    panelTitulo: "Configurar cookies",
    panelIntro: "Elige qué permites. Puedes cambiarlo en cualquier momento desde el pie de página.",
    necesarias:
      "Necesarias (siempre activas): recuerdan tu elección de cookies y, si las activas, guardan el borrador y las plantillas en este navegador.",
    analitica: "Analítica (Google Analytics 4): cookies _ga y _ga_<ID> para medir las visitas. Tus ficheros nunca se envían.",
    guardar: "Guardar",
    aceptarTodo: "Aceptar todo",
    rechazarTodo: "Rechazar todo",
    guardado: "Preferencias guardadas.",
    retirado: "Analítica desactivada. Hemos borrado sus cookies.",
  },
  en: {
    pieLegal: "Legal and privacy",
    pieLegalHref: "/legal-en#aviso-legal",
    pieCookies: "Cookie settings",
    avisoFicheros: "Your files are processed in your browser; they are never uploaded to any server.",
    avisoFicherosMas: "Learn more",
    avisoFicherosHref: "/legal-en#privacidad",
    borradorEtiqueta: "Save draft in this browser",
    borradorAyuda:
      "Saves the comparison in progress (including the data from your files) only in this browser so you can resume it. It is not sent to any server. You can delete it at any time.",
    borradorAviso: "Don't turn this on on a shared computer.",
    plantillasEtiqueta: "Save column templates in this browser",
    plantillasAyuda:
      "Remembers which column in your files matches each field so you don't have to pick them again. Only column names are saved, in this browser.",
    borrar: "Delete saved data",
    borrarTitulo: "Delete saved data?",
    borrarTexto: "The draft and column templates will be removed from this browser. This can't be undone.",
    borrarConfirmar: "Delete",
    borrarCancelar: "Cancel",
    borrarHecho: "Data deleted from this browser.",
    borrarVacio: "There is no data saved in this browser.",
    borrarMas: "Learn more",
    borrarMasHref: "/legal-en#cookies",
    resultadoCorto: "Indicative result. Check it before adjusting your stock or making decisions.",
    resultadoLargoAntes:
      "Cuadra compares the data exactly as it appears in the files, matching the key exactly. Formatting errors, spaces, duplicate codes or wrongly selected columns can change the result. Check the differences before acting.",
    resultadoLargoEnlace: "Terms",
    resultadoLargoHref: "/legal-en#aviso-legal",
    bannerTitulo: "Analytics cookies",
    banner:
      'With your permission, we use Google Analytics to understand how many people use Cuadra and how, using cookies. Google may process this data outside the EU. Your files are never sent. You can change your choice at any time in "Cookie settings".',
    bannerPolitica: "Cookie policy",
    bannerPoliticaHref: "/legal-en#cookies",
    aceptar: "Accept",
    rechazar: "Reject",
    configurar: "Settings",
    panelTitulo: "Cookie settings",
    panelIntro: "Choose what you allow. You can change it at any time from the footer.",
    necesarias:
      "Necessary (always on): remember your cookie choice and, if you turn them on, keep the draft and templates in this browser.",
    analitica: "Analytics (Google Analytics 4): _ga and _ga_<ID> cookies to measure visits. Your files are never sent.",
    guardar: "Save",
    aceptarTodo: "Accept all",
    rechazarTodo: "Reject all",
    guardado: "Preferences saved.",
    retirado: "Analytics turned off. Its cookies have been deleted.",
  },
} as const

export function textosDe(idioma: Idioma) {
  return textos[idioma]
}
