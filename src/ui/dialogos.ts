import type { Contexto } from '../app/contexto';
import { PROTOCOLOS } from '../dados/protocolos';
import type { Protocolo } from '../dados/tipos';
import { nomeCategoria, tr, ui, type ChaveTexto } from '../i18n/textos';
import { h, trocar } from './dom';
import { icone } from './icones';

const normalizar = (v: string): string => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const corresponde = (p: Protocolo, termo: string): boolean => {
  if (!termo) return true;
  const alvo = normalizar([p.sigla, p.id, p.nome.pt, p.nome.en, p.resumo.pt, p.resumo.en].join(' '));
  return normalizar(termo)
    .split(/\s+/)
    .filter(Boolean)
    .every((parte) => alvo.includes(parte));
};

export const montarBusca = (ctx: Contexto): HTMLDialogElement => {
  const { loja, reprodutor } = ctx;
  const campo = h('input', { class: 'busca-campo', type: 'search', autocomplete: 'off', spellcheck: 'false' });
  const resultados = h('ul', { class: 'busca-resultados', role: 'listbox' });
  const rodape = h('div', { class: 'busca-rodape' });
  const dialogo = h('dialog', { class: 'dialogo busca' }, h('div', { class: 'busca-topo' }, icone('busca'), campo, h('kbd', {}, 'Esc')), resultados, rodape);
  let selecionado = 0;
  let encontrados: Protocolo[] = [];

  const abrir = (p: Protocolo): void => {
    loja.alterar({ busca: false });
    reprodutor.selecionar(p.id);
    if (!loja.atual.expandido) loja.alterar({ expandido: true });
    history.replaceState(null, '', `#/${p.id}`);
  };

  const desenhar = (): void => {
    encontrados = PROTOCOLOS.filter((p) => corresponde(p, campo.value));
    selecionado = Math.min(selecionado, Math.max(0, encontrados.length - 1));
    if (encontrados.length === 0) {
      trocar(resultados, h('li', { class: 'vazio' }, ui('nenhumResultado')));
      return;
    }
    trocar(
      resultados,
      ...encontrados.map((p, i) =>
        h(
          'li',
          { role: 'option', 'aria-selected': String(i === selecionado) },
          h(
            'button',
            { type: 'button', onclick: () => abrir(p), onmousemove: () => { if (selecionado !== i) { selecionado = i; desenhar(); } } },
            h('b', {}, p.sigla),
            h('span', {}, tr(p.resumo)),
            h('small', {}, nomeCategoria(p.categoria)),
          ),
        ),
      ),
    );
    resultados.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };

  campo.addEventListener('input', () => {
    selecionado = 0;
    desenhar();
  });
  campo.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      selecionado = Math.min(encontrados.length - 1, selecionado + 1);
      desenhar();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      selecionado = Math.max(0, selecionado - 1);
      desenhar();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const alvo = encontrados[selecionado];
      if (alvo) abrir(alvo);
    }
  });
  dialogo.addEventListener('close', () => loja.alterar({ busca: false }));
  dialogo.addEventListener('click', (ev) => {
    if (ev.target === dialogo) loja.alterar({ busca: false });
  });

  const sincronizar = (): void => {
    campo.placeholder = ui('buscar');
    campo.setAttribute('aria-label', ui('buscar'));
    trocar(rodape, h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), ' ', ui('navegar')), h('span', {}, h('kbd', {}, 'Enter'), ' ', ui('abrir')));
    if (loja.atual.busca && !dialogo.open) {
      campo.value = '';
      selecionado = 0;
      desenhar();
      dialogo.showModal();
      campo.focus();
    } else if (!loja.atual.busca && dialogo.open) {
      dialogo.close();
    }
  };
  loja.assinar((e, a) => {
    if (e.busca !== a.busca || e.idioma !== a.idioma) sincronizar();
  });
  sincronizar();
  return dialogo;
};

const ATALHOS: readonly (readonly [readonly string[], ChaveTexto])[] = [
  [['Espaço'], 'atalhoTocar'],
  [['→'], 'atalhoPasso'],
  [['←'], 'atalhoVoltar'],
  [['R'], 'atalhoReiniciar'],
  [['−', '+'], 'atalhoVelocidade'],
  [['V'], 'atalhoVista'],
  [['↑', '↓'], 'atalhoProtocolo'],
  [['Ctrl', 'K'], 'atalhoBuscar'],
  [['[', ']'], 'atalhoPaineis'],
  [['F'], 'atalhoFoco'],
  [['T'], 'atalhoTema'],
  [['C'], 'atalhoPaleta'],
  [['L'], 'atalhoIdioma'],
  [['Esc'], 'atalhoFechar'],
  [['?'], 'atalhoAjuda'],
];

export const montarAjuda = (ctx: Contexto): HTMLDialogElement => {
  const { loja } = ctx;
  const titulo = h('h2', { class: 'titulo-secao' });
  const fechar = h('button', { class: 'botao-icone', type: 'button', onclick: () => loja.alterar({ ajuda: false }) }, icone('fechar'));
  const lista = h('dl', { class: 'atalhos' });
  const dialogo = h('dialog', { class: 'dialogo ajuda' }, h('div', { class: 'ajuda-topo' }, titulo, fechar), lista);
  dialogo.addEventListener('close', () => loja.alterar({ ajuda: false }));
  dialogo.addEventListener('click', (ev) => {
    if (ev.target === dialogo) loja.alterar({ ajuda: false });
  });
  const sincronizar = (): void => {
    titulo.textContent = ui('atalhos');
    fechar.setAttribute('aria-label', ui('fechar'));
    const espaco = loja.atual.idioma === 'pt' ? 'Espaço' : 'Space';
    trocar(lista, ...ATALHOS.flatMap(([teclas, chave]) => [h('dt', {}, ...teclas.map((t) => h('kbd', {}, t === 'Espaço' ? espaco : t))), h('dd', {}, ui(chave))]));
    if (loja.atual.ajuda && !dialogo.open) dialogo.showModal();
    else if (!loja.atual.ajuda && dialogo.open) dialogo.close();
  };
  loja.assinar((e, a) => {
    if (e.ajuda !== a.ajuda || e.idioma !== a.idioma) sincronizar();
  });
  sincronizar();
  return dialogo;
};
