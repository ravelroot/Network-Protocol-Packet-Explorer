import { protocoloAtual, type Contexto } from '../app/contexto';
import { VELOCIDADES_DISPONIVEIS } from '../app/estado';
import { analiseDe, formatarTempo, linhaDoTempo } from '../app/linha-do-tempo';
import { tr, ui } from '../i18n/textos';
import { h, trocar } from './dom';
import { icone } from './icones';

export const montarFluxo = (ctx: Contexto): HTMLElement => {
  const { loja, reprodutor } = ctx;
  const titulo = h('h2', { class: 'titulo-secao' });
  const legenda = h('div', { class: 'legenda' });
  const rotuloVelocidade = h('span', { class: 'velocidade-rotulo' });
  const botoesVelocidade = VELOCIDADES_DISPONIVEIS.map((v) =>
    h('button', { class: 'velocidade-opcao', type: 'button', role: 'radio', 'data-valor': v, onclick: () => loja.alterar({ velocidade: v }) }, `${String(v).replace('.', ',')}×`),
  );
  const velocidade = h('div', { class: 'velocidade', role: 'radiogroup' }, rotuloVelocidade, ...botoesVelocidade);
  const voltar = h('button', { class: 'botao-icone', type: 'button', onclick: () => reprodutor.voltarPasso() }, icone('esquerda'));
  const tocar = h('button', { class: 'botao-primario', type: 'button', onclick: () => reprodutor.alternar() });
  const passo = h('button', { class: 'botao-texto', type: 'button', onclick: () => reprodutor.avancarPasso() });
  const reiniciar = h('button', { class: 'botao-texto', type: 'button', onclick: () => reprodutor.reiniciar() });
  const cabecalhoTabela = h('tr', {});
  const corpoTabela = h('tbody', {});
  const rolagem = h('div', { class: 'fluxo-rolagem' }, h('table', { class: 'tabela-pacotes' }, h('thead', {}, cabecalhoTabela), corpoTabela));
  const fluxo = h(
    'section',
    { class: 'fluxo caixa' },
    h('div', { class: 'fluxo-topo' }, titulo, legenda, h('div', { class: 'controles' }, velocidade, voltar, tocar, passo, reiniciar)),
    rolagem,
  );

  const desenharControles = (): void => {
    const e = loja.atual;
    rotuloVelocidade.textContent = ui('velocidade');
    velocidade.setAttribute('aria-label', ui('velocidade'));
    velocidade.title = ui('atalhoVelocidade');
    for (const b of botoesVelocidade) {
      const ativo = Number(b.dataset.valor) === e.velocidade;
      b.setAttribute('aria-checked', String(ativo));
      b.classList.toggle('ativo', ativo);
    }
    voltar.setAttribute('aria-label', ui('voltar'));
    voltar.title = ui('voltar');
    trocar(tocar, icone(e.tocando ? 'pausar' : 'tocar'), e.tocando ? ui('pausar') : ui('tocar'));
    tocar.setAttribute('aria-pressed', String(e.tocando));
    trocar(passo, ui('passo'));
    trocar(reiniciar, icone('reiniciar'), ui('reiniciar'));
  };

  const desenharTopo = (): void => {
    const p = protocoloAtual(ctx);
    titulo.textContent = ui('fluxo');
    trocar(
      legenda,
      ...Object.values(p.legenda).map((item) => h('span', { class: `item-legenda cor-${item.cor}` }, h('span', { class: 'ponto' }), tr(item.nome))),
      p.observacao ? h('em', { class: 'observacao' }, tr(p.observacao)) : null,
    );
    trocar(cabecalhoTabela, ...(['colNo', 'colTempo', 'colOrigem', 'colDestino', 'colProtocolo', 'colInfo', 'colTamanho'] as const).map((c) => h('th', { scope: 'col' }, ui(c))));
  };

  let mostrados = 0;
  let protocoloMostrado = '';
  const desenharLinhas = (): void => {
    const e = loja.atual;
    const p = protocoloAtual(ctx);
    const linha = linhaDoTempo(p);
    const visiveis = linha.entradas.filter((en) => en.indice < e.entregues || en.indice === e.emVoo);
    if (protocoloMostrado !== p.id || visiveis.length < mostrados) mostrados = 0;
    const limiteNovas = mostrados;
    protocoloMostrado = p.id;
    mostrados = visiveis.length;
    if (visiveis.length === 0) {
      trocar(corpoTabela, h('tr', { class: 'vazio' }, h('td', { colspan: 7 }, ui('semPacotes'))));
      return;
    }
    trocar(
      corpoTabela,
      ...visiveis.map((en) => {
        const pacote = en.pacote;
        const analise = analiseDe(p, en.indice);
        const rede = analise.camadas.find((c) => c.nome === 'IPv4' || c.nome === 'IPv6' || c.nome === 'ARP');
        const enlace = analise.camadas[0];
        const [origem, destino] = (rede ?? enlace)?.resumo.split(' → ') ?? ['', ''];
        const cor = p.legenda[pacote.tipo]?.cor ?? 'neutra';
        const abrir = (): void => loja.alterar({ inspecionado: en.indice });
        return h(
          'tr',
          {
            class: `${en.indice === e.inspecionado ? 'selecionada' : ''}${pacote.perdido ? ' perdida' : ''}${en.indice === e.emVoo ? ' em-voo' : ''}${visiveis.indexOf(en) >= limiteNovas ? ' nova' : ''}`,
            tabindex: 0,
            onclick: abrir,
            onkeydown: (ev: Event) => {
              const k = (ev as KeyboardEvent).key;
              if (k === 'Enter' || k === ' ') {
                ev.preventDefault();
                abrir();
              }
            },
          },
          h('td', {}, h('span', { class: `numero-pacote cor-${cor}` }, String(en.indice + 1))),
          h('td', {}, formatarTempo(en.tempo)),
          h('td', {}, origem ?? ''),
          h('td', {}, destino ?? ''),
          h('td', {}, pacote.proto),
          h('td', { class: 'info' }, tr(pacote.info), pacote.perdido ? h('span', { class: 'selo-perdido' }, ui('perdido')) : null),
          h('td', {}, `${analise.bytes.length} B`),
        );
      }),
    );
    const alvo = corpoTabela.querySelector<HTMLElement>('tr.em-voo') ?? corpoTabela.lastElementChild;
    if (alvo instanceof HTMLElement && e.tocando) alvo.scrollIntoView({ block: 'nearest' });
  };

  desenharTopo();
  desenharControles();
  desenharLinhas();
  loja.assinar((e, a) => {
    if (e.protocoloId !== a.protocoloId || e.idioma !== a.idioma) {
      desenharTopo();
      desenharControles();
      desenharLinhas();
      return;
    }
    if (e.tocando !== a.tocando || e.velocidade !== a.velocidade) desenharControles();
    if (e.entregues !== a.entregues || e.emVoo !== a.emVoo || e.inspecionado !== a.inspecionado) desenharLinhas();
  });
  return fluxo;
};
