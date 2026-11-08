import { apertoDeMao, hex, nos, opaco, t } from '../base';
import { ascii, criarFluxo } from '../fluxo-tcp';
import type { Campo, Protocolo } from '../tipos';

const fluxo = criarFluxo('cliente', 'servidor', 50544, 443);

const registro = (tipo: string, nomeTipo: string, versao: string, tamanho: number): Campo =>
  hex(
    t('Cabeçalho do registro', 'Record header'),
    `${tipo} ${versao} ${((tamanho >> 8) & 0xff).toString(16).padStart(2, '0')} ${(tamanho & 0xff).toString(16).padStart(2, '0')}`,
    `${nomeTipo}, ${tamanho} bytes`,
    tipo === '17'
      ? t('No TLS 1.3 todo registro cifrado se disfarça de "application data" com versão 1.2.', 'In TLS 1.3 every encrypted record poses as "application data" with version 1.2.')
      : t('Tipo do conteúdo, versão legada e tamanho do que vem a seguir.', 'Content type, legacy version and length of what follows.'),
  );

const cifrado = (tamanho: number, conteudo: Campo['nome']): Campo[] => [
  registro('17', 'Application Data', '03 03', tamanho),
  opaco(conteudo, tamanho - 16, t('Conteúdo cifrado com AES-128-GCM; o tipo real fica escondido no fim.', 'Content encrypted with AES-128-GCM; the real type is hidden at the end.')),
  opaco(t('Etiqueta AEAD', 'AEAD tag'), 16, t('16 bytes que provam que nada foi alterado.', '16 bytes proving nothing was tampered with.')),
];

const mudaCifra: Campo = hex(
  t('ChangeCipherSpec', 'ChangeCipherSpec'),
  '14 03 03 00 01 01',
  'change_cipher_spec = 1',
  t('Sem função no TLS 1.3: só acalma equipamentos antigos no caminho.', 'Does nothing in TLS 1.3: it only soothes old middleboxes on the path.'),
);

