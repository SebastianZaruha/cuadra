export type Preferencia = "claro" | "oscuro" | "sistema"

const CLAVE = "cuadra-tema"

export function preferenciaGuardada(): Preferencia {
  try {
    const valor = localStorage.getItem(CLAVE)
    if (valor === "claro" || valor === "oscuro" || valor === "sistema") return valor
  } catch {
    // Un navegador que bloquea el almacenamiento se queda en el sistema.
  }
  return "sistema"
}

export function temaEfectivo(preferencia: Preferencia): "claro" | "oscuro" {
  if (preferencia === "claro" || preferencia === "oscuro") return preferencia
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro"
}

export function aplicarTema(preferencia: Preferencia) {
  const tema = temaEfectivo(preferencia)
  document.documentElement.dataset.tema = tema
  document.documentElement.dataset.preferencia = preferencia
  document.documentElement.classList.toggle("dark", tema === "oscuro")
  try {
    localStorage.setItem(CLAVE, preferencia)
  } catch {
    // La preferencia vive al menos en esta pestaña.
  }
}
