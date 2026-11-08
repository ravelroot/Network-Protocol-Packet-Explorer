import { hex, IP, no, nos, opaco, t } from '../base';
import type { Campo, Pacote, Protocolo, Texto } from '../tipos';
import { b16, b32, bIp, cabecalhoDns, consultaDns, emHex, optEdns, rotulosDns } from './dns';

const INICIO = '6a e6 81 00';
const FIM = '6b 02 30 80';
const TAG_KSK = 0x9c3f;
const TAG_ZSK = 0xe1a4;

const pergunta = (nome: string, tipo: number, leitura: string): Campo[] => [
  hex(t('Nome', 'Name'), emHex(rotulosDns(nome)), nome, t('O nome perguntado, em rótulos com tamanho.', 'The name asked about, as length-prefixed labels.')),
  hex(t('Tipo, classe', 'Type, class'), emHex([...b16(tipo), 0, 1]), leitura),
];

const rrsig = (coberto: number, nomeCoberto: string, algoritmo: number, rotulos: number, ttl: number, tag: number, signatario: number[], signatarioTexto: string, bytesAssinatura: number, quem: Texto): Campo[] => {
  const tamanho = 18 + signatario.length + bytesAssinatura;
  return [
    hex(
      t(`RRSIG ${nomeCoberto}: cabeçalho`, `RRSIG ${nomeCoberto}: header`),
      emHex([0xc0, 0x0c, ...b16(46), 0, 1, ...b32(ttl), ...b16(tamanho)]),
      `RRSIG, TTL ${ttl}`,
      t('Registro tipo 46: a assinatura do conjunto acima.', 'Record type 46: the signature over the set above.'),
    ),
    hex(
      t('Tipo coberto, algoritmo, rótulos', 'Type covered, algorithm, labels'),
      emHex([...b16(coberto), algoritmo, rotulos, ...b32(ttl)]),
      `${nomeCoberto}, ${algoritmo === 13 ? 'ECDSA P-256' : 'RSA/SHA-256'}, ${rotulos}`,
      t('O que foi assinado, com qual algoritmo e o TTL original.', 'What was signed, with which algorithm, and the original TTL.'),
    ),
    hex(t('Validade', 'Validity'), `${FIM} ${INICIO}`, '2026-11-01 → 2026-11-22', t('Fora dessa janela, a assinatura não vale.', 'Outside this window the signature is invalid.')),
    hex(t('Chave e signatário', 'Key tag and signer'), emHex([...b16(tag), ...signatario]), `${tag} · ${signatarioTexto}`, quem),
    opaco(t('Assinatura', 'Signature'), bytesAssinatura, t('Bytes da assinatura: só a chave pública certa os confere.', 'The signature bytes: only the right public key verifies them.')),
  ];
};

const registroA: Campo = hex(
  t('Resposta: A', 'Answer: A'),
  emHex([0xc0, 0x0c, ...b16(1), 0, 1, ...b32(3600), ...b16(4), ...bIp(IP.servidor)]),
  `www.example.com A ${IP.servidor}`,
  t('O endereço pedido, como no DNS comum.', 'The address asked for, just like plain DNS.'),
);

const dnskey = (flags: number, nome: Texto, leitura: string, explica: Texto): Campo[] => [
  hex(nome, emHex([0xc0, 0x0c, ...b16(48), 0, 1, ...b32(3600), ...b16(68), ...b16(flags), 3, 13]), leitura, explica),
  opaco(t('Chave pública', 'Public key'), 64, t('Ponto da curva P-256: 64 bytes.', 'A P-256 curve point: 64 bytes.')),
];

const consulta = (de: string, para: string, origem: number, dt: number, rotulo: Texto, info: Texto, resumo: Texto, carga: Campo[], nota?: Texto): Pacote => ({
  de,
  para,
  proto: 'DNS',
  rotulo,
  info,
  tipo: 'consulta',
  resumo,
  dt,
  ...(nota ? { nota } : {}),
  quadro: { udp: { origem, destino: 53 }, carga },
});

const assinado = (de: string, para: string, destino: number, dt: number, ttl: number, rotulo: Texto, info: Texto, resumo: Texto, carga: Campo[]): Pacote => ({
  de,
  para,
  proto: 'DNS',
  rotulo,
  info,
  tipo: 'assinado',
  resumo,
  dt,
  quadro: { ttl, udp: { origem: 53, destino }, carga },
});

