type Filho = Node | string | number | null | undefined | false;
type Atributos = Record<string, string | number | boolean | null | undefined | EventListener>;

const SVG = 'http://www.w3.org/2000/svg';

const aplicar = (el: Element, atributos: Atributos): void => {
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (typeof valor === 'function') {
      el.addEventListener(chave.slice(2).toLowerCase(), valor);
    } else if (chave === 'class') {
      el.setAttribute('class', String(valor));
    } else {
      el.setAttribute(chave, valor === true ? '' : String(valor));
    }
  }
};

const anexar = (el: Element, filhos: readonly Filho[]): void => {
  for (const filho of filhos) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(typeof filho === 'string' || typeof filho === 'number' ? document.createTextNode(String(filho)) : filho);
  }
};

export const h = <K extends keyof HTMLElementTagNameMap>(tag: K, atributos: Atributos = {}, ...filhos: Filho[]): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  aplicar(el, atributos);
  anexar(el, filhos);
  return el;
};

export const s = <K extends keyof SVGElementTagNameMap>(tag: K, atributos: Atributos = {}, ...filhos: Filho[]): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(SVG, tag);
  aplicar(el, atributos);
  anexar(el, filhos);
  return el;
};

export const trocar = (alvo: Element, ...filhos: Filho[]): void => {
  alvo.replaceChildren();
  anexar(alvo, filhos);
};
