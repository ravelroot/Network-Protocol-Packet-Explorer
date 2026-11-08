import { hex, nos, opaco, t } from '../base';
import type { Campo, Pacote, Protocolo } from '../tipos';

const CLIENTE = 51634;
const CID_INICIAL = '83 94 c8 f0 3e 51 57 08';
const CID_CLIENTE = 'c1 5e 39 7b 0d 22 a4 6f';
const CID_SERVIDOR = 'f6 7a 1d 5b 0c 9e 43 2b';
const CID_NOVO = 'a3 8d 51 0e 7c 64 f2 19';
const semEspaco = (s: string): string => s.replace(/\s/g, '');

const varint = (n: number): string => {
  const v = 0x4000 | n;
  return `${(v >> 8).toString(16).padStart(2, '0')} ${(v & 0xff).toString(16).padStart(2, '0')}`;
};

const cid = (nome: [string, string], valor: string, explicacao: [string, string]): Campo =>
  hex(t(nome[0], nome[1]), `08 ${valor}`, semEspaco(valor), t(explicacao[0], explicacao[1]), true);

const longo = (
  primeiro: string,
  tipo: string,
  destino: string,
  origem: string,
  pn: number,
  carga: number,
  conteudo: [string, string],
  token: boolean,
): Campo[] => [
  hex(t('Primeiro byte', 'First byte'), primeiro, `Long header, ${tipo}`, t('Bit alto em 1 = cabeçalho longo; os bits baixos ficam protegidos.', 'Top bit set = long header; the low bits are header-protected.')),
  hex(t('Versão', 'Version'), '00 00 00 01', 'QUIC v1'),
  cid(['ID de conexão de destino', 'Destination connection ID'], destino, ['Identifica a conexão, não o IP: sobrevive a trocas de rede.', 'Identifies the connection, not the IP: survives network changes.']),
  cid(['ID de conexão de origem', 'Source connection ID'], origem, ['O ID que o outro lado deve usar para responder.', 'The ID the other side must use when replying.']),
  ...(token ? [hex(t('Tamanho do token', 'Token length'), '00', '0', t('Sem token de validação de endereço.', 'No address validation token.'))] : []),
  hex(t('Tamanho', 'Length'), varint(pn + carga), `${pn + carga} bytes`, t('Inteiro de tamanho variável: número do pacote + carga.', 'Variable-length integer: packet number + payload.')),
  opaco(t('Número do pacote (protegido)', 'Packet number (protected)'), pn),
  opaco(t(conteudo[0], conteudo[1]), carga, t('Cifrado com AEAD; a tag de 16 bytes fica no fim.', 'AEAD-encrypted; the 16-byte tag sits at the end.')),
];

const curto = (destino: string, carga: number, conteudo: [string, string]): Campo[] => [
  hex(t('Primeiro byte', 'First byte'), '41', 'Short header, 1-RTT', t('Bit alto em 0 = cabeçalho curto, usado depois do aperto de mão.', 'Top bit clear = short header, used after the handshake.')),
  hex(t('ID de conexão de destino', 'Destination connection ID'), destino, semEspaco(destino), t('Sem campo de tamanho: cada lado já sabe o comprimento.', 'No length field: each side already knows its length.'), true),
  opaco(t('Número do pacote (protegido)', 'Packet number (protected)'), 2),
  opaco(t(conteudo[0], conteudo[1]), carga, t('Quadros cifrados; só as pontas leem.', 'Encrypted frames; only the endpoints can read them.')),
];

const datagrama = (
  de: 'cliente' | 'servidor',
  rotulo: [string, string],
  info: [string, string],
  tipo: string,
  carga: Campo[],
  dt: number,
  resumo: [string, string],
  extra: { origemIp?: string; destinoIp?: string; porta?: number } = {},
): Pacote => {
  const porta = extra.porta ?? CLIENTE;
  return {
    de,
    para: de === 'cliente' ? 'servidor' : 'cliente',
    proto: 'QUIC',
    rotulo: t(rotulo[0], rotulo[1]),
    info: t(info[0], info[1]),
    tipo,
    resumo: t(resumo[0], resumo[1]),
    dt,
    quadro: {
      ...(de === 'servidor' ? { ttl: 52 } : {}),
      ...(extra.origemIp ? { origemIp: extra.origemIp } : {}),
      ...(extra.destinoIp ? { destinoIp: extra.destinoIp } : {}),
      udp: { origem: de === 'cliente' ? porta : 443, destino: de === 'cliente' ? 443 : porta },
      carga,
      camada: 'QUIC',
    },
  };
};

