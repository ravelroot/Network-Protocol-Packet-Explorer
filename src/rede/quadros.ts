import { t } from '../dados/base';
import type { Campo, Cor, No, Pacote, Protocolo, Quadro, Texto } from '../dados/tipos';
import { noPorId, rota } from './rotas';

export interface CampoAnalisado {
  readonly nome: Texto;
  readonly valor: string | Texto;
  readonly explicacao?: Texto;
  readonly exemplo?: boolean;
  readonly inicio: number;
  readonly fim: number;
  readonly opaco?: boolean;
}

export interface CamadaAnalisada {
  readonly nome: string | Texto;
  readonly cor: Cor;
  readonly inicio: number;
  readonly fim: number;
  readonly resumo: string;
  readonly campos: readonly CampoAnalisado[];
}

export interface Analise {
  readonly bytes: Uint8Array;
  readonly opacos: ReadonlySet<number>;
  readonly camadas: readonly CamadaAnalisada[];
  readonly visto: Texto;
}

const MAC_GATEWAY = '00:00:5e:00:53:fe';
const MAC_BROADCAST = 'ff:ff:ff:ff:ff:ff';

const hash = (valor: string): number => {
  let h = 2166136261;
  for (const c of valor) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

export const macDe = (no: No): string => {
  if (no.mac) return no.mac;
  if (no.tipo === 'roteador') return '00:00:5e:00:53:01';
  if (no.id === 'cliente') return '00:00:5e:00:53:10';
  return `00:00:5e:00:53:${(0x20 + (hash(no.id) % 0xd0)).toString(16).padStart(2, '0')}`;
};

const bytesMac = (mac: string): number[] => mac.split(':').map((p) => parseInt(p, 16));

const bytesIpv4 = (ip: string): number[] => {
  const partes = ip.split('.').map(Number);
  if (partes.length !== 4 || partes.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new Error(`IPv4 inválido: ${ip}`);
  }
  return partes;
};

const bytesIpv6 = (ip: string): number[] => {
  const [esquerda, direita] = ip.includes('::') ? ip.split('::') : [ip, undefined];
  const grupos = (s: string | undefined): string[] => (s ? s.split(':').filter((g) => g.length > 0) : []);
  const a = grupos(esquerda);
  const b = grupos(direita);
  const zeros = direita === undefined ? 0 : 8 - a.length - b.length;
  const todos = [...a, ...Array<string>(zeros).fill('0'), ...b];
  if (todos.length !== 8) throw new Error(`IPv6 inválido: ${ip}`);
  return todos.flatMap((g) => {
    const v = parseInt(g, 16);
    return [(v >> 8) & 0xff, v & 0xff];
  });
};

const u16 = (v: number): number[] => [(v >> 8) & 0xff, v & 0xff];
const u32 = (v: number): number[] => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
const hex2 = (v: number, digitos = 4): string => `0x${v.toString(16).padStart(digitos, '0')}`;

const somaVerificacao = (dados: readonly number[]): number => {
  let soma = 0;
  for (let i = 0; i < dados.length; i += 2) soma += ((dados[i] ?? 0) << 8) + (dados[i + 1] ?? 0);
  while (soma >> 16) soma = (soma & 0xffff) + (soma >> 16);
  return ~soma & 0xffff;
};

const bytesHex = (valor: string): number[] => {
  const limpo = valor.replace(/[^0-9a-fA-F]/g, '');
  if (limpo.length % 2 !== 0) throw new Error(`Hex com número ímpar de dígitos: ${valor}`);
  const saida: number[] = [];
  for (let i = 0; i < limpo.length; i += 2) saida.push(parseInt(limpo.slice(i, i + 2), 16));
  return saida;
};

const bytesTexto = (valor: string): number[] => [...new TextEncoder().encode(valor)];

class Escritor {
  readonly bytes: number[] = [];
  readonly opacos = new Set<number>();
  private semente: number;

  constructor(semente: number) {
    this.semente = semente || 1;
  }

  aleatorio(): number {
    this.semente = (Math.imul(this.semente, 1103515245) + 12345) >>> 0;
    return (this.semente >>> 16) & 0xff;
  }

  escrever(dados: readonly number[], opaco = false): [number, number] {
    const inicio = this.bytes.length;
    for (const b of dados) {
      if (opaco) this.opacos.add(this.bytes.length);
      this.bytes.push(b & 0xff);
    }
    return [inicio, this.bytes.length];
  }
}

const NOMES_ETHERTYPE: Record<number, string> = { 0x0800: 'IPv4', 0x86dd: 'IPv6', 0x0806: 'ARP', 0x888e: 'EAPOL' };
const NOMES_IP: Record<number, string> = { 1: 'ICMP', 6: 'TCP', 17: 'UDP', 50: 'ESP', 58: 'ICMPv6', 47: 'GRE' };

const E = {
  macDestinoRoteador: t(
    'O roteador: tudo o que está fora da rede local passa por ele primeiro.',
    'The router: anything beyond the local network goes to it first.',
  ),
  macBroadcast: t('Broadcast: todos os aparelhos da rede local recebem.', 'Broadcast: every device on the local network receives it.'),
  macGateway: t('O próximo salto no caminho, rumo à internet.', 'The next hop on the path, towards the internet.'),
  ethertype: t('Diz o que o quadro carrega.', 'What the frame carries.'),
  versaoIpv4: t('IPv4, sem opções.', 'IPv4, with no options.'),
  dscp: t('Prioridade e marcas de congestionamento; 0 é tráfego comum.', 'Priority and congestion marks; 0 means ordinary traffic.'),
  tamanhoTotal: t('Este cabeçalho e tudo o que vem dentro dele.', 'This header and everything inside it.'),
  identificacao: t(
    'Permite ao receptor remontar as partes se o pacote for dividido.',
    'Lets the receiver reassemble the pieces if the packet gets split.',
  ),
  flagsDf: t(
    'Não fragmentar: se um enlace for pequeno demais, volta um erro em vez de dividir o pacote.',
    "Don't fragment: if a link is too small, an error comes back instead of splitting the packet.",
  ),
  flagsNenhuma: t('Pode ser dividido no caminho se um enlace for pequeno demais.', 'May be split on the way if a link is too small.'),
  ttl: t(
    'Cada roteador diminui 1; em zero o pacote é descartado, o que evita voltas infinitas.',
    'Every router lowers the TTL by 1; at zero the packet is dropped, so it never loops forever.',
  ),
  protocoloIp: t('Diz quem vem a seguir dentro do pacote.', 'Says what comes next inside the packet.'),
  checksumIp: t(
    'Confere só o cabeçalho; cada roteador recalcula ao mudar o TTL.',
    'Covers the header only; each router recomputes it after changing the TTL.',
  ),
  versaoIpv6: t('IPv6, sem prioridade nem rótulo de fluxo.', 'IPv6, with no priority or flow label.'),
  cargaIpv6: t('Tamanho de tudo o que vem depois deste cabeçalho de 40 bytes.', 'Size of everything after this 40-byte header.'),
  limiteSaltos: t('O TTL do IPv6: cada roteador diminui 1.', "IPv6's TTL: every router lowers it by 1."),
  portaEfemera: t('Porta efêmera, sorteada pelo sistema para esta conversa.', 'Ephemeral port, picked by the OS for this conversation.'),
  portaServico: t('Porta conhecida do serviço.', "The service's well-known port."),
  seq: t(
    'Posição do primeiro byte deste segmento no fluxo (contada a partir de 0).',
    "Position of this segment's first byte in the stream (counted from 0).",
  ),
  ack: t('O próximo byte que este lado espera receber.', 'The next byte this side expects to receive.'),
  semAck: t('Ainda não há nada para confirmar.', 'Nothing to acknowledge yet.'),
  flagsTcp: t('Tamanho do cabeçalho e as flags de controle deste segmento.', "Header length and this segment's control flags."),
  janela: t('Quantos bytes ainda cabem no buffer de quem envia.', "How many more bytes fit in the sender's buffer."),
  checksumTcp: t('Confere cabeçalho e dados, junto com os IPs de origem e destino.', 'Covers header and data, plus the source and destination IPs.'),
  urgente: t('Quase nunca usado; fica em 0.', 'Almost never used; left at 0.'),
  opcoesTcp: t(
    'MSS 1460, SACK permitido e escala de janela 7: combinados só no SYN.',
    'MSS 1460, SACK permitted and window scale 7: agreed in the SYN only.',
  ),
  sack: t(
    'SACK: avisa quais bytes já chegaram depois da lacuna, para o reenvio cobrir só o que falta.',
    'SACK: tells which bytes already arrived past the gap, so only the missing ones are resent.',
  ),
  tamanhoUdp: t('Cabeçalho de 8 bytes mais os dados.', 'The 8-byte header plus the data.'),
  checksumUdp: t(
    'Isso é todo o UDP: sem conexão, sem confirmação, sem reenvio.',
    'That is all of UDP: no connection, no acknowledgements, no resends.',
  ),
  tipoIcmp: t('O tipo da mensagem de controle.', 'The control message type.'),
  codigoIcmp: t('Detalha o tipo.', 'Refines the type.'),
  checksumIcmp: t('Confere a mensagem ICMP inteira.', 'Covers the whole ICMP message.'),
  idIcmp: t('Liga a resposta à pergunta certa.', 'Matches the reply to the right request.'),
  seqIcmp: t('Conta as mensagens deste identificador.', 'Counts the messages for this identifier.'),
  arpHardware: t('Ethernet (1) e IPv4 (0x0800), com 6 e 4 bytes.', 'Ethernet (1) and IPv4 (0x0800), 6 and 4 bytes long.'),
  arpOperacao: t('1 é pergunta, 2 é resposta.', '1 is a request, 2 is a reply.'),
  arpAlvoMac: t('Desconhecido na pergunta: é o que se quer descobrir.', 'Unknown in a request: it is what we want to find out.'),
  fc: t('Tipo e subtipo do quadro 802.11.', '802.11 frame type and subtype.'),
  duracao: t('Tempo, em microssegundos, que o canal fica reservado.', 'Time, in microseconds, the channel stays reserved.'),
  addr1: t('Receptor: quem deve pegar o quadro no ar.', 'Receiver: who should pick the frame out of the air.'),
  addr2: t('Transmissor: quem está falando agora.', 'Transmitter: who is talking right now.'),
  addr3: t('BSSID: identifica o ponto de acesso da rede.', "BSSID: identifies the network's access point."),
  seqWifi: t('Número de sequência, para descartar repetições.', 'Sequence number, to drop duplicates.'),
  snap: t('LLC/SNAP: diz o que vem dentro, como o tipo do Ethernet.', 'LLC/SNAP: says what is inside, like the Ethernet type.'),
  eapol: t('Versão 2 do 802.1X, tipo da mensagem e tamanho.', '802.1X version 2, message type and length.'),
};

const placa = (n: No): Texto => t(`A placa de rede de ${n.nome.pt}.`, `${n.nome.en}'s network card.`);
const endereco = (n: No | undefined, ip: string): Texto =>
  n ? t(`O endereço de ${n.nome.pt}.`, `${n.nome.en}'s address.`) : t(`Endereço ${ip}.`, `Address ${ip}.`);

const FC_WIFI: Record<string, [number, string]> = {
  'assoc-req': [0x0000, 'Association Request'],
  'assoc-resp': [0x1000, 'Association Response'],
  'probe-req': [0x4000, 'Probe Request'],
  'probe-resp': [0x5000, 'Probe Response'],
  beacon: [0x8000, 'Beacon'],
  auth: [0xb000, 'Authentication'],
  deauth: [0xc000, 'Deauthentication'],
  dados: [0x0801, 'Data'],
};

const lerCampo = (e: Escritor, campo: Campo): CampoAnalisado => {
  if (campo.opaco !== undefined) {
    const dados = Array.from({ length: campo.opaco }, () => e.aleatorio());
    const [inicio, fim] = e.escrever(dados, true);
    return { nome: campo.nome, valor: campo.valor ?? `${campo.opaco} bytes`, explicacao: campo.explicacao, inicio, fim, opaco: true };
  }
  const dados = campo.hex !== undefined ? bytesHex(campo.hex) : bytesTexto(campo.texto ?? '');
  const [inicio, fim] = e.escrever(dados);
  const exibicao =
    campo.valor ?? (campo.texto !== undefined ? campo.texto.replace(/\r\n/g, '↵ ').trim() : dados.map((b) => b.toString(16).padStart(2, '0')).join(' '));
  return {
    nome: campo.nome,
    valor: exibicao,
    ...(campo.explicacao ? { explicacao: campo.explicacao } : {}),
    ...(campo.exemplo ? { exemplo: true } : {}),
    inicio,
    fim,
  };
};

const flagsTcp = (flags: string): number => {
  const mapa: Record<string, number> = { FIN: 0x01, SYN: 0x02, RST: 0x04, PSH: 0x08, ACK: 0x10, URG: 0x20 };
  return flags
    .split(',')
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean)
    .reduce((acc, f) => acc | (mapa[f] ?? 0), 0);
};

