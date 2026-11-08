import { apertoDeMao, hex, no, t } from '../base';
import type { Campo, Pacote, Protocolo } from '../tipos';

const MARCADOR = Array<string>(16).fill('ff').join(' ');
const PORTA_A = 49733;
const PORTA_C = 52817;

const cabecalho = (tamanho: number, tipo: number, nomeTipo: string): Campo[] => [
  hex(t('Marcador', 'Marker'), MARCADOR, 'ff × 16', t('16 bytes em ff marcam o início de cada mensagem no fluxo TCP.', '16 bytes of ff mark the start of every message in the TCP stream.')),
  hex(t('Tamanho', 'Length'), tamanho.toString(16).padStart(4, '0'), `${tamanho} bytes`, t('A mensagem inteira, de 19 a 4096 bytes.', 'The whole message, 19 to 4096 bytes.')),
  hex(t('Tipo', 'Type'), tipo.toString(16).padStart(2, '0'), nomeTipo, t('1 OPEN, 2 UPDATE, 3 NOTIFICATION, 4 KEEPALIVE.', '1 OPEN, 2 UPDATE, 3 NOTIFICATION, 4 KEEPALIVE.')),
];

const open = (asHex: string, as: number, idHex: string, id: string): Campo[] => [
  ...cabecalho(45, 1, 'OPEN'),
  hex(t('Versão', 'Version'), '04', '4', t('BGP-4, a versão usada na internet desde 1994.', 'BGP-4, the version the internet has used since 1994.')),
  hex(t('Meu AS', 'My AS'), asHex, String(as), t('O número do sistema autônomo de quem fala.', 'The speaker’s autonomous system number.')),
  hex(t('Tempo de espera', 'Hold time'), '00 5a', '90 s', t('Sem notícias por 90 s, a sessão cai.', 'With no news for 90 s, the session goes down.')),
  hex(t('Identificador BGP', 'BGP identifier'), idHex, id, t('O ID do roteador, único dentro do AS.', 'The router ID, unique within the AS.')),
  hex(t('Parâmetros', 'Parameters'), '10', '16 bytes', t('Tamanho das capacidades a seguir.', 'Length of the capabilities that follow.')),
  hex(t('Capacidade multiprotocolo', 'Multiprotocol capability'), '02 06 01 04 00 01 00 01', 'IPv4 unicast', t('Quais famílias de endereços esta sessão troca.', 'Which address families this session carries.')),
  hex(t('Capacidade AS de 4 bytes', '4-byte AS capability'), `02 06 41 04 00 00 ${asHex}`, String(as), t('Aceita números de AS acima de 65535.', 'Accepts AS numbers above 65535.')),
];

const keepalive: Campo[] = cabecalho(19, 4, 'KEEPALIVE');

const mensagem = (
  de: 'as64500' | 'as64510',
  para: 'as64500' | 'as64510' | 'as64520',
  seq: number,
  ack: number,
  nome: [string, string],
  tipo: string,
  carga: Campo[],
  dt: number,
  resumo?: [string, string],
): Pacote => {
  const sessaoBC = para === 'as64520';
  const origem = sessaoBC ? 179 : de === 'as64500' ? PORTA_A : 179;
  const destino = sessaoBC ? PORTA_C : de === 'as64500' ? 179 : PORTA_A;
  const tipoMensagem = carga[2]?.valor ?? 'BGP';
  return {
    de,
    para,
    proto: 'BGP',
    rotulo: t(nome[0], nome[1]),
    info: t(`Mensagem ${tipoMensagem}`, `${tipoMensagem} Message`),
    tipo,
    ...(resumo ? { resumo: t(resumo[0], resumo[1]) } : {}),
    dt,
    quadro: {
      ...(sessaoBC ? { origemIp: '198.51.100.1' } : {}),
      ttl: 1,
      tcp: { origem, destino, seq, ack, flags: 'PSH,ACK', janela: 16384 },
      carga,
      camada: 'BGP',
    },
  };
};

const updateA: Campo[] = [
  ...cabecalho(47, 2, 'UPDATE'),
  hex(t('Rotas retiradas', 'Withdrawn routes'), '00 00', '0 bytes', t('Nada sendo retirado nesta mensagem.', 'Nothing withdrawn in this message.')),
  hex(t('Tamanho dos atributos', 'Path attributes length'), '00 14', '20 bytes'),
  hex(t('ORIGIN', 'ORIGIN'), '40 01 01 00', 'IGP', t('A rota nasceu dentro do próprio AS.', 'The route originated inside the AS itself.')),
  hex(t('AS_PATH', 'AS_PATH'), '40 02 06 02 01 00 00 fb f4', '64500', t('A lista de ASes por onde o anúncio passou; evita laços.', 'The list of ASes the announcement went through; prevents loops.')),
  hex(t('NEXT_HOP', 'NEXT_HOP'), '40 03 04 c0 00 02 01', '192.0.2.1', t('Para chegar ao prefixo, mande os pacotes para cá.', 'To reach the prefix, send the packets here.')),
  hex(t('NLRI (prefixo)', 'NLRI (prefix)'), '18 cb 00 71', '203.0.113.0/24', t('Tamanho do prefixo (24 bits) e só os bytes necessários.', 'Prefix length (24 bits) and only the bytes needed.')),
];

