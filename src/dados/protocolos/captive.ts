import { hex, no, t, texto } from '../base';
import { ascii, conversa, registroTls } from '../conversa';
import type { Campo, Pacote, Protocolo } from '../tipos';

const TESTE = '203.0.113.80';
const PORTAL_API = 'https://portal.hotel.example/api';
const zeros = (n: number): string => Array<string>(n).fill('00').join(' ');

const dhcp = (op: 1 | 2, tipo: number, nomeTipo: string, seuIp: string, opcoes: Campo[]): Campo[] => [
  hex(t('Operação', 'Op'), op === 1 ? '01' : '02', op === 1 ? 'BOOTREQUEST (1)' : 'BOOTREPLY (2)'),
  hex(t('Hardware, saltos', 'Hardware, hops'), '01 06 00', 'Ethernet, 6, 0'),
  hex(t('ID da transação', 'Transaction ID'), '3c 1f a2 9e', '0x3c1fa29e', t('Liga oferta e confirmação a este pedido.', 'Ties the offer and ack to this request.'), true),
  hex(t('Segundos, flags', 'Seconds, flags'), '00 00 80 00', 'broadcast', t('Responda em broadcast: ainda não há IP.', 'Answer by broadcast: there is no IP yet.')),
  hex(t('IP do cliente', 'Client IP'), '00 00 00 00', '0.0.0.0'),
  hex(t('Seu IP', 'Your IP'), seuIp.split('.').map((p) => Number(p).toString(16).padStart(2, '0')).join(' '), seuIp, op === 2 ? t('O endereço oferecido ao notebook.', 'The address offered to the laptop.') : undefined),
  hex(t('Servidor, relay', 'Server, relay'), zeros(8), '0.0.0.0, 0.0.0.0'),
  hex(t('MAC do cliente', 'Client MAC'), `00 00 5e 00 53 10 ${zeros(10)}`, '00:00:5e:00:53:10', t('Quem pediu o endereço.', 'Who asked for the address.'), true),
  hex(t('Nome e arquivo de boot', 'Boot name and file'), zeros(192), '0', t('Campos do BOOTP, sem uso aqui.', 'BOOTP fields, unused here.')),
  hex(t('Cookie mágico', 'Magic cookie'), '63 82 53 63', 'DHCP', t('Marca o início das opções DHCP.', 'Marks the start of the DHCP options.')),
  hex(t('Tipo de mensagem', 'Message type'), `35 01 0${tipo}`, nomeTipo),
  ...opcoes,
  hex(t('Fim', 'End'), 'ff', '255'),
];

const opcoesServidor = (): Campo[] => [
  hex(t('Servidor DHCP', 'DHCP server'), '36 04 0a 0a 00 01', '10.10.0.1'),
  hex(t('Concessão', 'Lease'), '33 04 00 00 0e 10', '3600 s'),
  hex(t('Máscara', 'Subnet mask'), '01 04 ff ff fe 00', '255.255.254.0'),
  hex(t('Roteador', 'Router'), '03 04 0a 0a 00 01', '10.10.0.1'),
  hex(t('DNS', 'DNS'), '06 04 0a 0a 00 01', '10.10.0.1'),
  hex(
    t('Portal cativo (114)', 'Captive portal (114)'),
    `72 ${PORTAL_API.length.toString(16)} ${ascii(PORTAL_API)}`,
    PORTAL_API,
    t('RFC 8910: avisa logo de cara que há um portal e onde fica a API dele.', 'RFC 8910: says up front that there is a portal and where its API lives.'),
  ),
];

const quadroDhcp = (de: 'cliente' | 'portal', carga: Campo[]): Pacote['quadro'] => ({
  enlace: 'wifi',
  origemIp: de === 'cliente' ? '0.0.0.0' : '10.10.0.1',
  destinoIp: '255.255.255.255',
  udp: de === 'cliente' ? { origem: 68, destino: 67 } : { origem: 67, destino: 68 },
  carga,
});

const teste = conversa({ id: 'cliente', porta: 49710 }, { id: 'portal', porta: 80 });
const login = conversa({ id: 'cliente', porta: 49711 }, { id: 'portal', porta: 443 });
const livre = conversa({ id: 'cliente', porta: 49712 }, { id: 'servidor', porta: 80, ttl: 56 });

