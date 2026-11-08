import { t } from './base';
import type { Campo, Pacote, Texto } from './tipos';

export const ascii = (valor: string): string =>
  [...new TextEncoder().encode(valor)].map((b) => b.toString(16).padStart(2, '0')).join(' ');

export const numeroHex = (valor: number, bytes: number): string =>
  Array.from({ length: bytes }, (_, i) => ((valor >>> ((bytes - 1 - i) * 8)) & 0xff).toString(16).padStart(2, '0')).join(' ');

export const tamanhoCampos = (campos: readonly Campo[]): number =>
  campos.reduce(
    (total, c) =>
      total +
      (c.opaco ?? (c.hex !== undefined ? c.hex.replace(/[^0-9a-fA-F]/g, '').length / 2 : new TextEncoder().encode(c.texto ?? '').length)),
    0,
  );

export interface Envio {
  readonly proto: string;
  readonly rotulo: Texto;
  readonly info: Texto;
  readonly tipo: string;
  readonly carga: readonly Campo[];
  readonly resumo?: Texto;
  readonly dt?: number;
  readonly camada?: string;
  readonly ttl?: number;
  readonly nota?: Texto;
  readonly origemIp?: string;
  readonly destinoIp?: string;
}

interface Controle {
  readonly tipo: string;
  readonly dt?: number;
  readonly ttl?: number;
}

export const criarFluxo = (cliente: string, servidor: string, portaCliente: number, portaServidor: number) => {
  let seqCliente = 1;
  let seqServidor = 1;
  const portas = (doCliente: boolean) =>
    doCliente ? { origem: portaCliente, destino: portaServidor } : { origem: portaServidor, destino: portaCliente };
  const pontas = (doCliente: boolean) => (doCliente ? { de: cliente, para: servidor } : { de: servidor, para: cliente });

  const enviar = (doCliente: boolean, e: Envio): Pacote => {
    const seq = doCliente ? seqCliente : seqServidor;
    const ack = doCliente ? seqServidor : seqCliente;
    const tamanho = tamanhoCampos(e.carga);
    if (doCliente) seqCliente += tamanho;
    else seqServidor += tamanho;
    return {
      ...pontas(doCliente),
      proto: e.proto,
      rotulo: e.rotulo,
      info: e.info,
      tipo: e.tipo,
      ...(e.resumo ? { resumo: e.resumo } : {}),
      ...(e.dt !== undefined ? { dt: e.dt } : {}),
      ...(e.nota ? { nota: e.nota } : {}),
      quadro: {
        ...(e.ttl !== undefined ? { ttl: e.ttl } : {}),
        ...(e.camada ? { camada: e.camada } : {}),
        ...(e.origemIp ? { origemIp: e.origemIp } : {}),
        ...(e.destinoIp ? { destinoIp: e.destinoIp } : {}),
        tcp: { ...portas(doCliente), seq, ack, flags: 'PSH,ACK', janela: doCliente ? 502 : 509 },
        carga: e.carga,
      },
    };
  };

  const controle = (doCliente: boolean, flags: string, c: Controle): Pacote => {
    const seq = doCliente ? seqCliente : seqServidor;
    const ack = doCliente ? seqServidor : seqCliente;
    if (flags.includes('FIN')) {
      if (doCliente) seqCliente += 1;
      else seqServidor += 1;
    }
    const { origem, destino } = portas(doCliente);
    const marcas = flags.replace(/,/g, ', ');
    return {
      ...pontas(doCliente),
      proto: 'TCP',
      rotulo: t(flags.replace(/,/g, '-'), flags.replace(/,/g, '-')),
      info: t(`${origem} → ${destino} [${marcas}] Seq=${seq} Ack=${ack}`, `${origem} → ${destino} [${marcas}] Seq=${seq} Ack=${ack}`),
      tipo: c.tipo,
      ...(c.dt !== undefined ? { dt: c.dt } : {}),
      quadro: {
        ...(c.ttl !== undefined ? { ttl: c.ttl } : {}),
        tcp: { origem, destino, seq, ack, flags, janela: doCliente ? 502 : 509 },
      },
    };
  };

  return {
    cliente: (e: Envio): Pacote => enviar(true, e),
    servidor: (e: Envio): Pacote => enviar(false, e),
    ack: (doCliente: boolean, c: Controle): Pacote => controle(doCliente, 'ACK', c),
    fin: (doCliente: boolean, c: Controle): Pacote => controle(doCliente, 'FIN,ACK', c),
  };
};
