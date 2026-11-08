import { hex, no, nos, opaco, t } from '../base';
import { ascii, chaveEapol } from '../conversa';
import type { Campo, Pacote, Protocolo } from '../tipos';

const ID = 'ana@corp.example';
const RSN_8021X = '30 14 01 00 00 0f ac 04 01 00 00 0f ac 04 01 00 00 0f ac 01 00 00';

const cabecalhoRadius = (codigo: string, nome: string, id: number, tamanho: number): Campo[] => [
  hex(t('Código', 'Code'), codigo, nome, t('O tipo da mensagem RADIUS.', 'The RADIUS message type.')),
  hex(t('Identificador', 'Identifier'), id.toString(16).padStart(2, '0'), String(id), t('Liga a resposta ao pedido.', 'Matches the reply to the request.'), true),
  hex(t('Tamanho', 'Length'), tamanho.toString(16).padStart(4, '0').replace(/(..)(..)/, '$1 $2'), `${tamanho} bytes`, t('A mensagem RADIUS inteira.', 'The whole RADIUS message.')),
  opaco(
    t('Autenticador', 'Authenticator'),
    16,
    t('16 bytes aleatórios no pedido; na resposta, um hash com o segredo compartilhado.', '16 random bytes in a request; in a reply, a hash with the shared secret.'),
  ),
];

const assinatura = (): Campo[] => [
  hex(t('Message-Authenticator', 'Message-Authenticator'), '50 12', '80 · 18 B'),
  opaco(t('HMAC-MD5', 'HMAC-MD5'), 16, t('Assina a mensagem inteira com o segredo entre ponto de acesso e servidor.', 'Signs the whole message with the secret shared by access point and server.')),
];

const estado = (): Campo[] => [
  hex(t('State', 'State'), '18 12', '24 · 18 B'),
  opaco(t('Valor do State', 'State value'), 16, t('O servidor usa para lembrar em que ponto a conversa está.', 'The server uses it to remember where the conversation is.')),
];

const usuario = (): Campo =>
  hex(t('User-Name', 'User-Name'), `01 12 ${ascii(ID)}`, ID, t('Quem está tentando entrar.', 'Who is trying to log in.'));

const nasIp = (): Campo =>
  hex(t('NAS-IP-Address', 'NAS-IP-Address'), '04 06 0a 14 00 02', '10.20.0.2', t('O ponto de acesso que está perguntando.', 'The access point that is asking.'));

const eapWifi = (tipo: 0 | 1, carga: Campo[]): Pacote['quadro'] => ({
  enlace: 'wifi',
  rede: 'eapol',
  eapolTipo: tipo,
  camada: 'EAP',
  ...(carga.length > 0 ? { carga } : {}),
});

const udpAp = { origem: 51234, destino: 1812 };
const udpServidor = { origem: 1812, destino: 51234 };

const chave = (de: string, para: string, n: 1 | 2 | 3 | 4, info: string, infoValor: string, resumo: Pacote['rotulo']): Pacote => ({
  de,
  para,
  proto: 'EAPOL',
  rotulo: t(`MENSAGEM ${n}/4`, `MESSAGE ${n}/4`),
  info: t(`Key (Mensagem ${n} de 4)`, `Key (Message ${n} of 4)`),
  tipo: 'chaves',
  resumo,
  dt: n === 1 ? 6 : 3,
  quadro: {
    enlace: 'wifi',
    rede: 'eapol',
    eapolTipo: 3,
    camada: 'EAPOL-Key',
    carga: chaveEapol({
      info,
      infoValor,
      explicacao: t('Versão 2: HMAC-SHA1 e AES para o MIC e a chave de grupo.', 'Version 2: HMAC-SHA1 and AES for the MIC and the group key.'),
      tamanhoChave: n === 1 || n === 3 ? 16 : 0,
      replay: n <= 2 ? 1 : 2,
      ...(n === 1 || n === 3 ? { nonce: t('ANonce do ponto de acesso.', 'The access point’s ANonce.') } : {}),
      ...(n === 2 ? { nonce: t('SNonce do notebook.', 'The laptop’s SNonce.') } : {}),
      mic: n !== 1,
      ...(n === 2 ? { rsn: RSN_8021X } : {}),
      ...(n === 3 ? { cifrado: 56 } : {}),
    }),
  },
});

