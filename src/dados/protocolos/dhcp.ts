import { hex, IP, no, nos, t } from '../base';
import type { Campo, Pacote, Protocolo, Texto } from '../tipos';

const MAC = '00 00 5e 00 53 10';
const XID = '39 03 f3 26';

const zeros = (n: number): string => Array.from({ length: n }, () => '00').join(' ');

const ip = (v: string): string =>
  v
    .split('.')
    .map((p) => Number(p).toString(16).padStart(2, '0'))
    .join(' ');

const NOMES: Record<number, string> = { 1: 'Discover', 2: 'Offer', 3: 'Request', 5: 'ACK' };

const mensagem = (op: 1 | 2, tipo: 1 | 2 | 3 | 5, ciaddr: string, yiaddr: string, opcoes: Campo[]): Campo[] => [
  hex(
    t('Operação, hardware', 'Op, hardware'),
    `0${op} 01 06 00`,
    op === 1 ? 'BOOTREQUEST, Ethernet' : 'BOOTREPLY, Ethernet',
    t('1 = pedido do cliente, 2 = resposta do servidor; Ethernet, MAC de 6 bytes, 0 saltos.', '1 = client request, 2 = server reply; Ethernet, 6-byte MAC, 0 hops.'),
  ),
  hex(t('ID da transação', 'Transaction ID'), XID, '0x3903f326', t('Sorteado pelo cliente; liga as quatro mensagens.', 'Picked by the client; ties the four messages together.'), true),
  hex(t('Segundos, flags', 'Seconds, flags'), '00 00 00 00', '0, unicast', t('Sem pressa e sem pedir resposta em broadcast.', 'No hurry, and no broadcast reply requested.')),
  hex(t('IP do cliente (ciaddr)', 'Client IP (ciaddr)'), ip(ciaddr), ciaddr, t('Preenchido só quando o cliente já tem endereço (renovação).', 'Only filled in when the client already has an address (renewal).')),
  hex(t('Seu IP (yiaddr)', 'Your IP (yiaddr)'), ip(yiaddr), yiaddr, t('O endereço que o servidor está dando.', 'The address the server is handing out.')),
  hex(t('Servidor, relay', 'Server, relay'), zeros(8), '0.0.0.0, 0.0.0.0', t('Sem servidor de boot e sem agente relay no caminho.', 'No boot server and no relay agent on the way.')),
  hex(t('MAC do cliente (chaddr)', 'Client MAC (chaddr)'), `${MAC} ${zeros(10)}`, '00:00:5e:00:53:10', t('16 bytes, dos quais o Ethernet usa 6.', '16 bytes, of which Ethernet uses 6.'), true),
  hex(t('sname + file', 'sname + file'), zeros(192), '192 × 00', t('Herança do BOOTP: nome do servidor e arquivo de boot, vazios.', 'BOOTP legacy: server name and boot file, left empty.')),
  hex(t('Magic cookie', 'Magic cookie'), '63 82 53 63', 'DHCP', t('Avisa que dali em diante vêm opções DHCP.', 'Marks the start of the DHCP options.')),
  hex(t('Opção 53: tipo', 'Option 53: type'), `35 01 0${tipo}`, `DHCP ${NOMES[tipo] ?? ''}`, t('O tipo da mensagem DHCP.', 'The DHCP message type.')),
  ...opcoes,
  hex(t('Fim', 'End'), 'ff', '255', t('Fim das opções.', 'End of options.')),
];

const pedidos = hex(
  t('Opção 55: o que quer saber', 'Option 55: parameter list'),
  '37 04 01 03 06 0f',
  '1, 3, 6, 15',
  t('Máscara, roteador, DNS e domínio.', 'Subnet mask, router, DNS and domain name.'),
);

const servidorId = hex(t('Opção 54: servidor', 'Option 54: server identifier'), `36 04 ${ip(IP.roteador)}`, IP.roteador, t('Qual servidor DHCP está falando.', 'Which DHCP server is talking.'));

