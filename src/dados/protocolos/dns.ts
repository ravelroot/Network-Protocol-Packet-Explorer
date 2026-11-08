import { hex, IP, no, nos, t } from '../base';
import type { Campo, Pacote, Protocolo, Texto } from '../tipos';

export const emHex = (bytes: readonly number[]): string => bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');

export const rotulosDns = (nome: string): number[] => [
  ...nome
    .split('.')
    .filter(Boolean)
    .flatMap((parte) => [parte.length, ...[...parte].map((c) => c.charCodeAt(0))]),
  0,
];

export const b16 = (v: number): number[] => [(v >> 8) & 0xff, v & 0xff];
export const b32 = (v: number): number[] => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
export const bIp = (ip: string): number[] => ip.split('.').map(Number);

export const optEdns = (dnssecOk: boolean): Campo =>
  hex(
    t('EDNS0 (OPT)', 'EDNS0 (OPT)'),
    `00 00 29 10 00 00 00 ${dnssecOk ? '80 00' : '00 00'} 00 00`,
    dnssecOk ? 'UDP 4096, DO=1' : 'UDP 4096, DO=0',
    dnssecOk
      ? t('Aceita respostas de até 4096 bytes e pede as assinaturas DNSSEC (bit DO).', 'Accepts answers up to 4096 bytes and asks for DNSSEC signatures (DO bit).')
      : t('Aceita respostas de até 4096 bytes por UDP; sem pedir DNSSEC.', 'Accepts answers up to 4096 bytes over UDP; DNSSEC not requested.'),
  );

const pergunta = (nome: string, tipo = 1): Campo[] => [
  hex(t('Nome', 'Name'), emHex(rotulosDns(nome)), nome, t('Cada parte vem com o tamanho na frente e termina em 0.', 'Each label is prefixed by its length and ends with 0.')),
  hex(t('Tipo, classe', 'Type, class'), emHex([...b16(tipo), 0, 1]), `${tipo === 1 ? 'A' : tipo === 43 ? 'DS' : tipo === 48 ? 'DNSKEY' : String(tipo)}, IN`, t('O tipo de registro pedido, na classe IN (internet).', 'The record type asked for, in class IN (internet).')),
];

export const cabecalhoDns = (id: number, flags: number, contagens: readonly [number, number, number, number], leitura: string, explicacao: Texto): Campo[] => [
  hex(t('ID da transação', 'Transaction ID'), emHex(b16(id)), `0x${id.toString(16).padStart(4, '0')}`, t('A resposta volta com o mesmo número.', 'The answer comes back with the same number.'), true),
  hex(t('Flags', 'Flags'), emHex(b16(flags)), leitura, explicacao),
  hex(
    t('Contadores', 'Counts'),
    emHex(contagens.flatMap((c) => b16(c))),
    `QD=${contagens[0]} AN=${contagens[1]} NS=${contagens[2]} AR=${contagens[3]}`,
    t('Perguntas, respostas, autoridades e registros adicionais.', 'Questions, answers, authorities and additional records.'),
  ),
];

export const consultaDns = (id: number, flags: number, nome: string, tipo: number, leitura: string, explicacao: Texto, edns?: boolean): Campo[] => [
  ...cabecalhoDns(id, flags, [1, 0, 0, edns === undefined ? 0 : 1], leitura, explicacao),
  ...pergunta(nome, tipo),
  ...(edns === undefined ? [] : [optEdns(edns)]),
];

const LETRAS_GTLD = 'abcdefghijklm';
const IPS_GTLD = [
  '192.5.6.30',
  '192.33.14.30',
  '192.26.92.30',
  '192.31.80.30',
  '192.12.94.30',
  '192.35.51.30',
  '192.42.93.30',
  '192.54.112.30',
  '192.43.172.30',
  '192.48.79.30',
  '192.52.178.30',
  '192.41.162.30',
  '192.55.83.30',
];

