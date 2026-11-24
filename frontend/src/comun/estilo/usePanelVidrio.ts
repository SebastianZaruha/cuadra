import { useRef } from "react"

import { useVidrioLiquido } from "@/comun/estilo/vidrio-liquido"

/**
 * Vidrio liso de Cuadra: data-vl="desenfoque", sin filtro SVG.
 * El mismo desenfoque en Chrome, Safari y Firefox. La distorsión del
 * módulo (hoja.ts) queda en el código portado y no se enciende.
 */
export function usePanelVidrio<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useVidrioLiquido(ref, { respaldo: "desenfoque", activo: false })
  return ref
}