const iterativa = (id: number, nome: string, tipo: number, leitura: string): Campo[] => [
  ...cabecalhoDns(id, 0x0000, [1, 0, 0, 1], 'RD=0', t('Consulta iterativa, sem recursão.', 'An iterative query, no recursion.')),
  ...pergunta(nome, tipo, leitura),
  optEdns(true),
];

export const dnssec: Protocolo = {
  id: 'dnssec',
  sigla: 'DNSSEC',
  nome: t('Extensões de Segurança do DNS', 'DNS Security Extensions'),
  resumo: t('Respostas DNS assinadas', 'Signed DNS answers'),
  categoria: 'seguranca',
  camada: 7,
  descricao: t(
    'O DNS comum aceita qualquer resposta que chegue com o ID certo, o que permite envenenar caches. O DNSSEC assina cada conjunto de registros. O resolvedor confere a assinatura com a chave da zona, a chave da zona com o hash publicado na zona pai, e assim por diante até a raiz, cuja chave ele já conhece. Não cifra nada: garante autenticidade e integridade.',
    'Plain DNS accepts any answer that arrives with the right ID, which allows cache poisoning. DNSSEC signs every record set. The resolver checks the signature against the zone’s key, the zone’s key against the hash published in the parent zone, and so on up to the root, whose key it already knows. Nothing is encrypted: it guarantees authenticity and integrity.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Porta', 'Port'), t('53, UDP com EDNS0 (respostas maiores)', '53, UDP with EDNS0 (bigger answers)')],
    [t('Novos registros', 'New records'), t('RRSIG, DNSKEY, DS, NSEC/NSEC3', 'RRSIG, DNSKEY, DS, NSEC/NSEC3')],
    [t('Garante', 'Provides'), t('Origem e integridade, não sigilo', 'Origin and integrity, not secrecy')],
    [t('Confiança', 'Trust'), t('Cadeia até a KSK da raiz', 'A chain up to the root KSK')],
    [t('Definido em', 'Defined in'), t('RFC 4033, 4034, 4035', 'RFC 4033, 4034, 4035')],
  ],
  legenda: {
    consulta: { nome: t('Consulta (DO=1)', 'Query (DO=1)'), cor: 'anil' },
    assinado: { nome: t('Resposta assinada', 'Signed answer'), cor: 'ouro' },
    validado: { nome: t('Validado (AD)', 'Validated (AD)'), cor: 'oliva' },
  },
  observacao: t('Indicações e DNSKEY do .com já em cache', 'Referrals and .com DNSKEY already cached'),
  nos: [
    nos.cliente(12, 74),
    nos.roteador(28, 58),
    nos.internet(48, 74),
    no('resolvedor', 'pilha', t('Resolvedor validador', 'Validating Resolver'), 44, 24, IP.resolvedor),
    no('raiz', 'pilha', t('Servidor Raiz', 'Root Server'), 68, 18, IP.raiz),
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
      titulo: t('Pede as assinaturas', 'Ask for signatures'),
      resumo: t('Consulta com o bit DO', 'A query with the DO bit'),
      descricao: t(
        'O notebook pergunta como sempre, só marcando AD para dizer que entende respostas validadas. O resolvedor, que já conhece o caminho até example.com, repete a pergunta ao servidor da zona com o bit DO ("DNSSEC OK") no EDNS0: me mande também as assinaturas.',
        'The laptop asks as usual, only setting AD to say it understands validated answers. The resolver, which already knows the way to example.com, repeats the question to the zone’s server with the DO ("DNSSEC OK") bit in EDNS0: send me the signatures too.',
      ),
      fatos: [
        [t('Pergunta', 'Question'), t('www.example.com (A)', 'www.example.com (A)')],
        [t('Flag do cliente', 'Client flag'), t('AD=1 (entendo validação)', 'AD=1 (I understand validation)')],
        [t('Flag do resolvedor', 'Resolver flag'), t('DO=1 no EDNS0', 'DO=1 in EDNS0')],
      ],
      pacotes: [
        consulta(
          'cliente',
          'resolvedor',
          53211,
          0,
          t('CONSULTA DNS', 'DNS QUERY'),
          t('Consulta padrão A www.example.com', 'Standard query A www.example.com'),
          t('A? www.example.com (AD)', 'A? www.example.com (AD)'),
          consultaDns(0x4e21, 0x0120, 'www.example.com', 1, 'RD=1, AD=1', t('Recursão desejada e interesse em respostas validadas.', 'Recursion desired, and interest in validated answers.'), false),
        ),
        consulta(
          'resolvedor',
          'autoritativo',
          47112,
          12,
          t('CONSULTA DO=1', 'QUERY DO=1'),
          t('Consulta padrão A www.example.com OPT DO', 'Standard query A www.example.com OPT DO'),
          t('A? www.example.com, DO=1', 'A? www.example.com, DO=1'),
          iterativa(0x2d90, 'www.example.com', 1, 'A, IN'),
          t('INDICAÇÕES EM CACHE', 'REFERRALS CACHED'),
        ),
      ],
    },
    {
      titulo: t('Resposta assinada', 'Signed answer'),
      resumo: t('O registro A vem com um RRSIG', 'The A record comes with an RRSIG'),
      descricao: t(
        'O servidor devolve o registro A e, ao lado, um RRSIG: a assinatura ECDSA do conjunto feita pela chave de assinatura da zona (ZSK, tag 57764), com prazo de validade. Sozinha, ela ainda não prova nada: falta saber se a chave é mesmo de example.com.',
        'The server returns the A record and, alongside it, an RRSIG: an ECDSA signature over the set made with the zone signing key (ZSK, tag 57764), with a validity window. On its own it proves nothing yet: we still need to know the key really belongs to example.com.',
      ),
      fatos: [
        [t('Registro', 'Record'), t(`www.example.com A ${IP.servidor}`, `www.example.com A ${IP.servidor}`)],
        [t('Assinatura', 'Signature'), t('RRSIG, algoritmo 13 (ECDSA P-256)', 'RRSIG, algorithm 13 (ECDSA P-256)')],
        [t('Assinado por', 'Signed by'), t('ZSK de example.com (tag 57764)', 'example.com ZSK (tag 57764)')],
      ],
      pacotes: [
        assinado(
          'autoritativo',
          'resolvedor',
          47112,
          21,
          52,
          t('A + RRSIG', 'A + RRSIG'),
          t('Resposta padrão A 203.0.113.10 RRSIG', 'Standard query response A 203.0.113.10 RRSIG'),
          t('A 203.0.113.10 + RRSIG', 'A 203.0.113.10 + RRSIG'),
          [
            ...cabecalhoDns(0x2d90, 0x8400, [1, 2, 0, 1], 'QR=1, AA=1', t('Resposta autoritativa, com o registro e sua assinatura.', 'An authoritative answer, with the record and its signature.')),
            ...pergunta('www.example.com', 1, 'A, IN'),
            registroA,
            ...rrsig(1, 'A', 13, 3, 3600, TAG_ZSK, [0xc0, 0x10], 'example.com', 64, t('Tag da ZSK que assinou, e a zona dona dela.', 'Tag of the signing ZSK, and the zone that owns it.')),
            optEdns(true),
          ],
        ),
      ],
    },
    {
      titulo: t('Chaves da zona', 'Zone keys'),
      resumo: t('Busca as DNSKEY de example.com', 'Fetches example.com’s DNSKEYs'),
      descricao: t(
        'O resolvedor pede as chaves públicas da zona. Vêm duas: a ZSK (flags 256), que assina os registros do dia a dia, e a KSK (flags 257), que assina só o conjunto de chaves. Com a ZSK, a assinatura do registro A confere; com a KSK, confere a assinatura das próprias chaves.',
        'The resolver asks for the zone’s public keys. Two come back: the ZSK (flags 256), which signs everyday records, and the KSK (flags 257), which signs only the key set. With the ZSK the A record’s signature checks out; with the KSK the signature over the keys themselves checks out.',
      ),
      fatos: [
        [t('ZSK', 'ZSK'), t('Flags 256, tag 57764', 'Flags 256, tag 57764')],
        [t('KSK', 'KSK'), t('Flags 257, tag 39999', 'Flags 257, tag 39999')],
        [t('Verifica', 'Verifies'), t('RRSIG(A) com a ZSK; RRSIG(DNSKEY) com a KSK', 'RRSIG(A) with the ZSK; RRSIG(DNSKEY) with the KSK')],
      ],
      pacotes: [
        consulta(
          'resolvedor',
          'autoritativo',
          39270,
          1,
          t('DNSKEY?', 'DNSKEY?'),
          t('Consulta padrão DNSKEY example.com OPT DO', 'Standard query DNSKEY example.com OPT DO'),
          t('DNSKEY? example.com', 'DNSKEY? example.com'),
          iterativa(0x61b3, 'example.com', 48, 'DNSKEY, IN'),
        ),
        assinado(
          'autoritativo',
          'resolvedor',
          39270,
          20,
          52,
          t('DNSKEY ×2', 'DNSKEY ×2'),
          t('Resposta padrão DNSKEY DNSKEY RRSIG', 'Standard query response DNSKEY DNSKEY RRSIG'),
          t('KSK 257 + ZSK 256 + RRSIG', 'KSK 257 + ZSK 256 + RRSIG'),
          [
            ...cabecalhoDns(0x61b3, 0x8400, [1, 3, 0, 1], 'QR=1, AA=1', t('As chaves públicas da zona, assinadas.', 'The zone’s public keys, signed.')),
            ...pergunta('example.com', 48, 'DNSKEY, IN'),
            ...dnskey(257, t('DNSKEY: KSK', 'DNSKEY: KSK'), '257, protocolo 3, alg 13', t('Chave de assinatura de chaves: seu hash fica na zona pai.', 'Key signing key: its hash lives in the parent zone.')),
            ...dnskey(256, t('DNSKEY: ZSK', 'DNSKEY: ZSK'), '256, protocolo 3, alg 13', t('Chave de assinatura da zona: assina os outros registros.', 'Zone signing key: signs the other records.')),
            ...rrsig(48, 'DNSKEY', 13, 2, 3600, TAG_KSK, [0xc0, 0x0c], 'example.com', 64, t('As chaves vêm assinadas pela KSK.', 'The keys come signed by the KSK.')),
            optEdns(true),
          ],
        ),
      ],
    },
    {
      titulo: t('DS na zona pai', 'DS in the parent'),
      resumo: t('O .com confirma a KSK', '.com vouches for the KSK'),
      descricao: t(
        'Quem garante que a KSK é legítima? A zona pai. O .com publica um registro DS com o hash SHA-256 da KSK de example.com, assinado pela chave do próprio .com. Se o hash da KSK recebida bater com o DS, o elo está feito.',
        'Who vouches for the KSK? The parent zone. .com publishes a DS record holding the SHA-256 hash of example.com’s KSK, signed with .com’s own key. If the received KSK hashes to the DS value, the link holds.',
      ),
      fatos: [
        [t('Registro', 'Record'), t('example.com DS 39999 13 2', 'example.com DS 39999 13 2')],
        [t('Resumo', 'Digest'), t('SHA-256 da KSK', 'SHA-256 of the KSK')],
        [t('Assinado por', 'Signed by'), t('ZSK do .com', '.com’s ZSK')],
      ],
      pacotes: [
        consulta(
          'resolvedor',
          'tld',
          55871,
          2,
          t('DS?', 'DS?'),
          t('Consulta padrão DS example.com OPT DO', 'Standard query DS example.com OPT DO'),
          t('DS? example.com', 'DS? example.com'),
          iterativa(0x0b5e, 'example.com', 43, 'DS, IN'),
        ),
        assinado(
          'tld',
          'resolvedor',
          55871,
          10,
          55,
          t('DS + RRSIG', 'DS + RRSIG'),
          t('Resposta padrão DS RRSIG', 'Standard query response DS RRSIG'),
          t('DS 39999 13 2 + RRSIG', 'DS 39999 13 2 + RRSIG'),
          [
            ...cabecalhoDns(0x0b5e, 0x8400, [1, 2, 0, 1], 'QR=1, AA=1', t('O .com responde com autoridade sobre o DS.', '.com answers authoritatively for the DS.')),
            ...pergunta('example.com', 43, 'DS, IN'),
            hex(
              t('DS: cabeçalho', 'DS: header'),
              emHex([0xc0, 0x0c, ...b16(43), 0, 1, ...b32(86400), ...b16(36), ...b16(TAG_KSK), 13, 2]),
              `DS ${TAG_KSK} 13 2`,
              t('Aponta para a KSK pela tag, algoritmo 13, resumo tipo 2 (SHA-256).', 'Points at the KSK by tag, algorithm 13, digest type 2 (SHA-256).'),
            ),
            opaco(t('Resumo SHA-256', 'SHA-256 digest'), 32, t('O hash da KSK de example.com.', 'The hash of example.com’s KSK.')),
            ...rrsig(43, 'DS', 13, 2, 86400, 0x4f5b, rotulosDns('com'), 'com', 64, t('Assinado pela ZSK do .com.', 'Signed by .com’s ZSK.')),
            optEdns(true),
          ],
        ),
      ],
    },
    {
      titulo: t('Até a âncora', 'Up to the anchor'),
      resumo: t('A raiz confirma o .com', 'The root vouches for .com'),
      descricao: t(
        'O mesmo vale um nível acima: a raiz publica o DS do .com, assinado pela chave da raiz. E a chave da raiz não precisa de ninguém: ela vem configurada no resolvedor como âncora de confiança. A cadeia fecha: raiz → .com → example.com → registro A.',
        'The same holds one level up: the root publishes .com’s DS, signed by the root’s key. And the root key needs nobody: it ships with the resolver as the trust anchor. The chain is closed: root → .com → example.com → A record.',
      ),
      fatos: [
        [t('Registro', 'Record'), t('com DS 19718 13 2', 'com DS 19718 13 2')],
        [t('Assinado por', 'Signed by'), t('ZSK da raiz (RSA/SHA-256)', 'Root ZSK (RSA/SHA-256)')],
        [t('Âncora de confiança', 'Trust anchor'), t('KSK da raiz, no resolvedor', 'Root KSK, built into the resolver')],
      ],
      pacotes: [
        consulta(
          'resolvedor',
          'raiz',
          60412,
          1,
          t('DS?', 'DS?'),
          t('Consulta padrão DS com OPT DO', 'Standard query DS com OPT DO'),
          t('DS? com', 'DS? com'),
          iterativa(0x93c4, 'com', 43, 'DS, IN'),
        ),
        assinado(
          'raiz',
          'resolvedor',
          60412,
          6,
          57,
          t('DS + RRSIG', 'DS + RRSIG'),
          t('Resposta padrão DS RRSIG', 'Standard query response DS RRSIG'),
          t('DS 19718 13 2 + RRSIG', 'DS 19718 13 2 + RRSIG'),
          [
            ...cabecalhoDns(0x93c4, 0x8400, [1, 2, 0, 1], 'QR=1, AA=1', t('A raiz responde pelo DS do .com.', 'The root answers for .com’s DS.')),
            ...pergunta('com', 43, 'DS, IN'),
            hex(
              t('DS: cabeçalho', 'DS: header'),
              emHex([0xc0, 0x0c, ...b16(43), 0, 1, ...b32(86400), ...b16(36), ...b16(19718), 13, 2]),
              'DS 19718 13 2',
              t('O elo entre a raiz e a chave do .com.', 'The link between the root and .com’s key.'),
            ),
            opaco(t('Resumo SHA-256', 'SHA-256 digest'), 32, t('O hash da KSK do .com.', 'The hash of .com’s KSK.')),
            ...rrsig(43, 'DS', 8, 1, 86400, 0x5a7d, [0], '.', 256, t('Assinado pela ZSK da raiz, RSA de 2048 bits.', 'Signed by the root ZSK, 2048-bit RSA.')),
            optEdns(true),
          ],
        ),
      ],
    },
    {
      titulo: t('Resposta validada', 'Validated answer'),
      resumo: t('O notebook recebe a flag AD', 'The laptop gets the AD flag'),
      descricao: t(
        'Tudo conferido, o resolvedor entrega o endereço com a flag AD (dados autenticados). Se qualquer assinatura falhasse ou estivesse vencida, a resposta seria SERVFAIL, e o navegador não iria para um endereço falso. O trecho até o resolvedor não é assinado: por isso ele costuma ser protegido com DoH ou DoT.',
        'With everything checked, the resolver returns the address with the AD (authenticated data) flag. Had any signature failed or expired, the answer would be SERVFAIL and the browser would never reach a forged address. The hop to the resolver itself is not signed, which is why it is usually protected with DoH or DoT.',
      ),
      fatos: [
        [t('Flags', 'Flags'), t('QR, RD, RA, AD', 'QR, RD, RA, AD')],
        [t('Se falhar', 'On failure'), t('SERVFAIL, sem endereço', 'SERVFAIL, no address')],
        [t('Último trecho', 'Last mile'), t('Proteger com DoH ou DoT', 'Protect with DoH or DoT')],
      ],
      pacotes: [
        {
          de: 'resolvedor',
          para: 'cliente',
          proto: 'DNS',
          rotulo: t('RESPOSTA AD', 'ANSWER AD'),
          info: t('Resposta padrão A 203.0.113.10 (AD)', 'Standard query response A 203.0.113.10 (AD)'),
          tipo: 'validado',
          resumo: t('www.example.com → 203.0.113.10, validado', 'www.example.com → 203.0.113.10, validated'),
          dt: 1,
          quadro: {
            ttl: 118,
            udp: { origem: 53, destino: 53211 },
            carga: [
              ...cabecalhoDns(0x4e21, 0x81a0, [1, 1, 0, 1], 'QR=1, RD=1, RA=1, AD=1', t('AD=1: o resolvedor validou a cadeia inteira.', 'AD=1: the resolver validated the whole chain.')),
              ...pergunta('www.example.com', 1, 'A, IN'),
              registroA,
              optEdns(false),
            ],
          },
        },
      ],
    },
  ],
};
