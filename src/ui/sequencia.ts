import { protocoloAtual, type Contexto } from '../app/contexto';
import { formatarTempo, linhaDoTempo, type Entrada } from '../app/linha-do-tempo';
import type { Protocolo } from '../dados/tipos';
import { tr, ui } from '../i18n/textos';
import { noPorId } from '../rede/rotas';
import { desenharDispositivo } from './dispositivos';
import { h, s, trocar } from './dom';
import { reduzMovimento, suave } from './movimento';

const L = 1000;
const MARGEM = 170;
const TOPO = 112;
const ALTURA_PACOTE = 42;
const QUEDA = 24;

interface Layout {
  readonly faixas: readonly string[];
  readonly x: ReadonlyMap<string, number>;
  readonly yPasso: readonly number[];
  readonly yPacote: readonly number[];
  readonly altura: number;
}

const calcular = (p: Protocolo): Layout => {
  const faixas = p.faixas ?? p.nos.map((n) => n.id);
  const passo = faixas.length > 1 ? (L - 100 - (MARGEM + 50)) / (faixas.length - 1) : 0;
  const x = new Map(faixas.map((id, i) => [id, faixas.length > 1 ? MARGEM + 50 + i * passo : (MARGEM + L) / 2] as const));
  const yPasso: number[] = [];
  const yPacote: number[] = [];
  let y = TOPO + 10;
  p.passos.forEach((ps) => {
    yPasso.push(y);
    y += 30;
    for (let i = 0; i < ps.pacotes.length; i++) {
      yPacote.push(y);
      y += ALTURA_PACOTE;
    }
    if (ps.pacotes.length === 0) y += 14;
    y += 8;
  });
  return { faixas, x, yPasso, yPacote, altura: y + 16 };
};

