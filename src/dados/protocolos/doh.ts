import { apertoDeMao, hex, nos, opaco, t, texto } from '../base';
import type { Campo, Pacote, Protocolo, Texto } from '../tipos';
import { consultaDns } from './dns';

const IP_DOH = '198.51.100.11';
const HOST = 'doh.example.net';

const registro = (tipo: 'handshake' | 'dados' | 'mudanca', versao: string, tamanho: number): Campo =>
  hex(
    t('Registro TLS', 'TLS record'),
    `${tipo === 'handshake' ? '16' : tipo === 'dados' ? '17' : '14'} ${versao} ${((tamanho >> 8) & 0xff).toString(16).padStart(2, '0')} ${(tamanho & 0xff).toString(16).padStart(2, '0')}`,
    `${tipo === 'handshake' ? 'Handshake' : tipo === 'dados' ? 'Application Data' : 'Change Cipher Spec'}, ${tamanho} bytes`,
    tipo === 'dados'
      ? t('Tipo 23: dados cifrados. O que vem dentro, ninguém no caminho lê.', 'Type 23: encrypted data. Nobody on the path can read what is inside.')
      : tipo === 'mudanca'
        ? t('Mensagem de compatibilidade com caixas antigas; sem efeito no TLS 1.3.', 'A compatibility message for old middleboxes; no effect in TLS 1.3.')
        : t('Tipo 22: mensagem de handshake, ainda em claro.', 'Type 22: a handshake message, still in the clear.'),
  );

const clientHello: Campo[] = [
  registro('handshake', '03 01', 185),
  hex(t('Tipo, tamanho', 'Type, length'), '01 00 00 b5', 'ClientHello, 181 bytes', t('O primeiro "olá" do cliente.', 'The client’s first "hello".')),
  hex(t('Versão', 'Version'), '03 03', 'TLS 1.2', t('Valor legado; a versão real vai nas extensões.', 'A legacy value; the real version goes in the extensions.')),
  opaco(t('Random', 'Random'), 32, t('32 bytes aleatórios do cliente.', 'The client’s 32 random bytes.')),
  hex(t('Session ID: tamanho', 'Session ID: length'), '20', '32'),
  opaco(t('Session ID', 'Session ID'), 32, t('Aleatório, só para compatibilidade.', 'Random, kept for compatibility only.')),
  hex(t('Cifras', 'Cipher suites'), '00 06 13 01 13 02 13 03', 'AES-128-GCM, AES-256-GCM, ChaCha20', t('As cifras do TLS 1.3 que o cliente aceita.', 'The TLS 1.3 ciphers the client accepts.')),
  hex(t('Compressão', 'Compression'), '01 00', 'null', t('Sempre desligada.', 'Always off.')),
  hex(t('Extensões: tamanho', 'Extensions: length'), '00 66', '102 bytes'),
  hex(t('SNI: cabeçalho', 'SNI: header'), '00 00 00 14 00 12 00 00 0f', 'server_name', t('Indicação do nome do servidor.', 'Server name indication.')),
  texto(t('SNI: nome', 'SNI: name'), HOST, t('Em claro: a rede vê com qual resolvedor você fala, mas não o que pergunta.', 'In the clear: the network sees which resolver you talk to, but not what you ask.')),
  hex(t('ALPN', 'ALPN'), '00 10 00 05 00 03 02 68 32', 'h2', t('Pede HTTP/2 dentro do túnel.', 'Asks for HTTP/2 inside the tunnel.')),
  hex(t('Versões suportadas', 'Supported versions'), '00 2b 00 03 02 03 04', 'TLS 1.3'),
  hex(t('Key share: cabeçalho', 'Key share: header'), '00 33 00 26 00 24 00 1d 00 20', 'X25519', t('Metade da troca de chaves Diffie-Hellman.', 'Half of the Diffie-Hellman key exchange.')),
  opaco(t('Key share: chave pública', 'Key share: public key'), 32, t('Chave efêmera, nova a cada conexão.', 'An ephemeral key, fresh for every connection.')),
  hex(t('Algoritmos de assinatura', 'Signature algorithms'), '00 0d 00 08 00 06 04 03 08 04 04 01', 'ECDSA P-256, RSA-PSS, RSA'),
  hex(t('Grupos', 'Supported groups'), '00 0a 00 04 00 02 00 1d', 'x25519'),
];

