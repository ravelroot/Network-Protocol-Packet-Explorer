import { apertoDeMao, hex, opaco, t } from './base';
import type { Campo, Pacote, Quadro, Texto } from './tipos';

export const ascii = (valor: string): string => [...new TextEncoder().encode(valor)].map((b) => b.toString(16).padStart(2, '0')).join(' ');

export const h16 = (v: number): string => [(v >> 8) & 0xff, v & 0xff].map((b) => b.toString(16).padStart(2, '0')).join(' ');

export const bytesDe = (campos: readonly Campo[]): number =>
  campos.reduce(
    (soma, c) =>
      soma +
      (c.opaco ?? (c.hex !== undefined ? c.hex.replace(/[^0-9a-fA-F]/g, '').length / 2 : new TextEncoder().encode(c.texto ?? '').length)),
    0,
  );

export const registroTls = (tamanho: number, conteudo: Texto, tipo: 'dados' | 'handshake' = 'dados'): Campo[] => [
  hex(
    t('Cabeçalho TLS', 'TLS header'),
    `${tipo === 'dados' ? '17' : '16'} 03 03 ${h16(tamanho)}`,
    `${tipo === 'dados' ? 'Application Data' : 'Handshake'}, TLS 1.2, ${tamanho} bytes`,
    t('Tipo do registro, versão e tamanho: a única parte legível.', 'Record type, version and length: the only readable part.'),
  ),
  opaco(t('Conteúdo cifrado', 'Encrypted content'), tamanho, conteudo),
];

export interface Ponta {
  readonly id: string;
  readonly porta: number;
  readonly ttl?: number;
  readonly janela?: number;
}

export interface Mensagem {
  readonly proto: string;
  readonly rotulo: Texto;
  readonly info: Texto;
  readonly tipo: string;
  readonly resumo?: Texto;
  readonly dt?: number;
  readonly nota?: Texto;
  readonly perdido?: boolean;
  readonly camada?: string;
  readonly flags?: string;
  readonly carga?: readonly Campo[];
  readonly quadro?: Omit<Quadro, 'tcp' | 'carga' | 'camada'>;
}

export const conversa = (cliente: Ponta, servidor: Ponta) => {
  const seq = new Map<string, number>([
    [cliente.id, 1],
    [servidor.id, 1],
  ]);

  const fala = (de: Ponta, para: Ponta, m: Mensagem): Pacote => {
    const carga = m.carga ?? [];
    const tamanho = bytesDe(carga);
    const flags = m.flags ?? (tamanho > 0 ? 'PSH,ACK' : 'ACK');
    const meu = seq.get(de.id) ?? 1;
    const pacote: Pacote = {
      de: de.id,
      para: para.id,
      proto: m.proto,
      rotulo: m.rotulo,
      info: m.info,
      tipo: m.tipo,
      ...(m.resumo ? { resumo: m.resumo } : {}),
      ...(m.dt !== undefined ? { dt: m.dt } : {}),
      ...(m.nota ? { nota: m.nota } : {}),
      ...(m.perdido ? { perdido: true } : {}),
      quadro: {
        ...(de.ttl ? { ttl: de.ttl } : {}),
        ...(m.quadro ?? {}),
        tcp: { origem: de.porta, destino: para.porta, seq: meu, ack: seq.get(para.id) ?? 1, flags, janela: de.janela ?? 502 },
        ...(carga.length > 0 ? { carga } : {}),
        ...(m.camada ? { camada: m.camada } : {}),
      },
    };
    seq.set(de.id, meu + tamanho + (flags.includes('FIN') ? 1 : 0));
    return pacote;
  };

  return {
    abrir: (tipo: string, dts: readonly number[] = [0, 18, 18]): Pacote[] =>
      apertoDeMao({ de: cliente.id, para: servidor.id, portaCliente: cliente.porta, portaServidor: servidor.porta, tipo }).map((p, i) => ({
        ...p,
        dt: dts[i] ?? 18,
        quadro: { ...p.quadro, ...(i === 1 && servidor.ttl ? { ttl: servidor.ttl } : {}) },
      })),
    cliente: (m: Mensagem): Pacote => fala(cliente, servidor, m),
    servidor: (m: Mensagem): Pacote => fala(servidor, cliente, m),
  };
};

const zeros = (n: number): string => Array<string>(n).fill('00').join(' ');

export interface ChaveEapol {
  readonly info: string;
  readonly infoValor: string;
  readonly explicacao: Texto;
  readonly tamanhoChave: number;
  readonly replay: number;
  readonly nonce?: Texto;
  readonly mic: boolean;
  readonly rsn?: string;
  readonly cifrado?: number;
}

export const chaveEapol = (c: ChaveEapol): Campo[] => {
  const dados = c.rsn ? c.rsn.replace(/[^0-9a-fA-F]/g, '').length / 2 : (c.cifrado ?? 0);
  return [
    hex(t('Descritor', 'Descriptor'), '02', 'RSN (2)', t('Formato de chave do 802.11i (RSN).', 'The 802.11i (RSN) key format.')),
    hex(t('Informação da chave', 'Key information'), c.info, c.infoValor, c.explicacao),
    hex(
      t('Tamanho da chave', 'Key length'),
      h16(c.tamanhoChave),
      `${c.tamanhoChave} bytes`,
      t('Tamanho da chave temporária; 16 para CCMP.', 'Temporal key length; 16 for CCMP.'),
    ),
    hex(
      t('Contador de repetição', 'Replay counter'),
      `${zeros(7)} ${c.replay.toString(16).padStart(2, '0')}`,
      String(c.replay),
      t('Sobe a cada mensagem e impede o reaproveitamento de mensagens antigas.', 'Goes up with every message and stops old messages from being replayed.'),
    ),
    c.nonce
      ? opaco(t('Nonce', 'Nonce'), 32, c.nonce)
      : hex(t('Nonce', 'Nonce'), zeros(32), '0', t('Não é necessário nesta mensagem.', 'Not needed in this message.')),
    hex(t('IV, RSC, reservado', 'IV, RSC, reserved'), zeros(32), '0', t('Campos herdados, zerados.', 'Legacy fields, left at zero.')),
    c.mic
      ? opaco(t('MIC', 'MIC'), 16, t('Prova de que quem envia conhece a chave, sem revelá-la.', 'Proof that the sender knows the key, without revealing it.'))
      : hex(t('MIC', 'MIC'), zeros(16), '0', t('Ainda não há chave para assinar.', 'There is no key to sign with yet.')),
    hex(t('Tamanho dos dados', 'Key data length'), h16(dados), `${dados} bytes`),
    ...(c.rsn
      ? [hex(t('Dados: RSN', 'Data: RSN'), c.rsn, 'RSN IE', t('Repete o que foi anunciado, para detectar adulteração.', 'Repeats what was advertised, to detect tampering.'))]
      : c.cifrado
        ? [opaco(t('Dados cifrados (GTK)', 'Encrypted data (GTK)'), c.cifrado, t('A chave de grupo, para broadcast, já cifrada.', 'The group key for broadcast, already encrypted.'))]
        : []),
  ];
};
