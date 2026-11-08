import { hex, IP, no, nos, opaco, t } from '../base';
import type { Campo, Pacote, Protocolo, Texto } from '../tipos';

const ISP = '100.64.0.1';

const emHex = (bytes: readonly number[]): string => bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');

const ipBytes = (ip: string): number[] => ip.split('.').map(Number);

const cabecalhoIpOriginal = (total: number, ttl: number, protocolo: number, origem: string, destino: string, id: number): number[] => {
  const cabecalho = [0x45, 0, total >> 8, total & 0xff, id >> 8, id & 0xff, 0, 0, ttl, protocolo, 0, 0, ...ipBytes(origem), ...ipBytes(destino)];
  let soma = 0;
  for (let i = 0; i < cabecalho.length; i += 2) soma += ((cabecalho[i] ?? 0) << 8) + (cabecalho[i + 1] ?? 0);
  while (soma >> 16) soma = (soma & 0xffff) + (soma >> 16);
  const final = ~soma & 0xffff;
  cabecalho[10] = final >> 8;
  cabecalho[11] = final & 0xff;
  return cabecalho;
};

const PADRAO = emHex(Array.from({ length: 48 }, (_, i) => 0x10 + i));

const dadosEco: Campo[] = [
  hex(t('Carimbo de tempo', 'Timestamp'), 'a0 1d 0e 6a 00 00 00 00 5c 3b 04 00 00 00 00 00', '12:00:00.277', t('A hora do envio, para o ping calcular o tempo de ida e volta.', 'The send time, so ping can compute the round trip.'), true),
  hex(t('Preenchimento', 'Padding'), PADRAO.split(' ').slice(0, 40).join(' '), '0x10 … 0x37', t('Bytes em sequência, só para completar 56 bytes de dados.', 'Sequential bytes, just to fill 56 bytes of data.')),
];

const eco = (de: string, para: string, tipoIcmp: 0 | 8, seq: number, ttl: number, destinoIp: string | undefined, rotulo: Texto, info: Texto, resumo: Texto, dt: number, nota?: Texto): Pacote => ({
  de,
  para,
  proto: 'ICMP',
  rotulo,
  info,
  tipo: 'eco',
  resumo,
  dt,
  ...(nota ? { nota } : {}),
  quadro: {
    ttl,
    ...(destinoIp ? { destinoIp } : {}),
    ...(tipoIcmp === 0 ? { origemIp: IP.servidor } : {}),
    icmp: { tipo: tipoIcmp, codigo: 0, id: 0x1c2b, seq },
    carga: dadosEco,
  },
});

const original = (ttlOriginal: number, seq: number): Campo[] => [
  hex(t('Não usado', 'Unused'), '00 00 00 00', '0', t('Quatro bytes vazios antes da cópia.', 'Four empty bytes before the copy.')),
  hex(
    t('Cabeçalho IP original', 'Original IP header'),
    emHex(cabecalhoIpOriginal(84, ttlOriginal, 1, IP.cliente, IP.servidor, 0x6f2e + seq)),
    `${IP.cliente} → ${IP.servidor}, TTL ${ttlOriginal}`,
    t('A cópia do cabeçalho que morreu, como chegou ao roteador.', 'A copy of the header that died, as it reached the router.'),
  ),
  hex(t('Início do ICMP original', 'Start of the original ICMP'), `08 00 00 00 1c 2b 00 0${seq}`, `Echo, seq ${seq}`, t('Os primeiros 8 bytes: assim o ping sabe de qual pergunta se trata.', 'The first 8 bytes: so ping knows which request this was.')),
];

