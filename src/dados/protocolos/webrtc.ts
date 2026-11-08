import { hex, no, nos, opaco, t } from '../base';
import type { Campo, Pacote, Protocolo } from '../tipos';

const COOKIE = '21 12 a4 42';
const MAPEADO = '00 20 00 08 00 01 f5 23 e7 21 c0 45';
const ascii = (s: string): string => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
const u16 = (n: number): string => `${(n >> 8).toString(16).padStart(2, '0')} ${(n & 0xff).toString(16).padStart(2, '0')}`;

const sdp = (tamanho: number, nome: [string, string], explicacao: [string, string]): Campo[] => [
  hex(t('Registro TLS', 'TLS record'), `17 03 03 ${u16(tamanho)}`, `Application Data, ${tamanho} bytes`, t('A sinalização vai por WebSocket seguro (wss://).', 'Signaling travels over secure WebSocket (wss://).')),
  opaco(t(nome[0], nome[1]), tamanho, t(explicacao[0], explicacao[1])),
];

const sinal = (
  de: 'cliente' | 'sinalizacao' | 'celular',
  para: 'cliente' | 'sinalizacao' | 'celular',
  portas: [number, number],
  seq: number,
  ack: number,
  rotulo: [string, string],
  carga: Campo[],
  dt: number,
  resumo: [string, string],
): Pacote => ({
  de,
  para,
  proto: 'TLSv1.3',
  rotulo: t(rotulo[0], rotulo[1]),
  info: t('Application Data', 'Application Data'),
  tipo: 'sinal',
  resumo: t(resumo[0], resumo[1]),
  dt,
  quadro: {
    ...(de !== 'cliente' ? { ttl: 54 } : {}),
    tcp: { origem: portas[0], destino: portas[1], seq, ack, flags: 'PSH,ACK' },
    carga,
    camada: 'TLS',
  },
});

const stunCabecalho = (tipo: string, nomeTipo: string, tamanho: number, transacao: string): Campo[] => [
  hex(t('Tipo de mensagem', 'Message type'), tipo, nomeTipo, t('Classe (pedido ou resposta) e método (Binding).', 'Class (request or response) and method (Binding).')),
  hex(t('Tamanho', 'Length'), u16(tamanho), `${tamanho} bytes`, t('Só os atributos, sem os 20 bytes do cabeçalho.', 'Attributes only, excluding the 20-byte header.')),
  hex(t('Magic cookie', 'Magic cookie'), COOKIE, '0x2112a442', t('Valor fixo que identifica o STUN moderno.', 'A fixed value that marks modern STUN.')),
  hex(t('ID da transação', 'Transaction ID'), transacao, transacao.replace(/\s/g, ''), t('96 bits aleatórios: liga a resposta ao pedido.', '96 random bits: matches the answer to the request.'), true),
];

const TRANSACAO_STUN = 'b7 e7 a7 01 bc 34 d6 86 fa 87 df ae';
const TRANSACAO_ICE = '4a 91 0c 6e 33 d2 85 17 e0 5b 7f a9';

const mapeado = hex(
  t('XOR-MAPPED-ADDRESS', 'XOR-MAPPED-ADDRESS'),
  MAPEADO,
  '198.51.100.7:54321',
  t('O IP e a porta públicos vistos de fora, com XOR para nenhum NAT reescrever.', 'The public IP and port seen from outside, XORed so no NAT rewrites them.'),
);

const integridade = [
  hex(t('MESSAGE-INTEGRITY', 'MESSAGE-INTEGRITY'), '00 08 00 14', 'HMAC-SHA1, 20 bytes', t('Assinado com a senha ICE trocada no SDP.', 'Signed with the ICE password exchanged in the SDP.')),
  opaco(t('HMAC', 'HMAC'), 20),
  hex(t('FINGERPRINT', 'FINGERPRINT'), '80 28 00 04', 'CRC-32', t('Separa o STUN de outros pacotes na mesma porta.', 'Tells STUN apart from other packets on the same port.')),
  opaco(t('CRC-32', 'CRC-32'), 4),
];

