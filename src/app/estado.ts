import type { Camada, Categoria, Idioma } from '../dados/tipos';
import { ehPaleta, type Paleta } from './paletas';

export type Vista = 'rede' | 'sequencia';
export type Tema = 'escuro' | 'claro';

export interface Estado {
  readonly idioma: Idioma;
  readonly tema: Tema;
  readonly paleta: Paleta;
  readonly filtro: Categoria | 'todos';
  readonly camada: Camada | null;
  readonly protocoloId: string;
  readonly expandido: boolean;
  readonly vista: Vista;
  readonly passo: number;
  readonly entregues: number;
  readonly emVoo: number | null;
  readonly tocando: boolean;
  readonly velocidade: number;
  readonly inspecionado: number | null;
  readonly painel: 'visao' | 'passo';
  readonly lista: boolean;
  readonly fluxo: boolean;
  readonly foco: boolean;
  readonly busca: boolean;
  readonly ajuda: boolean;
}

type Ouvinte = (estado: Estado, anterior: Estado) => void;

const CHAVE = 'ocelo:preferencias';
const VELOCIDADES = [0.5, 1, 2, 4];

const lerPreferencias = (): Partial<Estado> => {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return {};
    const dados = JSON.parse(bruto) as Record<string, unknown>;
    const saida: Partial<Record<keyof Estado, unknown>> = {};
    if (dados.idioma === 'pt' || dados.idioma === 'en') saida.idioma = dados.idioma;
    if (dados.tema === 'escuro' || dados.tema === 'claro') saida.tema = dados.tema;
    if (ehPaleta(dados.paleta)) saida.paleta = dados.paleta;
    if (dados.vista === 'rede' || dados.vista === 'sequencia') saida.vista = dados.vista;
    if (typeof dados.velocidade === 'number' && VELOCIDADES.includes(dados.velocidade)) saida.velocidade = dados.velocidade;
    return saida as Partial<Estado>;
  } catch {
    return {};
  }
};

const salvarPreferencias = (e: Estado): void => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ idioma: e.idioma, tema: e.tema, paleta: e.paleta, vista: e.vista, velocidade: e.velocidade }));
  } catch {
    return;
  }
};

const idiomaDoNavegador = (): Idioma => (navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en');

export const criarEstado = (protocoloInicial: string): Estado => ({
  idioma: idiomaDoNavegador(),
  tema: 'escuro',
  paleta: 'bento',
  filtro: 'todos',
  camada: null,
  protocoloId: protocoloInicial,
  expandido: true,
  vista: 'rede',
  passo: -1,
  entregues: 0,
  emVoo: null,
  tocando: false,
  velocidade: 1,
  inspecionado: null,
  painel: 'visao',
  lista: true,
  fluxo: true,
  foco: false,
  busca: false,
  ajuda: false,
  ...lerPreferencias(),
});

export const VELOCIDADES_DISPONIVEIS: readonly number[] = VELOCIDADES;

export class Loja {
  private estado: Estado;
  private readonly ouvintes = new Set<Ouvinte>();

  constructor(inicial: Estado) {
    this.estado = inicial;
  }

  get atual(): Estado {
    return this.estado;
  }

  alterar(parcial: Partial<Estado>): void {
    const anterior = this.estado;
    const proximo = { ...anterior, ...parcial };
    const mudou = (Object.keys(parcial) as (keyof Estado)[]).some((k) => anterior[k] !== proximo[k]);
    if (!mudou) return;
    this.estado = proximo;
    if (anterior.idioma !== proximo.idioma || anterior.tema !== proximo.tema || anterior.paleta !== proximo.paleta || anterior.vista !== proximo.vista || anterior.velocidade !== proximo.velocidade) {
      salvarPreferencias(proximo);
    }
    for (const ouvinte of this.ouvintes) ouvinte(proximo, anterior);
  }

  assinar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }
}
