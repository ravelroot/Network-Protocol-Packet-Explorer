import { apertoDeMao, hex, nos, opaco, t } from '../base';
import type { Campo, Pacote, Protocolo } from '../tipos';

const CLIENTE = 52344;
const ascii = (s: string): string => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');

const clientHello: Campo[] = [
  hex(t('Registro TLS', 'TLS record'), '16 03 01 00 c2', 'Handshake, 194 bytes', t('Tipo 22 (handshake); 03 01 é só compatibilidade com caixas antigas.', 'Type 22 (handshake); 03 01 is only there for old middleboxes.')),
  hex(t('Handshake', 'Handshake'), '01 00 00 be', 'Client Hello, 190 bytes'),
  hex(t('Versão legada', 'Legacy version'), '03 03', 'TLS 1.2', t('A versão real vai na extensão supported_versions.', 'The real version goes in the supported_versions extension.')),
  opaco(t('Aleatório', 'Random'), 32, t('32 bytes sorteados pelo navegador.', '32 bytes picked at random by the browser.')),
  hex(t('Tamanho do ID de sessão', 'Session ID length'), '20', '32'),
  opaco(t('ID de sessão', 'Session ID'), 32, t('Aleatório também; só existe por compatibilidade.', 'Random too; only there for compatibility.')),
  hex(
    t('Suítes de cifra', 'Cipher suites'),
    '00 06 13 01 13 02 13 03',
    'AES_128_GCM, AES_256_GCM, CHACHA20_POLY1305',
    t('As cifras que o navegador aceita, em ordem de preferência.', 'The ciphers the browser accepts, in order of preference.'),
  ),
  hex(t('Compressão', 'Compression'), '01 00', 'null', t('Sempre nenhuma no TLS 1.3.', 'Always none in TLS 1.3.')),
  hex(t('Tamanho das extensões', 'Extensions length'), '00 6f', '111 bytes'),
  hex(
    t('SNI', 'SNI'),
    `00 00 00 14 00 12 00 00 0f ${ascii('www.example.com')}`,
    'www.example.com',
    t('O nome do site, ainda em claro: o servidor escolhe o certificado por ele.', 'The site name, still in the clear: the server picks the certificate by it.'),
  ),
  hex(t('Versões suportadas', 'Supported versions'), '00 2b 00 03 02 03 04', 'TLS 1.3'),
  hex(t('Grupos suportados', 'Supported groups'), '00 0a 00 04 00 02 00 1d', 'x25519'),
  hex(t('ALPN', 'ALPN'), `00 10 00 0e 00 0c 02 ${ascii('h2')} 08 ${ascii('http/1.1')}`, 'h2, http/1.1', t('Qual protocolo vai dentro do túnel.', 'Which protocol runs inside the tunnel.')),
  hex(t('Algoritmos de assinatura', 'Signature algorithms'), '00 0d 00 08 00 06 04 03 08 04 04 01', 'ecdsa_p256, rsa_pss, rsa_pkcs1'),
  hex(t('Key share', 'Key share'), '00 33 00 26 00 24 00 1d 00 20', 'x25519, 32 bytes', t('O navegador já manda sua metade da troca de chaves.', 'The browser already sends its half of the key exchange.')),
  opaco(t('Chave pública X25519', 'X25519 public key'), 32),
];

