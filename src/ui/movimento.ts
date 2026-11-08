export type Ponto = readonly [number, number];

export const suave = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const senoidal = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

export interface Trecho {
  readonly tipo: 'mover' | 'parar';
  readonly segmento: number;
  readonly inicio: number;
  readonly fim: number;
}

export interface Percurso {
  readonly pontos: readonly Ponto[];
  readonly trechos: readonly Trecho[];
}

const PARADA = 0.1;

export const planejar = (pontos: readonly Ponto[]): Percurso => {
  const comprimentos = pontos.slice(1).map((p, i) => {
    const a = pontos[i] as Ponto;
    return Math.max(1, Math.hypot(p[0] - a[0], p[1] - a[1]));
  });
  const paradas = Math.max(0, comprimentos.length - 1);
  const parada = Math.min(PARADA, 0.3 / Math.max(1, paradas));
  const viagem = 1 - parada * paradas;
  const total = comprimentos.reduce((a, b) => a + b, 0);
  const trechos: Trecho[] = [];
  let cursor = 0;
  comprimentos.forEach((c, i) => {
    const duracao = (viagem * c) / total;
    trechos.push({ tipo: 'mover', segmento: i, inicio: cursor, fim: cursor + duracao });
    cursor += duracao;
    if (i < comprimentos.length - 1) {
      trechos.push({ tipo: 'parar', segmento: i + 1, inicio: cursor, fim: cursor + parada });
      cursor += parada;
    }
  });
  return { pontos, trechos };
};

export interface Posicao {
  readonly ponto: Ponto;
  readonly segmento: number;
  readonly parado: boolean;
  readonly no: number;
}

export const posicionar = (p: Percurso, f: number): Posicao => {
  const alvo = Math.min(1, Math.max(0, f));
  const trecho = p.trechos.find((t) => alvo <= t.fim) ?? p.trechos[p.trechos.length - 1];
  if (!trecho) return { ponto: p.pontos[0] ?? [0, 0], segmento: 0, parado: false, no: 0 };
  if (trecho.tipo === 'parar') {
    return { ponto: p.pontos[trecho.segmento] ?? [0, 0], segmento: trecho.segmento, parado: true, no: trecho.segmento };
  }
  const a = p.pontos[trecho.segmento] as Ponto;
  const b = p.pontos[trecho.segmento + 1] as Ponto;
  const local = trecho.fim === trecho.inicio ? 1 : (alvo - trecho.inicio) / (trecho.fim - trecho.inicio);
  const e = senoidal(local);
  return { ponto: [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e], segmento: trecho.segmento, parado: false, no: local >= 1 ? trecho.segmento + 1 : trecho.segmento };
};

export const reduzMovimento = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