export const tls: Protocolo = {
  id: 'tls',
  sigla: 'TLS/SSL',
  nome: t('Segurança da Camada de Transporte', 'Transport Layer Security'),
  resumo: t('Transport Layer Security', 'Transport Layer Security'),
  categoria: 'seguranca',
  camada: 6,
  descricao: t(
    'O TLS cria um canal cifrado e autenticado sobre o TCP: é o S do HTTPS. No TLS 1.3 o cliente já manda sua chave Diffie-Hellman no primeiro pacote, então basta uma ida e volta para começar a enviar dados. O certificado prova a identidade do servidor. O SSL e as versões 1.0 e 1.1 do TLS são obsoletos e inseguros; o TLS 1.2 ainda existe e precisa de duas idas e voltas.',
    'TLS builds an encrypted, authenticated channel on top of TCP: it is the S in HTTPS. In TLS 1.3 the client sends its Diffie-Hellman key in the very first packet, so one round trip is enough before data flows. The certificate proves the server’s identity. SSL and TLS 1.0 and 1.1 are obsolete and insecure; TLS 1.2 is still around and needs two round trips.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Apresentação (camada 6), entre o TCP e a aplicação', 'Presentation (Layer 6), between TCP and the app')],
    [t('Portas', 'Ports'), t('443 (HTTPS), 853 (DoT), 993 (IMAPS)', '443 (HTTPS), 853 (DoT), 993 (IMAPS)')],
    [t('Transporte', 'Transport'), t('TCP (DTLS e QUIC sobre UDP)', 'TCP (DTLS and QUIC over UDP)')],
    [t('Handshake', 'Handshake'), t('1-RTT no TLS 1.3, 2-RTT no TLS 1.2', '1-RTT in TLS 1.3, 2-RTT in TLS 1.2')],
    [t('Obsoletos', 'Obsolete'), t('SSL 2.0/3.0, TLS 1.0/1.1', 'SSL 2.0/3.0, TLS 1.0/1.1')],
    [t('Definido em', 'Defined in'), t('RFC 8446 (TLS 1.3)', 'RFC 8446 (TLS 1.3)')],
  ],
  legenda: {
    tcp: { nome: t('TCP', 'TCP'), cor: 'oliva' },
    claro: { nome: t('Handshake em claro', 'Cleartext handshake'), cor: 'anil' },
    cifrado: { nome: t('Handshake cifrado', 'Encrypted handshake'), cor: 'ouro' },
    dados: { nome: t('Dados da aplicação', 'Application data'), cor: 'brasa' },
  },
  observacao: t('ACKs puros não aparecem', 'Bare ACKs not shown'),
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
      resumo: t('Primeiro, um canal confiável', 'First, a reliable channel'),
      descricao: t(
        'O TLS não cuida de perdas nem de ordem: ele confia no TCP para isso. Por isso tudo começa com o aperto de mão em três vias na porta 443.',
        'TLS does not deal with loss or ordering: it relies on TCP for that. So everything starts with the three-way handshake on port 443.',
      ),
      fatos: [
        [t('Porta', 'Port'), t('443', '443')],
        [t('Custo', 'Cost'), t('1 RTT só do TCP', '1 RTT for TCP alone')],
      ],
      pacotes: apertoDeMao({ de: 'cliente', para: 'servidor', portaCliente: 50544, portaServidor: 443, tipo: 'tcp' }).map((p, i) => ({
        ...p,
        dt: i === 0 ? 0 : 18,
        quadro: i === 1 ? { ...p.quadro, ttl: 56 } : p.quadro,
      })),
    },
    {
      titulo: t('ClientHello', 'ClientHello'),
      resumo: t('Ofertas e chave do cliente', 'Client offers and key share'),
      descricao: t(
        'O cliente diz quais versões e cifras aceita, qual site quer (SNI, ainda em claro) e já envia sua chave pública X25519, apostando que o servidor vai aceitar essa curva. O campo de versão diz 1.2 por compatibilidade; a versão de verdade está na extensão supported_versions.',
        'The client lists the versions and ciphers it accepts, which site it wants (SNI, still in clear text) and already sends its X25519 public key, betting the server will accept that curve. The version field says 1.2 for compatibility; the real version is in the supported_versions extension.',
      ),
      fatos: [
        [t('SNI', 'SNI'), t('www.example.com (visível na rede)', 'www.example.com (visible on the wire)')],
        [t('Versões', 'Versions'), t('TLS 1.3', 'TLS 1.3')],
        [t('Grupo', 'Group'), t('x25519', 'x25519')],
        [t('ALPN', 'ALPN'), t('h2, http/1.1', 'h2, http/1.1')],
      ],
      pacotes: [
        fluxo.cliente({
          proto: 'TLSv1.3',
          rotulo: t('CLIENT HELLO', 'CLIENT HELLO'),
          info: t('Client Hello (SNI=www.example.com)', 'Client Hello (SNI=www.example.com)'),
          tipo: 'claro',
          resumo: t('TLS 1.3 · SNI www.example.com · key_share x25519', 'TLS 1.3 · SNI www.example.com · key_share x25519'),
          dt: 1,
          camada: 'TLS',
          carga: [
            registro('16', 'Handshake, TLS 1.0', '03 01', 194),
            hex(t('Tipo, tamanho', 'Type, length'), '01 00 00 be', 'ClientHello, 190 bytes', t('Mensagem de handshake número 1.', 'Handshake message number 1.')),
            hex(t('Versão legada', 'Legacy version'), '03 03', 'TLS 1.2', t('Congelada em 1.2; a negociação real está nas extensões.', 'Frozen at 1.2; the real negotiation is in the extensions.')),
            opaco(t('Random', 'Random'), 32, t('32 bytes aleatórios do cliente.', '32 random bytes from the client.')),
            hex(t('ID de sessão', 'Session ID'), '20', '32 bytes'),
            opaco(t('ID de sessão legado', 'Legacy session ID'), 32, t('Aleatório, só para parecer uma retomada do TLS 1.2.', 'Random, only to look like a TLS 1.2 resumption.')),
            hex(t('Suítes de cifra', 'Cipher suites'), '00 06 13 01 13 02 13 03', 'AES_128_GCM, AES_256_GCM, CHACHA20_POLY1305', t('As três suítes do TLS 1.3, em ordem de preferência.', 'The three TLS 1.3 suites, in order of preference.')),
            hex(t('Compressão', 'Compression'), '01 00', 'null', t('Compressão foi abolida (ataque CRIME).', 'Compression was abolished (CRIME attack).')),
            hex(t('Tamanho das extensões', 'Extensions length'), '00 6f', '111 bytes'),
            hex(t('server_name (SNI)', 'server_name (SNI)'), `00 00 00 14 00 12 00 00 0f ${ascii('www.example.com')}`, 'www.example.com', t('O site pedido, em claro: o servidor escolhe o certificado por ele.', 'The requested site, in clear: the server picks the certificate from it.')),
            hex(t('supported_versions', 'supported_versions'), '00 2b 00 03 02 03 04', 'TLS 1.3', t('Aqui está a versão de verdade.', 'Here is the real version.')),
            hex(t('supported_groups', 'supported_groups'), '00 0a 00 04 00 02 00 1d', 'x25519'),
            hex(t('key_share', 'key_share'), '00 33 00 26 00 24 00 1d 00 20', 'x25519, 32 bytes', t('A chave pública do cliente, enviada logo de cara.', "The client's public key, sent up front.")),
            opaco(t('Chave pública X25519', 'X25519 public key'), 32),
            hex(t('signature_algorithms', 'signature_algorithms'), '00 0d 00 08 00 06 04 03 08 04 04 01', 'ecdsa_secp256r1_sha256, rsa_pss_sha256, rsa_pkcs1_sha256'),
            hex(t('ALPN', 'ALPN'), `00 10 00 0e 00 0c 02 ${ascii('h2')} 08 ${ascii('http/1.1')}`, 'h2, http/1.1', t('Qual protocolo vai rodar por dentro.', 'Which protocol will run inside.')),
          ],
        }),
      ],
    },
    {
      titulo: t('ServerHello e certificado', 'ServerHello and certificate'),
      resumo: t('Chaves combinadas, resto cifrado', 'Keys agreed, the rest encrypted'),
      descricao: t(
        'O servidor escolhe TLS 1.3 com AES-128-GCM e devolve sua própria chave X25519. Com as duas metades, cada lado calcula o mesmo segredo. Daí em diante tudo é cifrado: extensões, o certificado (cadeia ECDSA), a assinatura CertificateVerify, que prova a posse da chave privada, e o Finished, um resumo autenticado de todo o handshake.',
        'The server picks TLS 1.3 with AES-128-GCM and sends back its own X25519 key. With both halves, each side computes the same secret. From then on everything is encrypted: the extensions, the certificate (an ECDSA chain), the CertificateVerify signature proving it holds the private key, and Finished, an authenticated digest of the whole handshake.',
      ),
      fatos: [
        [t('Suíte', 'Cipher suite'), t('TLS_AES_128_GCM_SHA256', 'TLS_AES_128_GCM_SHA256')],
        [t('Certificado', 'Certificate'), t('www.example.com, ECDSA P-256', 'www.example.com, ECDSA P-256')],
        [t('Cifrado', 'Encrypted'), t('Tudo depois do ServerHello', 'Everything after ServerHello')],
      ],
      pacotes: [
        fluxo.servidor({
          proto: 'TLSv1.3',
          rotulo: t('SERVER HELLO', 'SERVER HELLO'),
          info: t('Server Hello, Change Cipher Spec', 'Server Hello, Change Cipher Spec'),
          tipo: 'claro',
          resumo: t('TLS_AES_128_GCM_SHA256 · key_share x25519', 'TLS_AES_128_GCM_SHA256 · key_share x25519'),
          dt: 19,
          ttl: 56,
          camada: 'TLS',
          carga: [
            registro('16', 'Handshake, TLS 1.2', '03 03', 122),
            hex(t('Tipo, tamanho', 'Type, length'), '02 00 00 76', 'ServerHello, 118 bytes'),
            hex(t('Versão legada', 'Legacy version'), '03 03', 'TLS 1.2'),
            opaco(t('Random', 'Random'), 32, t('32 bytes aleatórios do servidor.', '32 random bytes from the server.')),
            hex(t('ID de sessão', 'Session ID'), '20', '32 bytes'),
            opaco(t('ID de sessão (eco)', 'Session ID (echo)'), 32, t('Devolve o mesmo valor que o cliente mandou.', 'Echoes the value the client sent.')),
            hex(t('Suíte escolhida', 'Chosen suite'), '13 01', 'TLS_AES_128_GCM_SHA256'),
            hex(t('Compressão', 'Compression'), '00', 'null'),
            hex(t('Tamanho das extensões', 'Extensions length'), '00 2e', '46 bytes'),
            hex(t('supported_versions', 'supported_versions'), '00 2b 00 02 03 04', 'TLS 1.3', t('Confirma o TLS 1.3.', 'Confirms TLS 1.3.')),
            hex(t('key_share', 'key_share'), '00 33 00 24 00 1d 00 20', 'x25519, 32 bytes'),
            opaco(t('Chave pública X25519', 'X25519 public key'), 32, t('A metade do servidor: com ela o segredo comum está pronto.', "The server's half: with it the shared secret is ready.")),
            mudaCifra,
          ],
        }),
        fluxo.servidor({
          proto: 'TLSv1.3',
          rotulo: t('CERT + FINISHED', 'CERT + FINISHED'),
          info: t('Application Data (EncryptedExtensions, Certificate, CertificateVerify, Finished)', 'Application Data (EncryptedExtensions, Certificate, CertificateVerify, Finished)'),
          tipo: 'cifrado',
          resumo: t('EncryptedExtensions · Certificate · CertificateVerify · Finished', 'EncryptedExtensions · Certificate · CertificateVerify · Finished'),
          dt: 1,
          ttl: 56,
          camada: 'TLS',
          carga: cifrado(1118, t('Handshake cifrado', 'Encrypted handshake')),
        }),
      ],
    },
    {
      titulo: t('Finished do cliente', 'Client Finished'),
      resumo: t('O cliente confere e confirma', 'The client checks and confirms'),
      descricao: t(
        'O cliente valida a cadeia do certificado até uma autoridade confiável, confere se o nome bate com www.example.com, verifica a assinatura e o Finished do servidor. Se tudo estiver certo, envia o próprio Finished. O handshake terminou em uma única ida e volta depois do TCP.',
        'The client validates the certificate chain up to a trusted authority, checks that the name matches www.example.com, and verifies the signature and the server Finished. If all is well, it sends its own Finished. The handshake completed in a single round trip after TCP.',
      ),
      fatos: [
        [t('Validação', 'Validation'), t('Cadeia, nome, validade, revogação', 'Chain, name, validity, revocation')],
        [t('Ida e volta', 'Round trips'), t('1 (0-RTT na retomada)', '1 (0-RTT on resumption)')],
        [t('TLS 1.2', 'TLS 1.2'), t('Precisaria de 2', 'Would need 2')],
      ],
      pacotes: [
        fluxo.cliente({
          proto: 'TLSv1.3',
          rotulo: t('FINISHED', 'FINISHED'),
          info: t('Change Cipher Spec, Application Data (Finished)', 'Change Cipher Spec, Application Data (Finished)'),
          tipo: 'cifrado',
          resumo: t('Finished: resumo autenticado do handshake', 'Finished: authenticated handshake digest'),
          dt: 3,
          camada: 'TLS',
          carga: [mudaCifra, ...cifrado(53, t('Finished cifrado', 'Encrypted Finished'))],
        }),
      ],
    },
    {
      titulo: t('Dados da aplicação', 'Application data'),
      resumo: t('HTTP dentro do túnel', 'HTTP inside the tunnel'),
      descricao: t(
        'Agora o HTTP corre dentro de registros cifrados. Quem observa a rede vê só tamanhos e horários. O servidor ainda envia um NewSessionTicket para que a próxima visita possa retomar a sessão mais rápido.',
        'Now HTTP runs inside encrypted records. An observer on the network sees only sizes and timing. The server also sends a NewSessionTicket so the next visit can resume faster.',
      ),
      fatos: [
        [t('Protocolo interno', 'Inner protocol'), t('HTTP/2 (ALPN h2)', 'HTTP/2 (ALPN h2)')],
        [t('Visível na rede', 'Visible on the wire'), t('IPs, portas, SNI, tamanhos', 'IPs, ports, SNI, sizes')],
        [t('Retomada', 'Resumption'), t('NewSessionTicket (PSK)', 'NewSessionTicket (PSK)')],
      ],
      pacotes: [
        fluxo.servidor({
          proto: 'TLSv1.3',
          rotulo: t('SESSION TICKET', 'SESSION TICKET'),
          info: t('Application Data (NewSessionTicket)', 'Application Data (NewSessionTicket)'),
          tipo: 'dados',
          resumo: t('NewSessionTicket para retomar depois', 'NewSessionTicket for later resumption'),
          dt: 18,
          ttl: 56,
          camada: 'TLS',
          carga: cifrado(250, t('Ticket cifrado', 'Encrypted ticket')),
        }),
        fluxo.cliente({
          proto: 'TLSv1.3',
          rotulo: t('GET /', 'GET /'),
          info: t('Application Data', 'Application Data'),
          tipo: 'dados',
          resumo: t('HEADERS GET / (HTTP/2, cifrado)', 'HEADERS GET / (HTTP/2, encrypted)'),
          dt: 1,
          camada: 'TLS',
          carga: cifrado(120, t('Pedido HTTP cifrado', 'Encrypted HTTP request')),
        }),
        fluxo.servidor({
          proto: 'TLSv1.3',
          rotulo: t('200 OK', '200 OK'),
          info: t('Application Data', 'Application Data'),
          tipo: 'dados',
          resumo: t('HEADERS 200 + DATA text/html (cifrado)', 'HEADERS 200 + DATA text/html (encrypted)'),
          dt: 21,
          ttl: 56,
          camada: 'TLS',
          carga: cifrado(1380, t('Resposta HTTP cifrada', 'Encrypted HTTP response')),
        }),
      ],
    },
    {
      titulo: t('Encerramento', 'Closing'),
      resumo: t('Alerta close_notify', 'close_notify alert'),
      descricao: t(
        'Para fechar com segurança, o cliente envia um alerta close_notify, também cifrado. Isso evita que alguém corte a conexão no meio e faça uma resposta truncada parecer completa. Depois o TCP fecha com FIN.',
        'To close safely, the client sends a close_notify alert, also encrypted. That stops anyone from cutting the connection mid-way and making a truncated response look complete. Then TCP closes with FIN.',
      ),
      fatos: [
        [t('Alerta', 'Alert'), t('close_notify (0)', 'close_notify (0)')],
        [t('Proteção', 'Protects against'), t('Ataques de truncamento', 'Truncation attacks')],
      ],
      pacotes: [
        fluxo.cliente({
          proto: 'TLSv1.3',
          rotulo: t('CLOSE NOTIFY', 'CLOSE NOTIFY'),
          info: t('Application Data (Alert close_notify)', 'Application Data (Alert close_notify)'),
          tipo: 'dados',
          resumo: t('Alerta close_notify cifrado', 'Encrypted close_notify alert'),
          dt: 40,
          camada: 'TLS',
          carga: cifrado(19, t('Alerta cifrado', 'Encrypted alert')),
        }),
        fluxo.fin(true, { tipo: 'tcp', dt: 1 }),
        fluxo.fin(false, { tipo: 'tcp', dt: 19, ttl: 56 }),
        fluxo.ack(true, { tipo: 'tcp', dt: 1 }),
      ],
    },
  ],
};
