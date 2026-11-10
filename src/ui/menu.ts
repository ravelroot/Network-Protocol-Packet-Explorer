import { h } from './dom';
import { icone } from './icones';

export interface ItemMenu {
  readonly rotulo: string;
  readonly cores?: readonly string[];
  readonly marcado?: boolean;
  readonly acao: () => void;
}

let fecharAberto: (() => void) | null = null;

const amostras = (cores: readonly string[]): HTMLElement => {
  const caixa = h('span', { class: 'amostras', 'aria-hidden': 'true' });
  for (const cor of cores) {
    const quadro = h('i', {});
    quadro.style.background = cor;
    caixa.append(quadro);
  }
  return caixa;
};

export const abrirMenu = (ancora: HTMLElement, itens: readonly ItemMenu[]): void => {
  const reabrindo = ancora.getAttribute('aria-expanded') === 'true';
  fecharAberto?.();
  if (reabrindo) return;

  const botoes = itens.map((item) =>
    h(
      'button',
      {
        class: 'menu-item',
        type: 'button',
        role: 'menuitemradio',
        'aria-checked': String(Boolean(item.marcado)),
        onclick: () => {
          fechar();
          item.acao();
          ancora.focus();
        },
      },
      h('span', { class: 'menu-marca' }, item.marcado ? icone('check', 'icone mini') : null),
      item.cores ? amostras(item.cores) : null,
      h('span', { class: 'crescer' }, item.rotulo),
    ),
  );
  const menu = h('div', { class: 'menu', role: 'menu' }, ...botoes);

  const foraDoMenu = (ev: PointerEvent): void => {
    const alvo = ev.target as Node | null;
    if (alvo && (menu.contains(alvo) || ancora.contains(alvo))) return;
    fechar();
  };

  const teclado = (ev: KeyboardEvent): void => {
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      fechar();
      ancora.focus();
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const passo = ev.key === 'ArrowDown' ? 1 : -1;
      botoes[(atual + passo + botoes.length) % botoes.length]?.focus();
    } else if (ev.key === 'Tab') {
      fechar();
    }
  };

  const fechar = (): void => {
    menu.remove();
    ancora.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', foraDoMenu, true);
    window.removeEventListener('resize', fechar);
    fecharAberto = null;
  };

  menu.addEventListener('keydown', teclado);
  document.body.append(menu);
  const caixa = ancora.getBoundingClientRect();
  const largura = menu.offsetWidth;
  menu.style.top = `${Math.round(caixa.bottom + 6)}px`;
  menu.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - largura - 8, caixa.right - largura)))}px`;
  ancora.setAttribute('aria-expanded', 'true');
  document.addEventListener('pointerdown', foraDoMenu, true);
  window.addEventListener('resize', fechar);
  fecharAberto = fechar;
  (botoes.find((b) => b.getAttribute('aria-checked') === 'true') ?? botoes[0])?.focus();
};