export const montarSequencia = (ctx: Contexto): { elemento: HTMLElement; atualizar: () => void } => {
  const { loja, reprodutor } = ctx;
  const cabecalhos = s('g', { class: 'seq-cabecalhos' });
  const fundo = s('g', { class: 'seq-fundo' });
  const entregues = s('g', { class: 'seq-pacotes' });
  const emVoo = s('g', { class: 'seq-voo' });
  const efeitos = s('g', { class: 'seq-efeitos', 'aria-hidden': 'true' });
  const svg = s('svg', { class: 'sequencia', viewBox: `0 ${TOPO} ${L} 400`, role: 'img' }, fundo, entregues, emVoo, efeitos);
  const svgCabecalho = s('svg', { class: 'sequencia-cabecalho', viewBox: `0 0 ${L} ${TOPO}`, 'aria-hidden': 'true' }, cabecalhos);
  let ultimoAnel = -1;
  const rolagem = h('div', { class: 'sequencia-rolagem' }, h('div', { class: 'sequencia-topo' }, svgCabecalho), svg);

  let layout: Layout | null = null;
  let desenhadoPara = '';

  const seta = (p: Protocolo, l: Layout, entrada: Entrada, fracao: number): SVGGElement => {
    const pacote = entrada.pacote;
    const x1 = l.x.get(pacote.de) ?? 0;
    const x2 = l.x.get(pacote.para) ?? 0;
    const y1 = l.yPacote[entrada.indice] ?? 0;
    const y2 = y1 + QUEDA;
    const limite = pacote.perdido ? 0.55 : 1;
    const f = Math.min(suave(Math.min(fracao, 1)), limite);
    const xf = x1 + (x2 - x1) * f;
    const yf = y1 + (y2 - y1) * f;
    const cor = p.legenda[pacote.tipo]?.cor ?? 'neutra';
    const g = s('g', { class: `seq-seta cor-${cor}${pacote.perdido ? ' perdido' : ''}` });
    g.append(s('line', { x1, y1, x2: xf, y2: yf, class: 'seq-linha' }));
    g.append(s('circle', { cx: x1, cy: y1, r: 2.6, class: 'seq-origem' }));
    const direcao = Math.sign(x2 - x1) || 1;
    if (!pacote.perdido || fracao < limite) {
      const angulo = Math.atan2(y2 - y1, x2 - x1);
      const pontaX = xf;
      const pontaY = yf;
      const a1 = angulo + Math.PI - 0.4;
      const a2 = angulo + Math.PI + 0.4;
      g.append(
        s('path', {
          d: `M${pontaX} ${pontaY} L${pontaX + Math.cos(a1) * 9} ${pontaY + Math.sin(a1) * 9} L${pontaX + Math.cos(a2) * 9} ${pontaY + Math.sin(a2) * 9} Z`,
          class: 'seq-ponta',
        }),
      );
    } else {
      g.append(s('path', { d: `M${xf - 6} ${yf - 6} L${xf + 6} ${yf + 6} M${xf + 6} ${yf - 6} L${xf - 6} ${yf + 6}`, class: 'seq-x' }));
    }
    if (fracao > 0.12) {
      const mx = x1 + (x2 - x1) * Math.min(0.5, f * 0.9);
      const my = y1 + (y2 - y1) * Math.min(0.5, f * 0.9);
      const angulo = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      const rotacao = direcao < 0 ? angulo + 180 : angulo;
      const rotulo = tr(pacote.rotulo);
      const largura = rotulo.length * 6.6 + 12;
      const chip = s(
          'g',
          { transform: `translate(${mx.toFixed(1)} ${(my - 9).toFixed(1)}) rotate(${rotacao.toFixed(2)})` },
          s('rect', { x: -largura / 2, y: -8, width: largura, height: 15, rx: 2, class: 'seq-chip' }),
          s('text', { x: 0, y: 3.5, 'text-anchor': 'middle', class: 'seq-rotulo' }, rotulo),
        );
      chip.style.opacity = Math.min(1, (fracao - 0.12) / 0.22).toFixed(3);
      g.append(chip);
    }
    if (pacote.nota) {
      const texto = tr(pacote.nota);
      const largura = texto.length * 6.4 + 22;
      const xn = direcao > 0 ? x1 + 6 : x1 - 6 - largura;
      g.append(
        s(
          'g',
          { class: 'seq-nota', transform: `translate(${xn.toFixed(1)} ${(y1 - 26).toFixed(1)})` },
          s('rect', { x: 0, y: 0, width: largura, height: 15, rx: 2 }),
          s('circle', { cx: 8, cy: 7.5, r: 2.4 }),
          s('text', { x: 15, y: 11 }, texto),
        ),
      );
    }
    return g;
  };

  const desenharFundo = (p: Protocolo, l: Layout): void => {
    svg.setAttribute('viewBox', `0 ${TOPO - 8} ${L} ${l.altura - TOPO + 8}`);
    trocar(fundo);
    trocar(cabecalhos);
    const e = loja.atual;
    const linha = linhaDoTempo(p);
    const ativosDoPasso = new Set(linha.entradas.filter((en) => en.passo === e.passo).flatMap((en) => [en.pacote.de, en.pacote.para]));
    if (e.passo >= 0) {
      const topo = (l.yPasso[e.passo] ?? 0) - 6;
      const base = (l.yPasso[e.passo + 1] ?? l.altura - 8) - 6;
      fundo.append(s('rect', { x: 0, y: topo, width: L, height: base - topo, class: 'seq-banda' }));
    }
    for (const id of l.faixas) {
      const x = l.x.get(id) ?? 0;
      fundo.append(s('line', { x1: x, y1: TOPO - 6, x2: x, y2: l.altura - 8, class: 'seq-faixa' }));
      const n = noPorId(p, id);
      const nome = tr(n.nome);
      const icone = desenharDispositivo(n.tipo);
      icone.setAttribute('transform', `translate(${x} 42) scale(0.5)`);
      cabecalhos.append(
        s('g', { class: `seq-icone${e.passo >= 0 && ativosDoPasso.has(id) ? ' ativo' : ''}` }, icone),
        s('text', { x, y: 74, 'text-anchor': 'middle', class: 'seq-nome' }, nome),
        s('text', { x, y: 90, 'text-anchor': 'middle', class: 'seq-ip' }, n.ip ?? ''),
      );
    }
    fundo.append(s('line', { x1: 0, y1: TOPO - 6, x2: L, y2: TOPO - 6, class: 'seq-divisa' }));
    p.passos.forEach((passo, i) => {
      const y = l.yPasso[i] ?? 0;
      fundo.append(s('line', { x1: 0, y1: y - 6, x2: L, y2: y - 6, class: 'seq-passo-linha' }));
      fundo.append(
        s('text', { x: 14, y: y + 10, class: `seq-passo${i === e.passo ? ' atual' : ''}` }, `${ui('passoCurto', { n: i + 1 }).toUpperCase()} · ${tr(passo.titulo).toUpperCase()}`),
      );
    });
    for (const entrada of linha.entradas) {
      if (entrada.indice >= e.entregues && entrada.indice !== e.emVoo) continue;
      const y = l.yPacote[entrada.indice] ?? 0;
      fundo.append(s('text', { x: 30, y: y + 4, class: 'seq-tempo' }, formatarTempo(entrada.tempo)));
    }
  };

  const atualizar = (): void => {
    const p = protocoloAtual(ctx);
    const e = loja.atual;
    if (!layout || desenhadoPara !== p.id) {
      layout = calcular(p);
      desenhadoPara = p.id;
    }
    desenharFundo(p, layout);
    const l = layout;
    const linha = linhaDoTempo(p);
    trocar(entregues, ...linha.entradas.filter((en) => en.indice < e.entregues).map((en) => seta(p, l, en, 1)));
    if (e.emVoo === null) trocar(emVoo);
    svg.setAttribute('aria-label', `${p.sigla} · ${ui('sequencia')}`);
  };

  reprodutor.aoQuadro((indice, fracao) => {
    if (loja.atual.vista !== 'sequencia' || !layout) return;
    const p = protocoloAtual(ctx);
    const entrada = linhaDoTempo(p).entradas[indice];
    if (!entrada) return;
    trocar(emVoo, seta(p, layout, entrada, fracao));
    if (fracao >= 1 && ultimoAnel !== indice && !reduzMovimento()) {
      ultimoAnel = indice;
      const pacote = entrada.pacote;
      const x = pacote.perdido ? (layout.x.get(pacote.de) ?? 0) + ((layout.x.get(pacote.para) ?? 0) - (layout.x.get(pacote.de) ?? 0)) * 0.55 : (layout.x.get(pacote.para) ?? 0);
      const y = (layout.yPacote[indice] ?? 0) + QUEDA * (pacote.perdido ? 0.55 : 1);
      const anel = s('circle', { cx: x, cy: y, r: 12, class: `onda cor-${p.legenda[pacote.tipo]?.cor ?? 'neutra'}${pacote.perdido ? ' falha' : ''}` });
      anel.addEventListener('animationend', () => anel.remove());
      window.setTimeout(() => anel.remove(), 1500);
      efeitos.append(anel);
    }
    if (fracao === 0 || fracao === 1) return;
    const y = layout.yPacote[indice] ?? 0;
    const escala = rolagem.clientWidth / L;
    const alvo = (y - TOPO) * escala + 120;
    if (alvo < rolagem.scrollTop + 40 || alvo > rolagem.scrollTop + rolagem.clientHeight - 60) {
      rolagem.scrollTo({ top: Math.max(0, alvo - rolagem.clientHeight / 2), behavior: 'smooth' });
    }
  });

  loja.assinar((e, a) => {
    if (e.protocoloId !== a.protocoloId) {
      rolagem.scrollTop = 0;
      trocar(efeitos);
      ultimoAnel = -1;
      svg.classList.remove('entrando');
      void svg.getBoundingClientRect();
      svg.classList.add('entrando');
    }
    if (e.protocoloId !== a.protocoloId || e.idioma !== a.idioma || e.passo !== a.passo || e.entregues !== a.entregues || e.emVoo !== a.emVoo || e.vista !== a.vista) atualizar();
  });
  atualizar();
  return { elemento: rolagem, atualizar };
};
