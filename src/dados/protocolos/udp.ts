import { hex, no, nos, opaco, t } from '../base';
import type { Campo, Pacote, Protocolo } from '../tipos';

const JOGO = 27015;
const CLIENTE = 50000;

const entrada = (seq: number): Campo[] => [
  hex(
    t('Sequência do jogo', 'Game sequence'),
    seq.toString(16).padStart(8, '0'),
    String(seq),
    t('Numerada pelo jogo, não pelo UDP: serve para descartar dados velhos.', 'Numbered by the game, not by UDP: used to drop stale data.'),
  ),
  hex(t('Tipo', 'Type'), '01', '1', t('1 = comando do jogador.', '1 = player input.')),
  hex(t('Comandos', 'Inputs'), '00 05', 'MOVE | JUMP', t('Um bit por tecla pressionada: andar e pular.', 'One bit per key held down: move and jump.')),
  hex(t('Mira', 'Aim'), '0b b8 ff 38', '30.00°, -2.00°', t('Ângulos da câmera em centésimos de grau.', 'Camera angles in hundredths of a degree.')),
];

const estado = (seq: number, ackJogador: number): Campo[] => [
  hex(t('Sequência do jogo', 'Game sequence'), seq.toString(16).padStart(8, '0'), String(seq), t('Cada atualização do mundo leva um número novo.', 'Every world update gets a new number.')),
  hex(t('Tipo', 'Type'), '02', '2', t('2 = estado do mundo.', '2 = world state.')),
  hex(t('Último comando visto', 'Last input seen'), ackJogador.toString(16).padStart(8, '0'), String(ackJogador), t('O próprio jogo confirma, se precisar.', 'The game itself acknowledges, if it needs to.')),
  opaco(t('Entidades', 'Entities'), 96, t('Posições e estados compactados de 8 jogadores.', 'Packed positions and states of 8 players.')),
];

const doNotebook = (seq: number, dt: number): Pacote => ({
  de: 'cliente',
  para: 'servidor',
  proto: 'UDP',
  rotulo: t('COMANDO', 'INPUT'),
  info: t(`${CLIENTE} → ${JOGO} Len=11`, `${CLIENTE} → ${JOGO} Len=11`),
  tipo: 'notebook',
  resumo: t(`Comando nº ${seq}: andar + pular`, `Input #${seq}: move + jump`),
  dt,
  quadro: { udp: { origem: CLIENTE, destino: JOGO }, carga: entrada(seq) },
});

const doServidor = (seq: number, ack: number, dt: number, extra: Partial<Pacote> = {}): Pacote => ({
  de: 'servidor',
  para: 'cliente',
  proto: 'UDP',
  rotulo: t('ESTADO', 'STATE'),
  info: t(`${JOGO} → ${CLIENTE} Len=105`, `${JOGO} → ${CLIENTE} Len=105`),
  tipo: 'servidor',
  resumo: t(`Estado nº ${seq} do mundo`, `World state #${seq}`),
  dt,
  ...extra,
  quadro: { ttl: 53, udp: { origem: JOGO, destino: CLIENTE }, carga: estado(seq, ack) },
});

