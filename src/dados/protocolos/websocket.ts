import { hex, no, nos, t, texto } from '../base';
import type { Campo, Pacote, Protocolo } from '../tipos';

const CLIENTE = 52412;
const CHAVE = [0x37, 0xfa, 0x21, 0x3d];
const CHAVE_PONG = [0x5c, 0x0e, 0x91, 0xa4];
const CHAVE_CLOSE = [0x9b, 0x41, 0x6d, 0x02];

const emHex = (bytes: readonly number[]): string => bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
const mascarar = (dados: readonly number[], chave: readonly number[]): string => emHex(dados.map((b, i) => b ^ (chave[i % 4] ?? 0)));
const bytesDe = (s: string): number[] => [...new TextEncoder().encode(s)];

const tamanho = (c: Campo): number =>
  c.opaco ?? (c.hex !== undefined ? c.hex.replace(/\s/g, '').length / 2 : new TextEncoder().encode(c.texto ?? '').length);

const proximo = { cliente: 1, servidor: 1 };

const pacote = (
  de: 'cliente' | 'servidor',
  proto: string,
  rotulo: [string, string],
  info: string,
  tipo: string,
  carga: Campo[],
  dt: number,
  resumo: [string, string],
): Pacote => {
  const len = carga.reduce((acc, c) => acc + tamanho(c), 0);
  const outro = de === 'cliente' ? 'servidor' : 'cliente';
  const seq = proximo[de];
  proximo[de] += len;
  return {
    de,
    para: outro,
    proto,
    rotulo: t(rotulo[0], rotulo[1]),
    info: t(info, info),
    tipo,
    resumo: t(resumo[0], resumo[1]),
    dt,
    quadro: {
      ...(de === 'servidor' ? { ttl: 52 } : {}),
      tcp: { origem: de === 'cliente' ? CLIENTE : 80, destino: de === 'cliente' ? 80 : CLIENTE, seq, ack: proximo[outro], flags: 'PSH,ACK', janela: de === 'cliente' ? 502 : 509 },
      carga,
      camada: proto === 'HTTP' ? 'HTTP' : 'WebSocket',
    },
  };
};

const quadroTexto = (mensagem: string, chave?: readonly number[]): Campo[] => {
  const dados = bytesDe(mensagem);
  const segundo = (chave ? 0x80 : 0) | dados.length;
  return [
    hex(t('FIN, opcode', 'FIN, opcode'), '81', 'FIN=1, 0x1 (text)', t('Última parte da mensagem; opcode 1 é texto UTF-8.', 'Last fragment of the message; opcode 1 is UTF-8 text.')),
    hex(
      t('Máscara, tamanho', 'Mask, length'),
      segundo.toString(16).padStart(2, '0'),
      `MASK=${chave ? 1 : 0}, ${dados.length} bytes`,
      chave
        ? t('Do navegador para o servidor, todo quadro é mascarado.', 'From browser to server, every frame is masked.')
        : t('Do servidor para o navegador não há máscara.', 'From server to browser there is no mask.'),
    ),
    ...(chave
      ? [
          hex(t('Chave de máscara', 'Masking key'), emHex(chave), emHex(chave), t('4 bytes sorteados a cada quadro.', '4 random bytes for every frame.'), true),
          hex(t('Dados (mascarados)', 'Payload (masked)'), mascarar(dados, chave), mensagem, t('Cada byte passa por XOR com a chave: proxies antigos não confundem isso com HTTP.', 'Every byte is XORed with the key so old proxies never mistake it for HTTP.')),
        ]
      : [hex(t('Dados', 'Payload'), emHex(dados), mensagem, t('Texto puro: o JSON do aplicativo de chat.', 'Plain text: the chat app’s JSON.'))]),
  ];
};