const serverHello: Campo[] = [
  registro('handshake', '03 03', 122),
  hex(t('Tipo, tamanho, versão', 'Type, length, version'), '02 00 00 76 03 03', 'ServerHello, 118 bytes', t('A resposta do servidor ao olá.', 'The server’s answer to the hello.')),
  opaco(t('Random', 'Random'), 32, t('32 bytes aleatórios do servidor.', 'The server’s 32 random bytes.')),
  hex(t('Session ID: tamanho', 'Session ID: length'), '20', '32'),
  opaco(t('Session ID', 'Session ID'), 32, t('Ecoa o do cliente.', 'Echoes the client’s.')),
  hex(t('Cifra escolhida', 'Chosen cipher'), '13 01 00', 'TLS_AES_128_GCM_SHA256', t('Uma das cifras oferecidas; compressão nula.', 'One of the offered ciphers; null compression.')),
  hex(t('Extensões', 'Extensions'), '00 2e 00 2b 00 02 03 04 00 33 00 24 00 1d 00 20', 'TLS 1.3, X25519', t('Confirma TLS 1.3 e manda a outra metade da troca de chaves.', 'Confirms TLS 1.3 and sends the other half of the key exchange.')),
  opaco(t('Key share do servidor', 'Server key share'), 32, t('Com as duas metades, os dois lados calculam a mesma chave.', 'With both halves, each side computes the same key.')),
  registro('mudanca', '03 03', 1),
  hex(t('Mudança de cifra', 'Change cipher spec'), '01', '1'),
  registro('dados', '03 03', 1200),
  opaco(t('Handshake cifrado', 'Encrypted handshake'), 1200, t('Extensões, certificado de doh.example.net, assinatura e Finished, tudo já cifrado.', 'Extensions, the doh.example.net certificate, signature and Finished, all already encrypted.')),
];

const aplicacao = (tamanho: number, explicacao: Texto): Campo[] => [
  registro('dados', '03 03', tamanho),
  opaco(t('HTTP/2 cifrado', 'Encrypted HTTP/2'), tamanho - 16, explicacao),
  opaco(t('Tag de autenticação', 'Authentication tag'), 16, t('16 bytes do AES-GCM: qualquer alteração no caminho é detectada.', '16 AES-GCM bytes: any tampering on the way is detected.')),
];

const tls = (de: string, para: string, tipo: string, rotulo: Texto, info: Texto, resumo: Texto, dt: number, seq: number, ack: number, carga: Campo[], ttl?: number): Pacote => ({
  de,
  para,
  proto: tipo === 'tls' ? 'TLSv1.3' : 'HTTP2',
  rotulo,
  info,
  tipo,
  resumo,
  dt,
  quadro: {
    ...(ttl ? { ttl } : {}),
    camada: tipo === 'tls' ? 'TLS' : 'TLS · HTTP/2 · DNS',
    tcp: de === 'cliente' ? { origem: 51234, destino: 443, seq, ack, flags: 'PSH,ACK' } : { origem: 443, destino: 51234, seq, ack, flags: 'PSH,ACK', janela: 501 },
    carga,
  },
});

