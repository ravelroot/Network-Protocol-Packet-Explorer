import { apertoDeMao, hex, IP, nomeDns, nos, opaco, t, texto } from '../base';
import type { Protocolo } from '../tipos';

const cabecalhoDns = (id: string, flags: string, resposta: boolean) => [
  hex(t('ID da transação', 'Transaction ID'), id, `0x${id.replace(' ', '')}`, t('A resposta volta com o mesmo número.', 'The answer comes back with the same number.'), true),
  hex(
    t('Flags', 'Flags'),
    flags,
    resposta ? 'QR=1, RD=1, RA=1' : 'RD=1',
    resposta
      ? t('É resposta, e o resolvedor fez a busca completa.', 'This is an answer, and the resolver did the full lookup.')
      : t('Pergunta com "recursão desejada": o resolvedor que se vire.', 'A query with "recursion desired": the resolver does the work.'),
  ),
  hex(t('Contadores', 'Counts'), resposta ? '00 01 00 01 00 00 00 00' : '00 01 00 00 00 00 00 00', resposta ? '1 pergunta, 1 resposta' : '1 pergunta', t('Perguntas, respostas, autoridades e extras.', 'Questions, answers, authorities and extras.')),
  hex(t('Nome', 'Name'), nomeDns('www.example.com'), 'www.example.com', t('Cada parte vem com o tamanho na frente e termina em 0.', 'Each label is prefixed by its length and ends with 0.')),
  hex(t('Tipo, classe', 'Type, class'), '00 01 00 01', 'A, IN', t('Quer o endereço IPv4 (A) na internet (IN).', 'Asks for the IPv4 address (A) on the internet (IN).')),
];

