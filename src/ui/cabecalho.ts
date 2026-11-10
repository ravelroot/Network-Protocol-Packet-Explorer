import { nomePaleta, PALETA_PADRAO, PALETAS } from '../app/aparencia';
import { protocoloAtual, type Contexto } from '../app/contexto';
import type { Camada } from '../dados/tipos';
import { nomeCamada, ui } from '../i18n/textos';
import { MARCA } from '../marca';
import { h, trocar } from './dom';
import { icone, logotipo } from './icones';
import { abrirMenu } from './menu';

const CAMADAS: readonly Camada[] = [1, 2, 3, 4, 5, 6, 7];

export const montarCabecalho = (ctx: Contexto): HTMLElement => {
  const { loja } = ctx;
  const nomeOsi = h('span', { class: 'osi-nome' });
  const rotuloOsi = h('span', { class: 'rotulo' });
  const botoesOsi = CAMADAS.map((c) =>
    h('button', {
      class: 'osi-botao',
      type: 'button',
      'data-camada': c,
      onclick: () => loja.alterar({ camada: loja.atual.camada === c ? null : c }),
    }, String(c)),
  );
  const textoBusca = h('span', { class: 'busca-texto' });
  const gatilhoBusca = h('button', { class: 'busca-gatilho', type: 'button', onclick: () => loja.alterar({ busca: true }) }, icone('busca'), textoBusca, h('kbd', {}, 'Ctrl K'));
  const alternadores = {
    lista: h('button', { class: 'botao-icone', type: 'button', onclick: () => loja.alterar({ lista: !loja.atual.lista, foco: false }) }, icone('painelEsquerdo')),
    fluxo: h('button', { class: 'botao-icone', type: 'button', onclick: () => loja.alterar({ fluxo: !loja.atual.fluxo, foco: false }) }, icone('painelInferior')),
    foco: h('button', { class: 'botao-icone', type: 'button', onclick: () => loja.alterar({ foco: !loja.atual.foco }) }, icone('foco')),
    ajuda: h('button', { class: 'botao-icone', type: 'button', onclick: () => loja.alterar({ ajuda: true }) }, icone('teclado')),
  };
  const credito = h('a', { class: 'credito', href: MARCA.repositorio, target: '_blank', rel: 'noopener noreferrer' }, h('span', { class: 'credito-nome' }, icone('github'), MARCA.autor));
  const siglaIdioma = h('span', {});
  const idioma = h('button', { class: 'idioma', type: 'button', onclick: () => loja.alterar({ idioma: loja.atual.idioma === 'pt' ? 'en' : 'pt' }) }, icone('globo'), siglaIdioma);
  const tema = h('button', { class: 'botao-icone tema', type: 'button', onclick: () => loja.alterar({ tema: loja.atual.tema === 'escuro' ? 'claro' : 'escuro' }) });
  const paleta = h('button', { class: 'botao-icone paleta', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icone('paleta'));
  paleta.addEventListener('click', () =>
    abrirMenu(
      paleta,
      PALETAS.map((p) => ({
        rotulo: ui(p.id === PALETA_PADRAO ? 'paletaPadrao' : 'paletaNome', { nome: p.nome }),
        cores: p.cores,
        marcado: loja.atual.paleta === p.id,
        acao: () => loja.alterar({ paleta: p.id }),
      })),
    ),
  );
  const slogan = h('small', { class: 'marca-slogan' });

  const cabecalho = h(
    'header',
    { class: 'cabecalho' },
    h('a', { class: 'marca', href: '#/' + loja.atual.protocoloId }, h('span', { class: 'marca-quadro' }, logotipo()), h('span', { class: 'marca-texto' }, h('strong', { class: 'marca-nome' }, MARCA.nome), slogan)),
    h('div', { class: 'espaco' }),
    h('div', { class: 'osi' }, h('div', { class: 'osi-topo' }, rotuloOsi, nomeOsi), h('div', { class: 'osi-botoes', role: 'group' }, ...botoesOsi)),
    h('div', { class: 'espaco' }),
    gatilhoBusca,
    h('div', { class: 'grupo-icones' }, alternadores.lista, alternadores.fluxo, alternadores.foco, alternadores.ajuda),
    credito,
    idioma,
    paleta,
    tema,
  );

  const atualizar = (): void => {
    const e = loja.atual;
    const p = protocoloAtual(ctx);
    rotuloOsi.textContent = ui('camadaOsi');
    nomeOsi.textContent = nomeCamada(p.camada);
    slogan.textContent = ui('slogan');
    textoBusca.textContent = ui('buscar');
    credito.title = `${ui('codigoFonte')} · GitHub`;
    credito.setAttribute('aria-label', `${ui('codigoFonte')}: ${MARCA.autor}`);
    siglaIdioma.textContent = e.idioma === 'pt' ? 'PT' : 'EN';
    idioma.setAttribute('aria-label', ui('idioma'));
    for (const b of botoesOsi) {
      const c = Number(b.dataset.camada) as Camada;
      b.classList.toggle('atual', c === p.camada);
      b.classList.toggle('filtrando', c === e.camada);
      b.setAttribute('aria-pressed', String(c === e.camada));
      b.title = `${ui('filtrarCamada', { n: c })} · ${nomeCamada(c)}`;
    }
    const estados: Record<keyof typeof alternadores, [boolean, string]> = {
      lista: [e.lista && !e.foco, ui('alternarLista')],
      fluxo: [e.fluxo && !e.foco, ui('alternarFluxo')],
      foco: [e.foco, ui('modoFoco')],
      ajuda: [e.ajuda, ui('atalhos')],
    };
    for (const [chave, [ativo, rotulo]] of Object.entries(estados) as [keyof typeof alternadores, [boolean, string]][]) {
      alternadores[chave].setAttribute('aria-pressed', String(ativo));
      alternadores[chave].setAttribute('aria-label', rotulo);
      alternadores[chave].title = rotulo;
    }
    trocar(tema, icone(e.tema === 'escuro' ? 'sol' : 'lua'));
    tema.setAttribute('aria-label', ui('tema'));
    tema.title = ui('tema');
    paleta.setAttribute('aria-label', ui('paleta'));
    paleta.title = `${ui('paleta')} · ${nomePaleta(e.paleta)}`;
    for (const b of botoesOsi) b.setAttribute('aria-label', b.title);
    botoesOsi[0]?.parentElement?.setAttribute('aria-label', ui('camadaOsi'));
  };

  atualizar();
  loja.assinar((e, a) => {
    if (e.idioma !== a.idioma || e.protocoloId !== a.protocoloId || e.camada !== a.camada || e.tema !== a.tema || e.paleta !== a.paleta || e.lista !== a.lista || e.fluxo !== a.fluxo || e.foco !== a.foco || e.ajuda !== a.ajuda) {
      atualizar();
    }
  });
  return cabecalho;
};
