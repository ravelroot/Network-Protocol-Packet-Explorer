import { hex, IP, no, opaco, t } from '../base';
import type { Campo, Pacote, Protocolo } from '../tipos';

const PUBLICO = '198.51.100.7';
const PADRAO = Array.from({ length: 48 }, (_, i) => (0x10 + i).toString(16).padStart(2, '0')).join(' ');

const dadosPing: Campo[] = [
  hex(t('Carimbo de tempo', 'Timestamp'), 'a1 3c 4e 67 00 00 00 00', '2026-11-08 10:22:41', t('O ping mede o tempo de ida e volta com ele.', 'Ping uses it to measure the round trip.'), true),
  hex(t('Padrão', 'Pattern'), PADRAO, '0x10 … 0x3f', t('Bytes de enchimento: o ping do Linux manda 56 bytes de dados.', 'Filler bytes: Linux ping sends 56 bytes of data.')),
];

const ping = (de: string, para: string, ttl: number, origemIp: string, dt: number, resumo: [string, string]): Pacote => ({
  de,
  para,
  proto: 'ICMP',
  rotulo: t(`TTL ${ttl}`, `TTL ${ttl}`),
  info: t(`Echo (ping) request id=0x0001, seq=1/256, ttl=${ttl}`, `Echo (ping) request id=0x0001, seq=1/256, ttl=${ttl}`),
  tipo: 'ida',
  resumo: t(resumo[0], resumo[1]),
  dt,
  quadro: { origemIp, destinoIp: IP.servidor, ttl, icmp: { tipo: 8, codigo: 0, id: 1, seq: 1 }, carga: dadosPing },
});

