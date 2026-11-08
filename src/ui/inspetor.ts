import { protocoloAtual, type Contexto } from '../app/contexto';
import { analiseDe, formatarTempo, linhaDoTempo } from '../app/linha-do-tempo';
import { tr, ui } from '../i18n/textos';
import type { CampoAnalisado } from '../rede/quadros';
import { noPorId } from '../rede/rotas';
import { h, trocar } from './dom';
import { icone } from './icones';

const imprimivel = (b: number): string => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.');

export const montarInspetor = (ctx: Contexto): { elemento: HTMLElement; atualizar: () => void } => {
  const { loja } = ctx;
  const raiz = h('div', { class: 'inspetor' });

  const atualizar = (): void => {
    const indice = loja.atual.inspecionado;
    if (indice === null) {
      trocar(raiz);
      return;
    }
    const p = protocoloAtual(ctx);
    const linha = linhaDoTempo(p);
    const entrada = linha.entradas[indice];
    if (!entrada) {
      trocar(raiz);
      return;
    }
    const pacote = entrada.pacote;
    const analise = analiseDe(p, indice);
    const total = analise.bytes.length;
    const cor = p.legenda[pacote.tipo]?.cor ?? 'neutra';
    const ultimoVisivel = Math.max(loja.atual.entregues - 1, indice);

    const bytesEl: HTMLSpanElement[] = [];
    const asciiEl: HTMLSpanElement[] = [];
    const linhasCampo: { campo: CampoAnalisado; el: HTMLElement }[] = [];

    const realcar = (inicio: number, fim: number, ligado: boolean): void => {
      for (let i = inicio; i < fim; i++) {
        bytesEl[i]?.classList.toggle('realce', ligado);
        asciiEl[i]?.classList.toggle('realce', ligado);
      }
    };

    const campos = h(
      'div',
      { class: 'insp-campos' },
      ...analise.camadas.map((camada, ic) =>
        h(
          'section',
          { class: `insp-camada cor-${camada.cor}`, 'data-ordem': ic },
          h('h4', {}, h('span', { class: 'insp-camada-nome' }, `${tr(camada.nome)} · ${camada.fim - camada.inicio} bytes`), h('span', { class: 'insp-camada-resumo' }, camada.resumo)),
          ...camada.campos.map((campo) => {
            const el = h(
              'div',
              {
                class: `insp-campo${campo.opaco ? ' opaco' : ''}`,
                tabindex: 0,
                onmouseenter: () => realcar(campo.inicio, campo.fim, true),
                onmouseleave: () => realcar(campo.inicio, campo.fim, false),
                onfocus: () => realcar(campo.inicio, campo.fim, true),
                onblur: () => realcar(campo.inicio, campo.fim, false),
              },
              h('span', { class: 'insp-campo-nome' }, tr(campo.nome)),
              h(
                'span',
                { class: 'insp-campo-valor' },
                h('span', { class: 'valor' }, tr(campo.valor)),
                campo.exemplo ? h('span', { class: 'selo-exemplo' }, ui('exemplo')) : null,
                campo.explicacao ? h('small', {}, tr(campo.explicacao)) : null,
              ),
            );
            linhasCampo.push({ campo, el });
            return el;
          }),
        ),
      ),
    );

    const camadaDe = (i: number): string => analise.camadas.find((c) => i >= c.inicio && i < c.fim)?.cor ?? 'neutra';
    const linhasHex: HTMLElement[] = [];
    for (let base = 0; base < total; base += 16) {
      const hexes: HTMLElement[] = [];
      const ascii: HTMLElement[] = [];
      for (let i = base; i < Math.min(base + 16, total); i++) {
        const b = analise.bytes[i] ?? 0;
        const opaco = analise.opacos.has(i);
        const campoDoByte = (): { campo: CampoAnalisado; el: HTMLElement } | undefined => linhasCampo.find((l) => i >= l.campo.inicio && i < l.campo.fim);
        const entrar = (): void => {
          const alvo = campoDoByte();
          if (!alvo) return;
          alvo.el.classList.add('realce');
          realcar(alvo.campo.inicio, alvo.campo.fim, true);
        };
        const sair = (): void => {
          const alvo = campoDoByte();
          if (!alvo) return;
          alvo.el.classList.remove('realce');
          realcar(alvo.campo.inicio, alvo.campo.fim, false);
        };
        const span = h('span', { class: `byte cor-${camadaDe(i)}${opaco ? ' opaco' : ''}`, onmouseenter: entrar, onmouseleave: sair }, opaco ? '··' : b.toString(16).padStart(2, '0'));
        const letra = h('span', { class: `letra${opaco ? ' opaco' : ''}` }, opaco ? '·' : imprimivel(b));
        span.style.animationDelay = `${Math.round((i / Math.max(1, total)) * 620)}ms`;
        bytesEl[i] = span;
        asciiEl[i] = letra;
        hexes.push(span);
        ascii.push(letra);
      }
      linhasHex.push(h('div', { class: 'hex-linha' }, h('span', { class: 'hex-offset' }, base.toString(16).padStart(4, '0')), h('span', { class: 'hex-bytes' }, ...hexes), h('span', { class: 'hex-ascii' }, ...ascii)));
    }

    const barra = h(
      'div',
      { class: 'insp-barra' },
      ...analise.camadas.map((c) => {
        const seg = h('div', { class: `insp-segmento cor-${c.cor}` }, h('span', { class: 'traco' }), h('b', {}, tr(c.nome)), h('small', {}, String(c.fim - c.inicio)));
        seg.style.flexGrow = String(Math.max(c.fim - c.inicio, 6));
        seg.style.animationDelay = `${analise.camadas.indexOf(c) * 90}ms`;
        return seg;
      }),
    );

    const origem = noPorId(p, pacote.de);
    const destino = noPorId(p, pacote.para);
    const ir = (i: number): void => loja.alterar({ inspecionado: i });
    for (const secao of campos.querySelectorAll<HTMLElement>('.insp-camada')) secao.style.animationDelay = `${Number(secao.dataset.ordem ?? 0) * 80}ms`;
    raiz.classList.remove('abrindo');
    void raiz.offsetWidth;
    raiz.classList.add('abrindo');
    trocar(
      raiz,
      h(
        'div',
        { class: 'insp-topo' },
        h('span', { class: `numero-pacote cor-${cor}` }, String(indice + 1)),
        h(
          'div',
          { class: 'insp-titulo' },
          h('b', {}, tr(pacote.rotulo)),
          h('small', {}, `${formatarTempo(entrada.tempo)} · ${analise.camadas.find((c) => c.nome === 'IPv4' || c.nome === 'IPv6')?.resumo ?? `${tr(origem.nome)} → ${tr(destino.nome)}`} · ${pacote.proto} · ${total} B`),
        ),
        h(
          'div',
          { class: 'insp-acoes' },
          h('button', { class: 'botao-icone', type: 'button', 'aria-label': ui('anterior'), title: ui('anterior'), disabled: indice === 0, onclick: () => ir(indice - 1) }, icone('esquerda')),
          h('button', { class: 'botao-icone', type: 'button', 'aria-label': ui('proximo'), title: ui('proximo'), disabled: indice >= ultimoVisivel, onclick: () => ir(indice + 1) }, icone('direita')),
          h('button', { class: 'botao-icone', type: 'button', 'aria-label': ui('fechar'), title: ui('fechar'), onclick: () => loja.alterar({ inspecionado: null }) }, icone('fechar')),
        ),
      ),
      h('p', { class: 'insp-visto' }, tr(analise.visto)),
      barra,
      h('div', { class: 'insp-corpo' }, campos, h('div', { class: 'insp-bytes' }, h('h4', {}, ui('bytes'), h('span', {}, ui('nesteQuadro', { n: total }))), h('div', { class: 'hex' }, ...linhasHex))),
      h('div', { class: 'insp-rodape' }, h('span', {}, h('span', { class: 'selo-exemplo' }, ui('exemplo')), ' ', ui('legendaExemplo')), h('span', {}, h('span', { class: 'pontinhos' }, '··'), ' ', ui('legendaOpaco'))),
    );
  };

  loja.assinar((e, a) => {
    if (e.inspecionado !== a.inspecionado || e.idioma !== a.idioma || e.protocoloId !== a.protocoloId) atualizar();
  });
  atualizar();
  return { elemento: raiz, atualizar };
};
