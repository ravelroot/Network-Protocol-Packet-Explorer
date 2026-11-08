import { hex, no, nos, opaco, t } from '../base';
import type { Campo, Pacote, Protocolo } from '../tipos';

const PORTA_CLIENTE = 41414;
const PORTA_SERVIDOR = 51820;

const indice = (bytes: string): string =>
  `0x${bytes.split(' ').reverse().join('').toUpperCase()}`;

const iniciacao = (remetente: string): Campo[] => [
  hex(t('Tipo, reservado', 'Type, reserved'), '01 00 00 00', 'Handshake Initiation (1)', t('Primeira mensagem do handshake Noise IK.', 'First message of the Noise IK handshake.')),
  hex(t('Índice do remetente', 'Sender index'), remetente, indice(remetente), t('Número que o cliente escolhe para reconhecer esta sessão.', 'A number the client picks to recognise this session.'), true),
  opaco(t('Chave efêmera', 'Ephemeral key'), 32, t('Chave pública Curve25519 nova, só para este handshake.', 'A fresh Curve25519 public key, for this handshake only.')),
  opaco(t('Chave estática (cifrada)', 'Static key (encrypted)'), 48, t('A identidade do cliente, cifrada: quem observa não descobre quem é.', "The client's identity, encrypted: an observer cannot tell who it is.")),
  opaco(t('Carimbo de tempo (cifrado)', 'Timestamp (encrypted)'), 28, t('TAI64N: impede que alguém repita esta mensagem depois.', 'TAI64N: stops anyone replaying this message later.')),
  opaco(t('MAC1', 'MAC1'), 16, t('Prova que o cliente conhece a chave pública do servidor; sem isso, silêncio.', "Proves the client knows the server's public key; without it, silence.")),
  hex(t('MAC2', 'MAC2'), '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00', 'zero', t('Só é usado quando o servidor está sob carga e pede um cookie.', 'Only used when the server is under load and asks for a cookie.')),
];

const resposta = (remetente: string, receptor: string): Campo[] => [
  hex(t('Tipo, reservado', 'Type, reserved'), '02 00 00 00', 'Handshake Response (2)'),
  hex(t('Índice do remetente', 'Sender index'), remetente, indice(remetente), t('O número do lado do servidor.', "The server side's number."), true),
  hex(t('Índice do receptor', 'Receiver index'), receptor, indice(receptor), t('Repete o número do cliente: liga a resposta à iniciação.', "Echoes the client's number: ties the response to the initiation."), true),
  opaco(t('Chave efêmera', 'Ephemeral key'), 32, t('A chave efêmera do servidor; com ela os dois derivam as chaves da sessão.', "The server's ephemeral key; with it both derive the session keys.")),
  opaco(t('Vazio (cifrado)', 'Empty (encrypted)'), 16, t('Só a etiqueta Poly1305: prova que o servidor calculou as mesmas chaves.', 'Just the Poly1305 tag: proves the server derived the same keys.')),
  opaco(t('MAC1', 'MAC1'), 16),
  hex(t('MAC2', 'MAC2'), '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00', 'zero'),
];

const transporte = (receptor: string, contador: number, bytes: number): Campo[] => [
  hex(t('Tipo, reservado', 'Type, reserved'), '04 00 00 00', 'Transport Data (4)', t('Pacote de dados do túnel.', 'A tunnel data packet.')),
  hex(t('Índice do receptor', 'Receiver index'), receptor, indice(receptor), t('Diz ao outro lado qual sessão (e qual chave) usar.', 'Tells the other side which session (and key) to use.'), true),
  hex(
    t('Contador', 'Counter'),
    Array.from({ length: 8 }, (_, i) => (i === 0 ? contador : 0).toString(16).padStart(2, '0')).join(' '),
    String(contador),
    t('Nonce de 64 bits que só cresce: pacotes repetidos são descartados.', 'A 64-bit nonce that only grows: replayed packets are dropped.'),
  ),
  ...(bytes > 0
    ? [opaco(t('Pacote IP interno (cifrado)', 'Inner IP packet (encrypted)'), bytes, t('O pacote original inteiro, com seus IPs internos, cifrado com ChaCha20.', 'The whole original packet, with its inner IPs, encrypted with ChaCha20.'))]
    : []),
  opaco(t('Etiqueta Poly1305', 'Poly1305 tag'), 16, t('Autentica o pacote: qualquer alteração é detectada.', 'Authenticates the packet: any change is detected.')),
];