const updateB: Campo[] = [
  ...cabecalho(51, 2, 'UPDATE'),
  hex(t('Rotas retiradas', 'Withdrawn routes'), '00 00', '0 bytes'),
  hex(t('Tamanho dos atributos', 'Path attributes length'), '00 18', '24 bytes'),
  hex(t('ORIGIN', 'ORIGIN'), '40 01 01 00', 'IGP'),
  hex(t('AS_PATH', 'AS_PATH'), '40 02 0a 02 02 00 00 fb fe 00 00 fb f4', '64510 64500', t('O AS64510 se coloca na frente antes de repassar.', 'AS64510 prepends itself before passing it on.')),
  hex(t('NEXT_HOP', 'NEXT_HOP'), '40 03 04 c6 33 64 01', '198.51.100.1', t('No eBGP, o próximo salto passa a ser quem repassa.', 'In eBGP, the next hop becomes whoever passes it on.')),
  hex(t('NLRI (prefixo)', 'NLRI (prefix)'), '18 cb 00 71', '203.0.113.0/24'),
];

const retirada: Campo[] = [
  ...cabecalho(27, 2, 'UPDATE'),
  hex(t('Rotas retiradas', 'Withdrawn routes'), '00 04', '4 bytes', t('Um prefixo retirado a seguir.', 'One withdrawn prefix follows.')),
  hex(t('Prefixo retirado', 'Withdrawn prefix'), '18 cb 00 71', '203.0.113.0/24', t('Esta rota não vale mais.', 'This route is no longer valid.')),
  hex(t('Tamanho dos atributos', 'Path attributes length'), '00 00', '0 bytes', t('Retirada pura: sem atributos nem prefixos novos.', 'A pure withdrawal: no attributes and no new prefixes.')),
];