export const websocket: Protocolo = {
  id: 'websocket',
  sigla: 'WebSocket',
  nome: t('WebSocket', 'WebSocket'),
  resumo: t('Mensagens nos dois sentidos', 'Two-way web messaging'),
  categoria: 'aplicacao',
  camada: 7,
  descricao: t(
    'O HTTP é sempre pedido e resposta: o servidor nunca fala primeiro. O WebSocket começa como um GET comum e, com um 101, transforma a mesma conexão TCP num canal permanente, onde qualquer lado envia mensagens quando quiser, com só 2 a 14 bytes de cabeçalho.',
    'HTTP is always request and response: the server never speaks first. WebSocket starts as an ordinary GET and, with a 101, turns that same TCP connection into a permanent channel where either side sends messages whenever it wants, with only 2 to 14 bytes of header.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Porta', 'Port'), t('80 (ws://) ou 443 (wss://)', '80 (ws://) or 443 (wss://)')],
    [t('Transporte', 'Transport'), t('TCP', 'TCP')],
    [t('Abertura', 'Opening'), t('Upgrade do HTTP/1.1 (status 101)', 'HTTP/1.1 Upgrade (status 101)')],
    [t('Quadro', 'Frame'), t('2–14 bytes de cabeçalho', '2–14 byte header')],
    [t('Definido em', 'Defined in'), t('RFC 6455', 'RFC 6455')],
  ],
  legenda: {
    http: { nome: t('Upgrade HTTP', 'HTTP upgrade'), cor: 'anil' },
    navegador: { nome: t('Do navegador', 'From browser'), cor: 'ouro' },
    servidor: { nome: t('Do servidor', 'From server'), cor: 'brasa' },
    controle: { nome: t('Controle', 'Control'), cor: 'neutra' },
  },
  observacao: t('TCP já aberto; ACKs não aparecem', 'TCP already open; ACKs not shown'),
  nos: [nos.cliente(), nos.roteador(), nos.internet(), no('servidor', 'servidor', t('Servidor de chat', 'Chat server'), 86, 30, '203.0.113.10')],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'servidor'],
  passos: [
    {
      titulo: t('Pedido de upgrade', 'Upgrade request'),
      resumo: t('Um GET com Upgrade: websocket', 'A GET with Upgrade: websocket'),
      descricao: t(
        'O aplicativo de chat abre ws://chat.example.com/chat. Sobre uma conexão TCP já aberta, o navegador manda um GET normal com dois cabeçalhos especiais: Upgrade: websocket e uma chave aleatória em Sec-WebSocket-Key.',
        'The chat app opens ws://chat.example.com/chat. Over an already open TCP connection, the browser sends a normal GET with two special headers: Upgrade: websocket and a random key in Sec-WebSocket-Key.',
      ),
      fatos: [
        [t('URL', 'URL'), t('ws://chat.example.com/chat', 'ws://chat.example.com/chat')],
        [t('Chave', 'Key'), t('16 bytes aleatórios em Base64', '16 random bytes in Base64')],
        [t('Versão', 'Version'), t('13', '13')],
      ],
      pacotes: [
        pacote(
          'cliente',
          'HTTP',
          ['GET /chat', 'GET /chat'],
          'GET /chat HTTP/1.1',
          'http',
          [
            texto(t('Linha de pedido', 'Request line'), 'GET /chat HTTP/1.1\r\n'),
            texto(t('Host', 'Host'), 'Host: chat.example.com\r\n'),
            texto(t('Upgrade', 'Upgrade'), 'Upgrade: websocket\r\n', t('Pede para trocar de protocolo.', 'Asks to switch protocols.')),
            texto(t('Connection', 'Connection'), 'Connection: Upgrade\r\n'),
            texto(t('Chave', 'Key'), 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n', t('Prova de que o servidor entende WebSocket de verdade.', 'Proof that the server really speaks WebSocket.')),
            texto(t('Versão', 'Version'), 'Sec-WebSocket-Version: 13\r\n'),
            texto(t('Origem', 'Origin'), 'Origin: http://chat.example.com\r\n', t('O servidor decide se aceita esta página.', 'The server decides whether to accept this page.')),
            texto(t('Fim dos cabeçalhos', 'End of headers'), '\r\n'),
          ],
          0,
          ['Upgrade: websocket', 'Upgrade: websocket'],
        ),
      ],
    },
    {
      titulo: t('101 Switching Protocols', '101 Switching Protocols'),
      resumo: t('O mesmo TCP muda de língua', 'The same TCP switches language'),
      descricao: t(
        'O servidor concatena a chave com um GUID fixo, calcula o SHA-1 e devolve em Base64 no Sec-WebSocket-Accept. O status 101 encerra o HTTP nesta conexão: dali em diante, os bytes são quadros WebSocket.',
        'The server appends a fixed GUID to the key, takes the SHA-1 and returns it in Base64 as Sec-WebSocket-Accept. Status 101 ends HTTP on this connection: from then on, the bytes are WebSocket frames.',
      ),
      fatos: [
        [t('Status', 'Status'), t('101 Switching Protocols', '101 Switching Protocols')],
        [t('Accept', 'Accept'), t('Base64(SHA-1(chave + GUID))', 'Base64(SHA-1(key + GUID))')],
        [t('GUID', 'GUID'), t('258EAFA5-E914-47DA-95CA-C5AB0DC85B11', '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')],
      ],
      pacotes: [
        pacote(
          'servidor',
          'HTTP',
          ['101', '101'],
          'HTTP/1.1 101 Switching Protocols',
          'http',
          [
            texto(t('Linha de status', 'Status line'), 'HTTP/1.1 101 Switching Protocols\r\n'),
            texto(t('Upgrade', 'Upgrade'), 'Upgrade: websocket\r\n'),
            texto(t('Connection', 'Connection'), 'Connection: Upgrade\r\n'),
            texto(t('Accept', 'Accept'), 'Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n', t('A chave do navegador transformada: prova o aceite.', 'The browser’s key, transformed: proof of acceptance.')),
            texto(t('Fim dos cabeçalhos', 'End of headers'), '\r\n'),
          ],
          17,
          ['Conexão promovida a WebSocket', 'Connection upgraded to WebSocket'],
        ),
      ],
    },
    {
      titulo: t('Mensagem do navegador', 'Browser message'),
      resumo: t('Quadro de texto mascarado', 'A masked text frame'),
      descricao: t(
        'O usuário digita "oi". O navegador monta um quadro de 32 bytes: 2 de cabeçalho, 4 da chave de máscara e 26 de JSON embaralhado com XOR. A máscara não é segurança; ela impede que proxies antigos interpretem os bytes como HTTP.',
        'The user types "oi". The browser builds a 32-byte frame: 2 bytes of header, 4 of masking key and 26 of JSON scrambled with XOR. The mask is not security; it stops old proxies from reading the bytes as HTTP.',
      ),
      fatos: [
        [t('Opcode', 'Opcode'), t('0x1 (texto)', '0x1 (text)')],
        [t('Cabeçalho', 'Header'), t('2 bytes + 4 da máscara', '2 bytes + 4 of mask')],
        [t('Conteúdo', 'Content'), t('{"type":"msg","text":"oi"}', '{"type":"msg","text":"oi"}')],
      ],
      pacotes: [pacote('cliente', 'WebSocket', ['TEXTO', 'TEXT'], 'WebSocket Text [FIN] [MASKED]', 'navegador', quadroTexto('{"type":"msg","text":"oi"}', CHAVE), 2400, ['{"type":"msg","text":"oi"}', '{"type":"msg","text":"oi"}'])],
    },
    {
      titulo: t('O servidor fala primeiro', 'The server speaks first'),
      resumo: t('Mensagens sem nenhum pedido', 'Messages with no request'),
      descricao: t(
        'Outras pessoas escrevem na sala e o servidor empurra as mensagens na hora, sem esperar pedido. Do servidor para o navegador não há máscara, então cada quadro tem só 2 bytes de cabeçalho.',
        'Other people write in the room and the server pushes their messages right away, with no request. From server to browser there is no mask, so each frame has just 2 bytes of header.',
      ),
      fatos: [
        [t('Direção', 'Direction'), t('Servidor → navegador', 'Server → browser')],
        [t('Máscara', 'Mask'), t('Nenhuma', 'None')],
        [t('Atraso', 'Delay'), t('Sem polling: chega na hora', 'No polling: arrives immediately')],
      ],
      pacotes: [
        pacote('servidor', 'WebSocket', ['TEXTO', 'TEXT'], 'WebSocket Text [FIN]', 'servidor', quadroTexto('{"from":"ana","text":"oi!"}'), 1300, ['Ana: oi!', 'Ana: oi!']),
        pacote('servidor', 'WebSocket', ['TEXTO', 'TEXT'], 'WebSocket Text [FIN]', 'servidor', quadroTexto('{"from":"bia","text":"tudo bem?"}'), 900, ['Bia: tudo bem?', 'Bia: tudo bem?']),
      ],
    },
    {
      titulo: t('Ping e pong', 'Ping and pong'),
      resumo: t('Prova de que a conexão vive', 'Proof the connection is alive'),
      descricao: t(
        'Para manter a conexão viva através de NATs e proxies que fecham conexões caladas, o servidor manda um ping a cada 30 s. O navegador responde sozinho com um pong, sem envolver o código da página.',
        'To keep the connection alive through NATs and proxies that close silent connections, the server sends a ping every 30 s. The browser answers with a pong on its own, without involving the page’s code.',
      ),
      fatos: [
        [t('Ping', 'Ping'), t('Opcode 0x9', 'Opcode 0x9')],
        [t('Pong', 'Pong'), t('Opcode 0xA', 'Opcode 0xA')],
        [t('Intervalo', 'Interval'), t('30 s (escolha do servidor)', '30 s (server’s choice)')],
      ],
      pacotes: [
        pacote(
          'servidor',
          'WebSocket',
          ['PING', 'PING'],
          'WebSocket Ping [FIN]',
          'controle',
          [hex(t('FIN, opcode', 'FIN, opcode'), '89', 'FIN=1, 0x9 (ping)'), hex(t('Máscara, tamanho', 'Mask, length'), '00', 'MASK=0, 0 bytes')],
          30000,
          ['Ainda está aí?', 'Still there?'],
        ),
        pacote(
          'cliente',
          'WebSocket',
          ['PONG', 'PONG'],
          'WebSocket Pong [FIN] [MASKED]',
          'controle',
          [
            hex(t('FIN, opcode', 'FIN, opcode'), '8a', 'FIN=1, 0xA (pong)'),
            hex(t('Máscara, tamanho', 'Mask, length'), '80', 'MASK=1, 0 bytes'),
            hex(t('Chave de máscara', 'Masking key'), emHex(CHAVE_PONG), emHex(CHAVE_PONG), undefined, true),
          ],
          17,
          ['Estou aqui', 'Still here'],
        ),
      ],
    },
    {
      titulo: t('Fechar', 'Close'),
      resumo: t('Código 1000, saída normal', 'Code 1000, normal closure'),
      descricao: t(
        'Ao sair da sala, o navegador manda um quadro Close com o código 1000 (encerramento normal). O servidor ecoa o Close e, em seguida, a conexão TCP é fechada com FIN.',
        'When leaving the room, the browser sends a Close frame with code 1000 (normal closure). The server echoes the Close, and then the TCP connection is shut down with FIN.',
      ),
      fatos: [
        [t('Opcode', 'Opcode'), t('0x8 (close)', '0x8 (close)')],
        [t('Código', 'Code'), t('1000: encerramento normal', '1000: normal closure')],
        [t('Depois', 'Afterwards'), t('FIN do TCP', 'TCP FIN')],
      ],
      pacotes: [
        pacote(
          'cliente',
          'WebSocket',
          ['CLOSE', 'CLOSE'],
          'WebSocket Connection Close [FIN] [MASKED]',
          'controle',
          [
            hex(t('FIN, opcode', 'FIN, opcode'), '88', 'FIN=1, 0x8 (close)'),
            hex(t('Máscara, tamanho', 'Mask, length'), '82', 'MASK=1, 2 bytes'),
            hex(t('Chave de máscara', 'Masking key'), emHex(CHAVE_CLOSE), emHex(CHAVE_CLOSE), undefined, true),
            hex(t('Código (mascarado)', 'Code (masked)'), mascarar([0x03, 0xe8], CHAVE_CLOSE), '1000', t('1000 significa saída normal.', '1000 means a normal closure.')),
          ],
          5200,
          ['Tchau: código 1000', 'Bye: code 1000'],
        ),
        pacote(
          'servidor',
          'WebSocket',
          ['CLOSE', 'CLOSE'],
          'WebSocket Connection Close [FIN]',
          'controle',
          [
            hex(t('FIN, opcode', 'FIN, opcode'), '88', 'FIN=1, 0x8 (close)'),
            hex(t('Máscara, tamanho', 'Mask, length'), '02', 'MASK=0, 2 bytes'),
            hex(t('Código', 'Code'), '03 e8', '1000'),
          ],
          17,
          ['Close confirmado', 'Close confirmed'],
        ),
      ],
    },
  ],
};
