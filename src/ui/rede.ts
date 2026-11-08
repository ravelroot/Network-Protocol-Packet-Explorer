import { protocoloAtual, type Contexto } from '../app/contexto';
import { linhaDoTempo } from '../app/linha-do-tempo';
import type { Cor, No, Protocolo } from '../dados/tipos';
import { tr } from '../i18n/textos';
import { noPorId, rota } from '../rede/rotas';
import { desenharDispositivo } from './dispositivos';
import { s, trocar } from './dom';
import { planejar, posicionar, reduzMovimento, type Percurso, type Ponto } from './movimento';

const L = 1000;
const A = 560;
const QUEDA = 0.58;

const posicao = (n: No): Ponto => [(n.x / 100) * L, (n.y / 100) * A];

interface Voo {
  readonly indice: number;
  readonly percurso: Percurso;
  readonly caminho: readonly string[];
  readonly cor: Cor;
  readonly perdido: boolean;
  segmento: number;
  no: number;
  chegou: boolean;
  caiu: boolean;
}

export const montarRede = (ctx: Contexto): { elemento: SVGSVGElement; atualizar: () => void } => {
  const { loja, reprodutor } = ctx;
  const defs = s(
    'defs',
    {},
    s('pattern', { id: 'grade-iso', width: 34.64, height: 20, patternUnits: 'userSpaceOnUse' }, s('path', { d: 'M0 0 L34.64 20 M34.64 0 L0 20', class: 'grade-linha' })),
    s(
      'radialGradient',
      { id: 'vinheta', cx: '50%', cy: '50%', r: '72%' },
      s('stop', { offset: '52%', 'stop-color': 'var(--caixa)', 'stop-opacity': 0 }),
      s('stop', { offset: '100%', 'stop-color': 'var(--caixa)', 'stop-opacity': 0.94 }),
    ),
  );
  const camadaLigacoes = s('g', { class: 'ligacoes' });
  const camadaTrilho = s('g', { class: 'trilhos' });
  const camadaNos = s('g', { class: 'nos' });
  const camadaEfeitos = s('g', { class: 'efeitos', 'aria-hidden': 'true' });
  const camadaRastro = s('g', { class: 'rastro', 'aria-hidden': 'true' });
  const camadaPacote = s('g', { class: 'pacote-voo', 'aria-hidden': 'true' });
  const svg = s(
    'svg',
    { class: 'rede', viewBox: `0 0 ${L} ${A}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' },
    defs,
    s('rect', { x: -400, y: -200, width: L + 800, height: A + 400, fill: 'url(#grade-iso)' }),
    s('rect', { x: -400, y: -200, width: L + 800, height: A + 400, fill: 'url(#vinheta)' }),
    camadaLigacoes,
    camadaTrilho,
    camadaNos,
    camadaEfeitos,
    camadaRastro,
    camadaPacote,
  );

  let desenhado: Protocolo | null = null;
  let voo: Voo | null = null;
  const segmentos = new Map<string, SVGLineElement>();
  const elementosNo = new Map<string, SVGGElement>();

  const onda = (id: string, cor: Cor, forte = false): void => {
    if (reduzMovimento() || !desenhado) return;
    const n = desenhado.nos.find((x) => x.id === id);
    if (!n) return;
    const [x, y] = posicao(n);
    for (let i = 0; i < (forte ? 2 : 1); i++) {
      const anel = s('circle', { cx: x.toFixed(1), cy: (y - 10).toFixed(1), r: 30, class: `onda cor-${cor}${forte ? ' forte' : ''}` });
      anel.style.animationDelay = `${i * 160}ms`;
      anel.addEventListener('animationend', () => anel.remove());
      window.setTimeout(() => anel.remove(), 1600);
      camadaEfeitos.append(anel);
    }
    const g = elementosNo.get(id);
    if (g) {
      g.classList.remove('pulsar');
      void g.getBoundingClientRect();
      g.classList.add('pulsar');
    }
  };

  const explosao = (ponto: Ponto): void => {
    if (reduzMovimento()) return;
    const g = s('g', { class: 'explosao', transform: `translate(${ponto[0].toFixed(1)} ${ponto[1].toFixed(1)})` });
    for (let i = 0; i < 8; i++) {
      const angulo = (i / 8) * Math.PI * 2;
      g.append(s('line', { x1: Math.cos(angulo) * 6, y1: Math.sin(angulo) * 6, x2: Math.cos(angulo) * 18, y2: Math.sin(angulo) * 18 }));
    }
    g.addEventListener('animationend', () => g.remove());
    window.setTimeout(() => g.remove(), 1200);
    camadaEfeitos.append(g);
  };

  const desenharBase = (p: Protocolo): void => {
    segmentos.clear();
    elementosNo.clear();
    trocar(camadaLigacoes);
    trocar(camadaNos);
    trocar(camadaTrilho);
    trocar(camadaEfeitos);
    p.ligacoes.forEach(([a, b], i) => {
      const [x1, y1] = posicao(noPorId(p, a));
      const [x2, y2] = posicao(noPorId(p, b));
      const linha = s('line', { x1, y1, x2, y2, class: 'ligacao entrando' });
      linha.style.animationDelay = `${120 + i * 50}ms`;
      segmentos.set(`${a}|${b}`, linha);
      segmentos.set(`${b}|${a}`, linha);
      camadaLigacoes.append(linha);
    });
    p.nos.forEach((n, i) => {
      const [x, y] = posicao(n);
      const corpo = s('g', { class: 'no-corpo' }, desenharDispositivo(n.tipo));
      const nome = s('text', { class: 'no-nome', x: 0, y: 52, 'text-anchor': 'middle' });
      const ip = s('text', { class: 'no-ip', x: 0, y: 67, 'text-anchor': 'middle' }, n.ip ?? '');
      const interno = s('g', { class: 'no-interno entrando' }, s('ellipse', { class: 'no-sombra', cx: 0, cy: 22, rx: 34, ry: 9 }), corpo, nome, ip);
      interno.style.animationDelay = `${i * 70}ms`;
      const g = s('g', { class: 'no', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, 'data-id': n.id }, interno);
      g.addEventListener('animationend', (ev) => {
        if ((ev as AnimationEvent).animationName === 'pulsar-no') g.classList.remove('pulsar');
      });
      elementosNo.set(n.id, g);
      camadaNos.append(g);
    });
    desenhado = p;
  };

  const limparVoo = (): void => {
    voo = null;
    trocar(camadaPacote);
    trocar(camadaRastro);
    trocar(camadaTrilho);
  };

  const atualizar = (): void => {
    const p = protocoloAtual(ctx);
    if (desenhado !== p) {
      limparVoo();
      desenharBase(p);
    }
    const e = loja.atual;
    svg.setAttribute('aria-label', `${p.sigla}: ${p.nos.map((n) => tr(n.nome)).join(', ')}`);
    for (const n of p.nos) {
      const texto = elementosNo.get(n.id)?.querySelector('.no-nome');
      if (texto) texto.textContent = tr(n.nome);
    }
    const linha = linhaDoTempo(p);
    const ativos = new Set<string>();
    const rotasPasso = new Set<SVGLineElement>();
    if (e.passo >= 0) {
      for (const entrada of linha.entradas) {
        if (entrada.passo !== e.passo) continue;
        ativos.add(entrada.pacote.de).add(entrada.pacote.para);
        const caminho = rota(p, entrada.pacote.de, entrada.pacote.para);
        caminho.slice(0, -1).forEach((id, i) => {
          const seg = segmentos.get(`${id}|${caminho[i + 1]}`);
          if (seg) rotasPasso.add(seg);
          ativos.add(id);
        });
      }
    }
    const focando = e.passo >= 0 && ativos.size > 0;
    for (const [id, g] of elementosNo) {
      g.classList.toggle('ativo', ativos.has(id));
      g.classList.toggle('apagado', focando && !ativos.has(id));
    }
    for (const seg of new Set(segmentos.values())) {
      seg.classList.toggle('rota-passo', rotasPasso.has(seg));
      seg.classList.toggle('apagada', focando && !rotasPasso.has(seg));
    }
    if (e.emVoo === null && voo) limparVoo();
  };

  const desenharTrilho = (v: Voo, segmentoAtual: number): void => {
    trocar(
      camadaTrilho,
      ...v.percurso.pontos.slice(0, -1).map((a, i) => {
        const b = v.percurso.pontos[i + 1] as Ponto;
        const estado = i < segmentoAtual ? ' feito' : i === segmentoAtual ? ' atual' : '';
        return s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: `trilho cor-${v.cor}${estado}` });
      }),
    );
  };

  const desenharPacote = (v: Voo, ponto: Ponto, rotulo: string, opacidade: number, queda: number): void => {
    const largura = Math.max(40, rotulo.length * 7.2 + 18);
    const g = s(
      'g',
      { class: `pacote cor-${v.cor}${v.caiu ? ' perdido' : ''}`, transform: `translate(${ponto[0].toFixed(1)} ${(ponto[1] - 12 + queda).toFixed(1)})` },
      s('g', { class: 'pacote-etiqueta', transform: 'translate(0 -26)' }, s('rect', { x: -largura / 2, y: -10, width: largura, height: 19, rx: 4 }), s('text', { x: 0, y: 3.6, 'text-anchor': 'middle' }, rotulo), s('path', { d: 'M-4 9 L0 14 L4 9 Z' })),
      s(
        'g',
        { class: 'pacote-quadro' },
        s('rect', { x: -15, y: -9, width: 30, height: 18, rx: 3, class: 'pacote-borda' }),
        s('rect', { x: -13, y: -7, width: 4, height: 14, class: 'faixa-enlace' }),
        s('rect', { x: -8, y: -7, width: 4, height: 14, class: 'faixa-rede' }),
        s('rect', { x: -3, y: -7, width: 4, height: 14, class: 'faixa-transporte' }),
        s('rect', { x: 2, y: -7, width: 11, height: 14, class: 'faixa-dados' }),
      ),
      v.caiu ? s('path', { d: 'M-9 -9 L9 9 M9 -9 L-9 9', class: 'pacote-x' }) : null,
    );
    g.style.opacity = opacidade.toFixed(3);
    trocar(camadaPacote, g);
  };

  const desenharRastro = (v: Voo, f: number): void => {
    if (reduzMovimento()) {
      trocar(camadaRastro);
      return;
    }
    const pontos: SVGCircleElement[] = [];
    for (let k = 1; k <= 12; k++) {
      const anterior = f - k * 0.011;
      if (anterior <= 0) break;
      const pos = posicionar(v.percurso, Math.min(anterior, v.perdido ? QUEDA : 1));
      if (pos.parado) continue;
      const c = s('circle', { cx: pos.ponto[0].toFixed(1), cy: (pos.ponto[1] - 12).toFixed(1), r: (4.2 - k * 0.28).toFixed(2), class: `rastro-ponto cor-${v.cor}` });
      c.style.opacity = (0.55 - k * 0.042).toFixed(3);
      pontos.push(c);
    }
    trocar(camadaRastro, ...pontos);
  };

  reprodutor.aoQuadro((indice, fracao) => {
    const p = protocoloAtual(ctx);
    if (desenhado !== p) desenharBase(p);
    const entrada = linhaDoTempo(p).entradas[indice];
    if (!entrada) return;
    const pacote = entrada.pacote;
    if (!voo || voo.indice !== indice) {
      const caminho = rota(p, pacote.de, pacote.para);
      voo = {
        indice,
        caminho,
        percurso: planejar(caminho.map((id) => posicao(noPorId(p, id)))),
        cor: p.legenda[pacote.tipo]?.cor ?? 'neutra',
        perdido: Boolean(pacote.perdido),
        segmento: -1,
        no: 0,
        chegou: false,
        caiu: false,
      };
      onda(pacote.de, voo.cor);
    }
    const v = voo;
    const progresso = v.perdido ? Math.min(fracao / QUEDA, 1) * QUEDA : fracao;
    const pos = posicionar(v.percurso, progresso);
    if (pos.segmento !== v.segmento) {
      v.segmento = pos.segmento;
      desenharTrilho(v, pos.segmento);
    }
    if (pos.parado && pos.no !== v.no && pos.no > 0 && pos.no < v.caminho.length - 1) {
      v.no = pos.no;
      onda(v.caminho[pos.no] as string, v.cor);
    }
    let opacidade = Math.min(1, fracao / 0.06);
    let queda = 0;
    if (v.perdido && fracao >= QUEDA) {
      if (!v.caiu) {
        v.caiu = true;
        explosao([pos.ponto[0], pos.ponto[1] - 12]);
      }
      const t = (fracao - QUEDA) / (1 - QUEDA);
      opacidade = 1 - t * 0.85;
      queda = t * t * 26;
    }
    desenharPacote(v, pos.ponto, tr(pacote.rotulo), opacidade, queda);
    desenharRastro(v, progresso);
    if (fracao >= 1 && !v.chegou && !v.perdido) {
      v.chegou = true;
      onda(pacote.para, v.cor, true);
      trocar(camadaRastro);
    }
  });

  atualizar();
  loja.assinar((e, a) => {
    if (e.protocoloId !== a.protocoloId || e.idioma !== a.idioma || e.passo !== a.passo || e.emVoo !== a.emVoo) atualizar();
  });
  return { elemento: svg, atualizar };
};