const OPCOES_SYN = [0x02, 0x04, 0x05, 0xb4, 0x01, 0x01, 0x04, 0x02, 0x01, 0x03, 0x03, 0x07];

export const analisar = (protocolo: Protocolo, pacote: Pacote, indice: number): Analise => {
  const q: Quadro = pacote.quadro;
  const origem = noPorId(protocolo, pacote.de);
  const destino = noPorId(protocolo, pacote.para);
  const caminho = rota(protocolo, pacote.de, pacote.para);
  const proximo = noPorId(protocolo, caminho[1] ?? pacote.para);
  const e = new Escritor(hash(`${protocolo.id}:${indice}`));
  const camadas: CamadaAnalisada[] = [];

  const rede = q.rede ?? 'ipv4';
  const ipOrigem = q.origemIp ?? origem.ip ?? (rede === 'ipv6' ? '::' : '0.0.0.0');
  const ipDestino = q.destinoIp ?? destino.ip ?? (rede === 'ipv6' ? '::' : '0.0.0.0');
  const broadcast = ipDestino === '255.255.255.255' || ipDestino.startsWith('ff02') || q.arp?.operacao === 1 || q.wifi === 'beacon';
  const macOrigem = macDe(origem);
  const macDestino = broadcast ? MAC_BROADCAST : proximo.tipo === 'internet' ? MAC_GATEWAY : macDe(proximo);
  const explicaDestino = broadcast
    ? E.macBroadcast
    : proximo.tipo === 'roteador' && proximo.id !== destino.id
      ? E.macDestinoRoteador
      : proximo.tipo === 'internet'
        ? E.macGateway
        : placa(proximo);

  const ethertype = rede === 'ipv6' ? 0x86dd : rede === 'arp' ? 0x0806 : rede === 'eapol' ? 0x888e : 0x0800;

  if ((q.enlace ?? 'ethernet') === 'wifi') {
    const [fc, nomeFc] = FC_WIFI[q.wifi ?? 'dados'] ?? [0x0801, 'Data'];
    const ap = protocolo.nos.find((n) => n.tipo === 'ponto-acesso') ?? proximo;
    const campos: CampoAnalisado[] = [];
    let [i, f] = e.escrever(u16(fc));
    campos.push({ nome: t('Controle do quadro', 'Frame control'), valor: `${hex2(fc)} (${nomeFc})`, explicacao: E.fc, inicio: i, fim: f });
    [i, f] = e.escrever(u16(q.wifi === 'beacon' ? 0 : 44));
    campos.push({ nome: t('Duração', 'Duration'), valor: q.wifi === 'beacon' ? '0 µs' : '44 µs', explicacao: E.duracao, inicio: i, fim: f });
    [i, f] = e.escrever(bytesMac(macDestino));
    campos.push({ nome: t('Endereço 1', 'Address 1'), valor: macDestino, explicacao: E.addr1, exemplo: true, inicio: i, fim: f });
    [i, f] = e.escrever(bytesMac(macOrigem));
    campos.push({ nome: t('Endereço 2', 'Address 2'), valor: macOrigem, explicacao: E.addr2, exemplo: true, inicio: i, fim: f });
    const bssid = macDe(ap);
    [i, f] = e.escrever(bytesMac(bssid));
    campos.push({ nome: t('Endereço 3', 'Address 3'), valor: bssid, explicacao: E.addr3, exemplo: true, inicio: i, fim: f });
    const sequencia = ((indice + 1) * 16) & 0xffff;
    [i, f] = e.escrever(u16(sequencia).reverse());
    campos.push({ nome: t('Sequência', 'Sequence'), valor: String(indice + 1), explicacao: E.seqWifi, inicio: i, fim: f });
    if ((q.wifi ?? 'dados') === 'dados') {
      [i, f] = e.escrever([0xaa, 0xaa, 0x03, 0x00, 0x00, 0x00, ...u16(ethertype)]);
      campos.push({
        nome: t('LLC/SNAP', 'LLC/SNAP'),
        valor: `${hex2(ethertype)} (${NOMES_ETHERTYPE[ethertype] ?? '?'})`,
        explicacao: E.snap,
        inicio: i,
        fim: f,
      });
    }
    camadas.push({ nome: '802.11', cor: 'neutra', inicio: 0, fim: e.bytes.length, resumo: `${macOrigem} → ${macDestino}`, campos });
  } else {
    const campos: CampoAnalisado[] = [];
    let [i, f] = e.escrever(bytesMac(macDestino));
    campos.push({ nome: t('Destino', 'Destination'), valor: macDestino, explicacao: explicaDestino, exemplo: true, inicio: i, fim: f });
    [i, f] = e.escrever(bytesMac(macOrigem));
    campos.push({
      nome: t('Origem', 'Source'),
      valor: macOrigem,
      explicacao: origem.tipo === 'roteador' ? t('O roteador, entregando o que veio de fora.', 'The router, delivering what came from outside.') : placa(origem),
      exemplo: true,
      inicio: i,
      fim: f,
    });
    [i, f] = e.escrever(u16(ethertype));
    campos.push({ nome: t('Tipo', 'Type'), valor: `${hex2(ethertype)} (${NOMES_ETHERTYPE[ethertype] ?? '?'})`, explicacao: E.ethertype, inicio: i, fim: f });
    camadas.push({ nome: 'Ethernet', cor: 'neutra', inicio: 0, fim: 14, resumo: `${macOrigem} → ${macDestino}`, campos });
  }

  const protoIp = q.tcp ? 6 : q.udp ? 17 : q.icmp ? (rede === 'ipv6' ? 58 : 1) : (q.ipProtocolo ?? 0);
  const transporte: number[] = [];
  const camposTransporte: { nome: Texto; valor: string | Texto; explicacao?: Texto; tamanho: number; exemplo?: boolean }[] = [];
  let nomeTransporte = '';
  let resumoTransporte = '';

  const carga = new Escritor(hash(`${protocolo.id}:${indice}:carga`));
  const camposCarga = (q.carga ?? []).map((c) => lerCampo(carga, c));

  const pseudo = (tamanho: number): number[] =>
    rede === 'ipv6'
      ? [...bytesIpv6(ipOrigem), ...bytesIpv6(ipDestino), ...u32(tamanho), 0, 0, 0, protoIp]
      : [...bytesIpv4(ipOrigem), ...bytesIpv4(ipDestino), 0, protoIp, ...u16(tamanho)];

  if (q.tcp) {
    const tcp = q.tcp;
    const flags = flagsTcp(tcp.flags);
    const opcoes = flags & 0x02 ? OPCOES_SYN : tcp.sack ? [0x01, 0x01, 0x05, 0x0a, ...u32(tcp.sack[0]), ...u32(tcp.sack[1])] : [];
    const tamanhoCabecalho = 20 + opcoes.length;
    const cabecalho = [
      ...u16(tcp.origem),
      ...u16(tcp.destino),
      ...u32(tcp.seq),
      ...u32(tcp.ack ?? 0),
      (tamanhoCabecalho / 4) << 4,
      flags,
      ...u16(tcp.janela ?? 502),
      0,
      0,
      0,
      0,
      ...opcoes,
    ];
    const segmento = [...cabecalho, ...carga.bytes];
    const soma = somaVerificacao([...pseudo(segmento.length), ...segmento]);
    cabecalho[16] = soma >> 8;
    cabecalho[17] = soma & 0xff;
    transporte.push(...cabecalho);
    const ehEfemera = (p: number): boolean => p >= 49152;
    camposTransporte.push(
      { nome: t('Porta de origem', 'Source port'), valor: String(tcp.origem), explicacao: ehEfemera(tcp.origem) ? E.portaEfemera : E.portaServico, tamanho: 2 },
      { nome: t('Porta de destino', 'Destination port'), valor: String(tcp.destino), explicacao: ehEfemera(tcp.destino) ? E.portaEfemera : E.portaServico, tamanho: 2 },
      { nome: t('Número de sequência', 'Sequence number'), valor: String(tcp.seq), explicacao: E.seq, tamanho: 4 },
      { nome: t('Confirmação', 'Acknowledgement'), valor: tcp.ack !== undefined ? String(tcp.ack) : '0', explicacao: tcp.ack !== undefined ? E.ack : E.semAck, tamanho: 4 },
      { nome: t('Cabeçalho, flags', 'Header, flags'), valor: `${tamanhoCabecalho} bytes, ${tcp.flags.replace(/,/g, ', ')}`, explicacao: E.flagsTcp, tamanho: 2 },
      { nome: t('Janela', 'Window'), valor: String(tcp.janela ?? 502), explicacao: E.janela, tamanho: 2 },
      { nome: t('Checksum', 'Checksum'), valor: hex2(soma), explicacao: E.checksumTcp, tamanho: 2 },
      { nome: t('Ponteiro urgente', 'Urgent pointer'), valor: '0', explicacao: E.urgente, tamanho: 2 },
    );
    if (opcoes.length > 0) {
      camposTransporte.push(
        flags & 0x02
          ? { nome: t('Opções', 'Options'), valor: 'MSS=1460, SACK_PERM, WS=7', explicacao: E.opcoesTcp, tamanho: opcoes.length }
          : { nome: t('Opções', 'Options'), valor: `SACK ${tcp.sack?.[0]}–${tcp.sack?.[1]}`, explicacao: E.sack, tamanho: opcoes.length },
      );
    }
    nomeTransporte = 'TCP';
    resumoTransporte = `${tcp.origem} → ${tcp.destino}`;
  } else if (q.udp) {
    const udp = q.udp;
    const tamanho = 8 + carga.bytes.length;
    const cabecalho = [...u16(udp.origem), ...u16(udp.destino), ...u16(tamanho), 0, 0];
    const soma = somaVerificacao([...pseudo(tamanho), ...cabecalho, ...carga.bytes]) || 0xffff;
    cabecalho[6] = soma >> 8;
    cabecalho[7] = soma & 0xff;
    transporte.push(...cabecalho);
    const ehEfemera = (p: number): boolean => p >= 49152;
    camposTransporte.push(
      { nome: t('Porta de origem', 'Source port'), valor: String(udp.origem), explicacao: ehEfemera(udp.origem) ? E.portaEfemera : E.portaServico, tamanho: 2 },
      { nome: t('Porta de destino', 'Destination port'), valor: String(udp.destino), explicacao: ehEfemera(udp.destino) ? E.portaEfemera : E.portaServico, tamanho: 2 },
      { nome: t('Tamanho', 'Length'), valor: `${tamanho} bytes`, explicacao: E.tamanhoUdp, tamanho: 2 },
      { nome: t('Checksum', 'Checksum'), valor: hex2(soma), explicacao: E.checksumUdp, tamanho: 2 },
    );
    nomeTransporte = 'UDP';
    resumoTransporte = `${udp.origem} → ${udp.destino}`;
  } else if (q.icmp) {
    const icmp = q.icmp;
    const temEco = icmp.id !== undefined || icmp.seq !== undefined;
    const cabecalho = [icmp.tipo, icmp.codigo, 0, 0, ...(temEco ? [...u16(icmp.id ?? 0), ...u16(icmp.seq ?? 0)] : [])];
    const mensagem = [...cabecalho, ...carga.bytes];
    const soma = somaVerificacao(rede === 'ipv6' ? [...pseudo(mensagem.length), ...mensagem] : mensagem);
    cabecalho[2] = soma >> 8;
    cabecalho[3] = soma & 0xff;
    transporte.push(...cabecalho);
    camposTransporte.push(
      { nome: t('Tipo', 'Type'), valor: String(icmp.tipo), explicacao: E.tipoIcmp, tamanho: 1 },
      { nome: t('Código', 'Code'), valor: String(icmp.codigo), explicacao: E.codigoIcmp, tamanho: 1 },
      { nome: t('Checksum', 'Checksum'), valor: hex2(soma), explicacao: E.checksumIcmp, tamanho: 2 },
    );
    if (temEco) {
      camposTransporte.push(
        { nome: t('Identificador', 'Identifier'), valor: hex2(icmp.id ?? 0), explicacao: E.idIcmp, tamanho: 2, exemplo: true },
        { nome: t('Sequência', 'Sequence'), valor: String(icmp.seq ?? 0), explicacao: E.seqIcmp, tamanho: 2 },
      );
    }
    nomeTransporte = rede === 'ipv6' ? 'ICMPv6' : 'ICMP';
    resumoTransporte = `${icmp.tipo}/${icmp.codigo}`;
  }

  if (rede === 'ipv4') {
    const total = 20 + transporte.length + carga.bytes.length;
    const identificacao = hash(`${protocolo.id}:${indice}:id`) & 0xffff;
    const df = Boolean(q.tcp);
    const cabecalho = [
      0x45,
      0x00,
      ...u16(total),
      ...u16(identificacao),
      ...(df ? [0x40, 0x00] : [0x00, 0x00]),
      q.ttl ?? 64,
      protoIp,
      0,
      0,
      ...bytesIpv4(ipOrigem),
      ...bytesIpv4(ipDestino),
    ];
    const soma = somaVerificacao(cabecalho);
    cabecalho[10] = soma >> 8;
    cabecalho[11] = soma & 0xff;
    const base = e.bytes.length;
    e.escrever(cabecalho);
    const no = (ip: string): No | undefined => protocolo.nos.find((n) => n.ip === ip);
    const campos: CampoAnalisado[] = [
      { nome: t('Versão, tamanho do cabeçalho', 'Version, header length'), valor: '4, 20 bytes', explicacao: E.versaoIpv4, inicio: base, fim: base + 1 },
      { nome: t('DSCP, ECN', 'DSCP, ECN'), valor: '0, 0', explicacao: E.dscp, inicio: base + 1, fim: base + 2 },
      { nome: t('Tamanho total', 'Total length'), valor: `${total} bytes`, explicacao: E.tamanhoTotal, inicio: base + 2, fim: base + 4 },
      { nome: t('Identificação', 'Identification'), valor: hex2(identificacao), explicacao: E.identificacao, exemplo: true, inicio: base + 4, fim: base + 6 },
      { nome: t('Flags', 'Flags'), valor: df ? 'DF' : t('nenhuma', 'none'), explicacao: df ? E.flagsDf : E.flagsNenhuma, inicio: base + 6, fim: base + 8 },
      { nome: t('TTL', 'TTL'), valor: String(q.ttl ?? 64), explicacao: E.ttl, inicio: base + 8, fim: base + 9 },
      { nome: t('Protocolo', 'Protocol'), valor: `${protoIp} (${NOMES_IP[protoIp] ?? '?'})`, explicacao: E.protocoloIp, inicio: base + 9, fim: base + 10 },
      { nome: t('Checksum', 'Checksum'), valor: hex2(soma), explicacao: E.checksumIp, inicio: base + 10, fim: base + 12 },
      { nome: t('Origem', 'Source'), valor: ipOrigem, explicacao: endereco(no(ipOrigem), ipOrigem), inicio: base + 12, fim: base + 16 },
      { nome: t('Destino', 'Destination'), valor: ipDestino, explicacao: endereco(no(ipDestino), ipDestino), inicio: base + 16, fim: base + 20 },
    ];
    camadas.push({ nome: 'IPv4', cor: 'anil', inicio: base, fim: base + 20, resumo: `${ipOrigem} → ${ipDestino}`, campos });
  } else if (rede === 'ipv6') {
    const cargaTotal = transporte.length + carga.bytes.length;
    const base = e.bytes.length;
    e.escrever([0x60, 0, 0, 0, ...u16(cargaTotal), protoIp, q.ttl ?? 64, ...bytesIpv6(ipOrigem), ...bytesIpv6(ipDestino)]);
    const campos: CampoAnalisado[] = [
      { nome: t('Versão, classe, fluxo', 'Version, class, flow'), valor: '6, 0, 0', explicacao: E.versaoIpv6, inicio: base, fim: base + 4 },
      { nome: t('Tamanho da carga', 'Payload length'), valor: `${cargaTotal} bytes`, explicacao: E.cargaIpv6, inicio: base + 4, fim: base + 6 },
      { nome: t('Próximo cabeçalho', 'Next header'), valor: `${protoIp} (${NOMES_IP[protoIp] ?? '?'})`, explicacao: E.protocoloIp, inicio: base + 6, fim: base + 7 },
      { nome: t('Limite de saltos', 'Hop limit'), valor: String(q.ttl ?? 64), explicacao: E.limiteSaltos, inicio: base + 7, fim: base + 8 },
      { nome: t('Origem', 'Source'), valor: ipOrigem, explicacao: t('Endereço IPv6 de origem.', 'Source IPv6 address.'), inicio: base + 8, fim: base + 24 },
      { nome: t('Destino', 'Destination'), valor: ipDestino, explicacao: t('Endereço IPv6 de destino.', 'Destination IPv6 address.'), inicio: base + 24, fim: base + 40 },
    ];
    camadas.push({ nome: 'IPv6', cor: 'anil', inicio: base, fim: base + 40, resumo: `${ipOrigem} → ${ipDestino}`, campos });
  } else if (rede === 'arp') {
    const op = q.arp?.operacao ?? 1;
    const macAlvo = op === 1 ? '00:00:00:00:00:00' : macDe(destino);
    const base = e.bytes.length;
    e.escrever([0, 1, 0x08, 0x00, 6, 4, ...u16(op), ...bytesMac(macOrigem), ...bytesIpv4(ipOrigem), ...bytesMac(macAlvo), ...bytesIpv4(ipDestino)]);
    const campos: CampoAnalisado[] = [
      { nome: t('Hardware, protocolo', 'Hardware, protocol'), valor: '1, 0x0800, 6, 4', explicacao: E.arpHardware, inicio: base, fim: base + 6 },
      { nome: t('Operação', 'Operation'), valor: op === 1 ? t('1 (pergunta)', '1 (request)') : t('2 (resposta)', '2 (reply)'), explicacao: E.arpOperacao, inicio: base + 6, fim: base + 8 },
      { nome: t('MAC de quem envia', 'Sender MAC'), valor: macOrigem, explicacao: placa(origem), exemplo: true, inicio: base + 8, fim: base + 14 },
      { nome: t('IP de quem envia', 'Sender IP'), valor: ipOrigem, explicacao: endereco(origem, ipOrigem), inicio: base + 14, fim: base + 18 },
      { nome: t('MAC do alvo', 'Target MAC'), valor: macAlvo, explicacao: op === 1 ? E.arpAlvoMac : placa(destino), inicio: base + 18, fim: base + 24 },
      { nome: t('IP do alvo', 'Target IP'), valor: ipDestino, explicacao: endereco(destino, ipDestino), inicio: base + 24, fim: base + 28 },
    ];
    camadas.push({ nome: 'ARP', cor: 'anil', inicio: base, fim: base + 28, resumo: `${ipOrigem} → ${ipDestino}`, campos });
  } else if (rede === 'eapol') {
    const tipo = q.eapolTipo ?? 3;
    const base = e.bytes.length;
    e.escrever([2, tipo, ...u16(carga.bytes.length)]);
    const nomeTipo = tipo === 0 ? 'EAP' : tipo === 1 ? 'Start' : 'Key';
    camadas.push({
      nome: 'EAPOL',
      cor: 'anil',
      inicio: base,
      fim: base + 4,
      resumo: nomeTipo,
      campos: [{ nome: t('Versão, tipo, tamanho', 'Version, type, length'), valor: `2, ${tipo} (${nomeTipo}), ${carga.bytes.length}`, explicacao: E.eapol, inicio: base, fim: base + 4 }],
    });
  }

  if (transporte.length > 0) {
    const base = e.bytes.length;
    e.escrever(transporte);
    let cursor = base;
    const campos = camposTransporte.map((c) => {
      const campo: CampoAnalisado = { nome: c.nome, valor: c.valor, ...(c.explicacao ? { explicacao: c.explicacao } : {}), ...(c.exemplo ? { exemplo: true } : {}), inicio: cursor, fim: cursor + c.tamanho };
      cursor += c.tamanho;
      return campo;
    });
    camadas.push({ nome: nomeTransporte, cor: 'oliva', inicio: base, fim: e.bytes.length, resumo: resumoTransporte, campos });
  }

  if (carga.bytes.length > 0) {
    const base = e.bytes.length;
    for (let i = 0; i < carga.bytes.length; i++) e.escrever([carga.bytes[i] as number], carga.opacos.has(i));
    const nomeCamada = q.camada ?? (['TCP', 'UDP'].includes(pacote.proto) ? t('Dados', 'Data') : pacote.proto);
    camadas.push({
      nome: nomeCamada,
      cor: 'brasa',
      inicio: base,
      fim: e.bytes.length,
      resumo: `${carga.bytes.length} bytes`,
      campos: camposCarga.map((c) => ({ ...c, inicio: c.inicio + base, fim: c.fim + base })),
    });
  }

  return {
    bytes: Uint8Array.from(e.bytes),
    opacos: e.opacos,
    camadas,
    visto: t(`Capturado no enlace entre ${origem.nome.pt} e ${proximo.nome.pt}`, `Captured on the link between ${origem.nome.en} and ${proximo.nome.en}`),
  };
};