export const radius: Protocolo = {
  id: 'radius',
  sigla: 'RADIUS',
  nome: t('Remote Authentication Dial-In User Service', 'Remote Authentication Dial-In User Service'),
  resumo: t('802.1X Enterprise Wi-Fi', '802.1X Enterprise Wi-Fi'),
  categoria: 'seguranca',
  camada: 7,
  descricao: t(
    'No Wi-Fi corporativo, cada pessoa entra com o próprio usuário, não com uma senha da rede. O ponto de acesso não decide nada: ele repassa a conversa EAP entre o notebook e o servidor RADIUS, que confere a identidade no diretório e devolve a chave daquela pessoa. Um desligamento bloqueia só uma conta.',
    'On corporate Wi-Fi everyone logs in with their own account, not a shared network password. The access point decides nothing: it relays the EAP conversation between the laptop and the RADIUS server, which checks the identity against the directory and returns that person’s key. Revoking one account blocks only that person.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Portas', 'Ports'), t('UDP 1812 (autenticação), 1813 (contabilidade)', 'UDP 1812 (auth), 1813 (accounting)')],
    [t('Transporte', 'Transport'), t('UDP; EAPOL no ar (802.1X)', 'UDP; EAPOL over the air (802.1X)')],
    [t('Métodos EAP', 'EAP methods'), t('PEAP-MSCHAPv2, EAP-TLS, EAP-TTLS', 'PEAP-MSCHAPv2, EAP-TLS, EAP-TTLS')],
    [t('Confiança', 'Trust'), t('Segredo compartilhado AP ↔ servidor', 'Shared secret AP ↔ server')],
    [t('Definido em', 'Defined in'), t('RFC 2865, RFC 3579, IEEE 802.1X', 'RFC 2865, RFC 3579, IEEE 802.1X')],
  ],
  legenda: {
    eap: { nome: t('EAP / 802.1X', 'EAP / 802.1X'), cor: 'anil' },
    radius: { nome: t('RADIUS', 'RADIUS'), cor: 'ouro' },
    aceite: { nome: t('Aceite', 'Accept'), cor: 'oliva' },
    chaves: { nome: t('EAPOL-Key', 'EAPOL-Key'), cor: 'brasa' },
  },
  observacao: t('Várias idas e voltas TLS resumidas', 'Several TLS round trips summarised'),
  nos: [
    nos.cliente(14, 72),
    no('ap', 'ponto-acesso', t('Ponto de acesso', 'Access point'), 42, 52, '10.20.0.2', '00:00:5e:00:53:a2'),
    no('radius', 'escudo', t('Servidor RADIUS', 'RADIUS Server'), 72, 30, '10.20.0.10'),
    no('diretorio', 'armazenamento', t('Diretório', 'Directory'), 90, 62),
  ],
  ligacoes: [
    ['cliente', 'ap'],
    ['ap', 'radius'],
    ['radius', 'diretorio'],
  ],
  faixas: ['cliente', 'ap', 'radius'],
  passos: [
    {
      titulo: t('Identidade', 'Identity'),
      resumo: t('O ponto de acesso pergunta quem é', 'The access point asks who you are'),
      descricao: t(
        'Associado à rede, o notebook ainda não tem acesso: a porta lógica está fechada para tudo que não seja EAPOL. Ele sinaliza o início, o ponto de acesso pede a identidade e o notebook responde com o usuário. É a única informação que vai sem túnel, por isso muitos sistemas usam um nome anônimo aqui.',
        'Associated to the network, the laptop still has no access: the logical port is closed to everything but EAPOL. It signals the start, the access point asks for an identity and the laptop answers with the username. It is the only thing sent outside the tunnel, which is why many systems use an anonymous name here.',
      ),
      fatos: [
        [t('Porta', 'Port'), t('Fechada, só EAPOL passa', 'Closed, only EAPOL passes')],
        [t('Identidade', 'Identity'), t(ID, ID)],
        [t('Ethertype', 'Ethertype'), t('0x888E (EAPOL)', '0x888E (EAPOL)')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'ap',
          proto: 'EAPOL',
          rotulo: t('EAPOL-START', 'EAPOL-START'),
          info: t('Start', 'Start'),
          tipo: 'eap',
          resumo: t('Quero me autenticar', 'I want to authenticate'),
          dt: 0,
          quadro: eapWifi(1, []),
        },
        {
          de: 'ap',
          para: 'cliente',
          proto: 'EAP',
          rotulo: t('IDENTITY?', 'IDENTITY?'),
          info: t('Request, Identity', 'Request, Identity'),
          tipo: 'eap',
          resumo: t('EAP-Request/Identity', 'EAP-Request/Identity'),
          dt: 3,
          quadro: eapWifi(0, [
            hex(t('Código', 'Code'), '01', 'Request (1)', t('Pedido do autenticador.', 'A request from the authenticator.')),
            hex(t('ID', 'ID'), '01', '1', t('A resposta repete este número.', 'The response repeats this number.')),
            hex(t('Tamanho', 'Length'), '00 05', '5 bytes'),
            hex(t('Tipo', 'Type'), '01', 'Identity (1)', t('Pede o nome do usuário.', 'Asks for the username.')),
          ]),
        },
        {
          de: 'cliente',
          para: 'ap',
          proto: 'EAP',
          rotulo: t('IDENTITY', 'IDENTITY'),
          info: t(`Response, Identity (${ID})`, `Response, Identity (${ID})`),
          tipo: 'eap',
          resumo: t(ID, ID),
          dt: 4,
          quadro: eapWifi(0, [
            hex(t('Código', 'Code'), '02', 'Response (2)'),
            hex(t('ID', 'ID'), '01', '1'),
            hex(t('Tamanho', 'Length'), '00 15', '21 bytes'),
            hex(t('Tipo', 'Type'), '01', 'Identity (1)'),
            hex(t('Identidade', 'Identity'), ascii(ID), ID, t('Vai em claro: a única parte fora do túnel.', 'Sent in the clear: the only part outside the tunnel.')),
          ]),
        },
      ],
    },
    {
      titulo: t('Pergunta ao RADIUS', 'Ask the RADIUS server'),
      resumo: t('O ponto de acesso repassa', 'The access point relays'),
      descricao: t(
        'O ponto de acesso embrulha a resposta EAP num Access-Request e manda ao servidor RADIUS por UDP. O servidor reconhece o usuário e responde com um Access-Challenge: quer começar o PEAP, um túnel TLS onde a senha vai protegida. O ponto de acesso desembrulha e entrega ao notebook.',
        'The access point wraps the EAP response in an Access-Request and sends it to the RADIUS server over UDP. The server recognises the user and answers with an Access-Challenge: it wants to start PEAP, a TLS tunnel where the password travels protected. The access point unwraps it and hands it to the laptop.',
      ),
      fatos: [
        [t('Servidor', 'Server'), t('10.20.0.10:1812', '10.20.0.10:1812')],
        [t('Método', 'Method'), t('PEAP (tipo EAP 25)', 'PEAP (EAP type 25)')],
        [t('Integridade', 'Integrity'), t('Message-Authenticator (HMAC-MD5)', 'Message-Authenticator (HMAC-MD5)')],
      ],
      pacotes: [
        {
          de: 'ap',
          para: 'radius',
          proto: 'RADIUS',
          rotulo: t('ACCESS-REQUEST', 'ACCESS-REQUEST'),
          info: t('Access-Request id=42', 'Access-Request id=42'),
          tipo: 'radius',
          resumo: t(`User-Name ${ID} + EAP-Message`, `User-Name ${ID} + EAP-Message`),
          dt: 2,
          quadro: {
            udp: udpAp,
            carga: [
              ...cabecalhoRadius('01', 'Access-Request (1)', 42, 85),
              usuario(),
              nasIp(),
              hex(t('EAP-Message', 'EAP-Message'), `4f 17 02 01 00 15 01 ${ascii(ID)}`, 'EAP-Response/Identity', t('A resposta EAP do notebook, intacta.', 'The laptop’s EAP response, untouched.')),
              ...assinatura(),
            ],
          },
        },
        {
          de: 'radius',
          para: 'ap',
          proto: 'RADIUS',
          rotulo: t('ACCESS-CHALLENGE', 'ACCESS-CHALLENGE'),
          info: t('Access-Challenge id=42', 'Access-Challenge id=42'),
          tipo: 'radius',
          resumo: t('EAP-Request: PEAP Start', 'EAP-Request: PEAP Start'),
          dt: 9,
          quadro: {
            udp: udpServidor,
            carga: [
              ...cabecalhoRadius('0b', 'Access-Challenge (11)', 42, 64),
              hex(t('EAP-Message', 'EAP-Message'), '4f 08 01 02 00 06 19 21', 'EAP-Request, PEAP Start', t('Tipo 25 (PEAP), flag Start, versão 1.', 'Type 25 (PEAP), Start flag, version 1.')),
              ...estado(),
              ...assinatura(),
            ],
          },
        },
        {
          de: 'ap',
          para: 'cliente',
          proto: 'EAP',
          rotulo: t('PEAP START', 'PEAP START'),
          info: t('Request, Protected EAP (PEAP)', 'Request, Protected EAP (PEAP)'),
          tipo: 'eap',
          resumo: t('Vamos abrir um túnel TLS', 'Let us open a TLS tunnel'),
          dt: 2,
          quadro: eapWifi(0, [
            hex(t('Código, ID, tamanho', 'Code, ID, length'), '01 02 00 06', 'Request, 2, 6 bytes'),
            hex(t('Tipo', 'Type'), '19', 'PEAP (25)'),
            hex(t('Flags', 'Flags'), '21', 'Start, v1', t('Começa o TLS agora.', 'Start TLS now.')),
          ]),
        },
      ],
    },
    {
      titulo: t('Túnel PEAP', 'PEAP tunnel'),
      resumo: t('TLS dentro do EAP', 'TLS inside EAP'),
      descricao: t(
        'O notebook manda um ClientHello dentro do EAP; o servidor responde com ServerHello e o certificado, grande o bastante para ser fragmentado. O notebook confere se o certificado é da empresa: é isso que impede um ponto de acesso falso. Com o túnel pronto, usuário e senha vão por dentro, via MSCHAPv2, em outras idas e voltas.',
        'The laptop sends a ClientHello inside EAP; the server replies with ServerHello and its certificate, big enough to be fragmented. The laptop checks that the certificate belongs to the company: that is what stops a fake access point. With the tunnel up, username and password travel inside it via MSCHAPv2, over more round trips.',
      ),
      fatos: [
        [t('Certificado', 'Certificate'), t('radius.corp.example', 'radius.corp.example')],
        [t('Fragmentação', 'Fragmentation'), t('EAP-Message de até 253 bytes', 'EAP-Message up to 253 bytes')],
        [t('Dentro do túnel', 'Inside the tunnel'), t('MSCHAPv2', 'MSCHAPv2')],
        [t('Idas e voltas', 'Round trips'), t('~8 no total', '~8 in total')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'ap',
          proto: 'TLSv1.2',
          rotulo: t('CLIENT HELLO', 'CLIENT HELLO'),
          info: t('Client Hello', 'Client Hello'),
          tipo: 'eap',
          resumo: t('EAP-Response/PEAP: ClientHello', 'EAP-Response/PEAP: ClientHello'),
          dt: 5,
          quadro: eapWifi(0, [
            hex(t('Cabeçalho EAP', 'EAP header'), '02 02 00 d3 19 00', 'Response, 2, 211 bytes, PEAP'),
            hex(t('Registro TLS', 'TLS record'), '16 03 01 00 c8', 'Handshake, 200 bytes'),
            opaco(t('ClientHello', 'ClientHello'), 200, t('Versões, suítes de cifra e um número aleatório.', 'Versions, cipher suites and a random number.')),
          ]),
        },
        {
          de: 'ap',
          para: 'radius',
          proto: 'RADIUS',
          rotulo: t('ACCESS-REQUEST', 'ACCESS-REQUEST'),
          info: t('Access-Request id=43', 'Access-Request id=43'),
          tipo: 'radius',
          resumo: t('Repassa o ClientHello', 'Relays the ClientHello'),
          dt: 2,
          quadro: {
            udp: udpAp,
            carga: [
              ...cabecalhoRadius('01', 'Access-Request (1)', 43, 293),
              usuario(),
              nasIp(),
              hex(t('EAP-Message', 'EAP-Message'), '4f d5 02 02 00 d3 19 00 16 03 01 00 c8', 'EAP-Response, PEAP'),
              opaco(t('ClientHello', 'ClientHello'), 200),
              ...estado(),
              ...assinatura(),
            ],
          },
        },
        {
          de: 'radius',
          para: 'ap',
          proto: 'RADIUS',
          rotulo: t('ACCESS-CHALLENGE', 'ACCESS-CHALLENGE'),
          info: t('Access-Challenge id=43', 'Access-Challenge id=43'),
          tipo: 'radius',
          resumo: t('ServerHello + certificado (fragmento 1)', 'ServerHello + certificate (fragment 1)'),
          dt: 14,
          quadro: {
            udp: udpServidor,
            carga: [
              ...cabecalhoRadius('0b', 'Access-Challenge (11)', 43, 1074),
              hex(
                t('EAP-Message 1/4', 'EAP-Message 1/4'),
                '4f ff 01 03 03 f2 19 c0 00 00 0b 8c',
                'EAP-Request, PEAP, 1010 bytes',
                t('Flags: tamanho incluído e mais fragmentos a caminho (2956 bytes de TLS).', 'Flags: length included and more fragments coming (2956 bytes of TLS).'),
              ),
              opaco(t('ServerHello e certificado', 'ServerHello and certificate'), 243),
              hex(t('EAP-Message 2/4', 'EAP-Message 2/4'), '4f ff', '253 bytes'),
              opaco(t('Certificado (continua)', 'Certificate (continued)'), 253),
              hex(t('EAP-Message 3/4', 'EAP-Message 3/4'), '4f ff', '253 bytes'),
              opaco(t('Certificado (continua)', 'Certificate (continued)'), 253),
              hex(t('EAP-Message 4/4', 'EAP-Message 4/4'), '4f fd', '251 bytes'),
              opaco(t('Certificado (continua)', 'Certificate (continued)'), 251),
              ...estado(),
              ...assinatura(),
            ],
          },
        },
        {
          de: 'ap',
          para: 'cliente',
          proto: 'TLSv1.2',
          rotulo: t('SERVER HELLO', 'SERVER HELLO'),
          info: t('Server Hello, Certificate (fragmento)', 'Server Hello, Certificate (fragment)'),
          tipo: 'eap',
          resumo: t('EAP-Request/PEAP: certificado da empresa', 'EAP-Request/PEAP: company certificate'),
          dt: 2,
          quadro: eapWifi(0, [
            hex(t('Cabeçalho EAP', 'EAP header'), '01 03 03 f2 19 c0 00 00 0b 8c', 'Request, 3, 1010 bytes, PEAP'),
            opaco(t('ServerHello e certificado', 'ServerHello and certificate'), 1000, t('O notebook confere a cadeia até a CA da empresa.', 'The laptop checks the chain up to the company CA.')),
          ]),
        },
      ],
    },
    {
      titulo: t('Aceite e chaves', 'Accept and keys'),
      resumo: t('O servidor libera e entrega a PMK', 'The server grants access and hands over the PMK'),
      descricao: t(
        'Senha conferida no diretório, o servidor manda o Access-Accept. Junto vão a chave mestra da sessão, cifrada com o segredo compartilhado (MS-MPPE), e a VLAN em que a pessoa deve cair. O ponto de acesso repassa só o EAP-Success: a chave fica com ele.',
        'Password verified against the directory, the server sends Access-Accept. With it come the session master key, encrypted with the shared secret (MS-MPPE), and the VLAN the user belongs to. The access point forwards only the EAP-Success: it keeps the key.',
      ),
      fatos: [
        [t('Resultado', 'Result'), t('Access-Accept', 'Access-Accept')],
        [t('Chave', 'Key'), t('MS-MPPE-Recv/Send-Key → PMK', 'MS-MPPE-Recv/Send-Key → PMK')],
        [t('VLAN', 'VLAN'), t('20 (atributos Tunnel)', '20 (Tunnel attributes)')],
      ],
      pacotes: [
        {
          de: 'radius',
          para: 'ap',
          proto: 'RADIUS',
          rotulo: t('ACCESS-ACCEPT', 'ACCESS-ACCEPT'),
          info: t('Access-Accept id=48', 'Access-Accept id=48'),
          tipo: 'aceite',
          resumo: t('EAP-Success + MS-MPPE + VLAN 20', 'EAP-Success + MS-MPPE + VLAN 20'),
          dt: 40,
          quadro: {
            udp: udpServidor,
            carga: [
              ...cabecalhoRadius('02', 'Access-Accept (2)', 48, 176),
              hex(t('EAP-Message', 'EAP-Message'), '4f 06 03 08 00 04', 'EAP-Success'),
              hex(t('MS-MPPE-Recv-Key', 'MS-MPPE-Recv-Key'), '1a 3a 00 00 01 37 11 34', 'Vendor 311 (Microsoft), 52 bytes', t('Atributo de fabricante com metade da chave.', 'Vendor attribute carrying half of the key.')),
              opaco(t('Chave cifrada', 'Encrypted key'), 50, t('Sal + chave, cifrados com o segredo compartilhado.', 'Salt + key, encrypted with the shared secret.')),
              hex(t('MS-MPPE-Send-Key', 'MS-MPPE-Send-Key'), '1a 3a 00 00 01 37 10 34', 'Vendor 311 (Microsoft), 52 bytes'),
              opaco(t('Chave cifrada', 'Encrypted key'), 50),
              hex(t('Tunnel-Type', 'Tunnel-Type'), '40 06 00 00 00 0d', 'VLAN (13)'),
              hex(t('Tunnel-Medium-Type', 'Tunnel-Medium-Type'), '41 06 00 00 00 06', '802 (6)'),
              hex(t('Tunnel-Private-Group-Id', 'Tunnel-Private-Group-Id'), '51 04 32 30', '"20"', t('A VLAN em que o notebook vai cair.', 'The VLAN the laptop will land in.')),
              ...assinatura(),
            ],
          },
        },
        {
          de: 'ap',
          para: 'cliente',
          proto: 'EAP',
          rotulo: t('EAP-SUCCESS', 'EAP-SUCCESS'),
          info: t('Success', 'Success'),
          tipo: 'aceite',
          resumo: t('Autenticado', 'Authenticated'),
          dt: 2,
          quadro: eapWifi(0, [
            hex(t('Código', 'Code'), '03', 'Success (3)', t('Autenticação concluída.', 'Authentication complete.')),
            hex(t('ID, tamanho', 'ID, length'), '08 00 04', '8, 4 bytes'),
          ]),
        },
      ],
    },
    {
      titulo: t('Aperto de mão de 4 vias', '4-way handshake'),
      resumo: t('Chaves só deste notebook', 'Keys for this laptop only'),
      descricao: t(
        'Notebook e ponto de acesso têm agora a mesma PMK, vinda do túnel. O aperto de mão de 4 vias deriva dela as chaves de tráfego, igual ao Wi-Fi doméstico. A diferença é que cada pessoa tem uma PMK própria, gerada a cada login.',
        'The laptop and the access point now share the same PMK, derived from the tunnel. The 4-way handshake turns it into traffic keys, just like home Wi-Fi. The difference is that every person gets their own PMK, generated at each login.',
      ),
      fatos: [
        [t('AKM', 'AKM'), t('1 = 802.1X', '1 = 802.1X')],
        [t('PMK', 'PMK'), t('Única por pessoa e por sessão', 'Unique per person and session')],
        [t('Porta', 'Port'), t('Aberta após a mensagem 4', 'Opened after message 4')],
      ],
      pacotes: [
        chave('ap', 'cliente', 1, '00 8a', 'Pairwise, ACK', t('ANonce', 'ANonce')),
        chave('cliente', 'ap', 2, '01 0a', 'Pairwise, MIC', t('SNonce + MIC', 'SNonce + MIC')),
        chave('ap', 'cliente', 3, '13 ca', 'Pairwise, Install, ACK, MIC, Secure, Encrypted', t('Instalar PTK + GTK', 'Install PTK + GTK')),
        chave('cliente', 'ap', 4, '03 0a', 'Pairwise, MIC, Secure', t('Porta aberta', 'Port opened')),
      ],
    },
  ],
};
