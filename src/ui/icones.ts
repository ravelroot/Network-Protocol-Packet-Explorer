import { MARCA } from '../marca';
import { s } from './dom';

const CAMINHOS = {
  camadas: ['M12 3 3 7.5l9 4.5 9-4.5L12 3Z', 'm3 12 9 4.5 9-4.5', 'm3 16.5 9 4.5 9-4.5'],
  sequencia: ['M4 7h13', 'm14 4 3 3-3 3', 'M20 17H7', 'm10 14-3 3 3 3'],
  busca: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-4-4'],
  painelEsquerdo: ['M4 4h16v16H4z', 'M10 4v16'],
  painelInferior: ['M4 4h16v16H4z', 'M4 14h16'],
  foco: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  teclado: ['M3 6h18v12H3z', 'M7 10h.01', 'M11 10h.01', 'M15 10h.01', 'M7 14h10'],
  github: [
    'M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  ],
  globo: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'],
  paleta: ['M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z', 'M7.5 12.5h.01', 'M9.5 8h.01', 'M14.5 8h.01', 'M17 12h.01'],
  lua: ['M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z'],
  sol: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 2v2', 'M12 20v2', 'm4.9 4.9 1.4 1.4', 'm17.7 17.7 1.4 1.4', 'M2 12h2', 'M20 12h2', 'm4.9 19.1 1.4-1.4', 'm17.7 6.3 1.4-1.4'],
  direita: ['m9 6 6 6-6 6'],
  esquerda: ['m15 6-6 6 6 6'],
  baixo: ['m6 9 6 6 6-6'],
  fechar: ['M6 6l12 12', 'M18 6 6 18'],
  reiniciar: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
  check: ['m5 12 4.5 4.5L19 7'],
} as const;

export type NomeIcone = keyof typeof CAMINHOS | 'tocar' | 'pausar';

export const icone = (nome: NomeIcone, classe = 'icone'): SVGSVGElement => {
  const svg = s('svg', { class: classe, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
  if (nome === 'tocar') {
    svg.append(s('path', { d: 'M7 4.5v15l12-7.5-12-7.5Z', fill: 'currentColor', stroke: 'none' }));
    return svg;
  }
  if (nome === 'pausar') {
    svg.append(s('rect', { x: 6, y: 5, width: 4, height: 14, fill: 'currentColor', stroke: 'none' }));
    svg.append(s('rect', { x: 14, y: 5, width: 4, height: 14, fill: 'currentColor', stroke: 'none' }));
    return svg;
  }
  for (const d of CAMINHOS[nome]) {
    svg.append(s('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }
  return svg;
};

export const logotipo = (classe = 'logotipo'): SVGSVGElement => {
  const svg = s('svg', { class: classe, viewBox: '0 0 12 12', 'shape-rendering': 'crispEdges', 'aria-hidden': 'true', focusable: 'false' });
  const partes: string[] = [];
  MARCA.grade.forEach((linha, y) => {
    let x = 0;
    while (x < linha.length) {
      if (linha[x] === '#') {
        const inicio = x;
        while (x < linha.length && linha[x] === '#') x++;
        partes.push(`M${inicio} ${y}h${x - inicio}v1h-${x - inicio}z`);
      } else {
        x++;
      }
    }
  });
  svg.append(s('path', { d: partes.join(''), fill: 'currentColor' }));
  return svg;
};