const wg = (doCliente: boolean, base: Omit<Pacote, 'de' | 'para' | 'proto' | 'quadro'>, carga: Campo[]): Pacote => ({
  ...base,
  de: doCliente ? 'cliente' : 'vpn',
  para: doCliente ? 'vpn' : 'cliente',
  proto: 'WireGuard',
  quadro: {
    ...(doCliente ? {} : { ttl: 54 }),
    udp: doCliente ? { origem: PORTA_CLIENTE, destino: PORTA_SERVIDOR } : { origem: PORTA_SERVIDOR, destino: PORTA_CLIENTE },
    carga,
  },
});

export const wireguard: Protocolo = {
  id: 'wireguard',
  sigla: 'WireGuard',
  nome: t('WireGuard', 'WireGuard'),
  resumo: t('Uma VPN moderna', 'A modern VPN'),
  categoria: 'seguranca',
  camada: 3,
  descricao: t(
    'O WireGuard cria um túnel cifrado que leva pacotes IP inteiros de uma ponta a outra, sobre UDP. Cada lado é identificado só por uma chave pública. O handshake, baseado no Noise IK, cabe em duas mensagens (148 e 92 bytes); depois cada pacote de dados tem só 32 bytes de acréscimo. Para quem não tem a chave certa, o servidor nem responde: parece desligado.',
    'WireGuard builds an encrypted tunnel that carries whole IP packets from end to end over UDP. Each side is identified only by a public key. The handshake, based on Noise IK, fits in two messages (148 and 92 bytes); after that each data packet adds only 32 bytes. To anyone without the right key, the server never answers: it looks switched off.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Rede (camada 3): túnel de pacotes IP', 'Network (Layer 3): IP packet tunnel')],
    [t('Porta', 'Port'), t('UDP 51820 (configurável)', 'UDP 51820 (configurable)')],
    [t('Criptografia', 'Cryptography'), t('Noise IK: Curve25519, ChaCha20-Poly1305, BLAKE2s', 'Noise IK: Curve25519, ChaCha20-Poly1305, BLAKE2s')],
    [t('Handshake', 'Handshake'), t('1 ida e volta: 148 + 92 bytes', '1 round trip: 148 + 92 bytes')],
    [t('Chaves', 'Keys'), t('Renovadas a cada 2 minutos', 'Renewed every 2 minutes')],
    [t('Definido em', 'Defined in'), t('Whitepaper WireGuard (NDSS 2017); Linux 5.6+', 'WireGuard whitepaper (NDSS 2017); Linux 5.6+')],
  ],
  legenda: {
    handshake: { nome: t('Handshake', 'Handshake'), cor: 'anil' },
    tunel: { nome: t('Dados no túnel', 'Tunnel data'), cor: 'brasa' },
    interno: { nome: t('Tráfego interno', 'Inner traffic'), cor: 'oliva' },
    keepalive: { nome: t('Keepalive', 'Keepalive'), cor: 'neutra' },
  },
  nos: [
    nos.cliente(12, 74),
    nos.roteador(30, 58),
    nos.internet(48, 74),
    no('vpn', 'escudo', t('Servidor WireGuard', 'WireGuard Server'), 68, 44, '203.0.113.50'),
    no('intranet', 'servidor', t('Intranet', 'Intranet'), 88, 22, '10.0.0.20'),
  ],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'vpn'],
    ['vpn', 'intranet'],
  ],
  faixas: ['cliente', 'vpn', 'intranet'],
  passos: [
    {
      titulo: t('Iniciação do handshake', 'Handshake initiation'),
      resumo: t('O cliente se apresenta, cifrado', 'The client introduces itself, encrypted'),
      descricao: t(
        'Ao enviar o primeiro pacote para a rede da empresa, o notebook dispara o handshake. Ele manda uma chave efêmera, sua chave estática cifrada e um carimbo de tempo cifrado. O MAC1 prova que ele conhece a chave pública do servidor: sem isso, o servidor descarta em silêncio e nem revela que existe.',
        "When the laptop first sends a packet towards the company network, it kicks off the handshake. It sends an ephemeral key, its encrypted static key and an encrypted timestamp. MAC1 proves it knows the server's public key: without it, the server silently drops the packet and never reveals it exists.",
      ),
      fatos: [
        [t('Mensagem', 'Message'), t('Handshake Initiation, 148 bytes', 'Handshake Initiation, 148 bytes')],
        [t('Padrão', 'Pattern'), t('Noise IK', 'Noise IK')],
        [t('Identidade', 'Identity'), t('Chave pública Curve25519', 'Curve25519 public key')],
        [t('Proteção', 'Protection'), t('Contra repetição (TAI64N) e varredura (MAC1)', 'Against replay (TAI64N) and scanning (MAC1)')],
      ],
      pacotes: [
        wg(
          true,
          {
            rotulo: t('INICIAÇÃO', 'INITIATION'),
            info: t('Handshake Initiation, sender=0x3A9C4107', 'Handshake Initiation, sender=0x3A9C4107'),
            tipo: 'handshake',
            resumo: t('Iniciação · remetente 0x3A9C4107 · 148 bytes', 'Initiation · sender 0x3A9C4107 · 148 bytes'),
            dt: 0,
          },
          iniciacao('07 41 9c 3a'),
        ),
      ],
    },
    {
      titulo: t('Resposta do handshake', 'Handshake response'),
      resumo: t('Chaves prontas em 1 ida e volta', 'Keys ready in 1 round trip'),
      descricao: t(
        'O servidor confere se a chave estática do cliente está na sua lista de pares autorizados e se o carimbo é mais novo que o último. Então responde com sua chave efêmera. Com quatro trocas Diffie-Hellman, os dois derivam um par de chaves de sessão, uma para cada sentido.',
        "The server checks that the client's static key is in its list of allowed peers and that the timestamp is newer than the last one. Then it answers with its ephemeral key. With four Diffie-Hellman operations, both derive a pair of session keys, one per direction.",
      ),
      fatos: [
        [t('Mensagem', 'Message'), t('Handshake Response, 92 bytes', 'Handshake Response, 92 bytes')],
        [t('Pares autorizados', 'Allowed peers'), t('Chave pública + AllowedIPs 10.8.0.2/32', 'Public key + AllowedIPs 10.8.0.2/32')],
        [t('Sigilo futuro', 'Forward secrecy'), t('Sim: chaves efêmeras', 'Yes: ephemeral keys')],
      ],
      pacotes: [
        wg(
          false,
          {
            rotulo: t('RESPOSTA', 'RESPONSE'),
            info: t('Handshake Response, sender=0xB1882E5C, receiver=0x3A9C4107', 'Handshake Response, sender=0xB1882E5C, receiver=0x3A9C4107'),
            tipo: 'handshake',
            resumo: t('Resposta · remetente 0xB1882E5C · 92 bytes', 'Response · sender 0xB1882E5C · 92 bytes'),
            dt: 26,
          },
          resposta('5c 2e 88 b1', '07 41 9c 3a'),
        ),
      ],
    },
    {
      titulo: t('Dados pelo túnel', 'Data through the tunnel'),
      resumo: t('Um ping até a intranet', 'A ping to the intranet'),
      descricao: t(
        'O notebook faz ping em 10.0.0.20. O pacote ICMP inteiro, com o IP interno 10.8.0.2, é cifrado e vai dentro de um UDP comum. O servidor decifra, confere que 10.8.0.2 é mesmo daquele par (AllowedIPs) e entrega o ping na rede interna. A resposta faz o caminho inverso.',
        'The laptop pings 10.0.0.20. The whole ICMP packet, with the inner IP 10.8.0.2, is encrypted and carried inside an ordinary UDP datagram. The server decrypts it, checks that 10.8.0.2 really belongs to that peer (AllowedIPs) and delivers the ping on the internal network. The reply takes the reverse path.',
      ),
      fatos: [
        [t('IP no túnel', 'Tunnel IP'), t('10.8.0.2', '10.8.0.2')],
        [t('Acréscimo', 'Overhead'), t('32 bytes + cabeçalhos IP/UDP externos', '32 bytes + outer IP/UDP headers')],
        [t('Roteamento', 'Routing'), t('Por chave: AllowedIPs', 'By key: AllowedIPs')],
      ],
      pacotes: [
        wg(
          true,
          {
            rotulo: t('DADOS', 'DATA'),
            info: t('Transport Data, receiver=0xB1882E5C, counter=0, datalen=96', 'Transport Data, receiver=0xB1882E5C, counter=0, datalen=96'),
            tipo: 'tunel',
            resumo: t('Ping cifrado dentro do UDP', 'Encrypted ping inside UDP'),
            dt: 1,
          },
          transporte('5c 2e 88 b1', 0, 96),
        ),
        {
          de: 'vpn',
          para: 'intranet',
          proto: 'ICMP',
          rotulo: t('PING', 'PING'),
          info: t('Echo (ping) request id=0x1c2a, seq=1/256, ttl=63', 'Echo (ping) request id=0x1c2a, seq=1/256, ttl=63'),
          tipo: 'interno',
          resumo: t('10.8.0.2 → 10.0.0.20, já decifrado', '10.8.0.2 → 10.0.0.20, already decrypted'),
          dt: 1,
          quadro: {
            origemIp: '10.8.0.2',
            ttl: 63,
            icmp: { tipo: 8, codigo: 0, id: 0x1c2a, seq: 1 },
            camada: 'ICMP',
            carga: [opaco(t('Dados do ping', 'Ping data'), 56, t('Bytes de preenchimento que voltam iguais na resposta.', 'Filler bytes that come back unchanged in the reply.'))],
          },
        },
        {
          de: 'intranet',
          para: 'vpn',
          proto: 'ICMP',
          rotulo: t('PONG', 'PONG'),
          info: t('Echo (ping) reply id=0x1c2a, seq=1/256, ttl=64', 'Echo (ping) reply id=0x1c2a, seq=1/256, ttl=64'),
          tipo: 'interno',
          resumo: t('10.0.0.20 → 10.8.0.2', '10.0.0.20 → 10.8.0.2'),
          dt: 1,
          quadro: {
            destinoIp: '10.8.0.2',
            icmp: { tipo: 0, codigo: 0, id: 0x1c2a, seq: 1 },
            camada: 'ICMP',
            carga: [opaco(t('Dados do ping', 'Ping data'), 56)],
          },
        },
        wg(
          false,
          {
            rotulo: t('DADOS', 'DATA'),
            info: t('Transport Data, receiver=0x3A9C4107, counter=0, datalen=96', 'Transport Data, receiver=0x3A9C4107, counter=0, datalen=96'),
            tipo: 'tunel',
            resumo: t('Resposta cifrada de volta ao notebook', 'Encrypted reply back to the laptop'),
            dt: 1,
          },
          transporte('07 41 9c 3a', 0, 96),
        ),
      ],
    },
    {
      titulo: t('Keepalive', 'Keepalive'),
      resumo: t('Mantém o NAT aberto', 'Keeps the NAT open'),
      descricao: t(
        'O WireGuard é silencioso: sem tráfego, não manda nada. Atrás de um NAT, porém, o roteador esquece o mapeamento em poucos minutos. Com PersistentKeepalive = 25, o cliente envia a cada 25 segundos um pacote de dados vazio, de 32 bytes, só para manter a porta aberta.',
        'WireGuard is quiet: with no traffic, it sends nothing. Behind NAT, however, the router forgets the mapping within minutes. With PersistentKeepalive = 25, the client sends an empty 32-byte data packet every 25 seconds just to keep the port open.',
      ),
      fatos: [
        [t('Configuração', 'Setting'), t('PersistentKeepalive = 25', 'PersistentKeepalive = 25')],
        [t('Tamanho', 'Size'), t('32 bytes: só cabeçalho e etiqueta', '32 bytes: header and tag only')],
      ],
      pacotes: [
        wg(
          true,
          {
            rotulo: t('KEEPALIVE', 'KEEPALIVE'),
            info: t('Keepalive, receiver=0xB1882E5C, counter=1', 'Keepalive, receiver=0xB1882E5C, counter=1'),
            tipo: 'keepalive',
            resumo: t('Pacote de dados vazio, 32 bytes', 'Empty data packet, 32 bytes'),
            dt: 25000,
          },
          transporte('5c 2e 88 b1', 1, 0),
        ),
      ],
    },
    {
      titulo: t('Rotação de chaves', 'Key rotation'),
      resumo: t('Chaves novas a cada 2 minutos', 'Fresh keys every 2 minutes'),
      descricao: t(
        'Depois de 120 segundos (REKEY_AFTER_TIME), o cliente refaz o handshake de forma transparente, com novos índices e novas chaves efêmeras. Mesmo que uma chave de sessão vaze, ela só abre uma janela de poucos minutos de tráfego.',
        'After 120 seconds (REKEY_AFTER_TIME), the client transparently redoes the handshake with new indices and new ephemeral keys. Even if a session key leaks, it only unlocks a window of a few minutes of traffic.',
      ),
      fatos: [
        [t('Gatilho', 'Trigger'), t('120 s ou 2⁶⁰ mensagens', '120 s or 2⁶⁰ messages')],
        [t('Para o usuário', 'For the user'), t('Nenhuma interrupção', 'No interruption')],
        [t('Contador', 'Counter'), t('Volta a 0 com a nova chave', 'Back to 0 with the new key')],
      ],
      pacotes: [
        wg(
          true,
          {
            rotulo: t('INICIAÇÃO', 'INITIATION'),
            info: t('Handshake Initiation, sender=0x557A10E3', 'Handshake Initiation, sender=0x557A10E3'),
            tipo: 'handshake',
            resumo: t('Novo handshake com novo índice', 'New handshake with a new index'),
            dt: 95000,
          },
          iniciacao('e3 10 7a 55'),
        ),
        wg(
          false,
          {
            rotulo: t('RESPOSTA', 'RESPONSE'),
            info: t('Handshake Response, sender=0x2F6D04A8, receiver=0x557A10E3', 'Handshake Response, sender=0x2F6D04A8, receiver=0x557A10E3'),
            tipo: 'handshake',
            resumo: t('Novas chaves de sessão', 'New session keys'),
            dt: 26,
          },
          resposta('a8 04 6d 2f', 'e3 10 7a 55'),
        ),
        wg(
          true,
          {
            rotulo: t('DADOS', 'DATA'),
            info: t('Transport Data, receiver=0x2F6D04A8, counter=0, datalen=96', 'Transport Data, receiver=0x2F6D04A8, counter=0, datalen=96'),
            tipo: 'tunel',
            resumo: t('Tráfego segue com a chave nova', 'Traffic continues with the new key'),
            dt: 1,
          },
          transporte('a8 04 6d 2f', 0, 96),
        ),
      ],
    },
  ],
};
