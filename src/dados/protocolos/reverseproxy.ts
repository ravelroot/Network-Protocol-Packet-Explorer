import { apertoDeMao, hex, no, nos, opaco, t, texto } from '../base';
import { criarFluxo } from '../fluxo-tcp';
import type { Campo, Protocolo, Texto } from '../tipos';

const INTERNO = '10.0.0.2';

const publico = criarFluxo('cliente', 'proxy', 50200, 443);
const app1 = criarFluxo('proxy', 'app1', 41000, 8080);
const app2 = criarFluxo('proxy', 'app2', 41002, 8080);

const fim = texto(t('Fim dos cabeçalhos', 'End of headers'), '\r\n');

const registro = (tamanho: number, conteudo: Texto, explicacao?: Texto): Campo[] => [
  hex(
    t('Cabeçalho do registro TLS', 'TLS record header'),
    `17 03 03 ${((tamanho >> 8) & 0xff).toString(16).padStart(2, '0')} ${(tamanho & 0xff).toString(16).padStart(2, '0')}`,
    `Application Data, ${tamanho} bytes`,
  ),
  opaco(conteudo, tamanho, explicacao ?? t('Cifrado entre o navegador e o proxy.', 'Encrypted between the browser and the proxy.')),
];

const saude = (fluxo: typeof app1, nome: string) => [
  fluxo.cliente({
    proto: 'HTTP',
    rotulo: t('GET /healthz', 'GET /healthz'),
    info: t('GET /healthz HTTP/1.1', 'GET /healthz HTTP/1.1'),
    tipo: 'saude',
    resumo: t(`Verificação de saúde do ${nome}`, `${nome} health check`),
    dt: nome === 'App 1' ? 0 : 1,
    origemIp: INTERNO,
    carga: [
      texto(t('Linha de pedido', 'Request line'), 'GET /healthz HTTP/1.1\r\n', t('Rota leve que só diz se a aplicação está de pé.', 'A cheap route that only says whether the app is up.')),
      texto(t('Host', 'Host'), `Host: ${nome === 'App 1' ? '10.0.0.11' : '10.0.0.12'}:8080\r\n`),
      fim,
    ],
  }),
  fluxo.servidor({
    proto: 'HTTP',
    rotulo: t('200 OK', '200 OK'),
    info: t('HTTP/1.1 200 OK (application/json)', 'HTTP/1.1 200 OK (application/json)'),
    tipo: 'saude',
    resumo: t(`${nome} saudável`, `${nome} healthy`),
    dt: 2,
    destinoIp: INTERNO,
    carga: [
      texto(t('Linha de status', 'Status line'), 'HTTP/1.1 200 OK\r\n'),
      texto(t('Content-Type', 'Content-Type'), 'Content-Type: application/json\r\n'),
      texto(t('Content-Length', 'Content-Length'), 'Content-Length: 15\r\n'),
      fim,
      texto(t('Corpo', 'Body'), '{"status":"ok"}', t('Se falhar algumas vezes seguidas, o servidor sai da rotação.', 'If it fails a few times in a row, the server leaves the rotation.')),
    ],
  }),
];

