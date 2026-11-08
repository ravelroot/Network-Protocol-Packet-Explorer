import type { Contexto } from '../app/contexto';
import { PROTOCOLOS } from '../dados/protocolos';
import type { Categoria, Protocolo } from '../dados/tipos';
import { nomeCamada, nomeCategoria, tr, ui } from '../i18n/textos';
import { h, trocar } from './dom';
import { icone } from './icones';

const FILTROS: readonly (Categoria | 'todos')[] = ['todos', 'core', 'aplicacao', 'seguranca'];

export const visiveis = (filtro: Categoria | 'todos', camada: number | null): Protocolo[] =>
  PROTOCOLOS.filter((p) => (filtro === 'todos' || p.categoria === filtro) && (camada === null || p.camada === camada));

export const montarLista = (ctx: Contexto): HTMLElement => {
  const { loja, reprodutor } = ctx;
  const titulo = h('h2', { class: 'titulo-secao' });
  const abas = h('div', { class: 'abas', role: 'tablist' });
  const aviso = h('div', { class: 'filtro-camada' });
  const lista = h('ul', { class: 'protocolos' });
  const caixa = h('aside', { class: 'lista caixa', 'aria-label': 'protocolos' }, titulo, abas, aviso, lista);

  const desenharAbas = (): void => {
    const e = loja.atual;
    trocar(
      abas,
      ...FILTROS.map((f) => {
        const total = PROTOCOLOS.filter((p) => f === 'todos' || p.categoria === f).length;
        return h(
          'button',
          {
            class: 'aba',
            type: 'button',
            role: 'tab',
            'aria-selected': String(e.filtro === f),
            onclick: () => loja.alterar({ filtro: f }),
          },
          nomeCategoria(f),
          h('span', { class: 'contador' }, String(total)),
        );
      }),
    );
  };

  const desenharAviso = (): void => {
    const { camada } = loja.atual;
    aviso.hidden = camada === null;
    if (camada === null) return;
    trocar(
      aviso,
      h('span', {}, `${ui('filtroCamada', { n: camada })} · ${nomeCamada(camada as 1 | 2 | 3 | 4 | 5 | 6 | 7)}`),
      h('button', { class: 'botao-icone pequeno', type: 'button', 'aria-label': ui('limparFiltro'), title: ui('limparFiltro'), onclick: () => loja.alterar({ camada: null }) }, icone('fechar')),
    );
  };

  const desenharLista = (abrir = false): void => {
    const e = loja.atual;
    const itens = visiveis(e.filtro, e.camada);
    if (itens.length === 0) {
      trocar(lista, h('li', { class: 'vazio' }, ui('semProtocolosCamada')));
      return;
    }
    trocar(
      lista,
      ...itens.map((p) => {
        const ativo = p.id === e.protocoloId;
        const aberto = ativo && e.expandido;
        const estadoPonto = ativo && e.tocando ? 'tocando' : ativo && e.passo >= p.passos.length - 1 && e.entregues > 0 && !e.tocando ? 'concluido' : '';
        const botao = h(
          'button',
          {
            class: `protocolo${ativo ? ' ativo' : ''}`,
            type: 'button',
            'aria-expanded': String(aberto),
            'data-id': p.id,
            onclick: () => {
              reprodutor.selecionar(p.id);
              history.replaceState(null, '', `#/${p.id}`);
            },
          },
          h('span', { class: `ponto ${estadoPonto}` }),
          h('span', { class: 'protocolo-texto' }, h('b', {}, p.sigla), h('small', {}, tr(p.resumo))),
          icone(aberto ? 'baixo' : 'direita', 'icone seta'),
        );
        const passos = aberto
          ? h(
              'ol',
              { class: `passos${abrir ? ' abrindo' : ''}` },
              ...p.passos.map((passo, i) => {
                const estado = i < e.passo ? 'feito' : i === e.passo ? 'atual' : '';
                return h(
                  'li',
                  {},
                  h(
                    'button',
                    { class: `passo ${estado}`, type: 'button', onclick: () => reprodutor.irParaPasso(i) },
                    h('span', { class: 'numero' }, estado === 'feito' ? icone('check', 'icone mini') : String(i + 1)),
                    h('span', { class: 'passo-texto' }, h('b', {}, tr(passo.titulo)), h('small', {}, tr(passo.resumo))),
                  ),
                );
              }),
            )
          : null;
        return h('li', {}, botao, passos);
      }),
    );
  };

  const tudo = (): void => {
    titulo.textContent = ui('protocolosInternet');
    desenharAbas();
    desenharAviso();
    desenharLista();
  };

  tudo();
  loja.assinar((e, a) => {
    if (e.idioma !== a.idioma || e.filtro !== a.filtro || e.camada !== a.camada) {
      tudo();
      return;
    }
    const ultimo = (visiveis('todos', null).find((p) => p.id === e.protocoloId)?.passos.length ?? 0) - 1;
    const mudouFim = e.entregues !== a.entregues && (e.passo === ultimo || a.passo === ultimo);
    if (e.protocoloId !== a.protocoloId || e.expandido !== a.expandido || e.passo !== a.passo || e.tocando !== a.tocando || mudouFim) {
      desenharLista(e.protocoloId !== a.protocoloId || e.expandido !== a.expandido);
      if (e.protocoloId !== a.protocoloId) lista.querySelector<HTMLElement>('.protocolo.ativo')?.scrollIntoView({ block: 'nearest' });
    }
  });
  return caixa;
};