const dtls = (tipo: string, epoca: string, seq: string, tamanho: number, nome: [string, string], explicacao: [string, string]): Campo[] => [
  hex(
    t('Registro DTLS', 'DTLS record'),
    `${tipo} fe fd ${epoca} ${seq} ${u16(tamanho)}`,
    `Handshake, DTLS 1.2, ${tamanho} bytes`,
    t('Tipo, versão, época, número de sequência e tamanho: o DTLS numera registros porque o UDP perde e embaralha.', 'Type, version, epoch, sequence number and length: DTLS numbers records because UDP loses and reorders them.'),
  ),
  opaco(t(nome[0], nome[1]), tamanho, t(explicacao[0], explicacao[1])),
];

const rtp = (marcador: string, seq: number, timestamp: string, ssrc: string, carga: number, nome: [string, string]): Campo[] => [
  hex(
    t('Versão, flags, tipo de carga', 'Version, flags, payload type'),
    marcador,
    marcador === '80 6f' ? 'V=2, PT=111 (Opus)' : marcador === '80 e0' ? 'V=2, M=1, PT=96 (VP8)' : 'V=2, PT=96 (VP8)',
    t('O tipo de carga diz qual codec, como combinado no SDP.', 'The payload type names the codec, as agreed in the SDP.'),
  ),
  hex(t('Sequência', 'Sequence'), u16(seq), String(seq), t('Para detectar perdas e reordenar.', 'To detect loss and reorder.')),
  hex(t('Timestamp', 'Timestamp'), timestamp, timestamp.replace(/\s/g, ''), t('Instante da amostra no relógio do codec.', 'Sampling instant on the codec clock.'), true),
  hex(t('SSRC', 'SSRC'), ssrc, ssrc.replace(/\s/g, ''), t('Identifica a fonte: esta câmera ou este microfone.', 'Identifies the source: this camera or this microphone.'), true),
  opaco(t(nome[0], nome[1]), carga, t('Cifrado com AES; o cabeçalho RTP fica em claro.', 'AES-encrypted; the RTP header stays in the clear.')),
  opaco(t('Tag de autenticação', 'Authentication tag'), 10, t('HMAC truncado: detecta adulteração.', 'Truncated HMAC: detects tampering.')),
];

const udp = (
  de: 'cliente' | 'stun' | 'celular',
  para: 'cliente' | 'stun' | 'celular',
  proto: string,
  rotulo: [string, string],
  info: [string, string],
  tipo: string,
  carga: Campo[],
  dt: number,
  resumo: [string, string],
): Pacote => {
  const porta = (n: string): number => (n === 'cliente' ? 50000 : n === 'stun' ? 3478 : 61000);
  return {
    de,
    para,
    proto,
    rotulo: t(rotulo[0], rotulo[1]),
    info: t(info[0], info[1]),
    tipo,
    resumo: t(resumo[0], resumo[1]),
    dt,
    quadro: {
      ...(de !== 'cliente' ? { ttl: 54 } : {}),
      udp: { origem: porta(de), destino: porta(para) },
      carga,
      camada: proto === 'STUN' ? 'STUN' : proto.startsWith('DTLS') ? 'DTLS' : 'SRTP',
    },
  };
};

