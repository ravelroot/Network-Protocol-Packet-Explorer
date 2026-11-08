import { protocoloPorId } from '../dados/protocolos';
import type { Protocolo } from '../dados/tipos';
import { VELOCIDADES_DISPONIVEIS, type Loja } from './estado';
import { linhaDoTempo } from './linha-do-tempo';

type OuvinteQuadro = (indice: number, fracao: number) => void;

const DURACAO_PACOTE = 2800;
const PAUSA_PACOTE = 650;
const PAUSA_PASSO = 1900;
const PASSO_SEM_PACOTES = 3800;

export class Reprodutor {
  private geracao = 0;
  private readonly ouvintes = new Set<OuvinteQuadro>();

  constructor(private readonly loja: Loja) {}

  get protocolo(): Protocolo {
    const p = protocoloPorId(this.loja.atual.protocoloId);
    if (!p) throw new Error(`Protocolo ${this.loja.atual.protocoloId} não encontrado`);
    return p;
  }

  aoQuadro(ouvinte: OuvinteQuadro): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  private reduzMovimento(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private espera(ms: number, geracao: number): Promise<boolean> {
    const fator = this.loja.atual.velocidade;
    return new Promise((resolver) => {
      window.setTimeout(() => resolver(geracao === this.geracao), ms / fator);
    });
  }

  private animar(indice: number, geracao: number): Promise<boolean> {
    const duracao = this.reduzMovimento() ? 200 : DURACAO_PACOTE;
    let anterior = performance.now();
    let fracao = 0;
    return new Promise((resolver) => {
      const quadro = (agora: number): void => {
        if (geracao !== this.geracao) {
          resolver(false);
          return;
        }
        fracao = Math.min(1, fracao + ((agora - anterior) * this.loja.atual.velocidade) / duracao);
        anterior = agora;
        for (const ouvinte of this.ouvintes) ouvinte(indice, fracao);
        if (fracao < 1) requestAnimationFrame(quadro);
        else resolver(true);
      };
      requestAnimationFrame(quadro);
    });
  }

  acelerar(direcao: 1 | -1): void {
    const lista = VELOCIDADES_DISPONIVEIS;
    const atual = lista.indexOf(this.loja.atual.velocidade);
    const proxima = lista[Math.min(lista.length - 1, Math.max(0, (atual === -1 ? 1 : atual) + direcao))];
    if (proxima !== undefined) this.loja.alterar({ velocidade: proxima });
  }

  private parar(): void {
    this.geracao++;
    if (this.loja.atual.tocando || this.loja.atual.emVoo !== null) this.loja.alterar({ tocando: false, emVoo: null });
  }

  tocar(): void {
    const linha = linhaDoTempo(this.protocolo);
    const { passo, entregues } = this.loja.atual;
    const fim = passo >= this.protocolo.passos.length - 1 && entregues >= linha.entradas.length;
    if (fim) this.reiniciar();
    this.geracao++;
    const geracao = this.geracao;
    this.loja.alterar({ tocando: true, inspecionado: null });
    void this.laco(geracao);
  }

  pausar(): void {
    this.parar();
  }

  alternar(): void {
    if (this.loja.atual.tocando) this.pausar();
    else this.tocar();
  }

  private async laco(geracao: number): Promise<void> {
    const protocolo = this.protocolo;
    const linha = linhaDoTempo(protocolo);
    const ultimo = protocolo.passos.length - 1;
    while (geracao === this.geracao) {
      const { passo, entregues } = this.loja.atual;
      if (passo < 0) {
        this.loja.alterar({ passo: 0, painel: 'passo' });
        if (!(await this.espera(350, geracao))) return;
        continue;
      }
      const fim = linha.fimPasso[passo] ?? 0;
      if (entregues < fim) {
        this.loja.alterar({ emVoo: entregues });
        if (!(await this.animar(entregues, geracao))) return;
        this.loja.alterar({ entregues: entregues + 1, emVoo: null });
        if (!(await this.espera(PAUSA_PACOTE, geracao))) return;
        continue;
      }
      if (passo >= ultimo) {
        this.loja.alterar({ tocando: false });
        this.geracao++;
        return;
      }
      const vazio = (linha.fimPasso[passo] ?? 0) === (linha.inicioPasso[passo] ?? 0);
      if (!(await this.espera(vazio ? PASSO_SEM_PACOTES : PAUSA_PASSO, geracao))) return;
      this.loja.alterar({ passo: passo + 1, painel: 'passo' });
    }
  }

  avancarPasso(): void {
    this.parar();
    const linha = linhaDoTempo(this.protocolo);
    const { passo, entregues } = this.loja.atual;
    const ultimo = this.protocolo.passos.length - 1;
    if (passo < 0) {
      this.loja.alterar({ passo: 0, entregues: linha.fimPasso[0] ?? 0, painel: 'passo' });
    } else if (entregues < (linha.fimPasso[passo] ?? 0)) {
      this.loja.alterar({ entregues: linha.fimPasso[passo] ?? 0, painel: 'passo' });
    } else if (passo < ultimo) {
      this.loja.alterar({ passo: passo + 1, entregues: linha.fimPasso[passo + 1] ?? 0, painel: 'passo' });
    }
  }

  voltarPasso(): void {
    this.parar();
    const linha = linhaDoTempo(this.protocolo);
    const { passo } = this.loja.atual;
    if (passo <= 0) {
      this.reiniciar();
      return;
    }
    this.loja.alterar({ passo: passo - 1, entregues: linha.fimPasso[passo - 1] ?? 0, painel: 'passo', inspecionado: null });
  }

  irParaPasso(i: number): void {
    this.parar();
    const linha = linhaDoTempo(this.protocolo);
    this.loja.alterar({ passo: i, entregues: linha.fimPasso[i] ?? 0, painel: 'passo', inspecionado: null });
  }

  reiniciar(): void {
    this.parar();
    this.loja.alterar({ passo: -1, entregues: 0, emVoo: null, painel: 'visao', inspecionado: null });
  }

  selecionar(id: string): void {
    if (!protocoloPorId(id)) return;
    const mesmo = id === this.loja.atual.protocoloId;
    this.reiniciar();
    this.loja.alterar({ protocoloId: id, expandido: mesmo ? !this.loja.atual.expandido : true });
  }
}
