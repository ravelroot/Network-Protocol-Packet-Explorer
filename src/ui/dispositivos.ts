import type { Dispositivo } from '../dados/tipos';
import { s } from './dom';

type Ponto = readonly [number, number];

const iso = (x: number, y: number, z: number): Ponto => [(x - y) * 0.866, (x + y) * 0.5 - z];

const poligono = (pontos: readonly Ponto[], classe: string): SVGPolygonElement =>
  s('polygon', { points: pontos.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' '), class: classe });

const linha = (a: Ponto, b: Ponto, classe = 'disp-detalhe'): SVGLineElement =>
  s('line', { x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: b[0].toFixed(1), y2: b[1].toFixed(1), class: classe });

const caixa = (g: SVGGElement, x: number, y: number, z: number, w: number, d: number, h: number): void => {
  const topo = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const frente = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const lado = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)];
  g.append(poligono(frente, 'disp-frente'), poligono(lado, 'disp-lado'), poligono(topo, 'disp-topo'));
};

const faixasFrente = (g: SVGGElement, x: number, y: number, z: number, w: number, alturas: readonly number[], margem = 4): void => {
  for (const a of alturas) g.append(linha(iso(x + margem, y, z + a), iso(x + w - margem, y, z + a)));
};

const desenhos: Record<Dispositivo, (g: SVGGElement) => void> = {
  notebook: (g) => {
    caixa(g, -26, -16, 0, 52, 34, 3);
    for (let i = 0; i < 4; i++) g.append(linha(iso(-20, -10 + i * 6, 3), iso(16, -10 + i * 6, 3)));
    const tela = [iso(-26, -16, 3), iso(26, -16, 3), iso(30, -24, 38), iso(-22, -24, 38)];
    g.append(poligono(tela, 'disp-frente'));
    const interna = [iso(-21, -17, 7), iso(21, -17, 7), iso(25, -23, 34), iso(-17, -23, 34)];
    g.append(poligono(interna, 'disp-tela'));
    for (let i = 0; i < 4; i++) g.append(linha(iso(-6, -19.5 + i * 0.6, 14 + i * 5), iso(18, -19.5 + i * 0.6, 14 + i * 5)));
    g.append(poligono([iso(-17, -18.5, 12), iso(-9, -18.5, 12), iso(-8, -19.5, 22), iso(-16, -19.5, 22)], 'disp-acento'));
  },
  celular: (g) => {
    caixa(g, -11, -3, 0, 22, 6, 44);
    g.append(poligono([iso(-8, 3, 5), iso(8, 3, 5), iso(8, 3, 40), iso(-8, 3, 40)], 'disp-tela'));
  },
  roteador: (g) => {
    caixa(g, -26, -16, 0, 52, 32, 13);
    g.append(linha(iso(14, -12, 13), iso(14, -12, 42), 'disp-antena'));
    g.append(s('circle', { cx: iso(14, -12, 43)[0].toFixed(1), cy: iso(14, -12, 43)[1].toFixed(1), r: 1.8, class: 'disp-led' }));
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = iso(-18 + i * 7, 16, 6.5);
      g.append(s('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 1.5, class: 'disp-led' }));
    }
    g.append(poligono([iso(10, 16, 4), iso(20, 16, 4), iso(20, 16, 9), iso(10, 16, 9)], 'disp-tela'));
  },
  internet: (g) => {
    g.append(
      s('path', {
        d: 'M-34 14 a12 12 0 0 1 2-23 a16 16 0 0 1 29-8 a14 14 0 0 1 25 4 a12 12 0 0 1 12 27 Z',
        class: 'disp-nuvem',
      }),
    );
    g.append(s('circle', { cx: 2, cy: 0, r: 9, class: 'disp-globo' }));
    g.append(s('ellipse', { cx: 2, cy: 0, rx: 4, ry: 9, class: 'disp-globo' }));
    g.append(linha([-7, 0], [11, 0], 'disp-globo'));
  },
  servidor: (g) => {
    caixa(g, -16, -16, 0, 32, 32, 62);
    faixasFrente(g, -16, 16, 0, 32, [12, 22, 32, 42, 52]);
    for (const a of [8, 18, 28, 38, 48]) {
      const [cx, cy] = iso(10, 16, a);
      g.append(s('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 1.3, class: 'disp-led' }));
    }
  },
  pilha: (g) => {
    for (let i = 0; i < 3; i++) {
      caixa(g, -16, -16, i * 16, 32, 32, 13);
      faixasFrente(g, -16, 16, i * 16, 32, [6.5]);
    }
  },
  'ponto-acesso': (g) => {
    caixa(g, -20, -20, 0, 40, 40, 7);
    const [cx, cy] = iso(0, 0, 7);
    for (const r of [8, 15, 22]) {
      g.append(s('path', { d: `M${(cx - r).toFixed(1)} ${(cy - 6).toFixed(1)} A${r} ${r} 0 0 1 ${(cx + r).toFixed(1)} ${(cy - 6).toFixed(1)}`, class: 'disp-onda' }));
    }
    g.append(s('circle', { cx: cx.toFixed(1), cy: (cy - 5).toFixed(1), r: 1.8, class: 'disp-led' }));
  },
  escudo: (g) => {
    caixa(g, -22, -16, 0, 44, 32, 30);
    const [cx, cy] = iso(0, 16, 15);
    g.append(s('path', { d: `M${cx} ${cy - 10} l8 3 v5 c0 6 -4 9 -8 11 c-4 -2 -8 -5 -8 -11 v-5 z`, class: 'disp-acento' }));
  },
  relogio: (g) => {
    caixa(g, -18, -12, 0, 36, 24, 36);
    const [cx, cy] = iso(0, 12, 18);
    g.append(s('ellipse', { cx: cx.toFixed(1), cy: cy.toFixed(1), rx: 11, ry: 12, class: 'disp-tela' }));
    g.append(linha([cx, cy], [cx, cy - 8], 'disp-antena'), linha([cx, cy], [cx + 6, cy + 2], 'disp-antena'));
  },
  plc: (g) => {
    caixa(g, -26, -12, 0, 52, 24, 34);
    for (let i = 0; i < 5; i++) g.append(linha(iso(-20 + i * 10, 12, 5), iso(-20 + i * 10, 12, 29)));
    for (let i = 0; i < 5; i++) {
      const [cx, cy] = iso(-15 + i * 10, 12, 25);
      g.append(s('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 1.3, class: 'disp-led' }));
    }
  },
  armazenamento: (g) => {
    caixa(g, -20, -16, 0, 40, 32, 40);
    for (let i = 0; i < 4; i++) {
      g.append(poligono([iso(-15, 16, 6 + i * 8.5), iso(15, 16, 6 + i * 8.5), iso(15, 16, 12 + i * 8.5), iso(-15, 16, 12 + i * 8.5)], 'disp-tela'));
    }
  },
  email: (g) => {
    caixa(g, -16, -16, 0, 32, 32, 52);
    faixasFrente(g, -16, 16, 0, 32, [10, 18]);
    const [cx, cy] = iso(0, 16, 34);
    g.append(s('rect', { x: (cx - 9).toFixed(1), y: (cy - 6).toFixed(1), width: 18, height: 12, class: 'disp-acento' }));
    g.append(s('path', { d: `M${cx - 9} ${cy - 6} l9 7 l9 -7`, class: 'disp-onda' }));
  },
};

export const desenharDispositivo = (tipo: Dispositivo): SVGGElement => {
  const g = s('g', { class: `dispositivo disp-${tipo}` });
  desenhos[tipo](g);
  return g;
};
