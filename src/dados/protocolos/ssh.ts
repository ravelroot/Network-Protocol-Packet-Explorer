import { apertoDeMao, hex, no, nos, opaco, t, texto } from '../base';
import { ascii, criarFluxo, numeroHex, tamanhoCampos } from '../fluxo-tcp';
import type { Campo, Protocolo, Texto } from '../tipos';

const lista = (nome: Texto, valor: string, explicacao?: Texto): Campo =>
  hex(nome, `${numeroHex(valor.length, 4)} ${ascii(valor)}`.trim(), valor || '""', explicacao);

const binario = (codigo: string, nomeCodigo: string, explicacao: Texto, campos: readonly Campo[]): Campo[] => {
  const carga = 1 + tamanhoCampos(campos);
  let preenchimento = 8 - ((5 + carga) % 8);
  if (preenchimento < 4) preenchimento += 8;
  return [
    hex(t('Tamanho do pacote', 'Packet length'), numeroHex(1 + carga + preenchimento, 4), `${1 + carga + preenchimento} bytes`, t('Tudo o que vem depois deste campo.', 'Everything after this field.')),
    hex(t('Tamanho do preenchimento', 'Padding length'), numeroHex(preenchimento, 1), `${preenchimento} bytes`, t('Bytes aleatórios no fim, para alinhar o pacote em blocos de 8.', 'Random bytes at the end, to align the packet to 8-byte blocks.')),
    hex(t('Mensagem', 'Message'), codigo, nomeCodigo, explicacao),
    ...campos,
    opaco(t('Preenchimento aleatório', 'Random padding'), preenchimento),
  ];
};

const cifrado = (bytes: number): Campo[] => [
  opaco(t('Tamanho (cifrado)', 'Length (encrypted)'), 4, t('Com chacha20-poly1305 até o tamanho do pacote é cifrado.', 'With chacha20-poly1305 even the packet length is encrypted.')),
  opaco(t('Mensagem cifrada', 'Encrypted message'), bytes, t('Tipo, conteúdo e preenchimento: ninguém no caminho consegue ler.', 'Type, content and padding: nobody on the path can read it.')),
  opaco(t('MAC Poly1305', 'Poly1305 MAC'), 16, t('Etiqueta de autenticação: qualquer bit alterado é detectado.', 'Authentication tag: any flipped bit is detected.')),
];

const infoCifrado = (lado: 'c' | 's', bytes: number) =>
  lado === 'c'
    ? t(`Cliente: Pacote cifrado (len=${bytes + 20})`, `Client: Encrypted packet (len=${bytes + 20})`)
    : t(`Servidor: Pacote cifrado (len=${bytes + 20})`, `Server: Encrypted packet (len=${bytes + 20})`);

const fluxo = criarFluxo('cliente', 'servidor', 50122, 22);

const kexinit = (lado: 'c' | 's'): Campo[] =>
  binario('14', 'SSH_MSG_KEXINIT (20)', t('Lista tudo o que este lado sabe fazer.', 'Lists everything this side supports.'), [
    opaco(t('Cookie', 'Cookie'), 16, t('16 bytes aleatórios: tornam cada negociação única.', '16 random bytes: make every negotiation unique.')),
    lista(
      t('Troca de chaves', 'Key exchange'),
      lado === 'c'
        ? 'mlkem768x25519-sha256,curve25519-sha256,ecdh-sha2-nistp256,ext-info-c,kex-strict-c-v00@openssh.com'
        : 'sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org,ecdh-sha2-nistp256,kex-strict-s-v00@openssh.com',
      t('Em ordem de preferência; vence a primeira do cliente que o servidor também conhece.', "In order of preference; the client's first one the server also knows wins."),
    ),
    lista(
      t('Chave do host', 'Host key'),
      lado === 'c' ? 'ssh-ed25519,ecdsa-sha2-nistp256,rsa-sha2-512' : 'rsa-sha2-512,rsa-sha2-256,ecdsa-sha2-nistp256,ssh-ed25519',
      t('Tipos de chave que o servidor pode usar para provar quem é.', 'Key types the server may use to prove who it is.'),
    ),
    lista(t('Cifras (cliente → servidor)', 'Ciphers (client → server)'), lado === 'c' ? 'chacha20-poly1305@openssh.com,aes256-gcm@openssh.com' : 'chacha20-poly1305@openssh.com,aes128-ctr,aes256-gcm@openssh.com'),
    lista(t('Cifras (servidor → cliente)', 'Ciphers (server → client)'), lado === 'c' ? 'chacha20-poly1305@openssh.com,aes256-gcm@openssh.com' : 'chacha20-poly1305@openssh.com,aes128-ctr,aes256-gcm@openssh.com'),
    lista(t('MACs (cliente → servidor)', 'MACs (client → server)'), lado === 'c' ? 'hmac-sha2-256-etm@openssh.com' : 'umac-64-etm@openssh.com,hmac-sha2-256-etm@openssh.com'),
    lista(t('MACs (servidor → cliente)', 'MACs (server → client)'), lado === 'c' ? 'hmac-sha2-256-etm@openssh.com' : 'umac-64-etm@openssh.com,hmac-sha2-256-etm@openssh.com'),
    lista(t('Compressão (ida)', 'Compression (out)'), 'none'),
    lista(t('Compressão (volta)', 'Compression (in)'), 'none'),
    lista(t('Idiomas (ida)', 'Languages (out)'), ''),
    lista(t('Idiomas (volta)', 'Languages (in)'), ''),
    hex(t('Primeiro KEX adiantado', 'First KEX follows'), '00', 'false'),
    hex(t('Reservado', 'Reserved'), '00 00 00 00', '0'),
  ]);