export const webrtc: Protocolo = {
  id: 'webrtc',
  sigla: 'WebRTC',
  nome: t('Comunicação Web em Tempo Real', 'Web Real-Time Communication'),
  resumo: t('Chamadas de vídeo no navegador', 'Browser video calls'),
  categoria: 'aplicacao',
  camada: 7,
  descricao: t(
    'O WebRTC liga dois navegadores direto, sem servidor no meio da mídia. Primeiro eles trocam ofertas por um servidor de sinalização qualquer; depois descobrem seus endereços públicos com STUN, testam caminhos através dos NATs com ICE, combinam chaves com DTLS e enviam áudio e vídeo cifrados com SRTP.',
    'WebRTC connects two browsers directly, with no server in the middle of the media. First they swap offers through any signaling server; then they learn their public addresses with STUN, test paths through the NATs with ICE, agree on keys with DTLS and send encrypted audio and video with SRTP.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Transporte', 'Transport'), t('UDP (SRTP; dados via SCTP sobre DTLS)', 'UDP (SRTP; data via SCTP over DTLS)')],
    [t('Travessia de NAT', 'NAT traversal'), t('ICE com STUN e TURN', 'ICE with STUN and TURN')],
    [t('Segurança', 'Security'), t('DTLS-SRTP, sempre cifrado', 'DTLS-SRTP, always encrypted')],
    [t('Sinalização', 'Signaling'), t('Livre: WebSocket, HTTP...', 'Up to the app: WebSocket, HTTP...')],
    [t('Definido em', 'Defined in'), t('RFC 8825–8835, W3C WebRTC', 'RFC 8825–8835, W3C WebRTC')],
  ],
  legenda: {
    sinal: { nome: t('Sinalização', 'Signaling'), cor: 'anil' },
    stun: { nome: t('STUN / ICE', 'STUN / ICE'), cor: 'ouro' },
    dtls: { nome: t('DTLS', 'DTLS'), cor: 'neutra' },
    midia: { nome: t('Mídia SRTP', 'SRTP media'), cor: 'oliva' },
  },
  observacao: t('RTCP e ACKs do TCP não aparecem', 'RTCP and TCP ACKs not shown'),
  nos: [
    no('cliente', 'notebook', t('Notebook', 'Laptop'), 10, 74, '192.168.1.10'),
    nos.roteador(28, 58),
    nos.internet(52, 72),
    no('stun', 'servidor', t('Servidor STUN', 'STUN server'), 40, 22, '198.51.100.40'),
    no('sinalizacao', 'servidor', t('Sinalização', 'Signaling'), 68, 22, '203.0.113.30'),
    no('celular', 'celular', t('Celular', 'Phone'), 88, 66, '192.0.2.77'),
  ],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'stun'],
    ['internet', 'sinalizacao'],
    ['internet', 'celular'],
  ],
  faixas: ['cliente', 'stun', 'sinalizacao', 'celular'],
  passos: [
    {
      titulo: t('Oferta e resposta', 'Offer and answer'),
      resumo: t('SDP pela sinalização', 'SDP via signaling'),
      descricao: t(
        'O notebook descreve a chamada num SDP: codecs (VP8, Opus), credenciais ICE e a impressão digital do seu certificado DTLS. O WebRTC não define como entregar isso; aqui o app usa WebSocket seguro. O servidor repassa a oferta ao celular, que devolve sua resposta pelo mesmo caminho.',
        'The laptop describes the call in an SDP: codecs (VP8, Opus), ICE credentials and the fingerprint of its DTLS certificate. WebRTC does not define how to deliver it; here the app uses secure WebSocket. The server relays the offer to the phone, which sends its answer back the same way.',
      ),
      fatos: [
        [t('Formato', 'Format'), t('SDP (oferta/resposta, JSEP)', 'SDP (offer/answer, JSEP)')],
        [t('Codecs', 'Codecs'), t('VP8 (vídeo), Opus (áudio)', 'VP8 (video), Opus (audio)')],
        [t('Impressão digital', 'Fingerprint'), t('SHA-256 do certificado DTLS', 'SHA-256 of the DTLS certificate')],
      ],
      pacotes: [
        sinal('cliente', 'sinalizacao', [52611, 443], 845, 3120, ['OFERTA', 'OFFER'], sdp(1200, ['SDP de oferta', 'SDP offer'], ['m=video, m=audio, ice-ufrag, a=fingerprint...', 'm=video, m=audio, ice-ufrag, a=fingerprint...']), 0, ['Oferta SDP do notebook', 'Laptop’s SDP offer']),
        sinal('sinalizacao', 'celular', [443, 40312], 7781, 2264, ['OFERTA', 'OFFER'], sdp(1200, ['SDP de oferta', 'SDP offer'], ['A mesma oferta, repassada.', 'The same offer, relayed.']), 21, ['Oferta repassada', 'Offer relayed']),
        sinal('celular', 'sinalizacao', [40312, 443], 2264, 8986, ['RESPOSTA', 'ANSWER'], sdp(1100, ['SDP de resposta', 'SDP answer'], ['Os codecs aceitos e as credenciais do celular.', 'The accepted codecs and the phone’s credentials.']), 140, ['Resposta SDP do celular', 'Phone’s SDP answer']),
        sinal('sinalizacao', 'cliente', [443, 52611], 3120, 2050, ['RESPOSTA', 'ANSWER'], sdp(1100, ['SDP de resposta', 'SDP answer'], ['A resposta, repassada ao notebook.', 'The answer, relayed to the laptop.']), 22, ['Resposta repassada', 'Answer relayed']),
      ],
    },
    {
      titulo: t('Descobrir o IP público', 'Find the public IP'),
      resumo: t('Uma pergunta ao STUN', 'One question to STUN'),
      descricao: t(
        'Atrás do NAT, o notebook só conhece 192.168.1.10. Ele pergunta ao servidor STUN "de onde você me vê?" e recebe 198.51.100.7:54321, o endereço que o roteador abriu para ele. Esse é o candidato server-reflexive, enviado ao celular pela sinalização.',
        'Behind the NAT, the laptop only knows 192.168.1.10. It asks the STUN server "where do you see me from?" and gets 198.51.100.7:54321, the address the router opened for it. That is the server-reflexive candidate, sent to the phone via signaling.',
      ),
      fatos: [
        [t('Candidato local', 'Host candidate'), t('192.168.1.10:50000', '192.168.1.10:50000')],
        [t('Candidato público', 'Server-reflexive candidate'), t('198.51.100.7:54321', '198.51.100.7:54321')],
        [t('Servidor', 'Server'), t('STUN, UDP 3478', 'STUN, UDP 3478')],
      ],
      pacotes: [
        udp('cliente', 'stun', 'STUN', ['BINDING', 'BINDING'], ['Binding Request', 'Binding Request'], 'stun', stunCabecalho('00 01', 'Binding Request', 0, TRANSACAO_STUN), 30, ['De onde você me vê?', 'Where do you see me from?']),
        udp(
          'stun',
          'cliente',
          'STUN',
          ['BINDING OK', 'BINDING OK'],
          ['Binding Success Response XOR-MAPPED-ADDRESS: 198.51.100.7:54321', 'Binding Success Response XOR-MAPPED-ADDRESS: 198.51.100.7:54321'],
          'stun',
          [...stunCabecalho('01 01', 'Binding Success', 12, TRANSACAO_STUN), mapeado],
          19,
          ['Você é 198.51.100.7:54321', 'You are 198.51.100.7:54321'],
        ),
      ],
    },
    {
      titulo: t('Testes de conectividade', 'Connectivity checks'),
      resumo: t('ICE abre caminho pelos NATs', 'ICE punches through the NATs'),
      descricao: t(
        'Com os candidatos dos dois lados, o ICE testa pares diretamente: o notebook manda um Binding Request ao endereço público do celular. A saída abre uma brecha no NAT do notebook e a resposta entra por ela. Se nenhum par direto funcionar, a mídia passa por um servidor TURN.',
        'With candidates from both sides, ICE tests pairs directly: the laptop sends a Binding Request to the phone’s public address. Going out opens a hole in the laptop’s NAT and the answer comes in through it. If no direct pair works, the media goes through a TURN relay.',
      ),
      fatos: [
        [t('Par escolhido', 'Selected pair'), t('198.51.100.7:54321 ↔ 192.0.2.77:61000', '198.51.100.7:54321 ↔ 192.0.2.77:61000')],
        [t('Autenticação', 'Authentication'), t('Usuário e senha ICE do SDP', 'ICE username and password from the SDP')],
        [t('Plano B', 'Fallback'), t('Retransmissão por TURN', 'Relay through TURN')],
      ],
      pacotes: [
        udp(
          'cliente',
          'celular',
          'STUN',
          ['CHECAGEM ICE', 'ICE CHECK'],
          ['Binding Request user: Ab9Z:Xq3k', 'Binding Request user: Ab9Z:Xq3k'],
          'stun',
          [
            ...stunCabecalho('00 01', 'Binding Request', 72, TRANSACAO_ICE),
            hex(t('USERNAME', 'USERNAME'), `00 06 00 09 ${ascii('Ab9Z:Xq3k')} 00 00 00`, 'Ab9Z:Xq3k', t('Fragmentos de usuário dos dois lados, trocados no SDP.', 'Both sides’ username fragments, swapped in the SDP.')),
            hex(t('PRIORITY', 'PRIORITY'), '00 24 00 04 6e 7f 1e ff', '1853824767', t('Quanto este candidato é preferido.', 'How much this candidate is preferred.')),
            hex(t('ICE-CONTROLLING', 'ICE-CONTROLLING'), '80 2a 00 08 7c 2d 19 a0 55 e3 0b 64', '0x7c2d19a055e30b64', t('Quem controla escolhe o par final.', 'The controlling side picks the final pair.'), true),
            hex(t('USE-CANDIDATE', 'USE-CANDIDATE'), '00 25 00 00', '—', t('Nomeia este par para a mídia.', 'Nominates this pair for the media.')),
            ...integridade,
          ],
          45,
          ['Checagem ICE para 192.0.2.77:61000', 'ICE check to 192.0.2.77:61000'],
        ),
        udp(
          'celular',
          'cliente',
          'STUN',
          ['CHECAGEM OK', 'CHECK OK'],
          ['Binding Success Response XOR-MAPPED-ADDRESS: 198.51.100.7:54321', 'Binding Success Response XOR-MAPPED-ADDRESS: 198.51.100.7:54321'],
          'stun',
          [...stunCabecalho('01 01', 'Binding Success', 44, TRANSACAO_ICE), mapeado, ...integridade],
          38,
          ['Caminho direto confirmado', 'Direct path confirmed'],
        ),
      ],
    },
    {
      titulo: t('Aperto de mão DTLS', 'DTLS handshake'),
      resumo: t('Chaves combinadas sobre o UDP', 'Keys agreed over UDP'),
      descricao: t(
        'No caminho que funcionou, os dois fazem um aperto de mão DTLS, o TLS adaptado ao UDP. Cada lado confere se o certificado recebido bate com a impressão digital do SDP. Dele saem as chaves do SRTP, por isso nem o servidor de sinalização consegue ouvir a chamada.',
        'On the path that worked, both sides run a DTLS handshake, TLS adapted to UDP. Each side checks that the certificate it receives matches the fingerprint in the SDP. The SRTP keys come out of it, so not even the signaling server can listen in.',
      ),
      fatos: [
        [t('Versão', 'Version'), t('DTLS 1.2', 'DTLS 1.2')],
        [t('Certificados', 'Certificates'), t('Autoassinados, validados pela impressão digital', 'Self-signed, validated by fingerprint')],
        [t('Extensão', 'Extension'), t('use_srtp: exporta as chaves de mídia', 'use_srtp: exports the media keys')],
      ],
      pacotes: [
        udp('cliente', 'celular', 'DTLSv1.2', ['CLIENT HELLO', 'CLIENT HELLO'], ['Client Hello', 'Client Hello'], 'dtls', dtls('16', '00 00', '00 00 00 00 00 00', 168, ['ClientHello', 'ClientHello'], ['Cifras, use_srtp e um aleatório.', 'Ciphers, use_srtp and a random value.']), 4, ['ClientHello com use_srtp', 'ClientHello with use_srtp']),
        udp(
          'celular',
          'cliente',
          'DTLSv1.2',
          ['SERVER HELLO', 'SERVER HELLO'],
          ['Server Hello, Certificate, Server Key Exchange, Certificate Request, Server Hello Done', 'Server Hello, Certificate, Server Key Exchange, Certificate Request, Server Hello Done'],
          'dtls',
          dtls('16', '00 00', '00 00 00 00 00 00', 752, ['ServerHello … ServerHelloDone', 'ServerHello … ServerHelloDone'], ['Certificado ECDSA autoassinado e a chave efêmera.', 'Self-signed ECDSA certificate and the ephemeral key.']),
          38,
          ['Certificado do celular', 'Phone’s certificate'],
        ),
        udp(
          'cliente',
          'celular',
          'DTLSv1.2',
          ['FINISHED', 'FINISHED'],
          ['Certificate, Client Key Exchange, Certificate Verify, Change Cipher Spec, Encrypted Handshake Message', 'Certificate, Client Key Exchange, Certificate Verify, Change Cipher Spec, Encrypted Handshake Message'],
          'dtls',
          dtls('16', '00 00', '00 00 00 00 00 01', 470, ['Certificate … Finished', 'Certificate … Finished'], ['O certificado do notebook, sua chave e o Finished.', 'The laptop’s certificate, its key and the Finished.']),
          3,
          ['Certificado do notebook + Finished', 'Laptop’s certificate + Finished'],
        ),
      ],
    },
    {
      titulo: t('Mídia SRTP', 'SRTP media'),
      resumo: t('Vídeo e áudio direto, cifrados', 'Video and audio, direct and encrypted'),
      descricao: t(
        'A chamada começa. Cada quadro de vídeo VP8 vira alguns pacotes RTP de até ~1200 bytes; o último leva o bit M. O áudio Opus vai em pacotes pequenos a cada 20 ms. O SRTP cifra a carga e adiciona uma tag de autenticação, deixando o cabeçalho RTP legível para medir perdas e atraso.',
        'The call begins. Each VP8 video frame becomes a few RTP packets of up to ~1200 bytes; the last one carries the M bit. Opus audio goes in small packets every 20 ms. SRTP encrypts the payload and adds an authentication tag, leaving the RTP header readable for loss and delay stats.',
      ),
      fatos: [
        [t('Vídeo', 'Video'), t('VP8, PT 96, 90 kHz', 'VP8, PT 96, 90 kHz')],
        [t('Áudio', 'Audio'), t('Opus, PT 111, 20 ms por pacote', 'Opus, PT 111, 20 ms per packet')],
        [t('Caminho', 'Path'), t('Direto, par a par', 'Direct, peer to peer')],
      ],
      pacotes: [
        udp('cliente', 'celular', 'SRTP', ['VÍDEO', 'VIDEO'], ['PT=VP8, SSRC=0xA34F9B21, Seq=6699, Time=1581194240', 'PT=VP8, SSRC=0xA34F9B21, Seq=6699, Time=1581194240'], 'midia', rtp('80 60', 6699, '5e 3f 1c 00', 'a3 4f 9b 21', 1100, ['Vídeo VP8 (parte 1)', 'VP8 video (part 1)']), 30, ['Quadro de vídeo, parte 1', 'Video frame, part 1']),
        udp('cliente', 'celular', 'SRTP', ['VÍDEO', 'VIDEO'], ['PT=VP8, SSRC=0xA34F9B21, Seq=6700, Time=1581194240, Mark', 'PT=VP8, SSRC=0xA34F9B21, Seq=6700, Time=1581194240, Mark'], 'midia', rtp('80 e0', 6700, '5e 3f 1c 00', 'a3 4f 9b 21', 640, ['Vídeo VP8 (parte 2)', 'VP8 video (part 2)']), 0, ['Último pedaço do quadro (M=1)', 'Last piece of the frame (M=1)']),
        udp('celular', 'cliente', 'SRTP', ['ÁUDIO', 'AUDIO'], ['PT=Opus, SSRC=0x1C7E04D5, Seq=31544, Time=8848320', 'PT=Opus, SSRC=0x1C7E04D5, Seq=31544, Time=8848320'], 'midia', rtp('80 6f', 31544, '00 87 03 c0', '1c 7e 04 d5', 80, ['Áudio Opus (20 ms)', 'Opus audio (20 ms)']), 8, ['20 ms de voz do celular', '20 ms of voice from the phone']),
      ],
    },
  ],
};
