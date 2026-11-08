import { apertoDeMao, hex, no, nos, opaco, t, texto } from '../base';
import { criarFluxo } from '../fluxo-tcp';
import type { Campo, Protocolo } from '../tipos';

const navegador = criarFluxo('cliente', 'proxy', 51000, 3128);
const origem80 = criarFluxo('proxy', 'servidor', 49870, 80);
const origem443 = criarFluxo('proxy', 'servidor', 49872, 443);

const fim = texto(t('Fim dos cabeçalhos', 'End of headers'), '\r\n', t('Uma linha vazia fecha a mensagem.', 'An empty line ends the message.'));

const credenciais: Campo[] = [
  texto(t('Proxy-Authorization', 'Proxy-Authorization'), 'Proxy-Authorization: Basic ', t('Esquema Basic: usuário e senha em Base64.', 'Basic scheme: username and password in Base64.')),
  opaco(t('Credenciais (Base64)', 'Credentials (Base64)'), 24, t('Base64 não é criptografia: qualquer um no caminho decodifica. Escondido aqui só para não mostrar uma senha.', 'Base64 is not encryption: anyone on the path can decode it. Hidden here only to avoid showing a password.')),
  texto(t('Quebra de linha', 'Line break'), '\r\n'),
];

const pedidoAbsoluto = (autenticado: boolean): Campo[] => [
  texto(t('Linha de pedido', 'Request line'), 'GET http://www.example.com/ HTTP/1.1\r\n', t('Para um proxy, o pedido leva a URL inteira, não só o caminho.', 'To a proxy, the request carries the full URL, not just the path.')),
  texto(t('Host', 'Host'), 'Host: www.example.com\r\n'),
  texto(t('User-Agent', 'User-Agent'), 'User-Agent: Mozilla/5.0\r\n'),
  ...(autenticado ? credenciais : []),
  texto(t('Proxy-Connection', 'Proxy-Connection'), 'Proxy-Connection: keep-alive\r\n', t('Pede para manter a conexão com o proxy aberta.', 'Asks to keep the connection to the proxy open.')),
  fim,
];

