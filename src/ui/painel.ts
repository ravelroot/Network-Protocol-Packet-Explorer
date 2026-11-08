import { protocoloAtual, type Contexto } from '../app/contexto';
import { analiseDe, linhaDoTempo } from '../app/linha-do-tempo';
import type { Fato } from '../dados/tipos';
import { nomeCategoria, tr, ui } from '../i18n/textos';
import { noPorId } from '../rede/rotas';
import { h, trocar } from './dom';
import { icone } from './icones';

const tabela = (fatos: readonly Fato[]): HTMLElement =>
  h('dl', { class: 'fatos' }, ...fatos.flatMap(([rotulo, valor]) => [h('dt', {}, tr(rotulo)), h('dd', {}, tr(valor))]));

export const montarPainel = (ctx: Contexto): HTMLElement => {
  const { loja } = ctx;
  const titulo = h('h2', { class: 'titulo-secao' });
  const voltar = h('button', { class: 'botao-texto', type: 'button', onclick: () => loja.alterar({ painel: 'visao' }) });
  const corpo = h('div', { class: 'painel-corpo' });
  const painel = h('aside', { class: 'painel caixa' }, h('div', { class: 'painel-topo' }, titulo, voltar), corpo);

  let chaveAnterior = '';
  let cartaoAnterior = -1;
  const animar = (chave: string): void => {
    if (chave === chaveAnterior) return;
    chaveAnterior = chave;
    corpo.classList.remove('animar');
    void corpo.offsetWidth;
    corpo.classList.add('animar');
    corpo.scrollTop = 0;
  };

  const atualizar = (): void => {
    const e = loja.atual;
    const p = protocoloAtual(ctx);
    const passo = e.passo >= 0 ? p.passos[e.passo] : undefined;
    const modoPasso = e.painel === 'passo' && passo !== undefined;
    titulo.textContent = modoPasso ? ui('detalhesPasso') : ui('visaoGeral');
    voltar.hidden = !modoPasso;
    trocar(voltar, icone('esquerda'), ui('voltarVisao'));

    if (!modoPasso || !passo) {
      trocar(
        corpo,
        h('div', { class: 'painel-cabeca' }, h('h3', { class: 'painel-sigla' }, p.sigla), h('span', { class: `selo-categoria cat-${p.categoria}` }, h('span', { class: 'ponto' }), nomeCategoria(p.categoria))),
        h('p', { class: 'painel-nome' }, tr(p.nome)),
        h('p', { class: 'painel-descricao' }, tr(p.descricao)),
        tabela(p.fatos),
      );
      animar(`${p.id}:visao:${e.idioma}`);
      return;
    }

    const linha = linhaDoTempo(p);
    const doPasso = linha.entradas.filter((en) => en.passo === e.passo);
    const visiveis = doPasso.filter((en) => en.indice < e.entregues || en.indice === e.emVoo);
    const foco = visiveis[visiveis.length - 1];
    const cartao = foco
      ? (() => {
          const pacote = foco.pacote;
          const cor = p.legenda[pacote.tipo]?.cor ?? 'neutra';
          const tamanho = analiseDe(p, foco.indice).bytes.length;
          const novo = foco.indice !== cartaoAnterior;
          cartaoAnterior = foco.indice;
          return h(
            'button',
            { class: `cartao-pacote cor-${cor}${novo ? ' novo' : ''}`, type: 'button', onclick: () => loja.alterar({ inspecionado: foco.indice }) },
            h('span', { class: 'cartao-topo' }, h('span', { class: 'chip' }, tr(pacote.rotulo)), h('span', { class: 'rota' }, `${tr(noPorId(p, pacote.de).nome)} → ${tr(noPorId(p, pacote.para).nome)}`)),
            pacote.resumo ? h('span', { class: 'cartao-resumo' }, tr(pacote.resumo)) : null,
            h('span', { class: 'cartao-meta' }, `${ui('pacoteDe', { a: foco.indice + 1, b: linha.entradas.length })} · ${pacote.proto} · ${tamanho} B`),
          );
        })()
      : doPasso.length === 0
        ? h('p', { class: 'cartao-vazio' }, ui('semPacotesPasso'))
        : null;

    trocar(
      corpo,
      h('p', { class: 'painel-passo' }, ui('passoDe', { a: e.passo + 1, b: p.passos.length })),
      h('h3', { class: 'painel-titulo-passo' }, tr(passo.titulo)),
      h('p', { class: 'painel-nome' }, tr(passo.resumo)),
      h('p', { class: 'painel-descricao' }, tr(passo.descricao)),
      cartao,
      passo.fatos ? tabela(passo.fatos) : null,
    );
    animar(`${p.id}:passo:${e.passo}:${e.idioma}`);
  };

  loja.assinar((e, a) => {
    if (e.protocoloId !== a.protocoloId || e.idioma !== a.idioma || e.passo !== a.passo || e.painel !== a.painel || e.entregues !== a.entregues || e.emVoo !== a.emVoo) atualizar();
  });
  atualizar();
  return painel;
};