const serverHello: Campo[] = [
  hex(t('Registro TLS', 'TLS record'), '16 03 03 00 7a', 'Handshake, 122 bytes'),
  hex(t('Handshake', 'Handshake'), '02 00 00 76', 'Server Hello, 118 bytes'),
  hex(t('Versão legada', 'Legacy version'), '03 03', 'TLS 1.2'),
  opaco(t('Aleatório', 'Random'), 32),
  hex(t('Tamanho do ID de sessão', 'Session ID length'), '20', '32'),
  opaco(t('ID de sessão (eco)', 'Session ID (echo)'), 32),
  hex(t('Cifra escolhida', 'Chosen cipher'), '13 01', 'TLS_AES_128_GCM_SHA256', t('Uma só, escolhida da lista do navegador.', 'Just one, picked from the browser’s list.')),
  hex(t('Compressão', 'Compression'), '00', '0'),
  hex(t('Tamanho das extensões', 'Extensions length'), '00 2e', '46 bytes'),
  hex(t('Versão escolhida', 'Selected version'), '00 2b 00 02 03 04', 'TLS 1.3'),
  hex(t('Key share', 'Key share'), '00 33 00 24 00 1d 00 20', 'x25519, 32 bytes', t('A metade do servidor: daqui em diante os dois já têm a chave.', 'The server’s half: from here on both sides have the key.')),
  opaco(t('Chave pública X25519', 'X25519 public key'), 32),
  hex(t('Change Cipher Spec', 'Change Cipher Spec'), '14 03 03 00 01 01', 'CCS', t('Sem efeito no TLS 1.3; só acalma caixas antigas.', 'No effect in TLS 1.3; it just soothes old middleboxes.')),
  hex(t('Registro cifrado', 'Encrypted record'), '17 03 03 05 2a', 'Application Data, 1322 bytes', t('Parece dado de aplicação, mas leva o resto do aperto de mão.', 'Looks like application data, but carries the rest of the handshake.')),
  opaco(t('EncryptedExtensions, Certificate, CertificateVerify, Finished', 'EncryptedExtensions, Certificate, CertificateVerify, Finished'), 1322, t('Até o certificado já viaja cifrado no TLS 1.3.', 'Even the certificate travels encrypted in TLS 1.3.')),
];

const clientFinished: Campo[] = [
  hex(t('Change Cipher Spec', 'Change Cipher Spec'), '14 03 03 00 01 01', 'CCS'),
  hex(t('Registro cifrado', 'Encrypted record'), '17 03 03 00 35', 'Application Data, 53 bytes'),
  opaco(t('Finished', 'Finished'), 53, t('Hash de todo o aperto de mão + 16 bytes de autenticação.', 'A hash of the whole handshake + a 16-byte auth tag.')),
];

const registro = (tamanho: number, nome: [string, string], explicacao: [string, string]): Campo[] => [
  hex(t('Registro cifrado', 'Encrypted record'), `17 03 03 ${(tamanho >> 8).toString(16).padStart(2, '0')} ${(tamanho & 0xff).toString(16).padStart(2, '0')}`, `Application Data, ${tamanho} bytes`),
  opaco(t(nome[0], nome[1]), tamanho, t(explicacao[0], explicacao[1])),
];

const tls = (de: 'cliente' | 'servidor', seq: number, ack: number, info: [string, string], rotulo: [string, string], tipo: string, carga: Campo[], dt: number, resumo: [string, string]): Pacote => ({
  de,
  para: de === 'cliente' ? 'servidor' : 'cliente',
  proto: 'TLSv1.3',
  rotulo: t(rotulo[0], rotulo[1]),
  info: t(info[0], info[1]),
  tipo,
  resumo: t(resumo[0], resumo[1]),
  dt,
  quadro: {
    ...(de === 'servidor' ? { ttl: 52 } : {}),
    tcp: { origem: de === 'cliente' ? CLIENTE : 443, destino: de === 'cliente' ? 443 : CLIENTE, seq, ack, flags: 'PSH,ACK', janela: de === 'cliente' ? 502 : 509 },
    carga,
    camada: 'TLS',
  },
});