export const udp: Protocolo = {
  id: 'udp',
  sigla: 'UDP',
  nome: t('Protocolo de Datagrama de Usuário', 'User Datagram Protocol'),
  resumo: t('Protocolo de Datagrama de Usuário', 'User Datagram Protocol'),
  categoria: 'core',
  camada: 4,
  descricao: t(
    'O UDP é o transporte mais simples possível: põe portas na frente dos dados e entrega o datagrama ao IP. Não abre conexão, não confirma, não reenvia e não ordena. Em troca, não tem atraso de aperto de mão nem espera por reenvios, por isso é a base de DNS, voz, jogos e do QUIC.',
    'UDP is the simplest possible transport: it puts ports in front of the data and hands the datagram to IP. It opens no connection, sends no acknowledgements, never resends and never reorders. In exchange there is no handshake delay and no waiting for resends, which is why DNS, voice, games and QUIC are built on it.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Transporte (camada 4)', 'Transport (Layer 4)')],
    [t('Cabeçalho', 'Header'), t('8 bytes fixos', '8 bytes, fixed')],
    [t('Conexão', 'Connection'), t('Nenhuma', 'None')],
    [t('Garantias', 'Guarantees'), t('Nenhuma: pode perder, duplicar ou inverter', 'None: may lose, duplicate or reorder')],
    [t('Usado por', 'Used by'), t('DNS, QUIC, VoIP, jogos, streaming', 'DNS, QUIC, VoIP, games, streaming')],
    [t('Definido em', 'Defined in'), t('RFC 768', 'RFC 768')],
  ],
  legenda: {
    notebook: { nome: t('Do notebook', 'From laptop'), cor: 'ouro' },
    servidor: { nome: t('Do servidor', 'From server'), cor: 'brasa' },
    icmp: { nome: t('ICMP', 'ICMP'), cor: 'neutra' },
  },
  observacao: t('Sem ACKs: o UDP não confirma nada', 'No ACKs: UDP acknowledges nothing'),
  nos: [nos.cliente(), nos.roteador(), nos.internet(), no('servidor', 'servidor', t('Servidor de jogo', 'Game server'), 86, 30, '203.0.113.20')],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'servidor'],
  passos: [
    {
      titulo: t('Só enviar', 'Just send'),
      resumo: t('Sem aperto de mão', 'No handshake'),
      descricao: t(
        'O jogo quer mandar o comando do jogador agora. Com UDP não há SYN nem conexão: o primeiro pacote já leva os dados. O servidor responde com o estado do mundo, também sem cerimônia.',
        'The game wants to send the player’s input right now. With UDP there is no SYN and no connection: the very first packet already carries data. The server answers with the world state, just as plainly.',
      ),
      fatos: [
        [t('Portas', 'Ports'), t('50000 → 27015', '50000 → 27015')],
        [t('Atraso de abertura', 'Setup delay'), t('Zero', 'Zero')],
        [t('Cabeçalho UDP', 'UDP header'), t('Porta, porta, tamanho, checksum', 'Port, port, length, checksum')],
      ],
      pacotes: [doNotebook(1234, 0), doServidor(6667, 1234, 24)],
    },
    {
      titulo: t('Atualizações em fluxo', 'Streaming updates'),
      resumo: t('Cada datagrama é independente', 'Every datagram stands alone'),
      descricao: t(
        'O servidor envia o estado do mundo 30 vezes por segundo, um datagrama a cada 33 ms. Cada um é completo e independente: se chegar fora de ordem, o jogo simplesmente fica com o de número maior.',
        'The server sends the world state 30 times a second, one datagram every 33 ms. Each one is complete on its own: if one arrives out of order, the game just keeps the higher number.',
      ),
      fatos: [
        [t('Ritmo', 'Rate'), t('30 atualizações/s (33 ms)', '30 updates/s (33 ms)')],
        [t('Ordem', 'Ordering'), t('Resolvida pelo jogo, pelo nº de sequência', 'Handled by the game, by sequence number')],
        [t('Fronteiras', 'Boundaries'), t('1 envio = 1 datagrama', '1 send = 1 datagram')],
      ],
      pacotes: [doServidor(6668, 1234, 33), doNotebook(1235, 4), doServidor(6669, 1235, 29)],
    },
    {
      titulo: t('Um datagrama se perde', 'A datagram is lost'),
      resumo: t('Ninguém reenvia', 'Nobody resends'),
      descricao: t(
        'A atualização 6670 some no caminho. O UDP não percebe e ninguém reenvia. Para um jogo isso é o certo: 33 ms depois chega a 6671, mais nova, e reenviar a velha só traria atraso.',
        'Update 6670 vanishes on the way. UDP does not notice and nobody resends it. For a game that is the right call: 33 ms later 6671 arrives, which is newer, and resending the old one would only add delay.',
      ),
      fatos: [
        [t('Perdido', 'Lost'), t('Estado nº 6670', 'State #6670')],
        [t('Reação', 'Reaction'), t('O jogo interpola até o próximo', 'The game interpolates to the next one')],
        [t('Se precisar de garantia', 'If you need guarantees'), t('A aplicação implementa (como o QUIC)', 'The application builds it (like QUIC)')],
      ],
      pacotes: [doServidor(6670, 1235, 33, { perdido: true, nota: t('DATAGRAMA PERDIDO', 'DATAGRAM LOST') }), doServidor(6671, 1235, 33)],
    },
    {
      titulo: t('Porta fechada', 'Closed port'),
      resumo: t('O ICMP avisa', 'ICMP reports back'),
      descricao: t(
        'O jogo tenta o chat de voz na porta 27016, mas nada escuta ali. Sem conexão, o UDP não tem como recusar; quem avisa é o sistema do servidor, com um ICMP "porta inalcançável" que traz de volta o começo do datagrama recusado.',
        'The game tries voice chat on port 27016, but nothing is listening there. With no connection, UDP has no way to refuse; the server’s OS reports it instead, with an ICMP "port unreachable" that carries back the start of the rejected datagram.',
      ),
      fatos: [
        [t('Destino', 'Destination'), t('203.0.113.20:27016', '203.0.113.20:27016')],
        [t('Resposta', 'Reply'), t('ICMP tipo 3, código 3', 'ICMP type 3, code 3')],
        [t('Conteúdo', 'Contents'), t('Cabeçalho IP + 8 bytes do original', 'IP header + first 8 bytes of the original')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'servidor',
          proto: 'UDP',
          rotulo: t('VOZ', 'VOICE'),
          info: t(`${CLIENTE} → 27016 Len=8`, `${CLIENTE} → 27016 Len=8`),
          tipo: 'notebook',
          resumo: t('Primeiro pacote do chat de voz', 'First voice chat packet'),
          dt: 12,
          quadro: {
            udp: { origem: CLIENTE, destino: 27016 },
            carga: [hex(t('Olá do chat de voz', 'Voice chat hello'), '00 00 00 01 09 00 00 00', 'HELLO v9', t('Primeira mensagem do protocolo de voz.', 'The voice protocol’s first message.'))],
          },
        },
        {
          de: 'servidor',
          para: 'cliente',
          proto: 'ICMP',
          rotulo: t('PORTA INALCANÇÁVEL', 'PORT UNREACHABLE'),
          info: t('Destino inalcançável (porta inalcançável)', 'Destination unreachable (Port unreachable)'),
          tipo: 'icmp',
          resumo: t('Ninguém escuta na porta 27016', 'Nobody listens on port 27016'),
          dt: 24,
          quadro: {
            ttl: 53,
            icmp: { tipo: 3, codigo: 3 },
            carga: [
              hex(t('Não usado', 'Unused'), '00 00 00 00', '0', t('Reservado neste tipo de ICMP.', 'Reserved for this ICMP type.')),
              hex(
                t('Cabeçalho IP original', 'Original IP header'),
                '45 00 00 24 3a 71 00 00 35 11 4d 91 c0 a8 01 0a cb 00 71 14',
                '192.168.1.10 → 203.0.113.20, UDP',
                t('O pacote recusado, para o remetente saber qual foi.', 'The rejected packet, so the sender knows which one.'),
              ),
              hex(t('UDP original', 'Original UDP'), 'c3 50 69 88 00 10 cc 2c', '50000 → 27016', t('As portas mostram qual conversa falhou.', 'The ports show which conversation failed.')),
              hex(t('Dados originais', 'Original data'), '00 00 00 01 09 00 00 00', 'HELLO v9'),
            ],
          },
        },
      ],
    },
  ],
};