const repassa = (fluxo: typeof app1, caminho: string, bytesCorpo: number, requestId: string) => [
  fluxo.cliente({
    proto: 'HTTP',
    rotulo: t(`GET ${caminho}`, `GET ${caminho}`),
    info: t(`GET ${caminho} HTTP/1.1`, `GET ${caminho} HTTP/1.1`),
    tipo: 'interno',
    resumo: t(`GET ${caminho} em texto puro, na rede interna`, `GET ${caminho} in plain text, on the internal network`),
    dt: 1,
    origemIp: INTERNO,
    carga: [
      texto(t('Linha de pedido', 'Request line'), `GET ${caminho} HTTP/1.1\r\n`, t('Já decifrado: a aplicação recebe HTTP simples.', 'Already decrypted: the app receives plain HTTP.')),
      texto(t('Host', 'Host'), 'Host: loja.example.com\r\n'),
      texto(t('X-Forwarded-For', 'X-Forwarded-For'), 'X-Forwarded-For: 198.51.100.7\r\n', t('O IP público real do cliente; sem isso a aplicação só veria o proxy.', "The client's real public IP; without it the app would only see the proxy.")),
      texto(t('X-Forwarded-Proto', 'X-Forwarded-Proto'), 'X-Forwarded-Proto: https\r\n', t('Avisa que, lá fora, o pedido chegou por HTTPS.', 'Tells the app that, outside, the request arrived over HTTPS.')),
      texto(t('X-Request-Id', 'X-Request-Id'), `X-Request-Id: ${requestId}\r\n`, t('Identificador para cruzar os logs do proxy e da aplicação.', 'An ID to correlate proxy and app logs.')),
      fim,
    ],
  }),
  fluxo.servidor({
    proto: 'HTTP',
    rotulo: t('200 OK', '200 OK'),
    info: t('HTTP/1.1 200 OK (application/json)', 'HTTP/1.1 200 OK (application/json)'),
    tipo: 'interno',
    resumo: t('200 OK · application/json', '200 OK · application/json'),
    dt: 9,
    destinoIp: INTERNO,
    carga: [
      texto(t('Linha de status', 'Status line'), 'HTTP/1.1 200 OK\r\n'),
      texto(t('Content-Type', 'Content-Type'), 'Content-Type: application/json\r\n'),
      texto(t('Content-Length', 'Content-Length'), `Content-Length: ${bytesCorpo}\r\n`),
      fim,
      opaco(t('Corpo (JSON)', 'Body (JSON)'), bytesCorpo, t('Conteúdo de arquivo: não faz parte da lição.', 'File content: not part of the lesson.')),
    ],
  }),
];