export const https: Protocolo = {
  id: 'https',
  sigla: 'HTTPS',
  nome: t('HTTP seguro', 'HTTP Secure'),
  resumo: t('HTTP seguro', 'HTTP Secure'),
  categoria: 'seguranca',
  camada: 7,
  descricao: t(
    'HTTPS é o mesmo HTTP, só que dentro de um túnel TLS. Antes do primeiro pedido, navegador e servidor combinam chaves que ninguém no caminho consegue deduzir, e o servidor prova com um certificado que é mesmo www.example.com. Daí em diante, quem olha o fio vê só tamanhos e horários.',
    'HTTPS is plain HTTP inside a TLS tunnel. Before the first request, browser and server agree on keys nobody on the path can work out, and the server proves with a certificate that it really is www.example.com. From then on, anyone watching the wire sees only sizes and timings.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (HTTP sobre TLS)', 'Application (HTTP over TLS)')],
    [t('Porta padrão', 'Default port'), t('443', '443')],
    [t('Transporte', 'Transport'), t('TCP (ou QUIC no HTTP/3)', 'TCP (or QUIC for HTTP/3)')],
    [t('Segurança', 'Security'), t('TLS 1.3: AEAD e sigilo futuro', 'TLS 1.3: AEAD and forward secrecy')],
    [t('Identidade', 'Identity'), t('Certificado X.509 + SNI', 'X.509 certificate + SNI')],
    [t('Definido em', 'Defined in'), t('RFC 9110, RFC 8446', 'RFC 9110, RFC 8446')],
  ],
  legenda: {
    tcp: { nome: t('TCP', 'TCP'), cor: 'oliva' },
    tls: { nome: t('Aperto de mão TLS', 'TLS handshake'), cor: 'anil' },
    dados: { nome: t('Dados cifrados', 'Encrypted data'), cor: 'brasa' },
  },
  observacao: t('Resposta DNS já em cache', 'DNS answer already cached'),
  nos: [nos.cliente(), nos.roteador(), nos.internet(), nos.servidor()],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'servidor'],
  passos: [
    {
      titulo: t('Conexão TCP', 'TCP connection'),
      resumo: t('Aperto de mão na porta 443', 'Handshake on port 443'),
      descricao: t(
        'O endereço já está no cache do DNS, então o navegador vai direto ao TCP: SYN, SYN-ACK e ACK, agora na porta 443. Até aqui, nada diferente de um HTTP comum.',
        'The address is already in the DNS cache, so the browser goes straight to TCP: SYN, SYN-ACK and ACK, now on port 443. So far, nothing different from plain HTTP.',
      ),
      fatos: [
        [t('Portas', 'Ports'), t('52344 → 443', '52344 → 443')],
        [t('Servidor', 'Server'), t('203.0.113.10', '203.0.113.10')],
        [t('Custo', 'Cost'), t('1 RTT', '1 RTT')],
      ],
      pacotes: apertoDeMao({ de: 'cliente', para: 'servidor', portaCliente: CLIENTE, portaServidor: 443, tipo: 'tcp' }).map((p, i) => ({
        ...p,
        dt: i === 0 ? 0 : 17,
        quadro: { ...p.quadro, ...(i === 1 ? { ttl: 52 } : {}) },
      })),
    },
    {
      titulo: t('Client Hello', 'Client Hello'),
      resumo: t('Oferece cifras e já manda uma chave', 'Offers ciphers and sends a key share'),
      descricao: t(
        'O navegador lista as cifras que aceita, diz que fala TLS 1.3 e já envia sua metade de uma troca de chaves X25519, apostando que o servidor vai aceitar. O nome do site segue em claro no SNI, a não ser que se use ECH.',
        'The browser lists the ciphers it accepts, says it speaks TLS 1.3 and already sends its half of an X25519 key exchange, betting the server will accept it. The site name still travels in the clear in the SNI, unless ECH is used.',
      ),
      fatos: [
        [t('SNI', 'SNI'), t('www.example.com (visível)', 'www.example.com (visible)')],
        [t('Grupo', 'Group'), t('x25519', 'x25519')],
        [t('ALPN', 'ALPN'), t('h2, http/1.1', 'h2, http/1.1')],
      ],
      pacotes: [
        tls(
          'cliente',
          1,
          1,
          ['Client Hello (SNI=www.example.com)', 'Client Hello (SNI=www.example.com)'],
          ['CLIENT HELLO', 'CLIENT HELLO'],
          'tls',
          clientHello,
          0,
          ['TLS 1.3, x25519, SNI www.example.com', 'TLS 1.3, x25519, SNI www.example.com'],
        ),
      ],
    },
    {
      titulo: t('Server Hello', 'Server Hello'),
      resumo: t('Escolhe e já cifra o resto', 'Picks and encrypts the rest'),
      descricao: t(
        'O servidor escolhe TLS_AES_128_GCM_SHA256 e devolve sua metade da troca de chaves. Com as duas metades, cada lado calcula o mesmo segredo sem nunca transmiti-lo. Por isso o certificado, a assinatura e o Finished do servidor já vão cifrados no mesmo segmento.',
        'The server picks TLS_AES_128_GCM_SHA256 and returns its half of the key exchange. With both halves, each side computes the same secret without ever sending it. That is why the certificate, signature and the server’s Finished already travel encrypted in the same segment.',
      ),
      fatos: [
        [t('Cifra', 'Cipher'), t('TLS_AES_128_GCM_SHA256', 'TLS_AES_128_GCM_SHA256')],
        [t('Certificado', 'Certificate'), t('CN=www.example.com, ECDSA P-256', 'CN=www.example.com, ECDSA P-256')],
        [t('Emissor', 'Issuer'), t('Autoridade certificadora intermediária', 'Intermediate certificate authority')],
      ],
      pacotes: [
        tls(
          'servidor',
          1,
          200,
          ['Server Hello, Change Cipher Spec, Application Data', 'Server Hello, Change Cipher Spec, Application Data'],
          ['SERVER HELLO', 'SERVER HELLO'],
          'tls',
          serverHello,
          17,
          ['Aceito: TLS 1.3, AES-128-GCM', 'Accepted: TLS 1.3, AES-128-GCM'],
        ),
      ],
    },
    {
      titulo: t('Verificar e concluir', 'Verify and finish'),
      resumo: t('O certificado confere; Finished', 'The certificate checks out; Finished'),
      descricao: t(
        'O navegador decifra o certificado, confere a cadeia até uma autoridade em que confia, verifica que o nome bate com www.example.com e checa a assinatura sobre todo o aperto de mão. Tudo certo, ele manda o próprio Finished. Um RTT depois do SYN-ACK, o túnel está pronto.',
        'The browser decrypts the certificate, follows the chain up to an authority it trusts, checks that the name matches www.example.com and verifies the signature over the whole handshake. All good, it sends its own Finished. One RTT after the SYN-ACK, the tunnel is ready.',
      ),
      fatos: [
        [t('Cadeia', 'Chain'), t('Folha → intermediária → raiz confiável', 'Leaf → intermediate → trusted root')],
        [t('Nome', 'Name'), t('Confere com o SNI', 'Matches the SNI')],
        [t('Aperto de mão TLS', 'TLS handshake'), t('1 RTT (0-RTT ao retomar)', '1 RTT (0-RTT on resumption)')],
      ],
      pacotes: [
        tls(
          'cliente',
          200,
          1461,
          ['Change Cipher Spec, Application Data', 'Change Cipher Spec, Application Data'],
          ['FINISHED', 'FINISHED'],
          'tls',
          clientFinished,
          6,
          ['Finished do navegador (cifrado)', 'Browser Finished (encrypted)'],
        ),
      ],
    },
    {
      titulo: t('HTTP cifrado', 'Encrypted HTTP'),
      resumo: t('Pedido e resposta ilegíveis no fio', 'Request and response unreadable on the wire'),
      descricao: t(
        'O GET e a resposta 200 OK são os mesmos de sempre, mas viajam em registros cifrados e autenticados. Quem estiver no caminho vê o IP, o SNI e os tamanhos, nunca a URL, os cookies ou a página. Logo depois o servidor envia tíquetes de sessão para retomar a conexão mais rápido.',
        'The GET and the 200 OK are the same as ever, but they travel inside encrypted, authenticated records. Anyone on the path sees the IP, the SNI and the sizes, never the URL, the cookies or the page. Right after, the server sends session tickets for a faster resumption.',
      ),
      fatos: [
        [t('Protocolo interno', 'Inner protocol'), t('HTTP/2 (via ALPN)', 'HTTP/2 (via ALPN)')],
        [t('Visível no fio', 'Visible on the wire'), t('IP, porta, SNI, tamanhos', 'IP, port, SNI, sizes')],
        [t('Integridade', 'Integrity'), t('Tag de 16 bytes por registro', '16-byte tag per record')],
      ],
      pacotes: [
        tls(
          'cliente',
          264,
          1461,
          ['Application Data', 'Application Data'],
          ['GET /', 'GET /'],
          'dados',
          registro(166, ['HTTP/2: GET /', 'HTTP/2: GET /'], ['Prefácio, SETTINGS e HEADERS do HTTP/2, cifrados.', 'HTTP/2 preface, SETTINGS and HEADERS, encrypted.']),
          1,
          ['GET / (cifrado)', 'GET / (encrypted)'],
        ),
        tls(
          'servidor',
          1461,
          435,
          ['Application Data', 'Application Data'],
          ['200 OK', '200 OK'],
          'dados',
          registro(1200, ['HTTP/2: 200 OK + HTML', 'HTTP/2: 200 OK + HTML'], ['Cabeçalhos e o começo da página, cifrados.', 'Headers and the start of the page, encrypted.']),
          18,
          ['200 OK (cifrado)', '200 OK (encrypted)'],
        ),
      ],
    },
  ],
};
