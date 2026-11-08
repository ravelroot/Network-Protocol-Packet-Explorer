import { protocoloPorId } from '../dados/protocolos';
import type { Protocolo } from '../dados/tipos';
import type { Loja } from './estado';
import type { Reprodutor } from './reprodutor';

export interface Contexto {
  readonly loja: Loja;
  readonly reprodutor: Reprodutor;
}

export const protocoloAtual = (ctx: Contexto): Protocolo => {
  const p = protocoloPorId(ctx.loja.atual.protocoloId);
  if (!p) throw new Error(`Protocolo ${ctx.loja.atual.protocoloId} não encontrado`);
  return p;
};