const concessao = (tipo: 2 | 5): Campo[] => [
  servidorId,
  hex(t('Opção 51: concessão', 'Option 51: lease time'), '33 04 00 01 51 80', '86400 s (24 h)', t('Por quanto tempo o endereço é seu.', 'How long the address is yours.')),
  hex(t('Opção 1: máscara', 'Option 1: subnet mask'), '01 04 ff ff ff 00', '255.255.255.0', t('A rede local é 192.168.1.0/24.', 'The local network is 192.168.1.0/24.')),
  hex(t('Opção 3: roteador', 'Option 3: router'), `03 04 ${ip(IP.roteador)}`, IP.roteador, t('O gateway padrão: a saída para a internet.', 'The default gateway: the way out to the internet.')),
  hex(t('Opção 6: DNS', 'Option 6: DNS'), `06 04 ${ip(IP.roteador)}`, IP.roteador, t('O roteador também responde DNS.', 'The router also answers DNS.')),
  ...(tipo === 5 ? [hex(t('Opção 58: renovar em', 'Option 58: renewal time'), '3a 04 00 00 a8 c0', '43200 s (T1)', t('Na metade do prazo o cliente pede para renovar.', 'Halfway through, the client asks to renew.'))] : []),
];

const pacote = (de: string, para: string, origemIp: string, destinoIp: string, tipo: 1 | 2 | 3 | 5, legenda: string, info: Texto, resumo: Texto, dt: number, carga: Campo[]): Pacote => ({
  de,
  para,
  proto: 'DHCP',
  rotulo: t(`DHCP ${(NOMES[tipo] ?? '').toUpperCase()}`, `DHCP ${(NOMES[tipo] ?? '').toUpperCase()}`),
  info,
  tipo: legenda,
  resumo,
  dt,
  quadro: {
    origemIp,
    destinoIp,
    ttl: 64,
    udp: de === 'cliente' ? { origem: 68, destino: 67 } : { origem: 67, destino: 68 },
    carga,
  },
});

