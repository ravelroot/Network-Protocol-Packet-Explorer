import { apertoDeMao, hex, no, t } from '../base';
import type { Campo, Pacote, Protocolo } from '../tipos';

const LL_CLIENTE = 'fe80::200:5eff:fe00:5310';
const LL_ROTEADOR = 'fe80::200:5eff:fe00:5301';
const GLOBAL_CLIENTE = '2001:db8:1::200:5eff:fe00:5310';
const NO_SOLICITADO_CLIENTE = 'ff02::1:ff00:5310';
const NO_SOLICITADO_ROTEADOR = 'ff02::1:ff00:5301';
const SERVIDOR = '2001:db8:80::10';

const reservado = (): Campo => hex(t('Reservado', 'Reserved'), '00 00 00 00', '0', t('Sempre zero.', 'Always zero.'));

const alvo = (endereco: string, bytes: string, explicacao: ReturnType<typeof t>): Campo => hex(t('Endereço-alvo', 'Target address'), bytes, endereco, explicacao);

const opcaoLinkOrigem = (mac: string): Campo =>
  hex(
    t('Opção: MAC de origem', 'Option: source link-layer address'),
    `01 01 ${mac.split(':').join(' ')}`,
    mac,
    t('Tipo 1, 8 bytes: o endereço MAC de quem envia, para a resposta não precisar perguntar.', 'Type 1, 8 bytes: the sender’s MAC, so the reply needs no extra lookup.'),
  );

const ns = (de: string, para: string, origemIp: string, destinoIp: string, alvoTexto: string, alvoHex: string, dad: boolean, dt: number): Pacote => ({
  de,
  para,
  proto: 'ICMPv6',
  rotulo: t('NS', 'NS'),
  info: t(`Neighbor Solicitation para ${alvoTexto}${dad ? ' (DAD)' : ''}`, `Neighbor Solicitation for ${alvoTexto}${dad ? ' (DAD)' : ''}`),
  tipo: 'ndp',
  resumo: t(`Quem tem ${alvoTexto}?`, `Who has ${alvoTexto}?`),
  dt,
  quadro: {
    rede: 'ipv6',
    origemIp,
    destinoIp,
    ttl: 255,
    icmp: { tipo: 135, codigo: 0 },
    camada: 'NDP',
    carga: [
      reservado(),
      alvo(
        alvoTexto,
        alvoHex,
        dad
          ? t('O próprio endereço que se quer usar: se alguém responder, ele já está em uso.', 'The very address we want to use: if anyone answers, it is taken.')
          : t('O vizinho cujo MAC se procura.', 'The neighbour whose MAC we are looking for.'),
      ),
      ...(dad ? [] : [opcaoLinkOrigem('00:00:5e:00:53:10')]),
    ],
  },
});