const indicacaoRaiz = (): Campo[] => {
  const inicioAutoridade = 12 + rotulosDns('www.example.com').length + 4;
  const autoridade: number[] = [];
  const posicoes: number[] = [];
  let ponteiroGtld = 0;
  for (const [i, letra] of [...LETRAS_GTLD].entries()) {
    const inicioRegistro = inicioAutoridade + autoridade.length;
    const dados = i === 0 ? [1, letra.charCodeAt(0), ...rotulosDns('gtld-servers.net')] : [1, letra.charCodeAt(0), 0xc0 | (ponteiroGtld >> 8), ponteiroGtld & 0xff];
    if (i === 0) ponteiroGtld = inicioRegistro + 12 + 2;
    posicoes.push(inicioRegistro + 12);
    autoridade.push(0xc0, 0x18, ...b16(2), 0, 1, ...b32(172800), ...b16(dados.length), ...dados);
  }
  const adicionais = IPS_GTLD.flatMap((ip, i) => [0xc0 | ((posicoes[i] ?? 0) >> 8), (posicoes[i] ?? 0) & 0xff, ...b16(1), 0, 1, ...b32(172800), ...b16(4), ...bIp(ip)]);
  return [
    ...cabecalhoDns(0x7c41, 0x8000, [1, 0, 13, 14], 'QR=1, AA=0', t('Resposta, mas não autoritativa: é só uma indicação.', 'An answer, but not authoritative: just a referral.')),
    ...pergunta('www.example.com'),
    hex(
      t('Autoridade: com. NS ×13', 'Authority: com. NS ×13'),
      emHex(autoridade),
      'a.gtld-servers.net … m.gtld-servers.net',
      t('Os 13 servidores que respondem por .com, válidos por 2 dias. Os nomes se repetem por ponteiros (c0 xx).', 'The 13 servers in charge of .com, valid for 2 days. Repeated names are compressed into pointers (c0 xx).'),
    ),
    hex(
      t('Adicionais: glue A ×13', 'Additional: glue A ×13'),
      emHex(adicionais),
      '192.5.6.30 … 192.55.83.30',
      t('Os IPs desses servidores ("glue"), para o resolvedor não precisar perguntar de novo.', 'The IPs of those servers ("glue"), so the resolver need not ask again.'),
    ),
    optEdns(false),
  ];
};

const indicacaoTld = (): Campo[] => {
  const inicioAutoridade = 12 + rotulosDns('www.example.com').length + 4;
  const ns1 = [3, ...[...'ns1'].map((c) => c.charCodeAt(0)), 0xc0, 0x10];
  const ns2 = [3, ...[...'ns2'].map((c) => c.charCodeAt(0)), 0xc0, 0x10];
  const registro1 = [0xc0, 0x10, ...b16(2), 0, 1, ...b32(172800), ...b16(ns1.length), ...ns1];
  const registro2 = [0xc0, 0x10, ...b16(2), 0, 1, ...b32(172800), ...b16(ns2.length), ...ns2];
  const p1 = inicioAutoridade + 12;
  const p2 = inicioAutoridade + registro1.length + 12;
  const glue = [
    0xc0, p1, ...b16(1), 0, 1, ...b32(172800), ...b16(4), ...bIp(IP.autoritativo),
    0xc0, p2, ...b16(1), 0, 1, ...b32(172800), ...b16(4), ...bIp('198.51.100.54'),
  ];
  return [
    ...cabecalhoDns(0x19e2, 0x8000, [1, 0, 2, 3], 'QR=1, AA=0', t('Outra indicação: o .com sabe quem cuida de example.com.', 'Another referral: .com knows who runs example.com.')),
    ...pergunta('www.example.com'),
    hex(t('Autoridade: example.com. NS ×2', 'Authority: example.com. NS ×2'), emHex([...registro1, ...registro2]), 'ns1.example.com, ns2.example.com', t('Os servidores de nomes da zona example.com.', 'The name servers of the example.com zone.')),
    hex(t('Adicionais: glue A ×2', 'Additional: glue A ×2'), emHex(glue), `${IP.autoritativo}, 198.51.100.54`, t('Glue obrigatório: os nomes ficam dentro da própria zona.', 'Required glue: the names live inside the zone itself.')),
    optEdns(false),
  ];
};

const respostaA = (id: number, flags: number, leitura: string, explicacao: Texto, edns: boolean): Campo[] => [
  ...cabecalhoDns(id, flags, [1, 1, 0, edns ? 1 : 0], leitura, explicacao),
  ...pergunta('www.example.com'),
  hex(t('Resposta: nome', 'Answer: name'), 'c0 0c', 'www.example.com', t('Ponteiro para o nome da pergunta, para não repetir.', 'A pointer back to the question’s name, to avoid repeating it.')),
  hex(t('Tipo, classe', 'Type, class'), '00 01 00 01', 'A, IN'),
  hex(t('TTL', 'TTL'), emHex(b32(3600)), '3600 s', t('Por quanto tempo a resposta pode ficar em cache.', 'How long the answer may be cached.')),
  hex(t('Endereço', 'Address'), emHex([...b16(4), ...bIp(IP.servidor)]), IP.servidor, t('4 bytes de dados: o IP do servidor web.', '4 bytes of data: the web server’s IP.')),
  ...(edns ? [optEdns(false)] : []),
];