export const quic: Protocolo = {
  id: 'quic',
  sigla: 'QUIC',
  nome: t('QUIC', 'QUIC'),
  resumo: t('HTTP/3 sobre UDP', 'HTTP/3 over UDP'),
  categoria: 'aplicacao',
  camada: 4,
  descricao: t(
    'O QUIC refaz o trabalho do TCP e do TLS juntos, por cima do UDP. Conexão e criptografia são combinadas num único RTT (ou zero, ao retomar uma sessão com 0-RTT), cada fluxo se recupera de perdas sozinho e a conexão é identificada por IDs, não por IP e porta, então sobrevive a uma troca de rede. É o transporte do HTTP/3.',
    'QUIC redoes the work of TCP and TLS together, on top of UDP. Connection and encryption are set up in a single RTT (or zero, when resuming a session with 0-RTT), each stream recovers from loss on its own and the connection is identified by IDs, not by IP and port, so it survives a network change. It is the transport behind HTTP/3.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Transporte (camada 4), sobre UDP', 'Transport (Layer 4), over UDP')],
    [t('Porta', 'Port'), t('UDP 443', 'UDP 443')],
    [t('Aperto de mão', 'Handshake'), t('TLS 1.3 embutido: 1 RTT, 0-RTT ao retomar', 'Built-in TLS 1.3: 1 RTT, 0-RTT on resumption')],
    [t('Fluxos', 'Streams'), t('Independentes, sem bloqueio de cabeça de fila', 'Independent, no head-of-line blocking')],
    [t('Identidade', 'Identity'), t('IDs de conexão (sobrevivem à troca de rede)', 'Connection IDs (survive network changes)')],
    [t('Definido em', 'Defined in'), t('RFC 9000, RFC 9001, RFC 9114', 'RFC 9000, RFC 9001, RFC 9114')],
  ],
  legenda: {
    inicial: { nome: t('Initial', 'Initial'), cor: 'anil' },
    handshake: { nome: t('Handshake', 'Handshake'), cor: 'ouro' },
    dados: { nome: t('1-RTT (dados)', '1-RTT (data)'), cor: 'oliva' },
    caminho: { nome: t('Validação de caminho', 'Path validation'), cor: 'brasa' },
  },
  nos: [nos.cliente(), nos.roteador(), nos.internet(), nos.servidor()],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'servidor'],
  passos: [
    {
      titulo: t('Initial do cliente', 'Client Initial'),
      resumo: t('ClientHello dentro do QUIC, 1200 bytes', 'ClientHello inside QUIC, 1200 bytes'),
      descricao: t(
        'O navegador manda um único datagrama UDP com um pacote Initial. Dentro vai o ClientHello do TLS 1.3, num quadro CRYPTO, completado com PADDING até 1200 bytes. O tamanho mínimo prova que o caminho aguenta pacotes grandes e limita ataques de amplificação.',
        'The browser sends a single UDP datagram holding an Initial packet. Inside is the TLS 1.3 ClientHello, in a CRYPTO frame, padded up to 1200 bytes. That minimum size proves the path carries large packets and limits amplification attacks.',
      ),
      fatos: [
        [t('Datagrama', 'Datagram'), t('1200 bytes (mínimo exigido)', '1200 bytes (required minimum)')],
        [t('Quadros', 'Frames'), t('CRYPTO (ClientHello) + PADDING', 'CRYPTO (ClientHello) + PADDING')],
        [t('Chaves Initial', 'Initial keys'), t('Derivadas do ID de conexão: só ofuscam', 'Derived from the connection ID: obfuscation only')],
      ],
      pacotes: [
        datagrama(
          'cliente',
          ['INITIAL', 'INITIAL'],
          [`Initial, DCID=${semEspaco(CID_INICIAL)}, PKN: 0, CRYPTO, PADDING`, `Initial, DCID=${semEspaco(CID_INICIAL)}, PKN: 0, CRYPTO, PADDING`],
          'inicial',
          longo('c3', 'Initial', CID_INICIAL, CID_CLIENTE, 4, 1170, ['CRYPTO (ClientHello) + PADDING', 'CRYPTO (ClientHello) + PADDING'], true),
          0,
          ['ClientHello, ALPN h3', 'ClientHello, ALPN h3'],
        ),
      ],
    },
    {
      titulo: t('Resposta do servidor', 'Server response'),
      resumo: t('Initial e Handshake no mesmo datagrama', 'Initial and Handshake in one datagram'),
      descricao: t(
        'O servidor responde com vários pacotes QUIC colados no mesmo datagrama: um Initial com o ServerHello e um Handshake com o certificado, a assinatura e o Finished. Como o endereço do cliente ainda não foi validado, ele não envia mais que 3 vezes o que recebeu.',
        'The server answers with several QUIC packets glued into one datagram: an Initial with the ServerHello and a Handshake with the certificate, signature and Finished. Since the client’s address is not validated yet, it sends no more than 3 times what it received.',
      ),
      fatos: [
        [t('Pacotes coalescidos', 'Coalesced packets'), t('Initial + Handshake', 'Initial + Handshake')],
        [t('Limite anti-amplificação', 'Anti-amplification limit'), t('3 × 1200 = 3600 bytes', '3 × 1200 = 3600 bytes')],
        [t('Novo ID do servidor', 'New server ID'), t(semEspaco(CID_SERVIDOR), semEspaco(CID_SERVIDOR))],
      ],
      pacotes: [
        datagrama(
          'servidor',
          ['INITIAL + HANDSHAKE', 'INITIAL + HANDSHAKE'],
          ['Initial, PKN: 0, ACK, CRYPTO; Handshake, PKN: 0, CRYPTO', 'Initial, PKN: 0, ACK, CRYPTO; Handshake, PKN: 0, CRYPTO'],
          'handshake',
          [
            ...longo('c1', 'Initial', CID_CLIENTE, CID_SERVIDOR, 2, 117, ['ACK + CRYPTO (ServerHello)', 'ACK + CRYPTO (ServerHello)'], true),
            ...longo('e1', 'Handshake', CID_CLIENTE, CID_SERVIDOR, 2, 1028, ['CRYPTO (EncryptedExtensions, Certificate…)', 'CRYPTO (EncryptedExtensions, Certificate…)'], false),
          ],
          17,
          ['ServerHello + certificado', 'ServerHello + certificate'],
        ),
        datagrama(
          'servidor',
          ['HANDSHAKE', 'HANDSHAKE'],
          ['Handshake, PKN: 1, CRYPTO', 'Handshake, PKN: 1, CRYPTO'],
          'handshake',
          longo('e1', 'Handshake', CID_CLIENTE, CID_SERVIDOR, 2, 785, ['CRYPTO (CertificateVerify, Finished)', 'CRYPTO (CertificateVerify, Finished)'], false),
          0,
          ['Assinatura e Finished do servidor', 'Server signature and Finished'],
        ),
      ],
    },
    {
      titulo: t('Pedido HTTP/3', 'HTTP/3 request'),
      resumo: t('Já no primeiro RTT', 'Already in the first RTT'),
      descricao: t(
        'O navegador confere o certificado, envia seu Finished num pacote Handshake e, no mesmo datagrama, já manda o pedido HTTP/3 num pacote 1-RTT de cabeçalho curto. O GET sai um RTT depois do primeiro pacote, contra dois no TCP + TLS.',
        'The browser checks the certificate, sends its Finished in a Handshake packet and, in the same datagram, already sends the HTTP/3 request in a short-header 1-RTT packet. The GET leaves one RTT after the first packet, versus two with TCP + TLS.',
      ),
      fatos: [
        [t('Fluxo', 'Stream'), t('0 (bidirecional, do cliente)', '0 (client-initiated, bidirectional)')],
        [t('Cabeçalhos', 'Headers'), t('Comprimidos com QPACK', 'Compressed with QPACK')],
        [t('Pedido', 'Request'), t('GET https://www.example.com/', 'GET https://www.example.com/')],
      ],
      pacotes: [
        datagrama(
          'cliente',
          ['FINISHED + GET', 'FINISHED + GET'],
          ['Handshake, PKN: 0, ACK, CRYPTO; Protected Payload (KP0)', 'Handshake, PKN: 0, ACK, CRYPTO; Protected Payload (KP0)'],
          'dados',
          [
            ...longo('e1', 'Handshake', CID_SERVIDOR, CID_CLIENTE, 2, 58, ['ACK + CRYPTO (Finished)', 'ACK + CRYPTO (Finished)'], false),
            ...curto(CID_SERVIDOR, 98, ['STREAM 0: HEADERS (GET /)', 'STREAM 0: HEADERS (GET /)']),
          ],
          17,
          ['Finished + GET / (HTTP/3)', 'Finished + GET / (HTTP/3)'],
        ),
      ],
    },
    {
      titulo: t('Resposta e ACK', 'Response and ACK'),
      resumo: t('Fluxos independentes', 'Independent streams'),
      descricao: t(
        'O servidor confirma o fim do aperto de mão (HANDSHAKE_DONE), oferece novos IDs de conexão e manda a resposta no fluxo 0. Se um pacote se perder, só o fluxo dele espera o reenvio: os outros seguem, ao contrário do TCP, onde tudo para.',
        'The server confirms the end of the handshake (HANDSHAKE_DONE), offers new connection IDs and sends the response on stream 0. If a packet is lost, only its own stream waits for the resend: the others keep going, unlike TCP, where everything stalls.',
      ),
      fatos: [
        [t('Quadros', 'Frames'), t('HANDSHAKE_DONE, NEW_CONNECTION_ID, STREAM', 'HANDSHAKE_DONE, NEW_CONNECTION_ID, STREAM')],
        [t('Status', 'Status'), t('200', '200')],
        [t('Números de pacote', 'Packet numbers'), t('Nunca se repetem, nem no reenvio', 'Never reused, not even on resend')],
      ],
      pacotes: [
        datagrama(
          'servidor',
          ['200 OK', '200 OK'],
          [`Protected Payload (KP0), DCID=${semEspaco(CID_CLIENTE)}`, `Protected Payload (KP0), DCID=${semEspaco(CID_CLIENTE)}`],
          'dados',
          curto(CID_CLIENTE, 1180, ['HANDSHAKE_DONE + STREAM 0: HEADERS + DATA', 'HANDSHAKE_DONE + STREAM 0: HEADERS + DATA']),
          18,
          ['200 OK + começo do HTML', '200 OK + start of the HTML'],
        ),
        datagrama(
          'cliente',
          ['ACK', 'ACK'],
          [`Protected Payload (KP0), DCID=${semEspaco(CID_SERVIDOR)}`, `Protected Payload (KP0), DCID=${semEspaco(CID_SERVIDOR)}`],
          'dados',
          curto(CID_SERVIDOR, 20, ['ACK', 'ACK']),
          1,
          ['Confirma o pacote do servidor', 'Acknowledges the server’s packet'],
        ),
      ],
    },
    {
      titulo: t('Trocar de rede', 'Switch networks'),
      resumo: t('Mesma conexão, outro IP', 'Same connection, new IP'),
      descricao: t(
        'O notebook sai do Wi-Fi e passa para o hotspot do celular: IP e porta mudam. Com TCP, a conexão morreria. No QUIC, o notebook continua com um dos novos IDs de conexão e manda um PATH_CHALLENGE; o servidor responde com PATH_RESPONSE e o download segue.',
        'The laptop leaves the Wi-Fi and moves to the phone’s hotspot: IP and port change. With TCP the connection would die. With QUIC the laptop carries on with one of the new connection IDs and sends a PATH_CHALLENGE; the server answers with PATH_RESPONSE and the download continues.',
      ),
      fatos: [
        [t('Novo endereço', 'New address'), t('172.20.10.4:61822', '172.20.10.4:61822')],
        [t('Novo ID de conexão', 'New connection ID'), t(semEspaco(CID_NOVO), semEspaco(CID_NOVO))],
        [t('Privacidade', 'Privacy'), t('ID novo: a rede não liga os dois caminhos', 'New ID: the network cannot link both paths')],
      ],
      pacotes: [
        datagrama(
          'cliente',
          ['PATH_CHALLENGE', 'PATH_CHALLENGE'],
          [`Protected Payload (KP0), DCID=${semEspaco(CID_NOVO)}`, `Protected Payload (KP0), DCID=${semEspaco(CID_NOVO)}`],
          'caminho',
          curto(CID_NOVO, 41, ['PATH_CHALLENGE + ACK', 'PATH_CHALLENGE + ACK']),
          3200,
          ['Desafio de 8 bytes pelo novo caminho', '8-byte challenge over the new path'],
          { origemIp: '172.20.10.4', porta: 61822 },
        ),
        datagrama(
          'servidor',
          ['PATH_RESPONSE', 'PATH_RESPONSE'],
          [`Protected Payload (KP0), DCID=${semEspaco(CID_CLIENTE)}`, `Protected Payload (KP0), DCID=${semEspaco(CID_CLIENTE)}`],
          'caminho',
          curto(CID_CLIENTE, 41, ['PATH_RESPONSE + STREAM 0', 'PATH_RESPONSE + STREAM 0']),
          22,
          ['Os mesmos 8 bytes de volta', 'The same 8 bytes back'],
          { destinoIp: '172.20.10.4', porta: 61822 },
        ),
      ],
    },
  ],
};
