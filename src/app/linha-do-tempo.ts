import type { Pacote, Protocolo } from '../dados/tipos';
import { analisar, type Analise } from '../rede/quadros';

export interface Entrada {
  readonly indice: number;
  readonly passo: number;
  readonly pacote: Pacote;
  readonly tempo: number;
}

export interface Linha {
  readonly entradas: readonly Entrada[];
  readonly fimPasso: readonly number[];
  readonly inicioPasso: readonly number[];
}

const linhas = new WeakMap<Protocolo, Linha>();
const analises = new WeakMap<Protocolo, Map<number, Analise>>();

export const linhaDoTempo = (protocolo: Protocolo): Linha => {
  const salva = linhas.get(protocolo);
  if (salva) return salva;
  const entradas: Entrada[] = [];
  const fimPasso: number[] = [];
  const inicioPasso: number[] = [];
  let tempo = 0;
  protocolo.passos.forEach((passo, i) => {
    inicioPasso.push(entradas.length);
    for (const pacote of passo.pacotes) {
      tempo += entradas.length === 0 ? 0 : (pacote.dt ?? 15);
      entradas.push({ indice: entradas.length, passo: i, pacote, tempo });
    }
    fimPasso.push(entradas.length);
  });
  const linha = { entradas, fimPasso, inicioPasso };
  linhas.set(protocolo, linha);
  return linha;
};

export const analiseDe = (protocolo: Protocolo, indice: number): Analise => {
  let mapa = analises.get(protocolo);
  if (!mapa) {
    mapa = new Map();
    analises.set(protocolo, mapa);
  }
  const salva = mapa.get(indice);
  if (salva) return salva;
  const entrada = linhaDoTempo(protocolo).entradas[indice];
  if (!entrada) throw new Error(`Pacote ${indice} não existe em ${protocolo.id}`);
  const analise = analisar(protocolo, entrada.pacote, indice);
  mapa.set(indice, analise);
  return analise;
};

export const formatarTempo = (ms: number): string => `${(ms / 1000).toFixed(3)}s`;