export const ssh: Protocolo = {
  id: 'ssh',
  sigla: 'SSH',
  nome: t('Shell seguro', 'Secure Shell'),
  resumo: t('Shell seguro', 'Secure Shell'),
  categoria: 'seguranca',
  camada: 7,
  descricao: t(
    'O SSH abre um terminal em outra máquina por um canal cifrado. Os dois lados combinam algoritmos, criam chaves com Diffie-Hellman, o servidor prova sua identidade com a chave do host e o usuário entra com uma chave pública, sem senha trafegando. Tudo depois disso, comandos e respostas, viaja cifrado e autenticado.',
    'SSH opens a terminal on another machine over an encrypted channel. Both sides agree on algorithms, derive keys with Diffie-Hellman, the server proves its identity with its host key and the user logs in with a public key, with no password on the wire. Everything after that, commands and output, travels encrypted and authenticated.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Porta padrão', 'Default port'), t('22', '22')],
    [t('Transporte', 'Transport'), t('TCP', 'TCP')],
    [t('Troca de chaves', 'Key exchange'), t('curve25519-sha256 (ECDH)', 'curve25519-sha256 (ECDH)')],
    [t('Autenticação', 'Authentication'), t('Chave pública, senha ou certificado', 'Public key, password or certificate')],
    [t('Definido em', 'Defined in'), t('RFC 4251–4254, RFC 8731', 'RFC 4251–4254, RFC 8731')],
  ],
  legenda: {
    tcp: { nome: t('Conexão TCP', 'TCP connection'), cor: 'oliva' },
    kex: { nome: t('Negociação e chaves', 'Negotiation and keys'), cor: 'anil' },
    auth: { nome: t('Autenticação', 'Authentication'), cor: 'ouro' },
    sessao: { nome: t('Sessão cifrada', 'Encrypted session'), cor: 'brasa' },
  },
  observacao: t('ACKs puros não aparecem', 'Bare ACKs not shown'),
  nos: [
    nos.cliente(),
    nos.roteador(),
    nos.internet(),
    no('servidor', 'servidor', t('Servidor SSH', 'SSH Server'), 86, 30, '203.0.113.22'),
  ],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'servidor'],
  passos: [
    {
      titulo: t('Conexão TCP', 'TCP connection'),
      resumo: t('Aperto de mão na porta 22', 'Handshake on port 22'),
      descricao: t(
        'Você roda ssh deploy@203.0.113.22. Antes de qualquer coisa do SSH, o cliente abre uma conexão TCP comum com a porta 22 do servidor, com o aperto de mão em três vias.',
        'You run ssh deploy@203.0.113.22. Before anything SSH-specific, the client opens a plain TCP connection to port 22 on the server with the three-way handshake.',
      ),
      fatos: [
        [t('Comando', 'Command'), t('ssh deploy@203.0.113.22', 'ssh deploy@203.0.113.22')],
        [t('Porta do cliente', 'Client port'), t('50122 (efêmera)', '50122 (ephemeral)')],
        [t('Porta do servidor', 'Server port'), t('22', '22')],
      ],
      pacotes: apertoDeMao({ de: 'cliente', para: 'servidor', portaCliente: 50122, portaServidor: 22, tipo: 'tcp' }).map((p, i) => ({
        ...p,
        dt: i === 0 ? 0 : 21,
        quadro: i === 1 ? { ...p.quadro, ttl: 54 } : p.quadro,
      })),
    },
    {
      titulo: t('Troca de versões', 'Version exchange'),
      resumo: t('Cada lado se apresenta em texto', 'Each side introduces itself in text'),
      descricao: t(
        'A primeira coisa que cada lado envia é uma linha de texto puro com a versão do protocolo e do programa. Se um dos dois não falar SSH-2.0, a conversa termina aqui. Esta é a única parte do SSH que dá para ler a olho nu.',
        'The first thing each side sends is a plain text line with the protocol and software version. If either one does not speak SSH-2.0, the conversation ends here. This is the only part of SSH you can read with the naked eye.',
      ),
      fatos: [
        [t('Cliente', 'Client'), t('SSH-2.0-OpenSSH_9.9', 'SSH-2.0-OpenSSH_9.9')],
        [t('Servidor', 'Server'), t('SSH-2.0-OpenSSH_8.9p1', 'SSH-2.0-OpenSSH_8.9p1')],
        [t('Formato', 'Format'), t('Uma linha terminada em CR LF', 'One line ending in CR LF')],
      ],
      pacotes: [
        fluxo.cliente({
          proto: 'SSHv2',
          rotulo: t('VERSÃO', 'VERSION'),
          info: t('Cliente: Protocolo (SSH-2.0-OpenSSH_9.9)', 'Client: Protocol (SSH-2.0-OpenSSH_9.9)'),
          tipo: 'kex',
          resumo: t('SSH-2.0-OpenSSH_9.9', 'SSH-2.0-OpenSSH_9.9'),
          dt: 1,
          camada: 'SSH',
          carga: [texto(t('Identificação', 'Identification'), 'SSH-2.0-OpenSSH_9.9\r\n', t('Versão do protocolo (2.0) e do programa.', 'Protocol version (2.0) and software version.'))],
        }),
        fluxo.servidor({
          proto: 'SSHv2',
          rotulo: t('VERSÃO', 'VERSION'),
          info: t('Servidor: Protocolo (SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.10)', 'Server: Protocol (SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.10)'),
          tipo: 'kex',
          resumo: t('SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.10', 'SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.10'),
          dt: 22,
          ttl: 54,
          camada: 'SSH',
          carga: [texto(t('Identificação', 'Identification'), 'SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.10\r\n', t('O servidor também diz a versão e a distribuição.', 'The server also gives its version and distribution.'))],
        }),
      ],
    },
    {
      titulo: t('Negociação (KEXINIT)', 'Negotiation (KEXINIT)'),
      resumo: t('Combinam os algoritmos', 'They agree on algorithms'),
      descricao: t(
        'Cada lado manda um SSH_MSG_KEXINIT com listas de algoritmos em ordem de preferência: troca de chaves, tipo de chave do host, cifra, MAC e compressão. Para cada item vence o primeiro da lista do cliente que o servidor também suporta. Aqui sai curve25519-sha256, ssh-ed25519 e chacha20-poly1305.',
        'Each side sends an SSH_MSG_KEXINIT with algorithm lists in order of preference: key exchange, host key type, cipher, MAC and compression. For each item the first entry in the client list that the server also supports wins. Here that gives curve25519-sha256, ssh-ed25519 and chacha20-poly1305.',
      ),
      fatos: [
        [t('Troca de chaves', 'Key exchange'), t('curve25519-sha256', 'curve25519-sha256')],
        [t('Chave do host', 'Host key'), t('ssh-ed25519', 'ssh-ed25519')],
        [t('Cifra', 'Cipher'), t('chacha20-poly1305@openssh.com', 'chacha20-poly1305@openssh.com')],
        [t('Modo estrito', 'Strict mode'), t('kex-strict (contra o ataque Terrapin)', 'kex-strict (against the Terrapin attack)')],
      ],
      pacotes: [
        fluxo.cliente({
          proto: 'SSHv2',
          rotulo: t('KEXINIT', 'KEXINIT'),
          info: t('Cliente: Início da troca de chaves', 'Client: Key Exchange Init'),
          tipo: 'kex',
          resumo: t('kex: mlkem768x25519, curve25519 · cifra: chacha20-poly1305', 'kex: mlkem768x25519, curve25519 · cipher: chacha20-poly1305'),
          dt: 2,
          camada: 'SSH',
          carga: kexinit('c'),
        }),
        fluxo.servidor({
          proto: 'SSHv2',
          rotulo: t('KEXINIT', 'KEXINIT'),
          info: t('Servidor: Início da troca de chaves', 'Server: Key Exchange Init'),
          tipo: 'kex',
          resumo: t('kex: sntrup761x25519, curve25519 · host: ssh-ed25519', 'kex: sntrup761x25519, curve25519 · host: ssh-ed25519'),
          dt: 21,
          ttl: 54,
          camada: 'SSH',
          carga: kexinit('s'),
        }),
      ],
    },
    {
      titulo: t('Troca de chaves ECDH', 'ECDH key exchange'),
      resumo: t('Segredo comum e chave do host', 'Shared secret and host key'),
      descricao: t(
        'O cliente envia sua chave pública efêmera Curve25519. O servidor responde com a dele, com a chave do host e com uma assinatura sobre o resumo de toda a negociação. Os dois calculam o mesmo segredo sem nunca enviá-lo. O cliente confere a chave do host no ~/.ssh/known_hosts: se for a primeira vez, pergunta se você confia na impressão digital; se mudou, recusa a conexão. O NEWKEYS liga a criptografia.',
        "The client sends its ephemeral Curve25519 public key. The server answers with its own, its host key and a signature over a hash of the whole negotiation. Both compute the same secret without ever sending it. The client checks the host key against ~/.ssh/known_hosts: on first contact it asks whether you trust the fingerprint; if it changed, it refuses to connect. NEWKEYS switches encryption on.",
      ),
      fatos: [
        [t('Impressão digital', 'Fingerprint'), t('SHA256:3Vq…k8Y (exemplo)', 'SHA256:3Vq…k8Y (example)')],
        [t('Verificação', 'Verification'), t('~/.ssh/known_hosts', '~/.ssh/known_hosts')],
        [t('Assinatura', 'Signature'), t('Ed25519 sobre o hash H da troca', 'Ed25519 over the exchange hash H')],
        [t('Sigilo futuro', 'Forward secrecy'), t('Sim: chaves efêmeras', 'Yes: ephemeral keys')],
      ],
      pacotes: [
        fluxo.cliente({
          proto: 'SSHv2',
          rotulo: t('ECDH INIT', 'ECDH INIT'),
          info: t('Cliente: Início da troca Diffie-Hellman de curva elíptica', 'Client: Elliptic Curve Diffie-Hellman Key Exchange Init'),
          tipo: 'kex',
          resumo: t('Q_C: chave pública efêmera X25519 (32 bytes)', 'Q_C: ephemeral X25519 public key (32 bytes)'),
          dt: 1,
          camada: 'SSH',
          carga: binario('1e', 'SSH_MSG_KEX_ECDH_INIT (30)', t('A metade do cliente na troca de chaves.', "The client's half of the key exchange."), [
            hex(t('Tamanho de Q_C', 'Q_C length'), '00 00 00 20', '32 bytes'),
            opaco(t('Chave pública efêmera (Q_C)', 'Ephemeral public key (Q_C)'), 32, t('Nova a cada conexão, descartada no fim.', 'Fresh for every connection, thrown away at the end.')),
          ]),
        }),
        fluxo.servidor({
          proto: 'SSHv2',
          rotulo: t('ECDH REPLY', 'ECDH REPLY'),
          info: t('Servidor: Resposta da troca Diffie-Hellman de curva elíptica, Novas chaves', 'Server: Elliptic Curve Diffie-Hellman Key Exchange Reply, New Keys'),
          tipo: 'kex',
          resumo: t('K_S ssh-ed25519 + Q_S + assinatura, NEWKEYS', 'K_S ssh-ed25519 + Q_S + signature, NEWKEYS'),
          dt: 24,
          ttl: 54,
          camada: 'SSH',
          carga: [
            ...binario('1f', 'SSH_MSG_KEX_ECDH_REPLY (31)', t('A metade do servidor, com a prova de identidade.', "The server's half, with proof of identity."), [
              hex(t('Chave do host (K_S)', 'Host key (K_S)'), `00 00 00 33 00 00 00 0b ${ascii('ssh-ed25519')} 00 00 00 20`, 'ssh-ed25519', t('A chave permanente do servidor; o cliente a compara com o known_hosts.', "The server's long-term key; the client compares it to known_hosts.")),
              opaco(t('Chave pública Ed25519', 'Ed25519 public key'), 32),
              hex(t('Tamanho de Q_S', 'Q_S length'), '00 00 00 20', '32 bytes'),
              opaco(t('Chave pública efêmera (Q_S)', 'Ephemeral public key (Q_S)'), 32),
              hex(t('Assinatura', 'Signature'), `00 00 00 53 00 00 00 0b ${ascii('ssh-ed25519')} 00 00 00 40`, 'ssh-ed25519', t('Assina o hash de toda a troca: prova que o servidor tem a chave privada.', 'Signs the hash of the whole exchange: proves the server holds the private key.')),
              opaco(t('Assinatura Ed25519', 'Ed25519 signature'), 64),
            ]),
            ...binario('15', 'SSH_MSG_NEWKEYS (21)', t('A partir daqui, tudo do servidor vai cifrado.', 'From here on, everything from the server is encrypted.'), []),
          ],
        }),
        fluxo.cliente({
          proto: 'SSHv2',
          rotulo: t('NEWKEYS', 'NEWKEYS'),
          info: t('Cliente: Novas chaves', 'Client: New Keys'),
          tipo: 'kex',
          resumo: t('Liga a criptografia no sentido cliente → servidor', 'Turns on encryption client → server'),
          dt: 3,
          camada: 'SSH',
          carga: binario('15', 'SSH_MSG_NEWKEYS (21)', t('O último pacote em claro do cliente.', "The client's last cleartext packet."), []),
        }),
      ],
    },
    {
      titulo: t('Autenticação por chave', 'Public key login'),
      resumo: t('O usuário prova quem é', 'The user proves who they are'),
      descricao: t(
        'Já cifrado, o cliente pede o serviço ssh-userauth e oferece a chave pública do usuário deploy. O servidor procura essa chave no ~/.ssh/authorized_keys e, se achar, responde PK_OK. O cliente então assina o identificador da sessão com a chave privada, que nunca sai do notebook. Assinatura válida: USERAUTH_SUCCESS.',
        'Now encrypted, the client requests the ssh-userauth service and offers the public key of user deploy. The server looks it up in ~/.ssh/authorized_keys and, if found, answers PK_OK. The client then signs the session identifier with the private key, which never leaves the laptop. Valid signature: USERAUTH_SUCCESS.',
      ),
      fatos: [
        [t('Usuário', 'User'), t('deploy', 'deploy')],
        [t('Método', 'Method'), t('publickey (ssh-ed25519)', 'publickey (ssh-ed25519)')],
        [t('No servidor', 'On the server'), t('~/.ssh/authorized_keys', '~/.ssh/authorized_keys')],
        [t('Senha na rede', 'Password on the wire'), t('Nenhuma', 'None')],
      ],
      pacotes: [
        fluxo.cliente({ proto: 'SSHv2', rotulo: t('SERVICE REQUEST', 'SERVICE REQUEST'), info: infoCifrado('c', 24), tipo: 'auth', resumo: t('SERVICE_REQUEST ssh-userauth (cifrado)', 'SERVICE_REQUEST ssh-userauth (encrypted)'), dt: 1, camada: 'SSH', carga: cifrado(24) }),
        fluxo.servidor({ proto: 'SSHv2', rotulo: t('SERVICE ACCEPT', 'SERVICE ACCEPT'), info: infoCifrado('s', 24), tipo: 'auth', resumo: t('SERVICE_ACCEPT ssh-userauth (cifrado)', 'SERVICE_ACCEPT ssh-userauth (encrypted)'), dt: 22, ttl: 54, camada: 'SSH', carga: cifrado(24) }),
        fluxo.cliente({ proto: 'SSHv2', rotulo: t('OFERECE CHAVE', 'OFFER KEY'), info: infoCifrado('c', 120), tipo: 'auth', resumo: t('USERAUTH_REQUEST deploy publickey ssh-ed25519 (sem assinatura)', 'USERAUTH_REQUEST deploy publickey ssh-ed25519 (no signature)'), dt: 2, camada: 'SSH', carga: cifrado(120) }),
        fluxo.servidor({ proto: 'SSHv2', rotulo: t('PK_OK', 'PK_OK'), info: infoCifrado('s', 80), tipo: 'auth', resumo: t('USERAUTH_PK_OK: chave aceita, prove que é sua', 'USERAUTH_PK_OK: key accepted, prove it is yours'), dt: 23, ttl: 54, camada: 'SSH', carga: cifrado(80) }),
        fluxo.cliente({ proto: 'SSHv2', rotulo: t('ASSINATURA', 'SIGNATURE'), info: infoCifrado('c', 208), tipo: 'auth', resumo: t('USERAUTH_REQUEST com assinatura Ed25519', 'USERAUTH_REQUEST with Ed25519 signature'), dt: 2, camada: 'SSH', carga: cifrado(208) }),
        fluxo.servidor({ proto: 'SSHv2', rotulo: t('SUCESSO', 'SUCCESS'), info: infoCifrado('s', 16), tipo: 'auth', resumo: t('USERAUTH_SUCCESS', 'USERAUTH_SUCCESS'), dt: 25, ttl: 54, camada: 'SSH', carga: cifrado(16) }),
      ],
    },
    {
      titulo: t('Sessão e comandos', 'Session and commands'),
      resumo: t('Canal cifrado de ponta a ponta', 'End-to-end encrypted channel'),
      descricao: t(
        'O cliente abre um canal do tipo session e pede para executar um comando. Cada tecla, comando e linha de saída vira um pacote cifrado com seu próprio MAC. Na mesma conexão cabem vários canais ao mesmo tempo: terminal, cópia de arquivos (SFTP) e túneis de portas.',
        'The client opens a session channel and asks to run a command. Every keystroke, command and output line becomes an encrypted packet with its own MAC. One connection can carry many channels at once: terminal, file copy (SFTP) and port forwarding.',
      ),
      fatos: [
        [t('Canal', 'Channel'), t('session (nº 0)', 'session (#0)')],
        [t('Comando', 'Command'), t('uptime', 'uptime')],
        [t('Multiplexação', 'Multiplexing'), t('Shell, SFTP e túneis na mesma conexão', 'Shell, SFTP and tunnels on one connection')],
      ],
      pacotes: [
        fluxo.cliente({ proto: 'SSHv2', rotulo: t('ABRE CANAL', 'OPEN CHANNEL'), info: infoCifrado('c', 32), tipo: 'sessao', resumo: t('CHANNEL_OPEN session', 'CHANNEL_OPEN session'), dt: 2, camada: 'SSH', carga: cifrado(32) }),
        fluxo.servidor({ proto: 'SSHv2', rotulo: t('CONFIRMA', 'CONFIRM'), info: infoCifrado('s', 24), tipo: 'sessao', resumo: t('CHANNEL_OPEN_CONFIRMATION', 'CHANNEL_OPEN_CONFIRMATION'), dt: 22, ttl: 54, camada: 'SSH', carga: cifrado(24) }),
        fluxo.cliente({ proto: 'SSHv2', rotulo: t('EXEC uptime', 'EXEC uptime'), info: infoCifrado('c', 32), tipo: 'sessao', resumo: t('CHANNEL_REQUEST exec "uptime"', 'CHANNEL_REQUEST exec "uptime"'), dt: 1, camada: 'SSH', carga: cifrado(32) }),
        fluxo.servidor({ proto: 'SSHv2', rotulo: t('SAÍDA', 'OUTPUT'), info: infoCifrado('s', 80), tipo: 'sessao', resumo: t('CHANNEL_DATA: " 10:42:07 up 12 days, load average: 0.08"', 'CHANNEL_DATA: " 10:42:07 up 12 days, load average: 0.08"'), dt: 27, ttl: 54, camada: 'SSH', carga: cifrado(80) }),
      ],
    },
  ],
};
