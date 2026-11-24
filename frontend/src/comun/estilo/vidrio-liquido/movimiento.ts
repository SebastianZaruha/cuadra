/**
 * Marca data-vl-mov en el elemento mientras tiene una transición o animación propia en curso
 * (la hoja entrando o saliendo). El CSS quita entonces el filtro SVG, que es lo caro,
 * y deja solo el desenfoque. Devuelve la limpieza.
 */
export function vigilarMovimiento(el: HTMLElement): () => void {
  const enCurso = new Set<string>();
  const clave = (e: Event) =>
    e instanceof TransitionEvent ? `t:${e.propertyName}` : `a:${(e as AnimationEvent).animationName}`;
  const marcar = () => {
    if (enCurso.size) el.dataset.vlMov = '';
    else delete el.dataset.vlMov;
  };
  const empieza = (e: Event) => {
    if (e.target !== el) return;
    enCurso.add(clave(e));
    marcar();
  };
  const acaba = (e: Event) => {
    if (e.target !== el) return;
    enCurso.delete(clave(e));
    marcar();
  };
  const tipos: [string, (e: Event) => void][] = [
    ['transitionrun', empieza], ['transitionend', acaba], ['transitioncancel', acaba],
    ['animationstart', empieza], ['animationend', acaba], ['animationcancel', acaba],
  ];
  for (const [t, f] of tipos) el.addEventListener(t, f);
  return () => {
    for (const [t, f] of tipos) el.removeEventListener(t, f);
    delete el.dataset.vlMov;
  };
}