export const ipv6: Protocolo = {
  id: 'ipv6',
  sigla: 'IPv6',
  nome: t('Protocolo de Internet, versão 6', 'Internet Protocol version 6'),
  resumo: t('Configuração de endereço, descoberta de vizinhos', 'Address setup, neighbour discovery'),
  categoria: 'core',
  camada: 3,
  descricao: t(
    'O IPv6 usa endereços de 128 bits, o bastante para cada aparelho ter o seu, sem NAT. Um computador se configura sozinho: cria um endereço local, ouve o anúncio do roteador, monta o endereço global a partir do prefixo (SLAAC) e confere se ninguém mais o usa. O ARP some: tudo isso é feito pelo Neighbor Discovery, sobre ICMPv6.',
    'IPv6 uses 128-bit addresses, enough for every device to have its own, with no NAT. A computer configures itself: it creates a link-local address, listens to the router’s advertisement, builds a global address from the prefix (SLAAC) and checks nobody else uses it. ARP is gone: Neighbor Discovery, over ICMPv6, does all of this.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Rede (camada 3)', 'Network (Layer 3)')],
    [t('Endereço', 'Address'), t('128 bits (2001:db8::/32 é para documentação)', '128 bits (2001:db8::/32 is for documentation)')],
    [t('Cabeçalho', 'Header'), t('40 bytes fixos, sem checksum', 'Fixed 40 bytes, no checksum')],
    [t('Configuração', 'Setup'), t('SLAAC ou DHCPv6', 'SLAAC or DHCPv6')],
    [t('Vizinhos', 'Neighbours'), t('NDP sobre ICMPv6 (substitui o ARP)', 'NDP over ICMPv6 (replaces ARP)')],
    [t('Definido em', 'Defined in'), t('RFC 8200, RFC 4861, RFC 4862', 'RFC 8200, RFC 4861, RFC 4862')],
  ],
  legenda: {
    ndp: { nome: t('Descoberta de vizinhos', 'Neighbour discovery'), cor: 'anil' },
    roteador: { nome: t('Mensagens do roteador', 'Router messages'), cor: 'ouro' },
    dados: { nome: t('Tráfego IPv6', 'IPv6 traffic'), cor: 'oliva' },
  },
  observacao: t('Multicast mostrado como broadcast', 'Multicast shown as broadcast'),
  nos: [
    no('cliente', 'notebook', t('Cliente', 'Client'), 14, 72),
    no('roteador', 'roteador', t('Roteador', 'Router'), 42, 52),
    no('internet', 'internet', t('Internet', 'Internet'), 66, 74),
    no('servidor', 'servidor', t('Servidor Web', 'Web Server'), 86, 30),
  ],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'roteador', 'servidor'],
  passos: [
    {
      titulo: t('Endereço local', 'Link-local address'),
      resumo: t('Um endereço só para a rede de casa', 'An address for the local link only'),
      descricao: t(
        'Ao ligar a interface, o notebook cria sozinho um endereço fe80:: a partir do próprio MAC. Antes de usá-lo, faz a detecção de duplicidade (DAD): pergunta, a partir do endereço vazio ::, se alguém já tem esse endereço. Silêncio por um segundo significa que está livre.',
        'When the interface comes up, the laptop creates an fe80:: address from its own MAC. Before using it, it runs duplicate address detection (DAD): from the unspecified address ::, it asks whether anyone already has it. One second of silence means it is free.',
      ),
      fatos: [
        [t('Endereço', 'Address'), t(LL_CLIENTE, LL_CLIENTE)],
        [t('Identificador', 'Interface ID'), t('EUI-64 do MAC 00:00:5e:00:53:10', 'EUI-64 from MAC 00:00:5e:00:53:10')],
        [t('Origem do DAD', 'DAD source'), t(':: (ainda sem endereço)', ':: (no address yet)')],
      ],
      pacotes: [ns('cliente', 'roteador', '::', NO_SOLICITADO_CLIENTE, LL_CLIENTE, 'fe 80 00 00 00 00 00 00 02 00 5e ff fe 00 53 10', true, 0)],
    },
    {
      titulo: t('Procura um roteador', 'Router solicitation'),
      resumo: t('Pergunta quem é o roteador', 'Asks who the router is'),
      descricao: t(
        'Em vez de esperar o próximo anúncio periódico, o notebook manda um Router Solicitation para ff02::2, o grupo de todos os roteadores da rede.',
        'Instead of waiting for the next periodic advertisement, the laptop sends a Router Solicitation to ff02::2, the all-routers group.',
      ),
      fatos: [
        [t('Destino', 'Destination'), t('ff02::2 (todos os roteadores)', 'ff02::2 (all routers)')],
        [t('ICMPv6', 'ICMPv6'), t('Tipo 133', 'Type 133')],
        [t('Limite de saltos', 'Hop limit'), t('255: não pode ter passado por roteador', '255: cannot have crossed a router')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'roteador',
          proto: 'ICMPv6',
          rotulo: t('RS', 'RS'),
          info: t('Router Solicitation de 00:00:5e:00:53:10', 'Router Solicitation from 00:00:5e:00:53:10'),
          tipo: 'ndp',
          resumo: t('Algum roteador aí?', 'Any routers here?'),
          dt: 1004,
          quadro: {
            rede: 'ipv6',
            origemIp: LL_CLIENTE,
            destinoIp: 'ff02::2',
            ttl: 255,
            icmp: { tipo: 133, codigo: 0 },
            camada: 'NDP',
            carga: [reservado(), opcaoLinkOrigem('00:00:5e:00:53:10')],
          },
        },
      ],
    },
    {
      titulo: t('Anúncio do roteador', 'Router advertisement'),
      resumo: t('O roteador entrega o prefixo', 'The router hands out the prefix'),
      descricao: t(
        'O roteador responde a todos (ff02::1) com o prefixo da rede, 2001:db8:1::/64, a MTU e o servidor DNS. As flags A e L dizem que o prefixo pode ser usado para se autoconfigurar. Como M e O estão desligadas, não há DHCPv6.',
        'The router answers everyone (ff02::1) with the network prefix 2001:db8:1::/64, the MTU and the DNS server. The A and L flags say the prefix may be used for autoconfiguration. Since M and O are off, there is no DHCPv6.',
      ),
      fatos: [
        [t('Prefixo', 'Prefix'), t('2001:db8:1::/64', '2001:db8:1::/64')],
        [t('Vida do roteador', 'Router lifetime'), t('1800 s', '1800 s')],
        [t('MTU', 'MTU'), t('1500 bytes', '1500 bytes')],
        [t('DNS (RDNSS)', 'DNS (RDNSS)'), t('2001:db8:1::1', '2001:db8:1::1')],
      ],
      pacotes: [
        {
          de: 'roteador',
          para: 'cliente',
          proto: 'ICMPv6',
          rotulo: t('RA', 'RA'),
          info: t('Router Advertisement de 00:00:5e:00:53:01, prefixo 2001:db8:1::/64', 'Router Advertisement from 00:00:5e:00:53:01, prefix 2001:db8:1::/64'),
          tipo: 'roteador',
          resumo: t('Prefixo 2001:db8:1::/64, MTU 1500', 'Prefix 2001:db8:1::/64, MTU 1500'),
          dt: 3,
          quadro: {
            rede: 'ipv6',
            origemIp: LL_ROTEADOR,
            destinoIp: 'ff02::1',
            ttl: 255,
            icmp: { tipo: 134, codigo: 0 },
            camada: 'NDP',
            carga: [
              hex(t('Limite de saltos sugerido', 'Cur hop limit'), '40', '64', t('O valor que os hosts devem usar nos pacotes.', 'The value hosts should put in their packets.')),
              hex(t('Flags M, O', 'Flags M, O'), '00', 'M=0, O=0', t('Sem DHCPv6: endereço e extras vêm do próprio anúncio.', 'No DHCPv6: address and extras come from this advertisement.')),
              hex(t('Vida do roteador', 'Router lifetime'), '07 08', '1800 s', t('Por quanto tempo ele vale como rota padrão.', 'How long it serves as the default route.')),
              hex(t('Alcançável, retransmissão', 'Reachable, retrans timer'), '00 00 00 00 00 00 00 00', '0, 0', t('Zero: usa os valores padrão do sistema.', 'Zero: use the OS defaults.')),
              opcaoLinkOrigem('00:00:5e:00:53:01'),
              hex(t('Opção: MTU', 'Option: MTU'), '05 01 00 00 00 00 05 dc', '1500', t('O maior pacote que cabe nesta rede.', 'The largest packet that fits on this link.')),
              hex(
                t('Opção: prefixo', 'Option: prefix information'),
                '03 04 40 c0 00 27 8d 00 00 09 3a 80 00 00 00 00 20 01 0d b8 00 01 00 00 00 00 00 00 00 00 00 00',
                '2001:db8:1::/64, L=1, A=1',
                t('Prefixo de 64 bits, válido por 30 dias, preferido por 7.', 'A 64-bit prefix, valid for 30 days, preferred for 7.'),
              ),
              hex(
                t('Opção: DNS (RDNSS)', 'Option: DNS (RDNSS)'),
                '19 03 00 00 00 00 0e 10 20 01 0d b8 00 01 00 00 00 00 00 00 00 00 00 01',
                '2001:db8:1::1',
                t('Servidor DNS recursivo, válido por 1 hora (RFC 8106).', 'Recursive DNS server, valid for 1 hour (RFC 8106).'),
              ),
            ],
          },
        },
      ],
    },
    {
      titulo: t('Endereço global', 'Global address'),
      resumo: t('SLAAC e detecção de duplicidade', 'SLAAC and duplicate detection'),
      descricao: t(
        'O notebook junta o prefixo /64 ao seu identificador de interface e forma 2001:db8:1::200:5eff:fe00:5310. Repete o DAD para esse endereço e, sem resposta, passa a usá-lo. Sistemas atuais costumam criar também um endereço temporário aleatório, por privacidade.',
        'The laptop appends its interface identifier to the /64 prefix and gets 2001:db8:1::200:5eff:fe00:5310. It repeats DAD for that address and, with no reply, starts using it. Modern systems usually also create a random temporary address, for privacy.',
      ),
      fatos: [
        [t('Endereço global', 'Global address'), t(GLOBAL_CLIENTE, GLOBAL_CLIENTE)],
        [t('Nó solicitado', 'Solicited node'), t(NO_SOLICITADO_CLIENTE, NO_SOLICITADO_CLIENTE)],
        [t('Temporário', 'Temporary'), t('Aleatório, troca a cada dia (RFC 8981)', 'Random, rotated daily (RFC 8981)')],
      ],
      pacotes: [ns('cliente', 'roteador', '::', NO_SOLICITADO_CLIENTE, GLOBAL_CLIENTE, '20 01 0d b8 00 01 00 00 02 00 5e ff fe 00 53 10', true, 412)],
    },
    {
      titulo: t('Acha o gateway', 'Find the gateway'),
      resumo: t('Descobre o MAC do roteador', 'Learns the router’s MAC'),
      descricao: t(
        'Para mandar algo para fora, o notebook precisa do MAC do roteador. Pergunta com um Neighbor Solicitation ao grupo de nó solicitado do roteador (só ele escuta esse grupo), e o roteador responde com um Neighbor Advertisement, com as flags de roteador e de resposta solicitada.',
        'To send anything off-link, the laptop needs the router’s MAC. It asks with a Neighbor Solicitation sent to the router’s solicited-node group (only it listens there), and the router replies with a Neighbor Advertisement carrying the router and solicited flags.',
      ),
      fatos: [
        [t('Pergunta para', 'Asked'), t(NO_SOLICITADO_ROTEADOR, NO_SOLICITADO_ROTEADOR)],
        [t('Resposta', 'Answer'), t('00:00:5e:00:53:01', '00:00:5e:00:53:01')],
        [t('Flags', 'Flags'), t('R=1, S=1, O=1', 'R=1, S=1, O=1')],
      ],
      pacotes: [
        ns('cliente', 'roteador', GLOBAL_CLIENTE, NO_SOLICITADO_ROTEADOR, LL_ROTEADOR, 'fe 80 00 00 00 00 00 00 02 00 5e ff fe 00 53 01', false, 6),
        {
          de: 'roteador',
          para: 'cliente',
          proto: 'ICMPv6',
          rotulo: t('NA', 'NA'),
          info: t(`Neighbor Advertisement ${LL_ROTEADOR} (rtr, sol, ovr) é 00:00:5e:00:53:01`, `Neighbor Advertisement ${LL_ROTEADOR} (rtr, sol, ovr) is at 00:00:5e:00:53:01`),
          tipo: 'roteador',
          resumo: t('Sou eu: 00:00:5e:00:53:01', 'That’s me: 00:00:5e:00:53:01'),
          dt: 1,
          quadro: {
            rede: 'ipv6',
            origemIp: LL_ROTEADOR,
            destinoIp: GLOBAL_CLIENTE,
            ttl: 255,
            icmp: { tipo: 136, codigo: 0 },
            camada: 'NDP',
            carga: [
              hex(t('Flags R, S, O', 'Flags R, S, O'), 'e0 00 00 00', 'R=1, S=1, O=1', t('É roteador, responde a uma pergunta e pode sobrescrever o cache.', 'It is a router, it answers a question and may override the cache.')),
              alvo(LL_ROTEADOR, 'fe 80 00 00 00 00 00 00 02 00 5e ff fe 00 53 01', t('O endereço sobre o qual se perguntou.', 'The address that was asked about.')),
              hex(t('Opção: MAC do alvo', 'Option: target link-layer address'), '02 01 00 00 5e 00 53 01', '00:00:5e:00:53:01', t('Tipo 2: a resposta em si.', 'Type 2: the answer itself.')),
            ],
          },
        },
      ],
    },
    {
      titulo: t('Primeiro pacote', 'First packet'),
      resumo: t('IPv6 de ponta a ponta, sem NAT', 'End-to-end IPv6, no NAT'),
      descricao: t(
        'Pronto: o notebook abre uma conexão TCP direto com o servidor 2001:db8:80::10. O endereço de origem é o global, visível do outro lado, sem tradução no roteador. O cabeçalho tem 40 bytes fixos e não tem checksum: essa conferência fica com o TCP.',
        'Done: the laptop opens a TCP connection straight to the server at 2001:db8:80::10. The source is its global address, visible on the other side, with no translation at the router. The header is a fixed 40 bytes with no checksum: that check is left to TCP.',
      ),
      fatos: [
        [t('Origem', 'Source'), t(GLOBAL_CLIENTE, GLOBAL_CLIENTE)],
        [t('Destino', 'Destination'), t(SERVIDOR, SERVIDOR)],
        [t('NAT', 'NAT'), t('Nenhum', 'None')],
      ],
      pacotes: apertoDeMao({ de: 'cliente', para: 'servidor', portaCliente: 50412, portaServidor: 80, tipo: 'dados' })
        .slice(0, 2)
        .map((p, i) => ({
          ...p,
          dt: i === 0 ? 220 : 24,
          quadro: {
            ...p.quadro,
            rede: 'ipv6' as const,
            origemIp: i === 0 ? GLOBAL_CLIENTE : SERVIDOR,
            destinoIp: i === 0 ? SERVIDOR : GLOBAL_CLIENTE,
            ttl: i === 0 ? 64 : 57,
          },
        })),
    },
  ],
};