const iterativa = (id: number, explicacao: Texto): Campo[] => consultaDns(id, 0x0000, 'www.example.com', 1, 'RD=0', explicacao, false);

const consulta = (de: string, para: string, origem: number, dt: number, campos: Campo[], nota?: Texto): Pacote => ({
  de,
  para,
  proto: 'DNS',
  rotulo: t('CONSULTA DNS', 'DNS QUERY'),
  info: t('Consulta padrão A www.example.com', 'Standard query A www.example.com'),
  tipo: 'consulta',
  resumo: t('A? www.example.com', 'A? www.example.com'),
  dt,
  ...(nota ? { nota } : {}),
  quadro: { udp: { origem, destino: 53 }, carga: campos },
});

export const dns: Protocolo = {
  id: 'dns',
  sigla: 'DNS',
  nome: t('Sistema de Nomes de Domínio', 'Domain Name System'),
  resumo: t('Sistema de Nomes de Domínio', 'Domain Name System'),
  categoria: 'core',
  camada: 7,
  descricao: t(
    'O DNS transforma nomes como www.example.com nos endereços IP que os computadores usam para se encontrar. Nenhum servidor sabe tudo: o sistema é uma hierarquia, e o resolvedor desce da raiz ao .com e dele ao servidor da zona. As respostas ficam em cache pelo caminho, então quase nunca é preciso ir até o topo.',
    'DNS turns names like www.example.com into the IP addresses computers use to find each other. No single server knows everything: the system is a hierarchy, and the resolver walks down from the root to .com and on to the zone’s own server. Answers are cached along the way, so the trip to the top is rarely needed.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Porta', 'Port'), t('53, UDP (TCP para respostas grandes)', '53, UDP (TCP for large answers)')],
    [t('Função', 'Turns'), t('Nomes em endereços IP', 'Names into IP addresses')],
    [t('Hierarquia', 'Hierarchy'), t('Raiz → TLD → autoritativo', 'Root → TLD → authoritative')],
    [t('Cache', 'Caching'), t('Pelo TTL de cada registro', 'For each record’s TTL')],
    [t('Definido em', 'Defined in'), t('RFC 1034, RFC 1035', 'RFC 1034, RFC 1035')],
  ],
  legenda: {
    consulta: { nome: t('Consulta', 'Query'), cor: 'anil' },
    indicacao: { nome: t('Indicação', 'Referral'), cor: 'ouro' },
    resposta: { nome: t('Resposta', 'Answer'), cor: 'oliva' },
  },
  observacao: t('DNSSEC não foi pedido aqui', 'DNSSEC not requested here'),
  nos: [
    nos.cliente(12, 74),
    nos.roteador(30, 58),
    nos.internet(50, 74),
    nos.resolvedor(46, 24),
    no('raiz', 'pilha', t('Servidor Raiz', 'Root Server'), 70, 18, IP.raiz),
    no('tld', 'pilha', t('Servidor TLD .com', '.com TLD Server'), 88, 40, IP.tld),
    no('autoritativo', 'servidor', t('Servidor Autoritativo', 'Authoritative Server'), 84, 76, IP.autoritativo),
  ],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'resolvedor'],
    ['internet', 'raiz'],
    ['internet', 'tld'],
    ['internet', 'autoritativo'],
  ],
  faixas: ['cliente', 'resolvedor', 'raiz', 'tld', 'autoritativo'],
  passos: [
    {
      titulo: t('Pergunta ao resolvedor', 'Ask the resolver'),
      resumo: t('O notebook repassa a pergunta', 'The laptop hands the question off'),
      descricao: t(
        'O navegador precisa do IP de www.example.com, e nem ele nem o sistema têm a resposta em cache. O notebook envia a pergunta ao resolvedor recursivo configurado na rede e pede que ele faça o trabalho todo (recursão desejada).',
        'The browser needs the IP address of www.example.com, and neither it nor the operating system has one cached. The laptop sends the question to the recursive resolver it was configured with and asks it to do the whole job (recursion desired).',
      ),
      fatos: [
        [t('Pergunta', 'Question'), t('www.example.com (A)', 'www.example.com (A)')],
        [t('Para', 'Asked'), t(`${IP.resolvedor} (resolvedor)`, `${IP.resolvedor} (resolver)`)],
        [t('Flags', 'Flags'), t('RD (recursão desejada)', 'RD (recursion desired)')],
      ],
      pacotes: [
        consulta(
          'cliente',
          'resolvedor',
          53211,
          0,
          consultaDns(0xa34c, 0x0100, 'www.example.com', 1, 'RD=1', t('Pergunta com "recursão desejada": o resolvedor que vá atrás.', 'A query with "recursion desired": the resolver does the legwork.')),
        ),
      ],
    },
    {
      titulo: t('Servidor raiz', 'Root server'),
      resumo: t('Aponta o caminho até .com', 'Points the way to .com'),
      descricao: t(
        'O cache do resolvedor está vazio (ele acabou de iniciar), então ele começa pelo topo. Um servidor raiz não sabe o endereço, mas sabe quais servidores cuidam de .com e responde com uma indicação. Muitos resolvedores mandam só "com", e não o nome completo, para revelar menos.',
        'The resolver’s cache is empty (it has just started), so it begins at the top. A root server doesn’t know the address, but it knows which servers handle .com and replies with a referral. Many resolvers send it only "com", not the full name, to reveal less.',
      ),
      fatos: [
        [t('Servidor', 'Server'), t('a.root-servers.net', 'a.root-servers.net')],
        [t('Servidores raiz', 'Root servers'), t('13 nomes, mais de 1.000 locais anycast', '13 names, 1,000+ anycast sites')],
        [t('Resposta', 'Reply'), t('Indicação (13 servidores .com)', 'Referral (13 .com servers)')],
      ],
      pacotes: [
        consulta(
          'resolvedor',
          'raiz',
          41873,
          12,
          iterativa(0x7c41, t('Consulta iterativa: o resolvedor vai sozinho, servidor por servidor.', 'An iterative query: the resolver goes server by server on its own.')),
          t('FORA DO CACHE', 'NOT IN CACHE'),
        ),
        {
          de: 'raiz',
          para: 'resolvedor',
          proto: 'DNS',
          rotulo: t('INDICAÇÃO', 'REFERRAL'),
          info: t('Indicação: com. NS ×13 (com glue)', 'Referral: com. NS ×13 (with glue)'),
          tipo: 'indicacao',
          resumo: t('com. NS a.gtld-servers.net … (13)', 'com. NS a.gtld-servers.net … (13)'),
          dt: 5,
          quadro: { ttl: 57, udp: { origem: 53, destino: 41873 }, carga: indicacaoRaiz() },
        },
      ],
    },
    {
      titulo: t('Servidor TLD .com', '.com TLD server'),
      resumo: t('Aponta o caminho até example.com', 'Points the way to example.com'),
      descricao: t(
        'O resolvedor repete a pergunta a um dos servidores do .com, que também não tem o endereço final. Ele responde quais servidores de nomes cuidam de example.com e, como os nomes deles ficam dentro da própria zona, já manda os IPs junto (glue).',
        'The resolver repeats the question to one of the .com servers, which doesn’t have the final address either. It replies with the name servers in charge of example.com and, since their names live inside that zone, sends their IPs along too (glue).',
      ),
      fatos: [
        [t('Servidor', 'Server'), t('a.gtld-servers.net', 'a.gtld-servers.net')],
        [t('Zona', 'Zone'), t('com. (mais de 150 milhões de nomes)', 'com. (150+ million names)')],
        [t('Resposta', 'Reply'), t('Indicação (ns1 e ns2.example.com)', 'Referral (ns1 and ns2.example.com)')],
      ],
      pacotes: [
        consulta('resolvedor', 'tld', 38422, 5, iterativa(0x19e2, t('Mesma pergunta, agora para o .com.', 'Same question, now to .com.'))),
        {
          de: 'tld',
          para: 'resolvedor',
          proto: 'DNS',
          rotulo: t('INDICAÇÃO', 'REFERRAL'),
          info: t('Indicação: example.com. NS ×2 (com glue)', 'Referral: example.com. NS ×2 (with glue)'),
          tipo: 'indicacao',
          resumo: t('example.com. NS ns1.example.com, ns2.example.com', 'example.com. NS ns1.example.com, ns2.example.com'),
          dt: 10,
          quadro: { ttl: 55, udp: { origem: 53, destino: 38422 }, carga: indicacaoTld() },
        },
      ],
    },
    {
      titulo: t('Servidor autoritativo', 'Authoritative server'),
      resumo: t('Dá a resposta de fato', 'Gives the actual answer'),
      descricao: t(
        'Por fim, o resolvedor pergunta ao servidor que guarda a zona example.com. Esse sabe a resposta e a assina como autoritativa (flag AA): www.example.com é 203.0.113.10, válido por uma hora.',
        'Finally, the resolver asks the server that holds the example.com zone. This one knows the answer and marks it authoritative (AA flag): www.example.com is 203.0.113.10, valid for one hour.',
      ),
      fatos: [
        [t('Servidor', 'Server'), t('ns1.example.com', 'ns1.example.com')],
        [t('Flag', 'Flag'), t('AA (resposta autoritativa)', 'AA (authoritative answer)')],
        [t('Registro', 'Record'), t('www.example.com A 203.0.113.10', 'www.example.com A 203.0.113.10')],
        [t('TTL', 'TTL'), t('3600 s (1 hora)', '3600 s (1 hour)')],
      ],
      pacotes: [
        consulta('resolvedor', 'autoritativo', 50117, 10, iterativa(0x5b07, t('A última pergunta da cadeia.', 'The last question in the chain.'))),
        {
          de: 'autoritativo',
          para: 'resolvedor',
          proto: 'DNS',
          rotulo: t('RESPOSTA', 'ANSWER'),
          info: t('Resposta A 203.0.113.10 (autoritativa)', 'Response A 203.0.113.10 (authoritative)'),
          tipo: 'resposta',
          resumo: t('www.example.com A 203.0.113.10 (AA)', 'www.example.com A 203.0.113.10 (AA)'),
          dt: 20,
          quadro: {
            ttl: 52,
            udp: { origem: 53, destino: 50117 },
            carga: respostaA(0x5b07, 0x8400, 'QR=1, AA=1', t('Resposta vinda de quem é dono da zona.', 'An answer from the zone’s own server.'), true),
          },
        },
      ],
    },
    {
      titulo: t('Resposta e cache', 'Answer & cache'),
      resumo: t('O notebook recebe o endereço', 'The laptop gets its address'),
      descricao: t(
        'O resolvedor guarda tudo o que aprendeu (os servidores do .com por 2 dias, a resposta por 1 hora) e devolve o IP ao notebook com a flag RA. A próxima pessoa que perguntar por www.example.com recebe a resposta direto do cache, em cerca de 1 ms.',
        'The resolver caches everything it learned (the .com servers for 2 days, the answer for 1 hour) and returns the IP to the laptop with the RA flag. The next person asking for www.example.com gets the answer straight from the cache, in about 1 ms.',
      ),
      fatos: [
        [t('Resposta', 'Answer'), t(IP.servidor, IP.servidor)],
        [t('Em cache', 'Cached for'), t('3600 s no resolvedor e no sistema', '3600 s in the resolver and the OS')],
        [t('Tempo total', 'Total time'), t('~62 ms com cache vazio', '~62 ms with a cold cache')],
        [t('Próxima vez', 'Next time'), t('~1 ms, direto do cache', '~1 ms, straight from cache')],
      ],
      pacotes: [
        {
          de: 'resolvedor',
          para: 'cliente',
          proto: 'DNS',
          rotulo: t('RESPOSTA DNS', 'DNS RESPONSE'),
          info: t('Resposta padrão A 203.0.113.10', 'Standard query response A 203.0.113.10'),
          tipo: 'resposta',
          resumo: t('www.example.com → 203.0.113.10', 'www.example.com → 203.0.113.10'),
          dt: 2,
          quadro: {
            ttl: 118,
            udp: { origem: 53, destino: 53211 },
            carga: respostaA(0xa34c, 0x8180, 'QR=1, RD=1, RA=1', t('Resposta com recursão disponível: o resolvedor fez a busca completa.', 'An answer with recursion available: the resolver did the full lookup.'), false),
          },
        },
      ],
    },
  ],
};
