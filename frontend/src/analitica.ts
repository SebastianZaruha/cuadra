/**
 * GA4 queda apagado. El banner solo aparece si se rellena un identificador
 * de medición. Hasta entonces no se inserta ningún script.
 */
export const MEDICION_GA4 = ""

export function analiticaPreparada(): boolean {
  return MEDICION_GA4.length > 0
}