export const reverseproxy: Protocolo = {
  id: 'reverseproxy',
  sigla: 'Reverse Proxy',
  nome: t('Proxy reverso', 'Reverse proxy'),
  resumo: t('Terminação de TLS', 'TLS offloading'),
  categoria: 'aplicacao',
  camada: 7,
  descricao: t(
    'O proxy reverso fica na frente dos servidores de aplicação e é o único endereço que a internet enxerga. Ele termina o TLS, ou seja, guarda o certificado e decifra os pedidos, depois os repassa em HTTP simples para a rede interna, escolhendo um servidor saudável a cada vez. No caminho ainda pode servir do cache, comprimir respostas e barrar ataques.',
    'A reverse proxy sits in front of the application servers and is the only address the internet sees. It terminates TLS, meaning it holds the certificate and decrypts requests, then forwards them as plain HTTP to the internal network, picking a healthy server each time. Along the way it can also serve from cache, compress responses and block attacks.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Portas', 'Ports'), t('443 público → 8080 interno', '443 public → 8080 internal')],
    [t('Funções', 'Roles'), t('TLS, balanceamento, cache, WAF', 'TLS, load balancing, cache, WAF')],
    [t('Cabeçalhos', 'Headers'), t('X-Forwarded-For, X-Forwarded-Proto, Forwarded', 'X-Forwarded-For, X-Forwarded-Proto, Forwarded')],
    [t('Exemplos', 'Examples'), t('Nginx, HAProxy, Envoy, Traefik', 'Nginx, HAProxy, Envoy, Traefik')],
    [t('Definido em', 'Defined in'), t('RFC 9110 (intermediários), RFC 7239', 'RFC 9110 (intermediaries), RFC 7239')],
  ],
  legenda: {
    tcp: { nome: t('TCP', 'TCP'), cor: 'oliva' },
    tls: { nome: t('TLS com o cliente', 'TLS with the client'), cor: 'anil' },
    interno: { nome: t('HTTP interno', 'Internal HTTP'), cor: 'ouro' },
    saude: { nome: t('Verificação de saúde', 'Health check'), cor: 'neutra' },
  },
  observacao: t('ACKs puros não aparecem', 'Bare ACKs not shown'),
  nos: [
    nos.cliente(12, 76),
    nos.roteador(28, 58),
    nos.internet(46, 76),
    no('proxy', 'escudo', t('Proxy reverso', 'Reverse proxy'), 64, 46, '203.0.113.10'),
    no('app1', 'servidor', t('App 1', 'App 1'), 86, 22, '10.0.0.11'),
    no('app2', 'servidor', t('App 2', 'App 2'), 88, 70, '10.0.0.12'),
  ],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'proxy'],
    ['proxy', 'app1'],
    ['proxy', 'app2'],
  ],
  faixas: ['cliente', 'proxy', 'app1', 'app2'],
  passos: [
    {
      titulo: t('Verificação de saúde', 'Health check'),
      resumo: t('Quem está pronto para atender', 'Who is ready to serve'),
      descricao: t(
        'A cada poucos segundos o proxy consulta uma rota leve em cada servidor de aplicação. Quem responde 200 fica na rotação; quem falha algumas vezes seguidas deixa de receber pedidos até se recuperar. Usuários nunca caem num servidor fora do ar.',
        'Every few seconds the proxy calls a cheap route on each application server. Servers answering 200 stay in the rotation; those failing several times in a row stop receiving requests until they recover. Users never land on a dead server.',
      ),
      fatos: [
        [t('Rota', 'Route'), t('GET /healthz', 'GET /healthz')],
        [t('Intervalo', 'Interval'), t('5 s, 3 falhas para remover', '5 s, 3 failures to remove')],
        [t('Rede interna', 'Internal network'), t('10.0.0.0/24, sem TLS', '10.0.0.0/24, no TLS')],
      ],
      pacotes: [...saude(app1, 'App 1'), ...saude(app2, 'App 2')],
    },
    {
      titulo: t('TLS termina no proxy', 'TLS ends at the proxy'),
      resumo: t('O certificado mora aqui', 'The certificate lives here'),
      descricao: t(
        'O navegador se conecta a loja.example.com, que aponta para o proxy. O handshake TLS acontece com ele: é o proxy que tem o certificado e a chave privada. Os servidores de aplicação não precisam lidar com criptografia nem com renovação de certificados.',
        'The browser connects to loja.example.com, which points at the proxy. The TLS handshake happens with it: the proxy holds the certificate and private key. The application servers never deal with cryptography or certificate renewal.',
      ),
      fatos: [
        [t('Site', 'Site'), t('loja.example.com → 203.0.113.10', 'loja.example.com → 203.0.113.10')],
        [t('Certificado', 'Certificate'), t('No proxy', 'On the proxy')],
        [t('Ganho', 'Benefit'), t('CPU de criptografia fora das aplicações', 'Crypto CPU kept off the apps')],
      ],
      pacotes: [
        ...apertoDeMao({ de: 'cliente', para: 'proxy', portaCliente: 50200, portaServidor: 443, tipo: 'tcp' }).map((p, i) => ({
          ...p,
          dt: i === 0 ? 900 : 17,
          quadro: i === 1 ? { ...p.quadro, ttl: 55 } : p.quadro,
        })),
        publico.cliente({
          proto: 'TLSv1.3',
          rotulo: t('CLIENT HELLO', 'CLIENT HELLO'),
          info: t('Client Hello (SNI=loja.example.com)', 'Client Hello (SNI=loja.example.com)'),
          tipo: 'tls',
          resumo: t('SNI loja.example.com', 'SNI loja.example.com'),
          dt: 1,
          camada: 'TLS',
          carga: [
            hex(t('Cabeçalho do registro TLS', 'TLS record header'), '16 03 01 00 c3', 'Handshake, 195 bytes'),
            opaco(t('ClientHello', 'ClientHello'), 195, t('Versões, cifras, SNI e a chave X25519 do navegador.', "Versions, ciphers, SNI and the browser's X25519 key.")),
          ],
        }),
        publico.servidor({
          proto: 'TLSv1.3',
          rotulo: t('SERVER HELLO', 'SERVER HELLO'),
          info: t('Server Hello, Change Cipher Spec, Application Data', 'Server Hello, Change Cipher Spec, Application Data'),
          tipo: 'tls',
          resumo: t('ServerHello + certificado de loja.example.com', 'ServerHello + certificate for loja.example.com'),
          dt: 18,
          ttl: 55,
          camada: 'TLS',
          carga: [
            hex(t('Cabeçalho do registro TLS', 'TLS record header'), '16 03 03 00 7a', 'Handshake, 122 bytes'),
            opaco(t('ServerHello', 'ServerHello'), 122),
            hex(t('ChangeCipherSpec', 'ChangeCipherSpec'), '14 03 03 00 01 01', 'change_cipher_spec = 1'),
            ...registro(1118, t('Certificado e Finished', 'Certificate and Finished')),
          ],
        }),
        publico.cliente({
          proto: 'TLSv1.3',
          rotulo: t('FINISHED', 'FINISHED'),
          info: t('Change Cipher Spec, Application Data (Finished)', 'Change Cipher Spec, Application Data (Finished)'),
          tipo: 'tls',
          resumo: t('Handshake concluído', 'Handshake complete'),
          dt: 2,
          camada: 'TLS',
          carga: [hex(t('ChangeCipherSpec', 'ChangeCipherSpec'), '14 03 03 00 01 01', 'change_cipher_spec = 1'), ...registro(53, t('Finished', 'Finished'))],
        }),
      ],
    },
    {
      titulo: t('Pedido repassado', 'Request forwarded'),
      resumo: t('Decifrado e enviado ao App 1', 'Decrypted and sent to App 1'),
      descricao: t(
        'O pedido chega cifrado. O proxy decifra, lê o caminho e escolhe o App 1. Na rede interna ele envia HTTP simples por uma conexão que já mantinha aberta, acrescentando X-Forwarded-For e X-Forwarded-Proto para a aplicação saber quem pediu e por onde. A resposta volta, é cifrada de novo e segue para o navegador.',
        'The request arrives encrypted. The proxy decrypts it, reads the path and picks App 1. On the internal network it sends plain HTTP over a connection it already kept open, adding X-Forwarded-For and X-Forwarded-Proto so the app knows who asked and how. The response comes back, is encrypted again and goes to the browser.',
      ),
      fatos: [
        [t('Escolhido', 'Chosen'), t('App 1 (10.0.0.11)', 'App 1 (10.0.0.11)')],
        [t('Algoritmo', 'Algorithm'), t('Round-robin entre os saudáveis', 'Round-robin among healthy servers')],
        [t('Cliente real', 'Real client'), t('198.51.100.7 (IP público após o NAT)', '198.51.100.7 (public IP after NAT)')],
      ],
      pacotes: [
        publico.cliente({ proto: 'TLSv1.3', rotulo: t('GET /produtos', 'GET /produtos'), info: t('Application Data', 'Application Data'), tipo: 'tls', resumo: t('GET /produtos (cifrado)', 'GET /produtos (encrypted)'), dt: 1, camada: 'TLS', carga: registro(132, t('Pedido HTTP cifrado', 'Encrypted HTTP request')) }),
        ...repassa(app1, '/produtos', 640, 'a3f9c2e1'),
        publico.servidor({ proto: 'TLSv1.3', rotulo: t('200 OK', '200 OK'), info: t('Application Data', 'Application Data'), tipo: 'tls', resumo: t('200 OK (cifrado de novo)', '200 OK (encrypted again)'), dt: 1, ttl: 55, camada: 'TLS', carga: registro(760, t('Resposta HTTP cifrada', 'Encrypted HTTP response')) }),
      ],
    },
    {
      titulo: t('Balanceamento', 'Load balancing'),
      resumo: t('O próximo vai para o App 2', 'The next one goes to App 2'),
      descricao: t(
        'O pedido seguinte, do mesmo navegador e pela mesma conexão TLS, vai para o App 2. Para o usuário nada muda; para a operação, a carga se divide e qualquer servidor pode ser atualizado ou reiniciado sem derrubar o site.',
        'The next request, from the same browser over the same TLS connection, goes to App 2. Nothing changes for the user; for operations, the load is shared and any server can be updated or restarted without taking the site down.',
      ),
      fatos: [
        [t('Escolhido', 'Chosen'), t('App 2 (10.0.0.12)', 'App 2 (10.0.0.12)')],
        [t('Sessão', 'Session'), t('Sem afinidade: estado fica no banco/cache', 'No affinity: state lives in a DB/cache')],
        [t('Implantação', 'Deploys'), t('Sem queda, um servidor por vez', 'Zero downtime, one server at a time')],
      ],
      pacotes: [
        publico.cliente({ proto: 'TLSv1.3', rotulo: t('GET /carrinho', 'GET /carrinho'), info: t('Application Data', 'Application Data'), tipo: 'tls', resumo: t('GET /carrinho (cifrado)', 'GET /carrinho (encrypted)'), dt: 220, camada: 'TLS', carga: registro(136, t('Pedido HTTP cifrado', 'Encrypted HTTP request')) }),
        ...repassa(app2, '/carrinho', 412, '7c1d04b8'),
        publico.servidor({ proto: 'TLSv1.3', rotulo: t('200 OK', '200 OK'), info: t('Application Data', 'Application Data'), tipo: 'tls', resumo: t('200 OK (cifrado)', '200 OK (encrypted)'), dt: 1, ttl: 55, camada: 'TLS', carga: registro(532, t('Resposta HTTP cifrada', 'Encrypted HTTP response')) }),
      ],
    },
    {
      titulo: t('Resposta do cache', 'Served from cache'),
      resumo: t('Sem tocar nas aplicações', 'Without touching the apps'),
      descricao: t(
        'Arquivos estáticos, como o logotipo, ficam guardados no próprio proxy conforme o Cache-Control. O pedido é atendido ali mesmo, em microssegundos, e nenhuma aplicação é incomodada. Os cabeçalhos X-Cache: HIT e Age mostram de onde veio e há quanto tempo está guardado.',
        'Static files, like the logo, are stored on the proxy itself according to Cache-Control. The request is answered right there, in microseconds, and no application is bothered. The X-Cache: HIT and Age headers show where it came from and how long it has been stored.',
      ),
      fatos: [
        [t('Arquivo', 'File'), t('/static/logo.svg', '/static/logo.svg')],
        [t('Cache', 'Cache'), t('X-Cache: HIT, Age: 312', 'X-Cache: HIT, Age: 312')],
        [t('Aplicações', 'Applications'), t('Nenhuma consultada', 'None consulted')],
      ],
      pacotes: [
        publico.cliente({ proto: 'TLSv1.3', rotulo: t('GET /static/logo.svg', 'GET /static/logo.svg'), info: t('Application Data', 'Application Data'), tipo: 'tls', resumo: t('GET /static/logo.svg (cifrado)', 'GET /static/logo.svg (encrypted)'), dt: 140, camada: 'TLS', carga: registro(128, t('Pedido HTTP cifrado', 'Encrypted HTTP request')) }),
        publico.servidor({ proto: 'TLSv1.3', rotulo: t('200 (CACHE)', '200 (CACHE)'), info: t('Application Data', 'Application Data'), tipo: 'tls', resumo: t('200 OK · X-Cache: HIT · Age: 312', '200 OK · X-Cache: HIT · Age: 312'), dt: 1, ttl: 55, nota: t('DO CACHE', 'FROM CACHE'), camada: 'TLS', carga: registro(1240, t('Resposta HTTP cifrada', 'Encrypted HTTP response')) }),
      ],
    },
  ],
};