export const icmp: Protocolo = {
  id: 'icmp',
  sigla: 'ICMP',
  nome: t('Protocolo de Mensagens de Controle da Internet', 'Internet Control Message Protocol'),
  resumo: t('Mensagens de controle da internet', 'Internet Control Message'),
  categoria: 'core',
  camada: 3,
  descricao: t(
    'O ICMP é o canal de recados do IP. Ele não carrega dados de aplicações: avisa quando um pacote não pôde ser entregue, quando o TTL acabou no caminho ou quando alguém só quer saber se o outro lado está vivo. O ping e o traceroute são feitos inteiramente com ele.',
    'ICMP is IP’s messaging channel. It carries no application data: it reports when a packet could not be delivered, when the TTL ran out on the way, or when someone simply wants to know whether the other end is alive. Ping and traceroute are built entirely on it.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Rede (camada 3), dentro do IP', 'Network (Layer 3), inside IP')],
    [t('Protocolo IP', 'IP protocol'), t('1 (ICMPv6 é 58)', '1 (ICMPv6 is 58)')],
    [t('Portas', 'Ports'), t('Nenhuma: usa tipo e código', 'None: uses type and code')],
    [t('Ferramentas', 'Tools'), t('ping, traceroute, Path MTU', 'ping, traceroute, Path MTU')],
    [t('Tipos comuns', 'Common types'), t('0, 3, 8, 11', '0, 3, 8, 11')],
    [t('Definido em', 'Defined in'), t('RFC 792', 'RFC 792')],
  ],
  legenda: {
    eco: { nome: t('Eco (ping)', 'Echo (ping)'), cor: 'anil' },
    expirado: { nome: t('Tempo excedido', 'Time exceeded'), cor: 'ouro' },
    erro: { nome: t('Inalcançável', 'Unreachable'), cor: 'brasa' },
    sonda: { nome: t('Sonda UDP', 'UDP probe'), cor: 'neutra' },
  },
  nos: [
    nos.cliente(12, 74),
    nos.roteador(30, 56),
    no('isp', 'roteador', t('Roteador do provedor', 'ISP Router'), 50, 30, ISP, '00:00:5e:00:53:02'),
    nos.internet(68, 72),
    nos.servidor(88, 34),
  ],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'isp'],
    ['isp', 'internet'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'roteador', 'isp', 'servidor'],
  passos: [
    {
      titulo: t('Ping', 'Ping'),
      resumo: t('Um eco até o servidor', 'An echo to the server'),
      descricao: t(
        'O ping manda um Echo Request (tipo 8) com um identificador, um número de sequência e 56 bytes de dados, incluindo a hora do envio. Nada de portas nem de conexão: o ICMP vai direto dentro do IP.',
        'Ping sends an Echo Request (type 8) with an identifier, a sequence number and 56 bytes of data, including the send time. No ports and no connection: ICMP rides directly inside IP.',
      ),
      fatos: [
        [t('Comando', 'Command'), t('ping 203.0.113.10', 'ping 203.0.113.10')],
        [t('Tipo, código', 'Type, code'), t('8, 0 (Echo Request)', '8, 0 (Echo Request)')],
        [t('Tamanho', 'Size'), t('64 bytes de ICMP', '64 bytes of ICMP')],
      ],
      pacotes: [
        eco(
          'cliente',
          'servidor',
          8,
          1,
          64,
          undefined,
          t('ECHO REQUEST', 'ECHO REQUEST'),
          t('Echo (ping) request id=0x1c2b, seq=1/256, ttl=64', 'Echo (ping) request id=0x1c2b, seq=1/256, ttl=64'),
          t('Você está aí?', 'Are you there?'),
          0,
        ),
      ],
    },
    {
      titulo: t('Resposta do eco', 'Echo reply'),
      resumo: t('O servidor devolve os mesmos dados', 'The server sends the same data back'),
      descricao: t(
        'O servidor responde com um Echo Reply (tipo 0), copiando identificador, sequência e dados. O ping compara a hora gravada com a hora da chegada e mostra o tempo de ida e volta. O TTL de 57 indica que a resposta atravessou 7 roteadores, partindo de 64.',
        'The server answers with an Echo Reply (type 0), copying identifier, sequence and data. Ping compares the stored time with the arrival time and prints the round trip. A TTL of 57 means the reply crossed 7 routers, starting from 64.',
      ),
      fatos: [
        [t('Tempo de ida e volta', 'Round-trip time'), t('18,4 ms', '18.4 ms')],
        [t('TTL recebido', 'Received TTL'), t('57 (partiu de 64: 7 saltos)', '57 (started at 64: 7 hops)')],
        [t('Perda', 'Loss'), t('0%', '0%')],
      ],
      pacotes: [
        eco(
          'servidor',
          'cliente',
          0,
          1,
          57,
          IP.cliente,
          t('ECHO REPLY', 'ECHO REPLY'),
          t('Echo (ping) reply id=0x1c2b, seq=1/256, ttl=57', 'Echo (ping) reply id=0x1c2b, seq=1/256, ttl=57'),
          t('Estou: 18,4 ms', 'Here: 18.4 ms'),
          18,
        ),
      ],
    },
    {
      titulo: t('Traceroute: TTL 1', 'Traceroute: TTL 1'),
      resumo: t('O primeiro roteador se revela', 'The first router reveals itself'),
      descricao: t(
        'O traceroute manda um eco com TTL 1 de propósito. O primeiro roteador diminui o TTL para zero, descarta o pacote e devolve um Time Exceeded (tipo 11) com uma cópia do início do pacote. O endereço de origem desse aviso é o primeiro salto.',
        'Traceroute deliberately sends an echo with TTL 1. The first router lowers the TTL to zero, drops the packet and returns a Time Exceeded (type 11) with a copy of the packet’s start. The source of that notice is hop number one.',
      ),
      fatos: [
        [t('TTL enviado', 'TTL sent'), t('1', '1')],
        [t('Salto 1', 'Hop 1'), t(`${IP.roteador} (roteador de casa)`, `${IP.roteador} (home router)`)],
        [t('Resposta', 'Reply'), t('Tipo 11, código 0', 'Type 11, code 0')],
      ],
      pacotes: [
        eco(
          'cliente',
          'roteador',
          8,
          2,
          1,
          IP.servidor,
          t('ECHO TTL=1', 'ECHO TTL=1'),
          t('Echo (ping) request id=0x1c2b, seq=2/512, ttl=1', 'Echo (ping) request id=0x1c2b, seq=2/512, ttl=1'),
          t('Eco que só vive um salto', 'An echo that lives one hop'),
          1004,
          t('TTL CHEGOU A 0', 'TTL HIT 0'),
        ),
        {
          de: 'roteador',
          para: 'cliente',
          proto: 'ICMP',
          rotulo: t('TIME EXCEEDED', 'TIME EXCEEDED'),
          info: t('Time-to-live exceeded (TTL expirou em trânsito)', 'Time-to-live exceeded (Time to live exceeded in transit)'),
          tipo: 'expirado',
          resumo: t(`${IP.roteador}: TTL expirou aqui`, `${IP.roteador}: TTL expired here`),
          dt: 1,
          quadro: { icmp: { tipo: 11, codigo: 0 }, carga: original(1, 2) },
        },
      ],
    },
    {
      titulo: t('Traceroute: TTL 2', 'Traceroute: TTL 2'),
      resumo: t('Um salto mais longe', 'One hop further'),
      descricao: t(
        'Agora com TTL 2: o roteador de casa passa o pacote adiante com TTL 1, e o roteador do provedor zera o contador e avisa. Repetindo com TTL 3, 4, 5 até chegar ao destino, o traceroute desenha o caminho inteiro, salto por salto.',
        'Now with TTL 2: the home router forwards the packet with TTL 1, and the ISP’s router hits zero and reports back. Repeating with TTL 3, 4, 5 until the destination answers, traceroute maps the whole path, hop by hop.',
      ),
      fatos: [
        [t('TTL enviado', 'TTL sent'), t('2', '2')],
        [t('Salto 2', 'Hop 2'), t(`${ISP} (provedor, CGNAT)`, `${ISP} (ISP, CGNAT)`)],
        [t('Tempo', 'Time'), t('4,1 ms', '4.1 ms')],
      ],
      pacotes: [
        eco(
          'cliente',
          'isp',
          8,
          3,
          2,
          IP.servidor,
          t('ECHO TTL=2', 'ECHO TTL=2'),
          t('Echo (ping) request id=0x1c2b, seq=3/768, ttl=2', 'Echo (ping) request id=0x1c2b, seq=3/768, ttl=2'),
          t('Eco que vive dois saltos', 'An echo that lives two hops'),
          1000,
          t('TTL CHEGOU A 0', 'TTL HIT 0'),
        ),
        {
          de: 'isp',
          para: 'cliente',
          proto: 'ICMP',
          rotulo: t('TIME EXCEEDED', 'TIME EXCEEDED'),
          info: t('Time-to-live exceeded (TTL expirou em trânsito)', 'Time-to-live exceeded (Time to live exceeded in transit)'),
          tipo: 'expirado',
          resumo: t(`${ISP}: TTL expirou aqui`, `${ISP}: TTL expired here`),
          dt: 4,
          quadro: { ttl: 254, icmp: { tipo: 11, codigo: 0 }, carga: original(1, 3) },
        },
      ],
    },
    {
      titulo: t('Destino inalcançável', 'Destination unreachable'),
      resumo: t('Uma porta fechada responde', 'A closed port answers back'),
      descricao: t(
        'Um programa manda um datagrama UDP para a porta 33434 do servidor, onde nada escuta. O próprio servidor avisa com um Destination Unreachable (tipo 3, código 3: porta inalcançável). É assim que o traceroute clássico do Unix sabe que chegou ao fim.',
        'A program sends a UDP datagram to port 33434 on the server, where nothing is listening. The server itself replies with a Destination Unreachable (type 3, code 3: port unreachable). That is how classic Unix traceroute knows it has reached the end.',
      ),
      fatos: [
        [t('Porta', 'Port'), t('UDP 33434 (fechada)', 'UDP 33434 (closed)')],
        [t('Tipo, código', 'Type, code'), t('3, 3 (porta inalcançável)', '3, 3 (port unreachable)')],
        [t('Outros códigos', 'Other codes'), t('0 rede, 1 host, 4 precisa fragmentar', '0 net, 1 host, 4 fragmentation needed')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'servidor',
          proto: 'UDP',
          rotulo: t('UDP :33434', 'UDP :33434'),
          info: t('49821 → 33434 Len=32', '49821 → 33434 Len=32'),
          tipo: 'sonda',
          resumo: t('Alguém na porta 33434?', 'Anyone on port 33434?'),
          dt: 1002,
          quadro: { udp: { origem: 49821, destino: 33434 }, carga: [opaco(t('Dados da sonda', 'Probe data'), 32, t('Conteúdo qualquer: só importa a porta.', 'Arbitrary content: only the port matters.'))] },
        },
        {
          de: 'servidor',
          para: 'cliente',
          proto: 'ICMP',
          rotulo: t('UNREACHABLE', 'UNREACHABLE'),
          info: t('Destination unreachable (Porta inalcançável)', 'Destination unreachable (Port unreachable)'),
          tipo: 'erro',
          resumo: t('Porta 33434 fechada', 'Port 33434 is closed'),
          dt: 18,
          quadro: {
            ttl: 57,
            icmp: { tipo: 3, codigo: 3 },
            carga: [
              hex(t('Não usado', 'Unused'), '00 00 00 00', '0', t('Quatro bytes vazios antes da cópia.', 'Four empty bytes before the copy.')),
              hex(
                t('Cabeçalho IP original', 'Original IP header'),
                emHex(cabecalhoIpOriginal(60, 57, 17, IP.cliente, IP.servidor, 0x7a10)),
                `${IP.cliente} → ${IP.servidor}, UDP`,
                t('A cópia do datagrama recusado.', 'A copy of the refused datagram.'),
              ),
              hex(t('Início do UDP original', 'Start of the original UDP'), 'c2 9d 82 9a 00 28 00 00', '49821 → 33434', t('As portas mostram qual programa deve receber o aviso.', 'The ports show which program should get the notice.')),
            ],
          },
        },
      ],
    },
  ],
};
