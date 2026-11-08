import { apertoDeMao, hex, no, nos, opaco, t } from '../base';
import { ascii, criarFluxo } from '../fluxo-tcp';
import type { Campo, Protocolo } from '../tipos';

const lado = criarFluxo('cliente', 'socks', 51515, 1080);
const destino = criarFluxo('socks', 'servidor', 49900, 443);

const clientHello: Campo[] = [
  hex(t('Cabeçalho do registro TLS', 'TLS record header'), '16 03 01 00 c2', 'Handshake, 194 bytes', t('Começo de um ClientHello: o SOCKS não sabe nem quer saber.', 'The start of a ClientHello: SOCKS neither knows nor cares.')),
  opaco(t('ClientHello', 'ClientHello'), 194, t('Repassado byte a byte, sem interpretação.', 'Relayed byte for byte, without parsing.')),
];

const serverHello: Campo[] = [
  hex(t('Cabeçalho do registro TLS', 'TLS record header'), '16 03 03 00 7a', 'Handshake, 122 bytes'),
  opaco(t('ServerHello', 'ServerHello'), 122),
  hex(t('ChangeCipherSpec', 'ChangeCipherSpec'), '14 03 03 00 01 01', 'change_cipher_spec = 1'),
  hex(t('Cabeçalho do registro TLS', 'TLS record header'), '17 03 03 04 5e', 'Application Data, 1118 bytes'),
  opaco(t('Handshake cifrado', 'Encrypted handshake'), 1118),
];