export const ip: Protocolo = {
  id: 'ip',
  sigla: 'IP',
  nome: t('Protocolo de Internet', 'Internet Protocol'),
  resumo: t('Protocolo de Internet', 'Internet Protocol'),
  categoria: 'core',
  camada: 3,
  descricao: t(
    'O IP dá a cada aparelho um endereço e leva pacotes de uma rede a outra, salto a salto. Cada roteador olha só o destino, escolhe a melhor saída na sua tabela e passa adiante. É entrega de melhor esforço: o IP não confirma nem reenvia nada, isso fica para o TCP.',
    'IP gives every device an address and carries packets from one network to another, hop by hop. Each router looks only at the destination, picks the best exit in its table and passes the packet on. It is best-effort delivery: IP never acknowledges or resends anything, that is TCP’s job.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Rede (camada 3)', 'Network (Layer 3)')],
    [t('Endereço', 'Address'), t('IPv4: 32 bits (192.168.1.10)', 'IPv4: 32 bits (192.168.1.10)')],
    [t('Cabeçalho', 'Header'), t('20–60 bytes', '20–60 bytes')],
    [t('Entrega', 'Delivery'), t('Melhor esforço, sem garantia', 'Best effort, no guarantees')],
    [t('Encaminhamento', 'Forwarding'), t('Salto a salto, pelo prefixo mais longo', 'Hop by hop, longest prefix match')],
    [t('Definido em', 'Defined in'), t('RFC 791', 'RFC 791')],
  ],
  legenda: {
    arp: { nome: t('ARP', 'ARP'), cor: 'neutra' },
    ida: { nome: t('Pacote de ida', 'Outbound packet'), cor: 'ouro' },
    volta: { nome: t('Resposta', 'Reply'), cor: 'oliva' },
    erro: { nome: t('Erro ICMP', 'ICMP error'), cor: 'brasa' },
  },
  nos: [
    no('cliente', 'notebook', t('Cliente', 'Client'), 10, 74, IP.cliente),
    no('roteador', 'roteador', t('Roteador de casa', 'Home router'), 29, 56, IP.roteador),
    no('provedor', 'roteador', t('Roteador do provedor', 'ISP router'), 49, 72, '198.51.100.1', '00:00:5e:00:53:a1'),
    no('transito', 'roteador', t('Roteador de trânsito', 'Transit router'), 69, 46, '192.0.2.254', '00:00:5e:00:53:b2'),
    no('servidor', 'servidor', t('Servidor', 'Server'), 88, 24, IP.servidor),
  ],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'provedor'],
    ['provedor', 'transito'],
    ['transito', 'servidor'],
  ],
  faixas: ['cliente', 'roteador', 'provedor', 'transito', 'servidor'],
  passos: [
    {
      titulo: t('Achar o gateway', 'Find the gateway'),
      resumo: t('O ARP descobre o MAC do roteador', 'ARP learns the router’s MAC'),
      descricao: t(
        'O servidor 203.0.113.10 está fora da rede local, então o pacote precisa ir para o gateway, 192.168.1.1. Mas o Ethernet entrega por endereço MAC, não por IP. O notebook grita para a rede toda "quem tem 192.168.1.1?" e o roteador responde com o seu MAC.',
        'Server 203.0.113.10 is outside the local network, so the packet must go to the gateway, 192.168.1.1. But Ethernet delivers by MAC address, not by IP. The laptop shouts to the whole network "who has 192.168.1.1?" and the router replies with its MAC.',
      ),
      fatos: [
        [t('Máscara', 'Netmask'), t('/24: 192.168.1.0 a 192.168.1.255', '/24: 192.168.1.0 to 192.168.1.255')],
        [t('Gateway', 'Gateway'), t('192.168.1.1', '192.168.1.1')],
        [t('Cache ARP', 'ARP cache'), t('Guardado por alguns minutos', 'Kept for a few minutes')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'roteador',
          proto: 'ARP',
          rotulo: t('QUEM TEM?', 'WHO HAS?'),
          info: t('Quem tem 192.168.1.1? Avise 192.168.1.10', 'Who has 192.168.1.1? Tell 192.168.1.10'),
          tipo: 'arp',
          resumo: t('Quem tem 192.168.1.1?', 'Who has 192.168.1.1?'),
          dt: 0,
          quadro: { rede: 'arp', arp: { operacao: 1 } },
        },
        {
          de: 'roteador',
          para: 'cliente',
          proto: 'ARP',
          rotulo: t('ESTÁ EM', 'IS AT'),
          info: t('192.168.1.1 está em 00:00:5e:00:53:01', '192.168.1.1 is at 00:00:5e:00:53:01'),
          tipo: 'arp',
          resumo: t('192.168.1.1 → 00:00:5e:00:53:01', '192.168.1.1 → 00:00:5e:00:53:01'),
          dt: 2,
          quadro: { rede: 'arp', arp: { operacao: 2 } },
        },
      ],
    },
    {
      titulo: t('Montar o pacote', 'Build the packet'),
      resumo: t('Origem, destino e TTL 64', 'Source, destination and TTL 64'),
      descricao: t(
        'O notebook monta um ping: cabeçalho IP com origem 192.168.1.10, destino 203.0.113.10 e TTL 64. O quadro Ethernet vai para o MAC do roteador, mas o endereço IP de destino continua sendo o do servidor durante toda a viagem.',
        'The laptop builds a ping: an IP header with source 192.168.1.10, destination 203.0.113.10 and TTL 64. The Ethernet frame goes to the router’s MAC, but the destination IP stays the server’s for the whole trip.',
      ),
      fatos: [
        [t('MAC de destino', 'Destination MAC'), t('O roteador (próximo salto)', 'The router (next hop)')],
        [t('IP de destino', 'Destination IP'), t('O servidor (destino final)', 'The server (final destination)')],
        [t('TTL inicial', 'Initial TTL'), t('64 (Linux, macOS)', '64 (Linux, macOS)')],
      ],
      pacotes: [ping('cliente', 'roteador', 64, IP.cliente, 1, ['Ping para 203.0.113.10, TTL 64', 'Ping to 203.0.113.10, TTL 64'])],
    },
    {
      titulo: t('Salto a salto', 'Hop by hop'),
      resumo: t('Cada roteador tira 1 do TTL', 'Each router takes 1 off the TTL'),
      descricao: t(
        'O roteador de casa troca a origem privada pelo seu IP público (NAT) e entrega ao provedor. Cada roteador consulta sua tabela, escolhe o prefixo mais específico que contém 203.0.113.10, diminui o TTL, recalcula o checksum e passa adiante.',
        'The home router swaps the private source for its public IP (NAT) and hands the packet to the ISP. Each router looks up its table, picks the most specific prefix containing 203.0.113.10, lowers the TTL, recomputes the checksum and passes it on.',
      ),
      fatos: [
        [t('NAT', 'NAT'), t('192.168.1.10 → 198.51.100.7', '192.168.1.10 → 198.51.100.7')],
        [t('Rota escolhida', 'Chosen route'), t('203.0.113.0/24, a mais específica', '203.0.113.0/24, the most specific')],
        [t('TTL', 'TTL'), t('64 → 63 → 62 → 61', '64 → 63 → 62 → 61')],
      ],
      pacotes: [
        ping('roteador', 'provedor', 63, PUBLICO, 2, ['Depois do NAT: origem 198.51.100.7', 'After NAT: source 198.51.100.7']),
        ping('provedor', 'transito', 62, PUBLICO, 6, ['Provedor → trânsito, TTL 62', 'ISP → transit, TTL 62']),
        ping('transito', 'servidor', 61, PUBLICO, 9, ['Último salto, TTL 61', 'Last hop, TTL 61']),
      ],
    },
    {
      titulo: t('A resposta volta', 'The reply comes back'),
      resumo: t('Um pacote novo, talvez por outro caminho', 'A brand-new packet, maybe by another path'),
      descricao: t(
        'O servidor responde com um Echo Reply para 198.51.100.7, com TTL novo de 64. A volta é independente da ida e pode seguir outro caminho. Ao chegar, o roteador de casa desfaz o NAT e entrega ao notebook, que mede cerca de 18 ms de ida e volta.',
        'The server answers with an Echo Reply to 198.51.100.7, starting again at TTL 64. The return trip is independent of the outbound one and may take another path. On arrival the home router undoes the NAT and delivers it to the laptop, which measures about 18 ms round trip.',
      ),
      fatos: [
        [t('Destino', 'Destination'), t('198.51.100.7 (o IP público)', '198.51.100.7 (the public IP)')],
        [t('Chega com', 'Arrives with'), t('TTL 61', 'TTL 61')],
        [t('Tempo', 'Time'), t('≈ 18 ms ida e volta', '≈ 18 ms round trip')],
      ],
      pacotes: [
        {
          de: 'servidor',
          para: 'cliente',
          proto: 'ICMP',
          rotulo: t('ECHO REPLY', 'ECHO REPLY'),
          info: t('Echo (ping) reply id=0x0001, seq=1/256, ttl=64', 'Echo (ping) reply id=0x0001, seq=1/256, ttl=64'),
          tipo: 'volta',
          resumo: t('Resposta para 198.51.100.7', 'Reply to 198.51.100.7'),
          dt: 1,
          quadro: { destinoIp: PUBLICO, ttl: 64, icmp: { tipo: 0, codigo: 0, id: 1, seq: 1 }, carga: dadosPing },
        },
      ],
    },
    {
      titulo: t('Grande demais', 'Too big for the link'),
      resumo: t('MTU, fragmentação e o bit DF', 'MTU, fragmentation and the DF bit'),
      descricao: t(
        'O enlace do provedor usa PPPoE e só aceita 1492 bytes, mas chega um pacote de 1500 com DF ("não fragmentar"). Em vez de dividi-lo, o roteador o descarta e devolve um ICMP dizendo o MTU possível. O notebook reduz os segmentos e tenta de novo: é o Path MTU Discovery.',
        'The ISP link uses PPPoE and only takes 1492 bytes, but a 1500-byte packet arrives with DF ("don’t fragment"). Instead of splitting it, the router drops it and returns an ICMP stating the usable MTU. The laptop shrinks its segments and tries again: that is Path MTU Discovery.',
      ),
      fatos: [
        [t('MTU Ethernet', 'Ethernet MTU'), t('1500 bytes', '1500 bytes')],
        [t('MTU do PPPoE', 'PPPoE MTU'), t('1492 bytes', '1492 bytes')],
        [t('Sem DF', 'Without DF'), t('O roteador fragmentaria o pacote', 'The router would fragment the packet')],
        [t('Mecanismo', 'Mechanism'), t('Path MTU Discovery (RFC 1191)', 'Path MTU Discovery (RFC 1191)')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'provedor',
          proto: 'TCP',
          rotulo: t('1500 BYTES', '1500 BYTES'),
          info: t('49152 → 443 [ACK] Seq=1 Ack=1 Len=1460', '49152 → 443 [ACK] Seq=1 Ack=1 Len=1460'),
          tipo: 'ida',
          resumo: t('1500 bytes com DF', '1500 bytes with DF'),
          dt: 20,
          perdido: true,
          nota: t('NÃO CABE: MTU 1492', 'DOES NOT FIT: MTU 1492'),
          quadro: {
            destinoIp: IP.servidor,
            tcp: { origem: 49152, destino: 443, seq: 1, ack: 1, flags: 'ACK' },
            carga: [opaco(t('Dados cifrados', 'Encrypted data'), 1460, t('Um segmento TLS cheio.', 'A full TLS segment.'))],
          },
        },
        {
          de: 'provedor',
          para: 'cliente',
          proto: 'ICMP',
          rotulo: t('FRAGMENTAÇÃO NECESSÁRIA', 'FRAG NEEDED'),
          info: t('Destino inalcançável (fragmentação necessária), MTU 1492', 'Destination unreachable (Fragmentation needed), MTU 1492'),
          tipo: 'erro',
          resumo: t('MTU do próximo salto: 1492', 'Next-hop MTU: 1492'),
          dt: 3,
          quadro: {
            destinoIp: PUBLICO,
            ttl: 255,
            icmp: { tipo: 3, codigo: 4 },
            carga: [
              hex(t('Não usado, MTU', 'Unused, MTU'), '00 00 05 d4', '1492', t('O maior pacote que o próximo enlace aceita.', 'The largest packet the next link accepts.')),
              hex(
                t('Cabeçalho IP original', 'Original IP header'),
                '45 00 05 dc 7c 1e 40 00 3e 06 54 b8 c6 33 64 07 cb 00 71 0a',
                '198.51.100.7 → 203.0.113.10, 1500 bytes, DF',
                t('O pacote recusado: tamanho 1500 e DF ligado.', 'The rejected packet: 1500 bytes long with DF set.'),
              ),
              hex(t('TCP original', 'Original TCP'), 'c0 00 01 bb 00 00 00 01', '49152 → 443, Seq=1', t('Os 8 primeiros bytes do TCP: portas e sequência.', 'The first 8 bytes of TCP: ports and sequence.')),
            ],
          },
        },
        {
          de: 'cliente',
          para: 'servidor',
          proto: 'TCP',
          rotulo: t('1492 BYTES', '1492 BYTES'),
          info: t('49152 → 443 [ACK] Seq=1 Ack=1 Len=1452', '49152 → 443 [ACK] Seq=1 Ack=1 Len=1452'),
          tipo: 'ida',
          resumo: t('Reenviado em pedaços de 1452 bytes', 'Resent in 1452-byte pieces'),
          dt: 2,
          quadro: {
            tcp: { origem: 49152, destino: 443, seq: 1, ack: 1, flags: 'ACK' },
            carga: [opaco(t('Dados cifrados', 'Encrypted data'), 1452, t('Agora cabe: 20 + 20 + 1452 = 1492.', 'Now it fits: 20 + 20 + 1452 = 1492.'))],
          },
        },
      ],
    },
  ],
};