export const bgp: Protocolo = {
  id: 'bgp',
  sigla: 'BGP',
  nome: t('Protocolo de Roteamento de Borda', 'Border Gateway Protocol'),
  resumo: t('Roteamento entre redes', 'Routing between networks'),
  categoria: 'core',
  camada: 3,
  descricao: t(
    'A internet é feita de dezenas de milhares de sistemas autônomos (ASes): provedores, nuvens, universidades. O BGP é como eles contam uns aos outros quais blocos de IP alcançam e por qual caminho. Cada AS escolhe a melhor rota pela sua política e repassa o anúncio adiante, acrescentando seu número ao caminho.',
    'The internet is made of tens of thousands of autonomous systems (ASes): ISPs, clouds, universities. BGP is how they tell each other which IP blocks they can reach and along which path. Each AS picks the best route by its own policy and passes the announcement on, adding its number to the path.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Roteamento (camada 3), sobre TCP', 'Routing (Layer 3), over TCP')],
    [t('Porta', 'Port'), t('179 (TCP)', '179 (TCP)')],
    [t('Tipo', 'Type'), t('Vetor de caminhos entre ASes', 'Path vector between ASes')],
    [t('Mensagens', 'Messages'), t('OPEN, UPDATE, KEEPALIVE, NOTIFICATION', 'OPEN, UPDATE, KEEPALIVE, NOTIFICATION')],
    [t('Tabela global', 'Global table'), t('Cerca de 1 milhão de prefixos IPv4', 'About 1 million IPv4 prefixes')],
    [t('Definido em', 'Defined in'), t('RFC 4271', 'RFC 4271')],
  ],
  legenda: {
    tcp: { nome: t('Sessão TCP', 'TCP session'), cor: 'neutra' },
    controle: { nome: t('OPEN e KEEPALIVE', 'OPEN and KEEPALIVE'), cor: 'oliva' },
    anuncio: { nome: t('Anúncio (UPDATE)', 'Announcement (UPDATE)'), cor: 'ouro' },
    retirada: { nome: t('Retirada', 'Withdrawal'), cor: 'brasa' },
  },
  observacao: t('Sessão AS64510–AS64520 já estabelecida', 'AS64510–AS64520 session already up'),
  nos: [
    no('servidor', 'servidor', t('Rede 203.0.113.0/24', 'Network 203.0.113.0/24'), 10, 36, '203.0.113.10'),
    no('as64500', 'roteador', t('Borda AS64500', 'AS64500 edge'), 24, 72, '192.0.2.1', '00:00:5e:00:53:a5'),
    no('as64510', 'roteador', t('Borda AS64510', 'AS64510 edge'), 54, 42, '192.0.2.2', '00:00:5e:00:53:b5'),
    no('as64520', 'roteador', t('Borda AS64520', 'AS64520 edge'), 86, 66, '198.51.100.2', '00:00:5e:00:53:c5'),
  ],
  ligacoes: [
    ['servidor', 'as64500'],
    ['as64500', 'as64510'],
    ['as64510', 'as64520'],
  ],
  faixas: ['as64500', 'as64510', 'as64520'],
  passos: [
    {
      titulo: t('Sessão TCP', 'TCP session'),
      resumo: t('Porta 179, TTL 1', 'Port 179, TTL 1'),
      descricao: t(
        'Os roteadores de borda do AS64500 e do AS64510 estão ligados diretamente, num ponto de troca de tráfego. O BGP não tem transporte próprio: abre uma conexão TCP comum na porta 179. Como os vizinhos eBGP estão a um salto, os pacotes saem com TTL 1.',
        'The edge routers of AS64500 and AS64510 are directly connected, at an internet exchange point. BGP has no transport of its own: it opens an ordinary TCP connection on port 179. Since eBGP neighbours are one hop away, the packets leave with TTL 1.',
      ),
      fatos: [
        [t('Vizinhos', 'Neighbours'), t('192.0.2.1 ↔ 192.0.2.2', '192.0.2.1 ↔ 192.0.2.2')],
        [t('Tipo de sessão', 'Session type'), t('eBGP (ASes diferentes)', 'eBGP (different ASes)')],
        [t('TTL', 'TTL'), t('1: só o vizinho direto aceita', '1: only the direct neighbour accepts it')],
      ],
      pacotes: apertoDeMao({ de: 'as64500', para: 'as64510', portaCliente: PORTA_A, portaServidor: 179, tipo: 'tcp' }).map((p, i) => ({
        ...p,
        dt: i === 0 ? 0 : 1,
        quadro: { ...p.quadro, ttl: 1 },
      })),
    },
    {
      titulo: t('Apresentação', 'Introductions'),
      resumo: t('Cada lado diz seu AS no OPEN', 'Each side states its AS in OPEN'),
      descricao: t(
        'Cada roteador manda um OPEN com seu número de AS, o tempo de espera e as capacidades que entende. Se tudo bate, cada um confirma com um KEEPALIVE e a sessão passa ao estado Established.',
        'Each router sends an OPEN with its AS number, hold time and the capabilities it understands. If everything matches, each one confirms with a KEEPALIVE and the session moves to the Established state.',
      ),
      fatos: [
        [t('AS local', 'Local AS'), t('64500', '64500')],
        [t('AS vizinho', 'Peer AS'), t('64510', '64510')],
        [t('Tempo de espera', 'Hold time'), t('90 s (o menor dos dois)', '90 s (the lower of the two)')],
        [t('Estado final', 'Final state'), t('Established', 'Established')],
      ],
      pacotes: [
        mensagem('as64500', 'as64510', 1, 1, ['OPEN', 'OPEN'], 'controle', open('fb f4', 64500, 'c0 00 02 01', '192.0.2.1'), 1, ['AS64500, espera 90 s', 'AS64500, hold 90 s']),
        mensagem('as64510', 'as64500', 1, 46, ['OPEN', 'OPEN'], 'controle', open('fb fe', 64510, 'c0 00 02 02', '192.0.2.2'), 1, ['AS64510, espera 90 s', 'AS64510, hold 90 s']),
        mensagem('as64500', 'as64510', 46, 46, ['KEEPALIVE', 'KEEPALIVE'], 'controle', keepalive, 1),
        mensagem('as64510', 'as64500', 46, 65, ['KEEPALIVE', 'KEEPALIVE'], 'controle', keepalive, 1),
      ],
    },
    {
      titulo: t('Anunciar o prefixo', 'Announce the prefix'),
      resumo: t('UPDATE com AS_PATH', 'UPDATE with AS_PATH'),
      descricao: t(
        'O AS64500 é dono do bloco 203.0.113.0/24, onde fica o servidor. Ele manda um UPDATE dizendo "este prefixo é alcançável por mim": o AS_PATH começa só com 64500 e o NEXT_HOP aponta para o próprio roteador.',
        'AS64500 owns the 203.0.113.0/24 block, where the server lives. It sends an UPDATE saying "this prefix is reachable through me": the AS_PATH starts with just 64500 and the NEXT_HOP points to the router itself.',
      ),
      fatos: [
        [t('Prefixo', 'Prefix'), t('203.0.113.0/24', '203.0.113.0/24')],
        [t('AS_PATH', 'AS_PATH'), t('64500', '64500')],
        [t('NEXT_HOP', 'NEXT_HOP'), t('192.0.2.1', '192.0.2.1')],
      ],
      pacotes: [mensagem('as64500', 'as64510', 65, 65, ['UPDATE', 'UPDATE'], 'anuncio', updateA, 120, ['203.0.113.0/24 via AS64500', '203.0.113.0/24 via AS64500'])],
    },
    {
      titulo: t('Passar adiante', 'Pass it on'),
      resumo: t('O caminho cresce a cada AS', 'The path grows with every AS'),
      descricao: t(
        'O AS64510 aceita a rota, compara com outras que já conhece e, sendo a melhor, repassa ao AS64520 com o seu número na frente: 64510 64500. Se um AS vir o próprio número no caminho, descarta o anúncio, e é assim que o BGP evita laços.',
        'AS64510 accepts the route, compares it with others it already knows and, since it is the best, passes it to AS64520 with its own number in front: 64510 64500. If an AS sees its own number in the path it drops the announcement, which is how BGP avoids loops.',
      ),
      fatos: [
        [t('AS_PATH', 'AS_PATH'), t('64510 64500', '64510 64500')],
        [t('NEXT_HOP', 'NEXT_HOP'), t('198.51.100.1', '198.51.100.1')],
        [t('Critérios', 'Tie-breakers'), t('LOCAL_PREF, AS_PATH mais curto, MED...', 'LOCAL_PREF, shortest AS_PATH, MED...')],
      ],
      pacotes: [mensagem('as64510', 'as64520', 3812, 2290, ['UPDATE', 'UPDATE'], 'anuncio', updateB, 35, ['203.0.113.0/24 via 64510 64500', '203.0.113.0/24 via 64510 64500'])],
    },
    {
      titulo: t('Manter viva', 'Keep it alive'),
      resumo: t('KEEPALIVE a cada 30 s', 'KEEPALIVE every 30 s'),
      descricao: t(
        'Sem novidades, os vizinhos trocam KEEPALIVEs de 19 bytes a cada um terço do tempo de espera. Se 90 s passarem sem nada, a sessão cai e todas as rotas aprendidas por ela são retiradas de uma vez.',
        'With nothing new, the neighbours exchange 19-byte KEEPALIVEs every third of the hold time. If 90 s go by with nothing, the session drops and every route learned through it is withdrawn at once.',
      ),
      fatos: [
        [t('Intervalo', 'Interval'), t('30 s', '30 s')],
        [t('Tamanho', 'Size'), t('19 bytes: só o cabeçalho', '19 bytes: header only')],
        [t('Sem resposta', 'No answer'), t('Em 90 s a sessão cai', 'After 90 s the session drops')],
      ],
      pacotes: [
        mensagem('as64510', 'as64500', 65, 112, ['KEEPALIVE', 'KEEPALIVE'], 'controle', keepalive, 30000),
        mensagem('as64500', 'as64510', 112, 84, ['KEEPALIVE', 'KEEPALIVE'], 'controle', keepalive, 2),
      ],
    },
    {
      titulo: t('Retirar a rota', 'Withdraw the route'),
      resumo: t('A rede sai do ar', 'The network goes offline'),
      descricao: t(
        'O enlace até o servidor cai. O AS64500 manda um UPDATE só com a lista de rotas retiradas, e o AS64510 repassa a retirada. Em segundos, toda a internet esquece o caminho, ou passa a usar outro, se existir.',
        'The link to the server goes down. AS64500 sends an UPDATE carrying only the withdrawn routes list, and AS64510 passes the withdrawal on. Within seconds the whole internet forgets the path, or switches to another one if it exists.',
      ),
      fatos: [
        [t('Prefixo retirado', 'Withdrawn prefix'), t('203.0.113.0/24', '203.0.113.0/24')],
        [t('Propagação', 'Propagation'), t('Segundos a poucos minutos', 'Seconds to a few minutes')],
        [t('Proteção', 'Protection'), t('RPKI valida quem pode anunciar', 'RPKI validates who may announce')],
      ],
      pacotes: [
        mensagem('as64500', 'as64510', 131, 84, ['RETIRADA', 'WITHDRAW'], 'retirada', retirada, 4200, ['Retirar 203.0.113.0/24', 'Withdraw 203.0.113.0/24']),
        mensagem('as64510', 'as64520', 3863, 2290, ['RETIRADA', 'WITHDRAW'], 'retirada', retirada, 30, ['Retirar 203.0.113.0/24', 'Withdraw 203.0.113.0/24']),
      ],
    },
  ],
};