export const socks5: Protocolo = {
  id: 'socks5',
  sigla: 'SOCKS5',
  nome: t('Proxy Socket Secure, versão 5', 'Socket Secure proxy, version 5'),
  resumo: t('Proxy Socket Secure', 'Socket Secure proxy'),
  categoria: 'aplicacao',
  camada: 5,
  descricao: t(
    'O SOCKS5 é um proxy genérico: ele não entende HTTP nem nenhum outro protocolo de aplicação, só recebe o pedido "conecte-me a este nome e porta" e depois repassa bytes nos dois sentidos. Serve para qualquer programa TCP, e para UDP com o comando UDP ASSOCIATE. Ele não cifra nada: a segurança fica por conta do que passa por dentro, como o TLS.',
    'SOCKS5 is a generic proxy: it understands neither HTTP nor any other application protocol, it just takes a "connect me to this name and port" request and then relays bytes both ways. It works for any TCP program, and for UDP via the UDP ASSOCIATE command. It encrypts nothing: security is up to whatever runs inside, such as TLS.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Sessão (camada 5)', 'Session (Layer 5)')],
    [t('Porta', 'Port'), t('1080', '1080')],
    [t('Transporte', 'Transport'), t('TCP (UDP via UDP ASSOCIATE)', 'TCP (UDP via UDP ASSOCIATE)')],
    [t('Autenticação', 'Authentication'), t('Nenhuma, usuário/senha, GSS-API', 'None, username/password, GSS-API')],
    [t('Destinos', 'Destinations'), t('IPv4, IPv6 ou nome de domínio', 'IPv4, IPv6 or domain name')],
    [t('Definido em', 'Defined in'), t('RFC 1928, RFC 1929', 'RFC 1928, RFC 1929')],
  ],
  legenda: {
    tcp: { nome: t('TCP', 'TCP'), cor: 'oliva' },
    negociacao: { nome: t('Negociação SOCKS', 'SOCKS negotiation'), cor: 'anil' },
    pedido: { nome: t('Pedido CONNECT', 'CONNECT request'), cor: 'ouro' },
    dados: { nome: t('Dados repassados', 'Relayed data'), cor: 'brasa' },
  },
  observacao: t('ACKs puros não aparecem', 'Bare ACKs not shown'),
  nos: [
    nos.cliente(12, 74),
    nos.roteador(30, 58),
    nos.internet(50, 74),
    no('socks', 'escudo', t('Proxy SOCKS', 'SOCKS Proxy'), 66, 32, '198.51.100.20'),
    nos.servidor(88, 56),
  ],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'socks'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'socks', 'servidor'],
  passos: [
    {
      titulo: t('Conexão com o proxy', 'Connect to the proxy'),
      resumo: t('TCP até a porta 1080', 'TCP to port 1080'),
      descricao: t(
        'O programa foi configurado para usar o proxy SOCKS em 198.51.100.20:1080. Em vez de se conectar ao site, ele abre uma conexão TCP com o proxy.',
        'The program is configured to use the SOCKS proxy at 198.51.100.20:1080. Instead of connecting to the site, it opens a TCP connection to the proxy.',
      ),
      fatos: [
        [t('Proxy', 'Proxy'), t('198.51.100.20:1080', '198.51.100.20:1080')],
        [t('Usos comuns', 'Common uses'), t('ssh -D, Tor, redes corporativas', 'ssh -D, Tor, corporate networks')],
      ],
      pacotes: apertoDeMao({ de: 'cliente', para: 'socks', portaCliente: 51515, portaServidor: 1080, tipo: 'tcp' }).map((p, i) => ({
        ...p,
        dt: i === 0 ? 0 : 16,
        quadro: i === 1 ? { ...p.quadro, ttl: 57 } : p.quadro,
      })),
    },
    {
      titulo: t('Saudação', 'Greeting'),
      resumo: t('Escolha do método de login', 'Choosing the login method'),
      descricao: t(
        'O cliente diz que fala a versão 5 e lista os métodos de autenticação que aceita: nenhum (00) e usuário/senha (02). O proxy escolhe um. Se nenhum servir, responde FF e fecha a conexão.',
        'The client says it speaks version 5 and lists the authentication methods it accepts: none (00) and username/password (02). The proxy picks one. If none works, it answers FF and closes the connection.',
      ),
      fatos: [
        [t('Oferecidos', 'Offered'), t('00 (nenhum), 02 (usuário/senha)', '00 (none), 02 (username/password)')],
        [t('Escolhido', 'Chosen'), t('02 (usuário/senha)', '02 (username/password)')],
        [t('Recusa', 'Refusal'), t('FF: nenhum método aceitável', 'FF: no acceptable method')],
      ],
      pacotes: [
        lado.cliente({
          proto: 'Socks',
          rotulo: t('MÉTODOS', 'METHODS'),
          info: t('Versão 5, 2 métodos: sem autenticação, usuário/senha', 'Version 5, 2 methods: no authentication, username/password'),
          tipo: 'negociacao',
          resumo: t('05 02 00 02', '05 02 00 02'),
          dt: 1,
          camada: 'SOCKS5',
          carga: [
            hex(t('Versão', 'Version'), '05', 'SOCKS5'),
            hex(t('Quantidade de métodos', 'Method count'), '02', '2'),
            hex(t('Métodos', 'Methods'), '00 02', 'no auth, username/password', t('00 = sem login; 02 = usuário e senha (RFC 1929).', '00 = no login; 02 = username and password (RFC 1929).')),
          ],
        }),
        lado.servidor({
          proto: 'Socks',
          rotulo: t('MÉTODO 02', 'METHOD 02'),
          info: t('Versão 5, método escolhido: usuário/senha', 'Version 5, chosen method: username/password'),
          tipo: 'negociacao',
          resumo: t('05 02: quero usuário e senha', '05 02: username and password, please'),
          dt: 17,
          ttl: 57,
          camada: 'SOCKS5',
          carga: [
            hex(t('Versão', 'Version'), '05', 'SOCKS5'),
            hex(t('Método escolhido', 'Chosen method'), '02', 'username/password', t('O proxy exige login.', 'The proxy requires a login.')),
          ],
        }),
      ],
    },
    {
      titulo: t('Usuário e senha', 'Username and password'),
      resumo: t('Subnegociação da RFC 1929', 'RFC 1929 subnegotiation'),
      descricao: t(
        'O cliente envia usuário e senha num formato binário simples: versão da subnegociação, tamanho e texto do usuário, tamanho e texto da senha. Atenção: a senha vai sem criptografia. Por isso o SOCKS costuma rodar dentro de uma rede confiável ou de um túnel SSH.',
        'The client sends username and password in a simple binary format: subnegotiation version, username length and text, password length and text. Careful: the password travels unencrypted. That is why SOCKS usually runs inside a trusted network or an SSH tunnel.',
      ),
      fatos: [
        [t('Usuário', 'Username'), t('deploy', 'deploy')],
        [t('Senha', 'Password'), t('Em claro na rede', 'In clear text on the wire')],
        [t('Resultado', 'Result'), t('00 = sucesso', '00 = success')],
      ],
      pacotes: [
        lado.cliente({
          proto: 'Socks',
          rotulo: t('LOGIN', 'LOGIN'),
          info: t('Autenticação usuário/senha: deploy', 'Username/password authentication: deploy'),
          tipo: 'negociacao',
          resumo: t('01 · deploy · ••••••••••••', '01 · deploy · ••••••••••••'),
          dt: 1,
          camada: 'SOCKS5',
          carga: [
            hex(t('Versão da subnegociação', 'Subnegotiation version'), '01', '1'),
            hex(t('Usuário', 'Username'), `06 ${ascii('deploy')}`, 'deploy', t('Tamanho (6) e o nome.', 'Length (6) and the name.')),
            hex(t('Tamanho da senha', 'Password length'), '0c', '12'),
            opaco(t('Senha', 'Password'), 12, t('Vai em texto puro: escondida aqui só para não mostrar uma senha.', 'Sent as plain text: hidden here only to avoid showing a password.')),
          ],
        }),
        lado.servidor({
          proto: 'Socks',
          rotulo: t('OK', 'OK'),
          info: t('Autenticação: sucesso', 'Authentication: success'),
          tipo: 'negociacao',
          resumo: t('01 00: login aceito', '01 00: login accepted'),
          dt: 18,
          ttl: 57,
          camada: 'SOCKS5',
          carga: [hex(t('Versão, status', 'Version, status'), '01 00', 'success', t('Qualquer valor diferente de 00 fecha a conexão.', 'Any value other than 00 closes the connection.'))],
        }),
      ],
    },
    {
      titulo: t('Pedido CONNECT', 'CONNECT request'),
      resumo: t('O proxy abre a conexão final', 'The proxy opens the final connection'),
      descricao: t(
        'O cliente pede CONNECT para www.example.com, porta 443. Como manda o nome e não o IP, quem resolve o DNS é o proxy, e o cliente nem precisa saber o endereço. O proxy abre a conexão TCP com o site e responde 00 (sucesso) com o endereço e a porta que usou do lado dele.',
        'The client asks to CONNECT to www.example.com, port 443. Because it sends the name and not the IP, the proxy does the DNS lookup and the client never needs the address. The proxy opens the TCP connection to the site and answers 00 (success) with the address and port it used on its side.',
      ),
      fatos: [
        [t('Comando', 'Command'), t('01 CONNECT (02 BIND, 03 UDP ASSOCIATE)', '01 CONNECT (02 BIND, 03 UDP ASSOCIATE)')],
        [t('Tipo de endereço', 'Address type'), t('03: nome de domínio', '03: domain name')],
        [t('DNS', 'DNS'), t('Resolvido pelo proxy', 'Resolved by the proxy')],
        [t('Resposta', 'Reply'), t('00 sucesso, 198.51.100.20:49900', '00 success, 198.51.100.20:49900')],
      ],
      pacotes: [
        lado.cliente({
          proto: 'Socks',
          rotulo: t('CONNECT', 'CONNECT'),
          info: t('Comando CONNECT: www.example.com:443', 'Command CONNECT: www.example.com:443'),
          tipo: 'pedido',
          resumo: t('CONNECT www.example.com:443', 'CONNECT www.example.com:443'),
          dt: 1,
          camada: 'SOCKS5',
          carga: [
            hex(t('Versão, comando, reservado', 'Version, command, reserved'), '05 01 00', 'v5, CONNECT', t('01 = CONNECT: abrir uma conexão TCP.', '01 = CONNECT: open a TCP connection.')),
            hex(t('Tipo de endereço', 'Address type'), '03', 'domain name', t('01 = IPv4, 03 = nome, 04 = IPv6.', '01 = IPv4, 03 = name, 04 = IPv6.')),
            hex(t('Destino', 'Destination'), `0f ${ascii('www.example.com')}`, 'www.example.com', t('Tamanho (15) e o nome.', 'Length (15) and the name.')),
            hex(t('Porta', 'Port'), '01 bb', '443'),
          ],
        }),
        ...apertoDeMao({ de: 'socks', para: 'servidor', portaCliente: 49900, portaServidor: 443, tipo: 'tcp' }).map((p, i) => ({
          ...p,
          dt: i === 0 ? 3 : i === 1 ? 11 : 1,
          quadro: i === 1 ? { ...p.quadro, ttl: 59 } : p.quadro,
        })),
        lado.servidor({
          proto: 'Socks',
          rotulo: t('SUCESSO', 'SUCCEEDED'),
          info: t('Resposta: sucesso, 198.51.100.20:49900', 'Reply: succeeded, 198.51.100.20:49900'),
          tipo: 'pedido',
          resumo: t('05 00: conectado', '05 00: connected'),
          dt: 1,
          ttl: 57,
          camada: 'SOCKS5',
          carga: [
            hex(t('Versão, resposta, reservado', 'Version, reply, reserved'), '05 00 00', 'v5, succeeded', t('00 = sucesso; 05 seria conexão recusada.', '00 = succeeded; 05 would be connection refused.')),
            hex(t('Tipo de endereço', 'Address type'), '01', 'IPv4'),
            hex(t('Endereço usado', 'Bound address'), 'c6 33 64 14', '198.51.100.20', t('O IP de onde o proxy fala com o site.', 'The IP the proxy uses to talk to the site.')),
            hex(t('Porta usada', 'Bound port'), 'c2 ec', '49900'),
          ],
        }),
      ],
    },
    {
      titulo: t('Dados repassados', 'Relayed data'),
      resumo: t('Um cano transparente', 'A transparent pipe'),
      descricao: t(
        'Daqui em diante o proxy só copia bytes entre as duas conexões. O que passa é o TLS do navegador com o site, então o proxy não lê o conteúdo. Para tráfego UDP, como DNS ou QUIC, o cliente usaria UDP ASSOCIATE, e cada datagrama ganharia um pequeno cabeçalho SOCKS.',
        'From now on the proxy just copies bytes between the two connections. What flows is the browser’s TLS with the site, so the proxy cannot read the content. For UDP traffic, such as DNS or QUIC, the client would use UDP ASSOCIATE, and each datagram would get a small SOCKS header.',
      ),
      fatos: [
        [t('O site vê', 'The site sees'), t('O IP do proxy (198.51.100.20)', 'The proxy’s IP (198.51.100.20)')],
        [t('Criptografia', 'Encryption'), t('Só a do TLS de dentro', 'Only the inner TLS')],
        [t('UDP', 'UDP'), t('Via UDP ASSOCIATE', 'Via UDP ASSOCIATE')],
      ],
      pacotes: [
        lado.cliente({ proto: 'TLSv1.3', rotulo: t('CLIENT HELLO', 'CLIENT HELLO'), info: t('Client Hello (SNI=www.example.com)', 'Client Hello (SNI=www.example.com)'), tipo: 'dados', resumo: t('ClientHello entra no túnel', 'ClientHello enters the tunnel'), dt: 1, camada: 'TLS', carga: clientHello }),
        destino.cliente({ proto: 'TLSv1.3', rotulo: t('CLIENT HELLO', 'CLIENT HELLO'), info: t('Client Hello (SNI=www.example.com)', 'Client Hello (SNI=www.example.com)'), tipo: 'dados', resumo: t('Os mesmos bytes saem do proxy', 'The same bytes leave the proxy'), dt: 1, camada: 'TLS', carga: clientHello }),
        destino.servidor({ proto: 'TLSv1.3', rotulo: t('SERVER HELLO', 'SERVER HELLO'), info: t('Server Hello, Change Cipher Spec, Application Data', 'Server Hello, Change Cipher Spec, Application Data'), tipo: 'dados', resumo: t('Resposta do site ao proxy', 'The site answers the proxy'), dt: 12, ttl: 59, camada: 'TLS', carga: serverHello }),
        lado.servidor({ proto: 'TLSv1.3', rotulo: t('SERVER HELLO', 'SERVER HELLO'), info: t('Server Hello, Change Cipher Spec, Application Data', 'Server Hello, Change Cipher Spec, Application Data'), tipo: 'dados', resumo: t('Repassada sem alteração', 'Relayed unchanged'), dt: 1, ttl: 57, camada: 'TLS', carga: serverHello }),
      ],
    },
  ],
};