export const proxy: Protocolo = {
  id: 'proxy',
  sigla: 'HTTP Proxy',
  nome: t('Proxy HTTP de saída', 'HTTP forward proxy'),
  resumo: t('Proxy de saída e CONNECT', 'Forward proxy and CONNECT'),
  categoria: 'aplicacao',
  camada: 7,
  descricao: t(
    'Um proxy de saída fica entre os navegadores de uma rede e a internet. Para HTTP comum, o navegador entrega a URL inteira ao proxy, que busca a página em nome dele, pode guardar em cache e aplicar regras. Para HTTPS, o navegador pede um túnel com CONNECT: o proxy abre a conexão TCP com o site e passa a só copiar bytes cifrados, sem conseguir lê-los.',
    'A forward proxy sits between a network’s browsers and the internet. For plain HTTP, the browser hands the full URL to the proxy, which fetches the page on its behalf, may cache it and apply policies. For HTTPS, the browser asks for a tunnel with CONNECT: the proxy opens the TCP connection to the site and from then on just copies encrypted bytes it cannot read.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Porta', 'Port'), t('3128 ou 8080 (configurável)', '3128 or 8080 (configurable)')],
    [t('Transporte', 'Transport'), t('TCP', 'TCP')],
    [t('Métodos', 'Methods'), t('GET com URL absoluta, CONNECT', 'GET with absolute URL, CONNECT')],
    [t('Autenticação', 'Authentication'), t('407 + Proxy-Authorization', '407 + Proxy-Authorization')],
    [t('Definido em', 'Defined in'), t('RFC 9110, RFC 9112', 'RFC 9110, RFC 9112')],
  ],
  legenda: {
    tcp: { nome: t('TCP', 'TCP'), cor: 'oliva' },
    navegador: { nome: t('Navegador ↔ proxy', 'Browser ↔ proxy'), cor: 'ouro' },
    origem: { nome: t('Proxy ↔ site', 'Proxy ↔ site'), cor: 'anil' },
    tunel: { nome: t('Túnel TLS', 'TLS tunnel'), cor: 'brasa' },
  },
  observacao: t('ACKs puros não aparecem', 'Bare ACKs not shown'),
  nos: [
    nos.cliente(12, 74),
    no('proxy', 'escudo', t('Proxy', 'Proxy'), 32, 46, '192.168.1.5'),
    nos.roteador(52, 62),
    nos.internet(70, 78),
    nos.servidor(88, 32),
  ],
  ligacoes: [
    ['cliente', 'proxy'],
    ['proxy', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'proxy', 'servidor'],
  passos: [
    {
      titulo: t('Conexão com o proxy', 'Connect to the proxy'),
      resumo: t('O navegador só fala com o proxy', 'The browser talks only to the proxy'),
      descricao: t(
        'Com o proxy configurado (manualmente, por PAC ou WPAD), o navegador não procura o IP do site nem se conecta a ele. Toda conexão vai para o proxy, na porta 3128.',
        'With a proxy configured (manually, via PAC or WPAD), the browser neither looks up the site’s IP nor connects to it. Every connection goes to the proxy, on port 3128.',
      ),
      fatos: [
        [t('Proxy', 'Proxy'), t('192.168.1.5:3128', '192.168.1.5:3128')],
        [t('Configuração', 'Configuration'), t('Manual, PAC ou WPAD', 'Manual, PAC or WPAD')],
        [t('DNS do site', 'Site DNS'), t('Feito pelo proxy', 'Done by the proxy')],
      ],
      pacotes: apertoDeMao({ de: 'cliente', para: 'proxy', portaCliente: 51000, portaServidor: 3128, tipo: 'tcp' }).map((p, i) => ({ ...p, dt: i === 0 ? 0 : 1 })),
    },
    {
      titulo: t('Autenticação (407)', 'Authentication (407)'),
      resumo: t('O proxy pede credenciais', 'The proxy asks for credentials'),
      descricao: t(
        'O navegador pede http://www.example.com/ com a URL completa. O proxy da empresa exige login e responde 407 com o cabeçalho Proxy-Authenticate. O navegador repete o pedido com Proxy-Authorization. No esquema Basic as credenciais vão só em Base64, por isso redes sérias usam Negotiate (Kerberos) ou falam TLS com o próprio proxy.',
        'The browser asks for http://www.example.com/ with the full URL. The company proxy requires a login and answers 407 with a Proxy-Authenticate header. The browser repeats the request with Proxy-Authorization. With the Basic scheme credentials are only Base64, so serious networks use Negotiate (Kerberos) or speak TLS to the proxy itself.',
      ),
      fatos: [
        [t('Resposta', 'Response'), t('407 Proxy Authentication Required', '407 Proxy Authentication Required')],
        [t('Desafio', 'Challenge'), t('Proxy-Authenticate: Basic realm="Empresa"', 'Proxy-Authenticate: Basic realm="Empresa"')],
        [t('Diferente de', 'Unlike'), t('401/Authorization, que são do site', '401/Authorization, which belong to the site')],
      ],
      pacotes: [
        navegador.cliente({
          proto: 'HTTP',
          rotulo: t('GET http://…', 'GET http://…'),
          info: t('GET http://www.example.com/ HTTP/1.1', 'GET http://www.example.com/ HTTP/1.1'),
          tipo: 'navegador',
          resumo: t('GET com URL absoluta, sem credenciais', 'GET with absolute URL, no credentials'),
          dt: 1,
          carga: pedidoAbsoluto(false),
        }),
        navegador.servidor({
          proto: 'HTTP',
          rotulo: t('407', '407'),
          info: t('HTTP/1.1 407 Proxy Authentication Required', 'HTTP/1.1 407 Proxy Authentication Required'),
          tipo: 'navegador',
          resumo: t('407: identifique-se primeiro', '407: identify yourself first'),
          dt: 2,
          carga: [
            texto(t('Linha de status', 'Status line'), 'HTTP/1.1 407 Proxy Authentication Required\r\n', t('O 407 é do proxy; o 401 seria do site.', 'The 407 comes from the proxy; a 401 would come from the site.')),
            texto(t('Proxy-Authenticate', 'Proxy-Authenticate'), 'Proxy-Authenticate: Basic realm="Empresa"\r\n', t('Diz qual esquema de login o proxy aceita.', 'Says which login scheme the proxy accepts.')),
            texto(t('Content-Length', 'Content-Length'), 'Content-Length: 0\r\n'),
            fim,
          ],
        }),
        navegador.cliente({
          proto: 'HTTP',
          rotulo: t('GET + CREDENCIAIS', 'GET + CREDENTIALS'),
          info: t('GET http://www.example.com/ HTTP/1.1 (Proxy-Authorization)', 'GET http://www.example.com/ HTTP/1.1 (Proxy-Authorization)'),
          tipo: 'navegador',
          resumo: t('Mesmo pedido, agora com Proxy-Authorization', 'Same request, now with Proxy-Authorization'),
          dt: 4,
          carga: pedidoAbsoluto(true),
        }),
      ],
    },
    {
      titulo: t('Pedido repassado', 'Request forwarded'),
      resumo: t('O proxy busca em seu nome', 'The proxy fetches on your behalf'),
      descricao: t(
        'O proxy resolve o nome, reaproveita uma conexão que já tinha aberta com o site e envia um GET normal, só com o caminho. Ele acrescenta Via e X-Forwarded-For e remove as credenciais. A resposta volta para o proxy, que pode guardá-la em cache e então a entrega ao navegador.',
        'The proxy resolves the name, reuses a connection it already had open to the site and sends a normal GET with just the path. It adds Via and X-Forwarded-For and strips the credentials. The response comes back to the proxy, which may cache it, and then hands it to the browser.',
      ),
      fatos: [
        [t('Conexão com o site', 'Connection to site'), t('Reaproveitada (keep-alive)', 'Reused (keep-alive)')],
        [t('Cabeçalhos novos', 'Added headers'), t('Via, X-Forwarded-For', 'Via, X-Forwarded-For')],
        [t('Cache', 'Cache'), t('MISS (primeira vez)', 'MISS (first time)')],
      ],
      pacotes: [
        origem80.cliente({
          proto: 'HTTP',
          rotulo: t('GET /', 'GET /'),
          info: t('GET / HTTP/1.1', 'GET / HTTP/1.1'),
          tipo: 'origem',
          resumo: t('GET / · Via: 1.1 proxy.empresa.local', 'GET / · Via: 1.1 proxy.empresa.local'),
          dt: 3,
          carga: [
            texto(t('Linha de pedido', 'Request line'), 'GET / HTTP/1.1\r\n', t('Agora só o caminho, como qualquer navegador faria.', 'Just the path now, like any browser would send.')),
            texto(t('Host', 'Host'), 'Host: www.example.com\r\n'),
            texto(t('User-Agent', 'User-Agent'), 'User-Agent: Mozilla/5.0\r\n'),
            texto(t('Via', 'Via'), 'Via: 1.1 proxy.empresa.local\r\n', t('Registra que a mensagem passou por um intermediário.', 'Records that the message went through an intermediary.')),
            texto(t('X-Forwarded-For', 'X-Forwarded-For'), 'X-Forwarded-For: 192.168.1.10\r\n', t('O IP de quem pediu de verdade.', 'The IP of the real requester.')),
            fim,
          ],
        }),
        origem80.servidor({
          proto: 'HTTP',
          rotulo: t('200 OK', '200 OK'),
          info: t('HTTP/1.1 200 OK (text/html)', 'HTTP/1.1 200 OK (text/html)'),
          tipo: 'origem',
          resumo: t('200 OK · Cache-Control: max-age=3600', '200 OK · Cache-Control: max-age=3600'),
          dt: 24,
          ttl: 52,
          carga: [
            texto(t('Linha de status', 'Status line'), 'HTTP/1.1 200 OK\r\n'),
            texto(t('Content-Type', 'Content-Type'), 'Content-Type: text/html; charset=UTF-8\r\n'),
            texto(t('Content-Length', 'Content-Length'), 'Content-Length: 1256\r\n'),
            texto(t('Cache-Control', 'Cache-Control'), 'Cache-Control: max-age=3600\r\n', t('Permite ao proxy guardar a página por uma hora.', 'Lets the proxy keep the page for an hour.')),
            fim,
            opaco(t('Corpo (HTML)', 'Body (HTML)'), 1256),
          ],
        }),
        navegador.servidor({
          proto: 'HTTP',
          rotulo: t('200 OK', '200 OK'),
          info: t('HTTP/1.1 200 OK (text/html)', 'HTTP/1.1 200 OK (text/html)'),
          tipo: 'navegador',
          resumo: t('200 OK · X-Cache: MISS', '200 OK · X-Cache: MISS'),
          dt: 1,
          carga: [
            texto(t('Linha de status', 'Status line'), 'HTTP/1.1 200 OK\r\n'),
            texto(t('Content-Type', 'Content-Type'), 'Content-Type: text/html; charset=UTF-8\r\n'),
            texto(t('Content-Length', 'Content-Length'), 'Content-Length: 1256\r\n'),
            texto(t('Via', 'Via'), 'Via: 1.1 proxy.empresa.local\r\n'),
            texto(t('X-Cache', 'X-Cache'), 'X-Cache: MISS\r\n', t('Não estava em cache: veio do site agora.', 'Was not cached: it came from the site just now.')),
            fim,
            opaco(t('Corpo (HTML)', 'Body (HTML)'), 1256),
          ],
        }),
      ],
    },
    {
      titulo: t('CONNECT para HTTPS', 'CONNECT for HTTPS'),
      resumo: t('O proxy abre um túnel', 'The proxy opens a tunnel'),
      descricao: t(
        'Para https://www.example.com o navegador não pode entregar a URL ao proxy, porque tudo vai cifrado de ponta a ponta. Ele envia CONNECT www.example.com:443. O proxy confere as regras, abre uma conexão TCP com o site e responde 200 Connection established. A partir daí a conexão vira um cano.',
        'For https://www.example.com the browser cannot hand the URL to the proxy, since everything is encrypted end to end. It sends CONNECT www.example.com:443. The proxy checks its rules, opens a TCP connection to the site and answers 200 Connection established. From there on the connection becomes a pipe.',
      ),
      fatos: [
        [t('Pedido', 'Request'), t('CONNECT www.example.com:443', 'CONNECT www.example.com:443')],
        [t('O proxy vê', 'The proxy sees'), t('Nome e porta do destino', 'Destination name and port')],
        [t('Resposta', 'Response'), t('200 Connection established', '200 Connection established')],
      ],
      pacotes: [
        navegador.cliente({
          proto: 'HTTP',
          rotulo: t('CONNECT :443', 'CONNECT :443'),
          info: t('CONNECT www.example.com:443 HTTP/1.1', 'CONNECT www.example.com:443 HTTP/1.1'),
          tipo: 'navegador',
          resumo: t('CONNECT www.example.com:443', 'CONNECT www.example.com:443'),
          dt: 120,
          carga: [
            texto(t('Linha de pedido', 'Request line'), 'CONNECT www.example.com:443 HTTP/1.1\r\n', t('Pede um túnel até o nome e a porta indicados.', 'Asks for a tunnel to the given name and port.')),
            texto(t('Host', 'Host'), 'Host: www.example.com:443\r\n'),
            ...credenciais,
            fim,
          ],
        }),
        ...apertoDeMao({ de: 'proxy', para: 'servidor', portaCliente: 49872, portaServidor: 443, tipo: 'tcp' }).map((p, i) => ({
          ...p,
          dt: i === 0 ? 2 : i === 1 ? 23 : 1,
          quadro: i === 1 ? { ...p.quadro, ttl: 52 } : p.quadro,
        })),
        navegador.servidor({
          proto: 'HTTP',
          rotulo: t('200 ESTABELECIDA', '200 ESTABLISHED'),
          info: t('HTTP/1.1 200 Connection established', 'HTTP/1.1 200 Connection established'),
          tipo: 'navegador',
          resumo: t('Túnel pronto: daqui em diante é só repasse', 'Tunnel ready: from here on it is just relaying'),
          dt: 1,
          carga: [
            texto(t('Linha de status', 'Status line'), 'HTTP/1.1 200 Connection established\r\n', t('O túnel está aberto.', 'The tunnel is open.')),
            fim,
          ],
        }),
      ],
    },
    {
      titulo: t('Túnel TLS', 'TLS tunnel'),
      resumo: t('Bytes cifrados de ponta a ponta', 'Encrypted bytes end to end'),
      descricao: t(
        'O navegador faz o handshake TLS diretamente com o site, através do túnel. O proxy copia cada byte de um lado para o outro sem conseguir ler nem alterar nada; no máximo vê o SNI e os tamanhos. Só com inspeção TLS, instalando um certificado da empresa nos computadores, o proxy poderia abrir esse conteúdo.',
        'The browser runs the TLS handshake directly with the site, through the tunnel. The proxy copies every byte from one side to the other without being able to read or change anything; at most it sees the SNI and the sizes. Only with TLS inspection, by installing a company certificate on the computers, could the proxy open that content.',
      ),
      fatos: [
        [t('O proxy vê', 'The proxy sees'), t('SNI, tamanhos, horários', 'SNI, sizes, timing')],
        [t('O proxy não vê', 'The proxy cannot see'), t('URL, cabeçalhos, conteúdo', 'URL, headers, content')],
        [t('Exceção', 'Exception'), t('Inspeção TLS com CA corporativa', 'TLS inspection with a corporate CA')],
      ],
      pacotes: [
        navegador.cliente({
          proto: 'TLSv1.3',
          rotulo: t('CLIENT HELLO', 'CLIENT HELLO'),
          info: t('Client Hello (SNI=www.example.com)', 'Client Hello (SNI=www.example.com)'),
          tipo: 'tunel',
          resumo: t('ClientHello dentro do túnel', 'ClientHello inside the tunnel'),
          dt: 1,
          camada: 'TLS',
          carga: [
            hex(t('Cabeçalho do registro', 'Record header'), '16 03 01 00 c2', 'Handshake, 194 bytes'),
            opaco(t('ClientHello', 'ClientHello'), 194, t('O proxy não interpreta: só copia os bytes adiante.', 'The proxy does not parse it: it just copies the bytes along.')),
          ],
        }),
        origem443.cliente({
          proto: 'TLSv1.3',
          rotulo: t('CLIENT HELLO', 'CLIENT HELLO'),
          info: t('Client Hello (SNI=www.example.com)', 'Client Hello (SNI=www.example.com)'),
          tipo: 'tunel',
          resumo: t('Os mesmos bytes, agora rumo ao site', 'The same bytes, now heading to the site'),
          dt: 1,
          camada: 'TLS',
          carga: [
            hex(t('Cabeçalho do registro', 'Record header'), '16 03 01 00 c2', 'Handshake, 194 bytes'),
            opaco(t('ClientHello', 'ClientHello'), 194, t('Idêntico ao que o navegador enviou.', 'Identical to what the browser sent.')),
          ],
        }),
        origem443.servidor({
          proto: 'TLSv1.3',
          rotulo: t('SERVER HELLO', 'SERVER HELLO'),
          info: t('Server Hello, Change Cipher Spec, Application Data', 'Server Hello, Change Cipher Spec, Application Data'),
          tipo: 'tunel',
          resumo: t('ServerHello + handshake cifrado', 'ServerHello + encrypted handshake'),
          dt: 24,
          ttl: 52,
          camada: 'TLS',
          carga: [
            hex(t('Cabeçalho do registro', 'Record header'), '16 03 03 00 7a', 'Handshake, 122 bytes'),
            opaco(t('ServerHello', 'ServerHello'), 122),
            hex(t('ChangeCipherSpec', 'ChangeCipherSpec'), '14 03 03 00 01 01', 'change_cipher_spec = 1'),
            hex(t('Cabeçalho do registro', 'Record header'), '17 03 03 04 5e', 'Application Data, 1118 bytes'),
            opaco(t('Certificado e Finished (cifrados)', 'Certificate and Finished (encrypted)'), 1118, t('Nem o proxy consegue ler.', 'Not even the proxy can read it.')),
          ],
        }),
        navegador.servidor({
          proto: 'TLSv1.3',
          rotulo: t('SERVER HELLO', 'SERVER HELLO'),
          info: t('Server Hello, Change Cipher Spec, Application Data', 'Server Hello, Change Cipher Spec, Application Data'),
          tipo: 'tunel',
          resumo: t('Repassado sem alteração ao navegador', 'Relayed unchanged to the browser'),
          dt: 1,
          camada: 'TLS',
          carga: [
            hex(t('Cabeçalho do registro', 'Record header'), '16 03 03 00 7a', 'Handshake, 122 bytes'),
            opaco(t('ServerHello', 'ServerHello'), 122),
            hex(t('ChangeCipherSpec', 'ChangeCipherSpec'), '14 03 03 00 01 01', 'change_cipher_spec = 1'),
            hex(t('Cabeçalho do registro', 'Record header'), '17 03 03 04 5e', 'Application Data, 1118 bytes'),
            opaco(t('Certificado e Finished (cifrados)', 'Certificate and Finished (encrypted)'), 1118),
          ],
        }),
      ],
    },
  ],
};