export const dhcp: Protocolo = {
  id: 'dhcp',
  sigla: 'DHCP',
  nome: t('Protocolo de Configuração Dinâmica de Host', 'Dynamic Host Configuration Protocol'),
  resumo: t('Configuração automática de rede', 'Dynamic Host Configuration'),
  categoria: 'core',
  camada: 7,
  descricao: t(
    'Quando um aparelho entra na rede, ele ainda não tem endereço IP, não sabe quem é o roteador nem qual DNS usar. O DHCP resolve isso em quatro mensagens, o "DORA": Discover, Offer, Request e ACK. O endereço é emprestado por um prazo e renovado antes de vencer.',
    'When a device joins a network it has no IP address and doesn’t know the router or which DNS to use. DHCP fixes that in four messages, the "DORA": Discover, Offer, Request and ACK. The address is leased for a while and renewed before it expires.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Portas', 'Ports'), t('UDP 67 (servidor), 68 (cliente)', 'UDP 67 (server), 68 (client)')],
    [t('Troca', 'Exchange'), t('Discover, Offer, Request, ACK', 'Discover, Offer, Request, ACK')],
    [t('Entrega', 'Delivers'), t('IP, máscara, gateway, DNS, prazo', 'IP, mask, gateway, DNS, lease')],
    [t('Base', 'Based on'), t('BOOTP (1985)', 'BOOTP (1985)')],
    [t('Definido em', 'Defined in'), t('RFC 2131, RFC 2132', 'RFC 2131, RFC 2132')],
  ],
  legenda: {
    cliente: { nome: t('Do cliente', 'From client'), cor: 'ouro' },
    servidor: { nome: t('Do servidor', 'From server'), cor: 'oliva' },
    renovacao: { nome: t('Renovação', 'Renewal'), cor: 'anil' },
  },
  observacao: t('O roteador de casa faz o papel de servidor DHCP', 'The home router acts as the DHCP server'),
  nos: [no('cliente', 'notebook', t('Cliente', 'Client'), 18, 70, IP.cliente), nos.roteador(52, 44), nos.internet(82, 66)],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
  ],
  faixas: ['cliente', 'roteador'],
  passos: [
    {
      titulo: t('Discover', 'Discover'),
      resumo: t('Tem algum servidor DHCP aí?', 'Is there a DHCP server here?'),
      descricao: t(
        'Sem endereço, o notebook usa 0.0.0.0 como origem e grita para a rede inteira (255.255.255.255): preciso de um IP. Ele manda junto o próprio MAC e a lista do que quer saber.',
        'With no address, the laptop uses 0.0.0.0 as its source and shouts to the whole network (255.255.255.255): I need an IP. It sends its MAC and the list of things it wants to know.',
      ),
      fatos: [
        [t('Origem', 'Source'), t('0.0.0.0:68', '0.0.0.0:68')],
        [t('Destino', 'Destination'), t('255.255.255.255:67 (broadcast)', '255.255.255.255:67 (broadcast)')],
        [t('Pede', 'Asks for'), t('Máscara, roteador, DNS, domínio', 'Mask, router, DNS, domain')],
      ],
      pacotes: [
        pacote(
          'cliente',
          'roteador',
          '0.0.0.0',
          '255.255.255.255',
          1,
          'cliente',
          t('DHCP Discover - ID da transação 0x3903f326', 'DHCP Discover - Transaction ID 0x3903f326'),
          t('Preciso de um endereço IP', 'I need an IP address'),
          0,
          mensagem(1, 1, '0.0.0.0', '0.0.0.0', [
            hex(t('Opção 61: ID do cliente', 'Option 61: client identifier'), `3d 07 01 ${MAC}`, '00:00:5e:00:53:10', t('Como o cliente se identifica.', 'How the client identifies itself.')),
            pedidos,
          ]),
        ),
      ],
    },
    {
      titulo: t('Offer', 'Offer'),
      resumo: t('O servidor oferece um endereço', 'The server offers an address'),
      descricao: t(
        'O servidor DHCP do roteador separa um endereço livre, 192.168.1.10, e o oferece junto com a máscara, o gateway, o DNS e o prazo. Se houvesse mais de um servidor, cada um mandaria sua oferta.',
        'The router’s DHCP server reserves a free address, 192.168.1.10, and offers it along with the mask, gateway, DNS and lease time. If there were several servers, each would send its own offer.',
      ),
      fatos: [
        [t('Oferta', 'Offer'), t('192.168.1.10', '192.168.1.10')],
        [t('Prazo', 'Lease'), t('24 horas', '24 hours')],
        [t('Gateway e DNS', 'Gateway and DNS'), t(IP.roteador, IP.roteador)],
      ],
      pacotes: [
        pacote(
          'roteador',
          'cliente',
          IP.roteador,
          IP.cliente,
          2,
          'servidor',
          t('DHCP Offer - ID da transação 0x3903f326', 'DHCP Offer - Transaction ID 0x3903f326'),
          t('Que tal 192.168.1.10?', 'How about 192.168.1.10?'),
          3,
          mensagem(2, 2, '0.0.0.0', IP.cliente, concessao(2)),
        ),
      ],
    },
    {
      titulo: t('Request', 'Request'),
      resumo: t('O cliente aceita a oferta', 'The client accepts the offer'),
      descricao: t(
        'O notebook pede formalmente o endereço oferecido, ainda em broadcast. Assim, qualquer outro servidor que tenha feito oferta fica sabendo que perdeu e libera o endereço que reservou.',
        'The laptop formally requests the offered address, still by broadcast. That way, any other server that made an offer learns it lost and frees the address it had reserved.',
      ),
      fatos: [
        [t('Pede', 'Requests'), t('192.168.1.10 (opção 50)', '192.168.1.10 (option 50)')],
        [t('Escolhe', 'Chooses'), t(`Servidor ${IP.roteador} (opção 54)`, `Server ${IP.roteador} (option 54)`)],
        [t('Por que broadcast', 'Why broadcast'), t('Avisar todos os servidores', 'To tell every server')],
      ],
      pacotes: [
        pacote(
          'cliente',
          'roteador',
          '0.0.0.0',
          '255.255.255.255',
          3,
          'cliente',
          t('DHCP Request - ID da transação 0x3903f326', 'DHCP Request - Transaction ID 0x3903f326'),
          t('Quero 192.168.1.10, por favor', 'I’ll take 192.168.1.10, please'),
          4,
          mensagem(1, 3, '0.0.0.0', '0.0.0.0', [
            hex(t('Opção 50: IP pedido', 'Option 50: requested IP'), `32 04 ${ip(IP.cliente)}`, IP.cliente, t('O endereço que aceita.', 'The address it accepts.')),
            servidorId,
            pedidos,
          ]),
        ),
      ],
    },
    {
      titulo: t('ACK', 'ACK'),
      resumo: t('Endereço confirmado', 'Address confirmed'),
      descricao: t(
        'O servidor confirma e o empréstimo começa a contar. O notebook costuma conferir com um ARP se ninguém mais usa o endereço e, então, configura a interface: IP, máscara, rota padrão e DNS.',
        'The server confirms and the lease clock starts. The laptop usually checks with ARP that nobody else uses the address and then configures the interface: IP, mask, default route and DNS.',
      ),
      fatos: [
        [t('Endereço', 'Address'), t('192.168.1.10/24', '192.168.1.10/24')],
        [t('Renovar em (T1)', 'Renew at (T1)'), t('12 horas', '12 hours')],
        [t('Rebind (T2)', 'Rebind (T2)'), t('21 horas', '21 hours')],
      ],
      pacotes: [
        pacote(
          'roteador',
          'cliente',
          IP.roteador,
          IP.cliente,
          5,
          'servidor',
          t('DHCP ACK - ID da transação 0x3903f326', 'DHCP ACK - Transaction ID 0x3903f326'),
          t('Feito: 192.168.1.10 por 24 h', 'Done: 192.168.1.10 for 24 h'),
          2,
          mensagem(2, 5, '0.0.0.0', IP.cliente, concessao(5)),
        ),
      ],
    },
    {
      titulo: t('Renovação', 'Renewal'),
      resumo: t('Na metade do prazo (T1)', 'Halfway through the lease (T1)'),
      descricao: t(
        'Doze horas depois, o notebook pede para renovar direto ao servidor, em unicast e já com o próprio IP em ciaddr. Se o servidor não responder, tenta de novo em broadcast no T2 (87,5% do prazo) antes de perder o endereço.',
        'Twelve hours later, the laptop asks the server directly to renew, by unicast and with its own IP in ciaddr. If the server doesn’t answer, it tries again by broadcast at T2 (87.5% of the lease) before losing the address.',
      ),
      fatos: [
        [t('Quando', 'When'), t('T1 = 50% do prazo', 'T1 = 50% of the lease')],
        [t('Como', 'How'), t('Unicast, ciaddr = 192.168.1.10', 'Unicast, ciaddr = 192.168.1.10')],
        [t('Resultado', 'Result'), t('Mais 24 horas', 'Another 24 hours')],
      ],
      pacotes: [
        pacote(
          'cliente',
          'roteador',
          IP.cliente,
          IP.roteador,
          3,
          'renovacao',
          t('DHCP Request - ID da transação 0x3903f326 (renovação)', 'DHCP Request - Transaction ID 0x3903f326 (renewal)'),
          t('Posso continuar com 192.168.1.10?', 'May I keep 192.168.1.10?'),
          43200000,
          mensagem(1, 3, IP.cliente, '0.0.0.0', [pedidos]),
        ),
        pacote(
          'roteador',
          'cliente',
          IP.roteador,
          IP.cliente,
          5,
          'renovacao',
          t('DHCP ACK - ID da transação 0x3903f326 (renovação)', 'DHCP ACK - Transaction ID 0x3903f326 (renewal)'),
          t('Pode: mais 24 h', 'Yes: another 24 h'),
          2,
          mensagem(2, 5, IP.cliente, IP.cliente, concessao(5)),
        ),
      ],
    },
  ],
};