export const doh: Protocolo = {
  id: 'doh',
  sigla: 'DNS over HTTPS',
  nome: t('DNS sobre HTTPS (DoH)', 'DNS over HTTPS (DoH)'),
  resumo: t('Consultas DNS cifradas', 'Encrypted DNS lookups'),
  categoria: 'seguranca',
  camada: 7,
  descricao: t(
    'O DNS tradicional viaja em texto aberto: o provedor, o Wi-Fi do café ou qualquer um no caminho vê e pode alterar cada nome que você consulta. O DoH coloca a mesma mensagem DNS dentro de um pedido HTTPS para o resolvedor. Para a rede, parece só mais uma conexão na porta 443.',
    'Traditional DNS travels in plain text: your ISP, the café Wi-Fi or anyone on the path can see, and change, every name you look up. DoH puts the very same DNS message inside an HTTPS request to the resolver. To the network it looks like just another connection on port 443.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Porta', 'Port'), t('443, a mesma do HTTPS', '443, same as HTTPS')],
    [t('Transporte', 'Transport'), t('TCP + TLS (ou QUIC no HTTP/3)', 'TCP + TLS (or QUIC with HTTP/3)')],
    [t('Formato', 'Data format'), t('application/dns-message', 'application/dns-message')],
    [t('Protege', 'Protects'), t('Sigilo e integridade das consultas', 'Privacy and integrity of queries')],
    [t('Definido em', 'Defined in'), t('RFC 8484', 'RFC 8484')],
  ],
  legenda: {
    aberto: { nome: t('DNS em texto aberto', 'Plaintext DNS'), cor: 'brasa' },
    tcp: { nome: t('TCP', 'TCP'), cor: 'oliva' },
    tls: { nome: t('TLS', 'TLS'), cor: 'anil' },
    cifrado: { nome: t('DNS cifrado', 'Encrypted DNS'), cor: 'ouro' },
  },
  observacao: t('O passo 1 mostra o DNS comum, para comparar', 'Step 1 shows plain DNS, for comparison'),
  nos: [nos.cliente(12, 74), nos.roteador(32, 58), nos.internet(56, 74), { ...nos.resolvedor(84, 28), nome: t('Resolvedor DoH', 'DoH Resolver'), ip: IP_DOH }],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'resolvedor'],
  ],
  faixas: ['cliente', 'resolvedor'],
  passos: [
    {
      titulo: t('O problema', 'The problem'),
      resumo: t('DNS comum viaja em claro', 'Plain DNS travels in the clear'),
      descricao: t(
        'Antes do DoH, a consulta sai num datagrama UDP para a porta 53, sem cifra nem assinatura. Qualquer equipamento no caminho lê "www.example.com" e pode até responder antes do resolvedor, com um endereço falso.',
        'Without DoH, the query leaves in a UDP datagram to port 53, with no encryption or signature. Any box on the path can read "www.example.com" and could even answer before the resolver, with a fake address.',
      ),
      fatos: [
        [t('Porta', 'Port'), t('UDP 53', 'UDP 53')],
        [t('Quem vê', 'Who sees it'), t('Provedor, Wi-Fi, qualquer um no caminho', 'ISP, Wi-Fi, anyone on the path')],
        [t('Risco', 'Risk'), t('Espionagem e respostas forjadas', 'Snooping and forged answers')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'resolvedor',
          proto: 'DNS',
          rotulo: t('DNS EM CLARO', 'PLAIN DNS'),
          info: t('Consulta padrão A www.example.com', 'Standard query A www.example.com'),
          tipo: 'aberto',
          resumo: t('A? www.example.com (legível)', 'A? www.example.com (readable)'),
          dt: 0,
          nota: t('VISÍVEL NA REDE', 'VISIBLE ON THE WIRE'),
          quadro: {
            udp: { origem: 53211, destino: 53 },
            carga: consultaDns(0xa34c, 0x0100, 'www.example.com', 1, 'RD=1', t('Tudo em claro: qualquer um lê o nome consultado.', 'All in the clear: anyone can read the name being looked up.')),
          },
        },
      ],
    },
    {
      titulo: t('Conexão TCP', 'TCP connection'),
      resumo: t('Abre a porta 443 do resolvedor', 'Opens the resolver’s port 443'),
      descricao: t(
        'Com DoH, o navegador abre uma conexão TCP comum com o resolvedor, na porta 443. Ela costuma ficar aberta e ser reaproveitada por centenas de consultas.',
        'With DoH, the browser opens an ordinary TCP connection to the resolver on port 443. It usually stays open and is reused for hundreds of lookups.',
      ),
      fatos: [
        [t('Destino', 'Destination'), t(`${IP_DOH}:443`, `${IP_DOH}:443`)],
        [t('Reuso', 'Reuse'), t('Uma conexão para muitas consultas', 'One connection for many lookups')],
      ],
      pacotes: apertoDeMao({ de: 'cliente', para: 'resolvedor', portaCliente: 51234, portaServidor: 443, tipo: 'tcp' }).map((p, i) => ({
        ...p,
        dt: i === 0 ? 1500 : 11,
        quadro: { ...p.quadro, ...(i === 1 ? { ttl: 58 } : {}) },
      })),
    },
    {
      titulo: t('Handshake TLS 1.3', 'TLS 1.3 handshake'),
      resumo: t('Combina as chaves do túnel', 'Agrees on the tunnel’s keys'),
      descricao: t(
        'O cliente diz olá com sua metade da troca de chaves e o nome do resolvedor (SNI). O servidor responde com a outra metade e, já cifrado, manda o certificado de doh.example.net. O navegador confere o certificado: assim sabe que fala com o resolvedor certo.',
        'The client says hello with its half of the key exchange and the resolver’s name (SNI). The server replies with the other half and, already encrypted, sends the doh.example.net certificate. The browser checks it, so it knows it is talking to the right resolver.',
      ),
      fatos: [
        [t('SNI', 'SNI'), t(`${HOST} (visível)`, `${HOST} (visible)`)],
        [t('ALPN', 'ALPN'), t('h2 (HTTP/2)', 'h2 (HTTP/2)')],
        [t('Troca de chaves', 'Key exchange'), t('X25519, 1 ida e volta', 'X25519, 1 round trip')],
      ],
      pacotes: [
        tls(
          'cliente',
          'resolvedor',
          'tls',
          t('CLIENT HELLO', 'CLIENT HELLO'),
          t('Client Hello (SNI=doh.example.net)', 'Client Hello (SNI=doh.example.net)'),
          t(`Olá, ${HOST}; falo TLS 1.3 e h2`, `Hello, ${HOST}; I speak TLS 1.3 and h2`),
          1,
          1,
          1,
          clientHello,
        ),
        tls(
          'resolvedor',
          'cliente',
          'tls',
          t('SERVER HELLO', 'SERVER HELLO'),
          t('Server Hello, Change Cipher Spec, Application Data', 'Server Hello, Change Cipher Spec, Application Data'),
          t('Olá; o resto já vai cifrado', 'Hello; the rest is already encrypted'),
          12,
          1,
          191,
          serverHello,
          58,
        ),
      ],
    },
    {
      titulo: t('Consulta cifrada', 'Encrypted query'),
      resumo: t('POST /dns-query dentro do túnel', 'POST /dns-query inside the tunnel'),
      descricao: t(
        'O navegador faz um pedido HTTP/2 POST /dns-query com o tipo application/dns-message. O corpo é a mesma consulta DNS binária do passo 1, com ID 0 para facilitar cache. Na rede, tudo isso é só um registro TLS de dados.',
        'The browser makes an HTTP/2 POST /dns-query request with type application/dns-message. The body is the very same binary DNS query from step 1, with ID 0 to help caching. On the wire, all of it is just one TLS data record.',
      ),
      fatos: [
        [t('Pedido', 'Request'), t('POST /dns-query', 'POST /dns-query')],
        [t('Content-Type', 'Content-Type'), t('application/dns-message', 'application/dns-message')],
        [t('Corpo', 'Body'), t('Consulta DNS de 33 bytes, ID 0', '33-byte DNS query, ID 0')],
      ],
      pacotes: [
        tls(
          'cliente',
          'resolvedor',
          'cifrado',
          t('DNS CIFRADO', 'ENCRYPTED DNS'),
          t('Application Data (HTTP/2 POST /dns-query)', 'Application Data (HTTP/2 POST /dns-query)'),
          t('POST /dns-query · A? www.example.com', 'POST /dns-query · A? www.example.com'),
          2,
          191,
          1339,
          aplicacao(
            140,
            t('Quadros HEADERS (POST /dns-query, application/dns-message) e DATA com a consulta. Ilegível no caminho.', 'HEADERS (POST /dns-query, application/dns-message) and DATA frames with the query. Unreadable on the way.'),
          ),
        ),
      ],
    },
    {
      titulo: t('Resposta cifrada', 'Encrypted answer'),
      resumo: t('200 OK com a mensagem DNS', '200 OK carrying the DNS message'),
      descricao: t(
        'O resolvedor resolve o nome como de costume e devolve um HTTP 200 cujo corpo é a resposta DNS binária, com o TTL refletido no cabeçalho Cache-Control. O navegador lê 203.0.113.10; quem estava no caminho viu só bytes cifrados.',
        'The resolver resolves the name as usual and returns HTTP 200 whose body is the binary DNS answer, with the TTL reflected in the Cache-Control header. The browser reads 203.0.113.10; anyone on the path saw only encrypted bytes.',
      ),
      fatos: [
        [t('Status', 'Status'), t('200 OK', '200 OK')],
        [t('Cache-Control', 'Cache-Control'), t('max-age=3600 (o TTL)', 'max-age=3600 (the TTL)')],
        [t('Resposta', 'Answer'), t('www.example.com A 203.0.113.10', 'www.example.com A 203.0.113.10')],
      ],
      pacotes: [
        tls(
          'resolvedor',
          'cliente',
          'cifrado',
          t('DNS CIFRADO', 'ENCRYPTED DNS'),
          t('Application Data (HTTP/2 200, application/dns-message)', 'Application Data (HTTP/2 200, application/dns-message)'),
          t('200 OK · www.example.com A 203.0.113.10', '200 OK · www.example.com A 203.0.113.10'),
          14,
          1339,
          336,
          aplicacao(180, t('HEADERS (:status 200, cache-control) e DATA com a resposta DNS de 49 bytes.', 'HEADERS (:status 200, cache-control) and DATA with the 49-byte DNS answer.')),
          58,
        ),
      ],
    },
    {
      titulo: t('O que fica visível', 'What remains visible'),
      resumo: t('Metadados, não conteúdo', 'Metadata, not content'),
      descricao: t(
        'Com DoH, a rede ainda vê o IP do resolvedor, o SNI e o tamanho e o horário dos pacotes, mas não vê nenhum nome consultado nem pode forjar respostas. O resolvedor, por sua vez, continua vendo tudo: escolher um resolvedor confiável faz parte da proteção.',
        'With DoH the network still sees the resolver’s IP, the SNI and the size and timing of packets, but no names looked up, and it cannot forge answers. The resolver, however, still sees everything: choosing a trustworthy resolver is part of the protection.',
      ),
      fatos: [
        [t('Visível', 'Visible'), t('IP do resolvedor, SNI, tamanhos', 'Resolver IP, SNI, sizes')],
        [t('Escondido', 'Hidden'), t('Nomes consultados e respostas', 'Names looked up and answers')],
        [t('Alternativas', 'Alternatives'), t('DoT (853), DoQ, ODoH', 'DoT (853), DoQ, ODoH')],
      ],
      pacotes: [],
    },
  ],
};