export const http: Protocolo = {
  id: 'http',
  sigla: 'HTTP',
  nome: t('Protocolo de Transferência de Hipertexto', 'Hypertext Transfer Protocol'),
  resumo: t('Protocolo de Transferência de Hipertexto', 'Hypertext Transfer Protocol'),
  categoria: 'aplicacao',
  camada: 7,
  descricao: t(
    'O HTTP é a língua da web. O navegador pede um recurso, como uma página HTML, uma imagem ou um JSON, e o servidor responde com um código de status, cabeçalhos e, quase sempre, um corpo. Cada troca é um pedido e uma resposta, escritos em texto no HTTP/1.1.',
    'HTTP is the protocol of the web. The browser asks for a resource, such as an HTML page, an image or some JSON, and the server answers with a status code, headers and usually a body. Every exchange is one request and one response, written as text in HTTP/1.1.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Porta padrão', 'Default port'), t('80 (HTTPS: 443)', '80 (HTTPS: 443)')],
    [t('Transporte', 'Transport'), t('TCP', 'TCP')],
    [t('Formato', 'Data format'), t('Texto (cabeçalhos) + corpo', 'Text (headers) + body')],
    [t('Métodos comuns', 'Common methods'), t('GET, POST, PUT, DELETE', 'GET, POST, PUT, DELETE')],
    [t('Definido em', 'Defined in'), t('RFC 9110, RFC 9112', 'RFC 9110, RFC 9112')],
  ],
  legenda: {
    dns: { nome: t('DNS', 'DNS'), cor: 'anil' },
    tcp: { nome: t('TCP', 'TCP'), cor: 'oliva' },
    pedido: { nome: t('Pedido', 'Request'), cor: 'ouro' },
    resposta: { nome: t('Resposta', 'Response'), cor: 'brasa' },
  },
  observacao: t('ACKs de dados não aparecem', 'Data ACKs not shown'),
  nos: [nos.cliente(), nos.roteador(), nos.internet(), nos.resolvedor(), nos.servidor()],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'resolvedor'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'resolvedor', 'servidor'],
  passos: [
    {
      titulo: t('Pedido do cliente', 'Client request'),
      resumo: t('O navegador prepara o pedido', 'Browser prepares the request'),
      descricao: t(
        'Você digita www.example.com e aperta Enter. O navegador separa o endereço em esquema (http), nome (www.example.com) e caminho (/), confere o cache e monta o pedido. Ainda não saiu nada pela rede: primeiro ele precisa descobrir o IP do servidor.',
        'You type www.example.com and press Enter. The browser splits the address into scheme (http), host (www.example.com) and path (/), checks its cache and builds the request. Nothing has left the machine yet: first it needs the server’s IP address.',
      ),
      fatos: [
        [t('URL', 'URL'), t('http://www.example.com/', 'http://www.example.com/')],
        [t('Método', 'Method'), t('GET', 'GET')],
        [t('Cache', 'Cache'), t('Vazio (primeira visita)', 'Empty (first visit)')],
      ],
      pacotes: [],
    },
    {
      titulo: t('Resolução DNS', 'DNS resolution'),
      resumo: t('Descobre o IP do servidor', 'Finds the server’s IP address'),
      descricao: t(
        'Computadores conversam por números, não por nomes. O notebook pergunta ao resolvedor DNS qual é o endereço de www.example.com, em um único pacote UDP. O resolvedor responde com 203.0.113.10.',
        'Computers talk in numbers, not names. The laptop asks the DNS resolver for the address of www.example.com in a single UDP packet. The resolver answers with 203.0.113.10.',
      ),
      fatos: [
        [t('Pergunta', 'Question'), t('A www.example.com', 'A www.example.com')],
        [t('Resolvedor', 'Resolver'), t(IP.resolvedor, IP.resolvedor)],
        [t('Resposta', 'Answer'), t(IP.servidor, IP.servidor)],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'resolvedor',
          proto: 'DNS',
          rotulo: t('CONSULTA DNS', 'DNS QUERY'),
          info: t('Consulta padrão A www.example.com', 'Standard query A www.example.com'),
          tipo: 'dns',
          resumo: t('A? www.example.com', 'A? www.example.com'),
          dt: 0,
          quadro: { udp: { origem: 53211, destino: 53 }, carga: cabecalhoDns('d8 25', '01 00', false) },
        },
        {
          de: 'resolvedor',
          para: 'cliente',
          proto: 'DNS',
          rotulo: t('RESPOSTA DNS', 'DNS RESPONSE'),
          info: t('Resposta padrão A 203.0.113.10', 'Standard query response A 203.0.113.10'),
          tipo: 'dns',
          resumo: t('www.example.com → 203.0.113.10', 'www.example.com → 203.0.113.10'),
          dt: 12,
          quadro: {
            ttl: 118,
            udp: { origem: 53, destino: 53211 },
            carga: [
              ...cabecalhoDns('d8 25', '81 80', true),
              hex(t('Resposta: nome', 'Answer: name'), 'c0 0c', 'www.example.com', t('Ponteiro para o nome da pergunta, para não repetir.', 'A pointer back to the question’s name, to avoid repeating it.')),
              hex(t('Tipo, classe', 'Type, class'), '00 01 00 01', 'A, IN'),
              hex(t('TTL', 'TTL'), '00 00 0e 10', '3600 s', t('Por quanto tempo a resposta pode ficar em cache.', 'How long the answer may be cached.')),
              hex(t('Endereço', 'Address'), '00 04 cb 00 71 0a', IP.servidor, t('4 bytes de dados: o IP do servidor.', '4 bytes of data: the server’s IP.')),
            ],
          },
        },
      ],
    },
    {
      titulo: t('Conexão TCP', 'TCP connection'),
      resumo: t('Estabelece um canal confiável', 'Establishes a reliable link'),
      descricao: t(
        'Antes de qualquer HTTP, os dois lados combinam uma conexão TCP com o aperto de mão em três vias: SYN, SYN-ACK e ACK. Cada lado escolhe seu número de sequência inicial e confirma o do outro.',
        'Before any HTTP, both sides set up a TCP connection with the three-way handshake: SYN, SYN-ACK and ACK. Each side picks its initial sequence number and acknowledges the other’s.',
      ),
      fatos: [
        [t('Porta do cliente', 'Client port'), t('52344 (efêmera)', '52344 (ephemeral)')],
        [t('Porta do servidor', 'Server port'), t('80', '80')],
        [t('Ida e volta', 'Round trips'), t('1 RTT antes de enviar dados', '1 RTT before sending data')],
      ],
      pacotes: apertoDeMao({ de: 'cliente', para: 'servidor', portaCliente: 52344, portaServidor: 80, tipo: 'tcp' }).map((p, i) => ({ ...p, dt: i === 0 ? 12 : 17 })),
    },
    {
      titulo: t('Troca HTTP', 'HTTP exchange'),
      resumo: t('Mensagens de pedido e resposta', 'Request and response messages'),
      descricao: t(
        'O navegador envia o pedido em texto: a linha GET / HTTP/1.1 e cabeçalhos como Host. O servidor responde 200 OK com o HTML. A página tem cerca de 12 KB, então a resposta viaja em 9 segmentos TCP; aqui aparece o primeiro.',
        'The browser sends the request as text: the line GET / HTTP/1.1 and headers such as Host. The server answers 200 OK with the HTML. The page is about 12 KB, so the response travels in 9 TCP segments; the first one is shown here.',
      ),
      fatos: [
        [t('Pedido', 'Request'), t('GET / HTTP/1.1', 'GET / HTTP/1.1')],
        [t('Status', 'Status'), t('200 OK', '200 OK')],
        [t('Corpo', 'Body'), t('text/html, 12.458 bytes', 'text/html, 12,458 bytes')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'servidor',
          proto: 'HTTP',
          rotulo: t('GET /', 'GET /'),
          info: t('GET / HTTP/1.1', 'GET / HTTP/1.1'),
          tipo: 'pedido',
          resumo: t('GET / HTTP/1.1 · Host: www.example.com', 'GET / HTTP/1.1 · Host: www.example.com'),
          dt: 0,
          quadro: {
            tcp: { origem: 52344, destino: 80, seq: 1, ack: 1, flags: 'PSH,ACK' },
            carga: [
              texto(t('Linha de pedido', 'Request line'), 'GET / HTTP/1.1\r\n', t('Método, caminho e versão.', 'Method, path and version.')),
              texto(t('Host', 'Host'), 'Host: www.example.com\r\n', t('Qual site, já que um IP pode hospedar vários.', 'Which site, since one IP can host many.')),
              texto(t('User-Agent', 'User-Agent'), 'User-Agent: Mozilla/5.0\r\n', t('Quem está pedindo.', 'Who is asking.')),
              texto(t('Accept', 'Accept'), 'Accept: text/html\r\n', t('Os formatos que o navegador aceita.', 'The formats the browser accepts.')),
              texto(t('Fim dos cabeçalhos', 'End of headers'), '\r\n', t('Uma linha vazia fecha o pedido.', 'An empty line ends the request.')),
            ],
          },
        },
        {
          de: 'servidor',
          para: 'cliente',
          proto: 'HTTP',
          rotulo: t('200 OK', '200 OK'),
          info: t('HTTP/1.1 200 OK (text/html), 9 segmentos', 'HTTP/1.1 200 OK (text/html), 9 segments'),
          tipo: 'resposta',
          resumo: t('HTTP/1.1 200 OK · text/html', 'HTTP/1.1 200 OK · text/html'),
          dt: 18,
          quadro: {
            ttl: 52,
            tcp: { origem: 80, destino: 52344, seq: 1, ack: 79, flags: 'PSH,ACK', janela: 509 },
            carga: [
              texto(t('Linha de status', 'Status line'), 'HTTP/1.1 200 OK\r\n', t('Versão, código e frase de status.', 'Version, code and reason phrase.')),
              texto(t('Content-Type', 'Content-Type'), 'Content-Type: text/html; charset=UTF-8\r\n', t('Como interpretar o corpo.', 'How to read the body.')),
              texto(t('Content-Length', 'Content-Length'), 'Content-Length: 12458\r\n', t('Tamanho total do corpo em bytes.', 'Total body size in bytes.')),
              texto(t('Fim dos cabeçalhos', 'End of headers'), '\r\n'),
              opaco(t('Corpo (HTML)', 'Body (HTML)'), 1310, t('O começo do HTML; o resto vem nos próximos 8 segmentos.', 'The start of the HTML; the rest follows in the next 8 segments.')),
            ],
          },
        },
      ],
    },
    {
      titulo: t('Renderização da página', 'Page rendering'),
      resumo: t('O navegador mostra o conteúdo', 'Browser displays the content'),
      descricao: t(
        'Com o HTML em mãos, o navegador monta a árvore DOM, aplica o CSS e desenha a página. Cada imagem, folha de estilo ou script referenciado vira um novo pedido HTTP, quase sempre reaproveitando a mesma conexão TCP.',
        'With the HTML in hand, the browser builds the DOM tree, applies the CSS and paints the page. Every referenced image, stylesheet or script becomes a new HTTP request, usually over the same TCP connection.',
      ),
      fatos: [
        [t('Conexão', 'Connection'), t('Mantida aberta (keep-alive)', 'Kept open (keep-alive)')],
        [t('Próximos pedidos', 'Next requests'), t('CSS, JS, imagens', 'CSS, JS, images')],
      ],
      pacotes: [],
    },
  ],
};