const GET_204 = (): Campo[] => [
  texto(t('Linha de pedido', 'Request line'), 'GET /generate_204 HTTP/1.1\r\n', t('Uma URL que, na internet de verdade, sempre responde 204 vazio.', 'A URL that, on the real internet, always answers an empty 204.')),
  texto(t('Host', 'Host'), 'Host: connectivitycheck.gstatic.com\r\n'),
  texto(t('Connection', 'Connection'), 'Connection: close\r\n\r\n'),
];

export const captive: Protocolo = {
  id: 'captive',
  sigla: 'Captive Portal',
  nome: t('Portal cativo', 'Captive portal'),
  resumo: t('Logins de Wi-Fi de hotel e café', 'Hotel and café Wi-Fi logins'),
  categoria: 'aplicacao',
  camada: 7,
  descricao: t(
    'Em hotéis, aeroportos e cafés, o Wi-Fi é aberto, mas a internet só funciona depois de aceitar os termos ou digitar o número do quarto. Até lá, o gateway intercepta o tráfego e responde no lugar dos sites. O sistema percebe isso com um teste de conectividade e abre a página de login sozinho.',
    'In hotels, airports and cafés the Wi-Fi is open, but the internet only works after you accept the terms or type your room number. Until then, the gateway intercepts traffic and answers on behalf of websites. The OS notices with a connectivity check and opens the login page by itself.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Descoberta', 'Discovery'), t('Opção DHCP 114, teste HTTP 204', 'DHCP option 114, HTTP 204 probe')],
    [t('Portas', 'Ports'), t('80 (interceptada), 443 (portal)', '80 (intercepted), 443 (portal)')],
    [t('Transporte', 'Transport'), t('TCP; DHCP sobre UDP', 'TCP; DHCP over UDP')],
    [t('Liberação', 'Release'), t('Regra no firewall por MAC/IP', 'Firewall rule per MAC/IP')],
    [t('Definido em', 'Defined in'), t('RFC 8908, RFC 8910, RFC 8952', 'RFC 8908, RFC 8910, RFC 8952')],
  ],
  legenda: {
    dhcp: { nome: t('DHCP', 'DHCP'), cor: 'anil' },
    interceptado: { nome: t('Interceptado', 'Intercepted'), cor: 'brasa' },
    portal: { nome: t('Portal (HTTPS)', 'Portal (HTTPS)'), cor: 'ouro' },
    livre: { nome: t('Internet liberada', 'Internet open'), cor: 'oliva' },
  },
  observacao: t('DNS omitido', 'DNS not shown'),
  nos: [
    no('cliente', 'notebook', t('Cliente', 'Client'), 14, 72, '10.10.0.57'),
    no('portal', 'escudo', t('Gateway do hotel', 'Hotel gateway'), 42, 50, '10.10.0.1', '00:00:5e:00:53:01'),
    no('internet', 'internet', t('Internet', 'Internet'), 66, 72),
    no('servidor', 'servidor', t('Servidor de teste', 'Probe server'), 86, 30, TESTE),
  ],
  ligacoes: [
    ['cliente', 'portal'],
    ['portal', 'internet'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'portal', 'servidor'],
  passos: [
    {
      titulo: t('Wi-Fi aberto e DHCP', 'Open Wi-Fi and DHCP'),
      resumo: t('Ganha IP e a dica do portal', 'Gets an IP and the portal hint'),
      descricao: t(
        'O notebook entra na rede aberta HotelGuest e pede um endereço por DHCP. Na confirmação, além de IP, roteador e DNS, vem a opção 114: o endereço da API do portal. Sistemas recentes já sabem, antes de qualquer teste, que há um login pela frente.',
        'The laptop joins the open HotelGuest network and asks for an address via DHCP. Along with IP, router and DNS, the ack carries option 114: the portal API address. Recent systems know there is a login ahead before running any check.',
      ),
      fatos: [
        [t('Rede', 'Network'), t('HotelGuest (aberta)', 'HotelGuest (open)')],
        [t('IP recebido', 'IP received'), t('10.10.0.57/23', '10.10.0.57/23')],
        [t('Opção 114', 'Option 114'), t(PORTAL_API, PORTAL_API)],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'portal',
          proto: 'DHCP',
          rotulo: t('DISCOVER', 'DISCOVER'),
          info: t('DHCP Discover - ID 0x3c1fa29e', 'DHCP Discover - Transaction ID 0x3c1fa29e'),
          tipo: 'dhcp',
          resumo: t('Alguém me dá um IP?', 'Can someone give me an IP?'),
          dt: 0,
          quadro: quadroDhcp(
            'cliente',
            dhcp(1, 1, 'Discover (1)', '0.0.0.0', [
              hex(t('Lista de pedidos', 'Parameter list'), '37 05 01 03 06 0f 72', '1, 3, 6, 15, 114', t('Pede máscara, roteador, DNS, domínio e o portal.', 'Asks for mask, router, DNS, domain and the portal.')),
            ]),
          ),
        },
        {
          de: 'portal',
          para: 'cliente',
          proto: 'DHCP',
          rotulo: t('OFFER', 'OFFER'),
          info: t('DHCP Offer - ID 0x3c1fa29e', 'DHCP Offer - Transaction ID 0x3c1fa29e'),
          tipo: 'dhcp',
          resumo: t('Ofereço 10.10.0.57', 'Offering 10.10.0.57'),
          dt: 3,
          quadro: quadroDhcp('portal', dhcp(2, 2, 'Offer (2)', '10.10.0.57', opcoesServidor())),
        },
        {
          de: 'cliente',
          para: 'portal',
          proto: 'DHCP',
          rotulo: t('REQUEST', 'REQUEST'),
          info: t('DHCP Request - ID 0x3c1fa29e', 'DHCP Request - Transaction ID 0x3c1fa29e'),
          tipo: 'dhcp',
          resumo: t('Quero 10.10.0.57', 'I will take 10.10.0.57'),
          dt: 2,
          quadro: quadroDhcp(
            'cliente',
            dhcp(1, 3, 'Request (3)', '0.0.0.0', [
              hex(t('IP pedido', 'Requested IP'), '32 04 0a 0a 00 39', '10.10.0.57'),
              hex(t('Servidor DHCP', 'DHCP server'), '36 04 0a 0a 00 01', '10.10.0.1'),
            ]),
          ),
        },
        {
          de: 'portal',
          para: 'cliente',
          proto: 'DHCP',
          rotulo: t('ACK', 'ACK'),
          info: t('DHCP ACK - ID 0x3c1fa29e', 'DHCP ACK - Transaction ID 0x3c1fa29e'),
          tipo: 'dhcp',
          resumo: t('10.10.0.57 + portal em /api', '10.10.0.57 + portal at /api'),
          dt: 2,
          quadro: quadroDhcp('portal', dhcp(2, 5, 'ACK (5)', '10.10.0.57', opcoesServidor())),
        },
      ],
    },
    {
      titulo: t('Teste de conectividade', 'Connectivity check'),
      resumo: t('O gateway responde no lugar do site', 'The gateway answers for the site'),
      descricao: t(
        'O sistema pede uma URL que na internet de verdade devolve 204 vazio. O gateway intercepta: responde ao SYN e ao GET fingindo ser 203.0.113.80 e devolve um 302 para a página de login. Recebeu algo diferente de 204? Então há um portal, e o sistema abre a janela de login.',
        'The OS requests a URL that on the real internet returns an empty 204. The gateway intercepts it: it answers the SYN and the GET pretending to be 203.0.113.80 and returns a 302 to the login page. Got anything other than 204? Then there is a portal, and the OS opens the login window.',
      ),
      fatos: [
        [t('URL de teste', 'Probe URL'), t('/generate_204', '/generate_204')],
        [t('Esperado', 'Expected'), t('204 No Content', '204 No Content')],
        [t('Recebido', 'Received'), t('302 Found → /login', '302 Found → /login')],
        [t('Quem respondeu', 'Who answered'), t('O gateway, com IP falso', 'The gateway, with a spoofed IP')],
      ],
      pacotes: [
        ...teste.abrir('interceptado', [40, 2, 1]).map((p) => ({
          ...p,
          quadro: { ...p.quadro, enlace: 'wifi' as const, ...(p.de === 'cliente' ? { destinoIp: TESTE } : { origemIp: TESTE }) },
        })),
        teste.cliente({
          proto: 'HTTP',
          rotulo: t('GET /generate_204', 'GET /generate_204'),
          info: t('GET /generate_204 HTTP/1.1', 'GET /generate_204 HTTP/1.1'),
          tipo: 'interceptado',
          resumo: t('Tem internet de verdade?', 'Is there real internet?'),
          dt: 1,
          quadro: { enlace: 'wifi', destinoIp: TESTE },
          carga: GET_204(),
        }),
        teste.servidor({
          proto: 'HTTP',
          rotulo: t('302 FOUND', '302 FOUND'),
          info: t('HTTP/1.1 302 Found (Location: /login)', 'HTTP/1.1 302 Found (Location: /login)'),
          tipo: 'interceptado',
          resumo: t('Redirecionado para o portal', 'Redirected to the portal'),
          nota: t('NÃO É 204', 'NOT A 204'),
          dt: 2,
          quadro: { enlace: 'wifi', origemIp: TESTE },
          carga: [
            texto(t('Linha de status', 'Status line'), 'HTTP/1.1 302 Found\r\n', t('Não é o 204 esperado: há um portal no meio.', 'Not the expected 204: there is a portal in the way.')),
            texto(t('Location', 'Location'), 'Location: https://portal.hotel.example/login\r\n', t('Para onde o navegador deve ir.', 'Where the browser should go.')),
            texto(t('Content-Length', 'Content-Length'), 'Content-Length: 0\r\n\r\n'),
          ],
        }),
      ],
    },
    {
      titulo: t('Página de login', 'Login page'),
      resumo: t('O portal aparece, via HTTPS', 'The portal shows up, over HTTPS'),
      descricao: t(
        'A janela do portal abre https://portal.hotel.example/login. Essa conexão é permitida mesmo sem login, e vai cifrada: a página pede o número do quarto e o sobrenome, que não devem trafegar abertos numa rede sem senha.',
        'The portal window opens https://portal.hotel.example/login. This connection is allowed even before login, and it is encrypted: the page asks for room number and surname, which must not travel in the clear on a password-less network.',
      ),
      fatos: [
        [t('Página', 'Page'), t('portal.hotel.example/login', 'portal.hotel.example/login')],
        [t('Permitido antes do login', 'Allowed before login'), t('Só o portal e o DNS', 'Only the portal and DNS')],
        [t('Proteção', 'Protection'), t('TLS 1.3', 'TLS 1.3')],
      ],
      pacotes: [
        login.cliente({
          proto: 'TLSv1.3',
          rotulo: t('GET /login', 'GET /login'),
          info: t('Application Data', 'Application Data'),
          tipo: 'portal',
          resumo: t('GET /login (cifrado)', 'GET /login (encrypted)'),
          dt: 120,
          quadro: { enlace: 'wifi' },
          carga: registroTls(412, t('O pedido GET /login, cifrado.', 'The GET /login request, encrypted.')),
        }),
        login.servidor({
          proto: 'TLSv1.3',
          rotulo: t('200 OK', '200 OK'),
          info: t('Application Data', 'Application Data'),
          tipo: 'portal',
          resumo: t('Formulário: quarto, sobrenome, termos', 'Form: room, surname, terms'),
          dt: 18,
          quadro: { enlace: 'wifi' },
          carga: registroTls(1180, t('O HTML do formulário de login.', 'The login form HTML.')),
        }),
      ],
    },
    {
      titulo: t('Aceite dos termos', 'Accept the terms'),
      resumo: t('O firewall libera este notebook', 'The firewall lets this laptop through'),
      descricao: t(
        'O hóspede preenche o quarto, aceita os termos e envia. O portal confere com o sistema do hotel e cria uma regra no firewall para o MAC e o IP do notebook, por 24 horas. O sistema confirma pela API da RFC 8908, que agora responde captive: false.',
        'The guest fills in the room, accepts the terms and submits. The portal checks the hotel system and adds a firewall rule for the laptop’s MAC and IP, valid for 24 hours. The OS confirms through the RFC 8908 API, which now answers captive: false.',
      ),
      fatos: [
        [t('Formulário', 'Form'), t('POST /accept', 'POST /accept')],
        [t('Regra', 'Rule'), t('00:00:5e:00:53:10 / 10.10.0.57', '00:00:5e:00:53:10 / 10.10.0.57')],
        [t('Validade', 'Valid for'), t('24 horas', '24 hours')],
        [t('API', 'API'), t('{"captive": false}', '{"captive": false}')],
      ],
      pacotes: [
        login.cliente({
          proto: 'TLSv1.3',
          rotulo: t('POST /accept', 'POST /accept'),
          info: t('Application Data', 'Application Data'),
          tipo: 'portal',
          resumo: t('quarto=412&sobrenome=Silva&termos=1', 'room=412&surname=Silva&terms=1'),
          dt: 9000,
          quadro: { enlace: 'wifi' },
          carga: registroTls(486, t('O formulário enviado, cifrado.', 'The submitted form, encrypted.')),
        }),
        login.servidor({
          proto: 'TLSv1.3',
          rotulo: t('200 OK', '200 OK'),
          info: t('Application Data', 'Application Data'),
          tipo: 'portal',
          resumo: t('Conectado. Boa estadia!', 'Connected. Enjoy your stay!'),
          dt: 140,
          quadro: { enlace: 'wifi' },
          carga: registroTls(640, t('A página de sucesso.', 'The success page.')),
        }),
        login.cliente({
          proto: 'TLSv1.3',
          rotulo: t('GET /api', 'GET /api'),
          info: t('Application Data', 'Application Data'),
          tipo: 'portal',
          resumo: t('Accept: application/captive+json', 'Accept: application/captive+json'),
          dt: 30,
          quadro: { enlace: 'wifi' },
          carga: registroTls(198, t('Consulta à API do portal (RFC 8908).', 'Query to the portal API (RFC 8908).')),
        }),
        login.servidor({
          proto: 'TLSv1.3',
          rotulo: t('CAPTIVE: FALSE', 'CAPTIVE: FALSE'),
          info: t('Application Data', 'Application Data'),
          tipo: 'portal',
          resumo: t('{"captive": false, "seconds-remaining": 86400}', '{"captive": false, "seconds-remaining": 86400}'),
          dt: 12,
          quadro: { enlace: 'wifi' },
          carga: registroTls(214, t('JSON dizendo que a rede está liberada.', 'JSON saying the network is open.')),
        }),
      ],
    },
    {
      titulo: t('Internet liberada', 'Internet unlocked'),
      resumo: t('O teste agora recebe 204', 'The probe now gets 204'),
      descricao: t(
        'O sistema repete o teste. Desta vez o pedido atravessa o gateway e chega ao servidor de verdade, que responde 204 sem conteúdo. A janela do portal fecha e o ícone de Wi-Fi deixa de mostrar o aviso.',
        'The OS repeats the probe. This time the request crosses the gateway and reaches the real server, which replies 204 with no content. The portal window closes and the Wi-Fi icon drops its warning.',
      ),
      fatos: [
        [t('Resposta', 'Response'), t('204 No Content', '204 No Content')],
        [t('Caminho', 'Path'), t('Cliente → gateway → internet', 'Client → gateway → internet')],
        [t('Estado', 'State'), t('Conectado', 'Connected')],
      ],
      pacotes: [
        livre.cliente({
          proto: 'HTTP',
          rotulo: t('GET /generate_204', 'GET /generate_204'),
          info: t('GET /generate_204 HTTP/1.1', 'GET /generate_204 HTTP/1.1'),
          tipo: 'livre',
          resumo: t('Mesmo teste, agora liberado', 'Same probe, now allowed'),
          dt: 400,
          quadro: { enlace: 'wifi' },
          carga: GET_204(),
        }),
        livre.servidor({
          proto: 'HTTP',
          rotulo: t('204', '204'),
          info: t('HTTP/1.1 204 No Content', 'HTTP/1.1 204 No Content'),
          tipo: 'livre',
          resumo: t('Internet de verdade', 'Real internet'),
          dt: 38,
          carga: [
            texto(t('Linha de status', 'Status line'), 'HTTP/1.1 204 No Content\r\n', t('Exatamente o esperado: não há mais portal.', 'Exactly what was expected: no more portal.')),
            texto(t('Content-Length', 'Content-Length'), 'Content-Length: 0\r\n\r\n'),
          ],
        }),
      ],
    },
  ],
};
