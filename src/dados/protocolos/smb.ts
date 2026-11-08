import { hex, no, nos, opaco, t, texto } from '../base';
import { bytesDe, conversa } from '../conversa';
import type { Campo, Protocolo } from '../tipos';

const b = (v: number): string => v.toString(16).padStart(2, '0');
const le = (v: number, bytes: number): string => Array.from({ length: bytes }, (_, i) => b(Math.floor(v / 256 ** i) & 0xff)).join(' ');
const utf16 = (s: string): string => [...s].map((c) => `${b(c.charCodeAt(0) & 0xff)} ${b(c.charCodeAt(0) >> 8)}`).join(' ');

const SESSAO = 0x1c0000000011;
const COMANDOS: Record<number, string> = { 0: 'NEGOTIATE', 1: 'SESSION_SETUP', 3: 'TREE_CONNECT', 5: 'CREATE', 6: 'CLOSE', 8: 'READ' };

interface Cabecalho {
  readonly comando: number;
  readonly id: number;
  readonly resposta: boolean;
  readonly status?: 'mais';
  readonly arvore?: number;
  readonly sessao?: boolean;
  readonly assinado?: boolean;
}

const smb2 = (c: Cabecalho, corpo: Campo[]): Campo[] => {
  const tamanho = 64 + bytesDe(corpo);
  const flags = (c.resposta ? 1 : 0) | (c.assinado ? 8 : 0);
  return [
    hex(t('NetBIOS', 'NetBIOS'), `00 ${b(tamanho >> 16)} ${b((tamanho >> 8) & 0xff)} ${b(tamanho & 0xff)}`, `${tamanho} bytes`, t('Moldura de 4 bytes com o tamanho da mensagem SMB.', 'A 4-byte frame holding the SMB message length.')),
    hex(t('Protocolo', 'Protocol'), 'fe 53 4d 42', '\\xFESMB', t('A assinatura do SMB2 e SMB3.', 'The SMB2 and SMB3 signature.')),
    hex(t('Cabeçalho, crédito', 'Header, credit charge'), '40 00 01 00', '64 bytes, 1'),
    hex(
      t('Status', 'Status'),
      c.status === 'mais' ? '16 00 00 c0' : '00 00 00 00',
      c.status === 'mais' ? 'STATUS_MORE_PROCESSING_REQUIRED' : 'STATUS_SUCCESS',
      c.status === 'mais' ? t('Continua: falta mais uma ida e volta.', 'Not done: one more round trip needed.') : undefined,
    ),
    hex(t('Comando', 'Command'), le(c.comando, 2), `${COMANDOS[c.comando] ?? '?'} (${c.comando})`, t('O que esta mensagem pede ou responde.', 'What this message asks or answers.')),
    hex(t('Créditos', 'Credits'), c.resposta ? '20 00' : '1f 00', c.resposta ? '32' : '31', t('Controle de fluxo: quantos pedidos podem ficar pendentes.', 'Flow control: how many requests may be outstanding.')),
    hex(t('Flags', 'Flags'), le(flags, 4), [c.resposta ? 'Response' : 'Request', ...(c.assinado ? ['Signed'] : [])].join(', ')),
    hex(t('Próximo comando', 'Next command'), '00 00 00 00', '0', t('Sem comandos encadeados.', 'No chained commands.')),
    hex(t('ID da mensagem', 'Message ID'), le(c.id, 8), String(c.id), t('A resposta repete o número do pedido.', 'The response repeats the request number.')),
    hex(t('Reservado, árvore', 'Reserved, tree'), `00 00 00 00 ${le(c.arvore ?? 0, 4)}`, `Tree ID ${c.arvore ?? 0}`, t('Qual compartilhamento conectado esta mensagem usa.', 'Which connected share this message uses.')),
    hex(t('ID da sessão', 'Session ID'), le(c.sessao ? SESSAO : 0, 8), c.sessao ? '0x00001c0000000011' : '0', t('Dado pelo servidor no login.', 'Assigned by the server at login.'), true),
    c.assinado
      ? opaco(t('Assinatura', 'Signature'), 16, t('AES-CMAC da mensagem: impede alterações no caminho.', 'AES-CMAC of the message: stops tampering on the way.'))
      : hex(t('Assinatura', 'Signature'), le(0, 16), '0', t('Ainda não há chave de sessão.', 'There is no session key yet.')),
    ...corpo,
  ];
};

const c = conversa({ id: 'cliente', porta: 49833 }, { id: 'arquivos', porta: 445 });
const COMPARTILHAMENTO = '\\\\servidor\\docs';
const ARQUIVO = 'relatorio.xlsx';
const FILE_ID = '1d 00 00 00 08 00 00 00 41 00 00 00 08 00 00 00';

export const smb: Protocolo = {
  id: 'smb',
  sigla: 'SMB',
  nome: t('Server Message Block', 'Server Message Block'),
  resumo: t('Compartilhamento de arquivos do Windows', 'Windows file sharing'),
  categoria: 'aplicacao',
  camada: 7,
  descricao: t(
    'O SMB é o que está por trás das pastas de rede do Windows, do \\\\servidor\\pasta. O cliente negocia a versão, faz login, conecta num compartilhamento e então abre, lê e fecha arquivos como se fossem locais. Cada operação é uma mensagem binária com um cabeçalho fixo de 64 bytes.',
    'SMB is what powers Windows network folders, the \\\\server\\share paths. The client negotiates a version, logs in, connects to a share and then opens, reads and closes files as if they were local. Every operation is a binary message with a fixed 64-byte header.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Porta', 'Port'), t('TCP 445', 'TCP 445')],
    [t('Transporte', 'Transport'), t('TCP (ou QUIC no SMB 3.1.1)', 'TCP (or QUIC with SMB 3.1.1)')],
    [t('Formato', 'Data format'), t('Binário, cabeçalho de 64 bytes', 'Binary, 64-byte header')],
    [t('Segurança', 'Security'), t('Assinatura AES-CMAC, cifra AES-GCM', 'AES-CMAC signing, AES-GCM encryption')],
    [t('Definido em', 'Defined in'), t('MS-SMB2 (Microsoft)', 'MS-SMB2 (Microsoft)')],
  ],
  legenda: {
    tcp: { nome: t('TCP', 'TCP'), cor: 'oliva' },
    sessao: { nome: t('Negociação e login', 'Negotiate and login'), cor: 'anil' },
    pedido: { nome: t('Pedido', 'Request'), cor: 'ouro' },
    resposta: { nome: t('Resposta', 'Response'), cor: 'brasa' },
  },
  observacao: t('Rede local, sem roteador no caminho', 'Local network, no router in between'),
  nos: [nos.cliente(18, 70), no('arquivos', 'armazenamento', t('Servidor de arquivos', 'File server'), 78, 32, '192.168.1.20')],
  ligacoes: [['cliente', 'arquivos']],
  faixas: ['cliente', 'arquivos'],
  passos: [
    {
      titulo: t('Conexão', 'Connect'),
      resumo: t('TCP na porta 445', 'TCP on port 445'),
      descricao: t(
        'O Windows abre uma conexão TCP direto na porta 445 do servidor de arquivos, na mesma rede. O antigo NetBIOS sobre as portas 137 a 139 ficou para trás; dele sobrou só a moldura de 4 bytes com o tamanho de cada mensagem.',
        'Windows opens a TCP connection straight to port 445 on the file server, on the same network. The old NetBIOS over ports 137 to 139 is gone; all that remains is the 4-byte frame holding each message length.',
      ),
      fatos: [
        [t('Servidor', 'Server'), t('192.168.1.20:445', '192.168.1.20:445')],
        [t('Caminho', 'Path'), t(COMPARTILHAMENTO, COMPARTILHAMENTO)],
        [t('Mesma rede', 'Same network'), t('Sim, sem roteador no caminho', 'Yes, no router in between')],
      ],
      pacotes: c.abrir('tcp', [0, 1, 1]),
    },
    {
      titulo: t('NEGOTIATE', 'NEGOTIATE'),
      resumo: t('Combinam a versão do SMB', 'They agree on the SMB version'),
      descricao: t(
        'O cliente lista os dialetos que conhece, do SMB 2.0.2 ao 3.1.1, e as preferências de segurança. O servidor escolhe o mais novo em comum, 3.1.1, que traz verificação de integridade antes do login e cifra AES-GCM.',
        'The client lists the dialects it knows, from SMB 2.0.2 to 3.1.1, plus its security preferences. The server picks the newest one in common, 3.1.1, which brings pre-auth integrity checks and AES-GCM encryption.',
      ),
      fatos: [
        [t('Dialetos oferecidos', 'Dialects offered'), t('2.0.2, 2.1, 3.1.1', '2.0.2, 2.1, 3.1.1')],
        [t('Escolhido', 'Selected'), t('3.1.1', '3.1.1')],
        [t('Integridade', 'Integrity'), t('SHA-512 sobre a negociação', 'SHA-512 over the negotiation')],
      ],
      pacotes: [
        c.cliente({
          proto: 'SMB2',
          rotulo: t('NEGOTIATE', 'NEGOTIATE'),
          info: t('Negotiate Protocol Request', 'Negotiate Protocol Request'),
          tipo: 'sessao',
          resumo: t('Dialetos 2.0.2, 2.1, 3.1.1', 'Dialects 2.0.2, 2.1, 3.1.1'),
          dt: 1,
          carga: smb2({ comando: 0, id: 0, resposta: false }, [
            hex(t('Tamanho, dialetos', 'Size, dialects'), '24 00 03 00', '36, 3'),
            hex(t('Modo de segurança', 'Security mode'), '01 00', 'signing enabled', t('Sabe assinar, mas não exige.', 'Can sign, does not require it.')),
            hex(t('Capacidades', 'Capabilities'), '00 00 7f 00 00 00', 'DFS, Leasing, Large MTU, Multi-channel, Encryption'),
            opaco(t('GUID do cliente', 'Client GUID'), 16, t('Identifica este computador.', 'Identifies this computer.')),
            hex(t('Contextos', 'Contexts'), '68 00 00 00 03 00 00 00', '3'),
            hex(t('Dialetos', 'Dialects'), '02 02 10 02 11 03', '2.0.2, 2.1, 3.1.1', t('Do mais antigo ao mais novo.', 'From oldest to newest.')),
            opaco(t('Contextos de negociação', 'Negotiate contexts'), 66, t('SHA-512 com sal aleatório, cifras AES-128/256-GCM e assinatura.', 'SHA-512 with a random salt, AES-128/256-GCM ciphers and signing.')),
          ]),
        }),
        c.servidor({
          proto: 'SMB2',
          rotulo: t('NEGOTIATE OK', 'NEGOTIATE OK'),
          info: t('Negotiate Protocol Response, Dialect 3.1.1', 'Negotiate Protocol Response, Dialect 3.1.1'),
          tipo: 'sessao',
          resumo: t('SMB 3.1.1, AES-128-GCM', 'SMB 3.1.1, AES-128-GCM'),
          dt: 1,
          carga: smb2({ comando: 0, id: 0, resposta: true }, [
            hex(t('Tamanho, modo', 'Size, mode'), '41 00 01 00', '65, signing enabled'),
            hex(t('Dialeto', 'Dialect'), '11 03', '3.1.1', t('A versão escolhida pelo servidor.', 'The version chosen by the server.')),
            hex(t('Contextos', 'Contexts'), '02 00', '2'),
            opaco(t('GUID do servidor', 'Server GUID'), 16),
            hex(t('Limites', 'Limits'), '00 00 80 00 00 00 80 00 00 00 80 00', '8 MB', t('Maior transação, leitura e escrita aceitas.', 'Largest transaction, read and write accepted.')),
            opaco(t('Hora do sistema', 'System time'), 8),
            opaco(t('Blob de segurança (SPNEGO)', 'Security blob (SPNEGO)'), 74, t('Métodos de login aceitos: Kerberos e NTLM.', 'Accepted login methods: Kerberos and NTLM.')),
            opaco(t('Contextos de negociação', 'Negotiate contexts'), 58, t('O sal do servidor e a cifra escolhida.', 'The server salt and the chosen cipher.')),
          ]),
        }),
      ],
    },
    {
      titulo: t('SESSION_SETUP', 'SESSION_SETUP'),
      resumo: t('Login com NTLM', 'Login with NTLM'),
      descricao: t(
        'Fora de um domínio, o login usa NTLM em três mensagens: o cliente se anuncia, o servidor manda um desafio aleatório e o cliente devolve uma resposta calculada com o hash da senha. A senha nunca trafega. Num domínio, o Kerberos entra no lugar com um tíquete. No fim, o servidor dá o ID da sessão e as mensagens passam a ser assinadas.',
        'Outside a domain, login uses NTLM in three messages: the client announces itself, the server sends a random challenge and the client returns a response computed with the password hash. The password never travels. In a domain, Kerberos takes over with a ticket. At the end the server assigns the session ID and messages become signed.',
      ),
      fatos: [
        [t('Método', 'Method'), t('NTLMv2 (Kerberos em domínio)', 'NTLMv2 (Kerberos in a domain)')],
        [t('Usuário', 'User'), t('ana', 'ana')],
        [t('ID da sessão', 'Session ID'), t('0x00001c0000000011', '0x00001c0000000011')],
        [t('Depois do login', 'After login'), t('Mensagens assinadas', 'Messages signed')],
      ],
      pacotes: [
        c.cliente({
          proto: 'SMB2',
          rotulo: t('NTLM NEGOTIATE', 'NTLM NEGOTIATE'),
          info: t('Session Setup Request, NTLMSSP_NEGOTIATE', 'Session Setup Request, NTLMSSP_NEGOTIATE'),
          tipo: 'sessao',
          resumo: t('NTLMSSP_NEGOTIATE', 'NTLMSSP_NEGOTIATE'),
          dt: 1,
          carga: smb2({ comando: 1, id: 1, resposta: false }, [
            hex(t('Parâmetros', 'Parameters'), '19 00 00 01 01 00 00 00 00 00 00 00 58 00 4a 00 00 00 00 00 00 00 00 00', '25, signing, buffer 74 bytes'),
            opaco(t('Embrulho SPNEGO', 'SPNEGO wrapper'), 26),
            texto(t('Assinatura NTLMSSP', 'NTLMSSP signature'), 'NTLMSSP\u0000', t('Visível no meio dos bytes: é o NTLM.', 'Visible among the bytes: it is NTLM.')),
            hex(t('Tipo NTLM', 'NTLM type'), '01 00 00 00', 'NEGOTIATE (1)'),
            opaco(t('Flags e versão', 'Flags and version'), 36),
          ]),
        }),
        c.servidor({
          proto: 'SMB2',
          rotulo: t('NTLM CHALLENGE', 'NTLM CHALLENGE'),
          info: t('Session Setup Response, Error: STATUS_MORE_PROCESSING_REQUIRED, NTLMSSP_CHALLENGE', 'Session Setup Response, Error: STATUS_MORE_PROCESSING_REQUIRED, NTLMSSP_CHALLENGE'),
          tipo: 'sessao',
          resumo: t('Desafio de 8 bytes', '8-byte challenge'),
          dt: 1,
          carga: smb2({ comando: 1, id: 1, resposta: true, status: 'mais', sessao: true }, [
            hex(t('Parâmetros', 'Parameters'), '09 00 00 00 48 00 d4 00', '9, buffer 212 bytes'),
            opaco(t('Embrulho SPNEGO', 'SPNEGO wrapper'), 24),
            texto(t('Assinatura NTLMSSP', 'NTLMSSP signature'), 'NTLMSSP\u0000'),
            hex(t('Tipo NTLM', 'NTLM type'), '02 00 00 00', 'CHALLENGE (2)'),
            opaco(t('Desafio do servidor', 'Server challenge'), 8, t('8 bytes aleatórios que o cliente terá de "assinar" com o hash da senha.', '8 random bytes the client must "sign" with the password hash.')),
            opaco(t('Informações do alvo', 'Target info'), 168, t('Nome do servidor, domínio e hora.', 'Server name, domain and time.')),
          ]),
        }),
        c.cliente({
          proto: 'SMB2',
          rotulo: t('NTLM AUTH', 'NTLM AUTH'),
          info: t('Session Setup Request, NTLMSSP_AUTH, User: \\ana', 'Session Setup Request, NTLMSSP_AUTH, User: \\ana'),
          tipo: 'sessao',
          resumo: t('Resposta NTLMv2 do usuário ana', 'NTLMv2 response for user ana'),
          dt: 2,
          carga: smb2({ comando: 1, id: 2, resposta: false, sessao: true }, [
            hex(t('Parâmetros', 'Parameters'), '19 00 00 01 01 00 00 00 00 00 00 00 58 00 9a 01 00 00 00 00 00 00 00 00', '25, buffer 410 bytes'),
            opaco(t('Embrulho SPNEGO', 'SPNEGO wrapper'), 28),
            texto(t('Assinatura NTLMSSP', 'NTLMSSP signature'), 'NTLMSSP\u0000'),
            hex(t('Tipo NTLM', 'NTLM type'), '03 00 00 00', 'AUTHENTICATE (3)'),
            hex(t('Usuário', 'User'), utf16('ana'), 'ana (UTF-16)', t('O nome vai legível; a senha, não.', 'The name is readable; the password is not.')),
            opaco(t('Resposta NTLMv2', 'NTLMv2 response'), 340, t('HMAC do desafio com o hash da senha: prova que sabe a senha.', 'HMAC of the challenge with the password hash: proves knowledge of the password.')),
            opaco(t('Chave de sessão cifrada', 'Encrypted session key'), 16),
          ]),
        }),
        c.servidor({
          proto: 'SMB2',
          rotulo: t('SESSION OK', 'SESSION OK'),
          info: t('Session Setup Response', 'Session Setup Response'),
          tipo: 'sessao',
          resumo: t('Logado, sessão 0x...0011', 'Logged in, session 0x...0011'),
          dt: 4,
          carga: smb2({ comando: 1, id: 2, resposta: true, sessao: true, assinado: true }, [
            hex(t('Parâmetros', 'Parameters'), '09 00 00 00 48 00 1d 00', '9, buffer 29 bytes'),
            opaco(t('SPNEGO: aceito', 'SPNEGO: accepted'), 29, t('accept-completed: login concluído.', 'accept-completed: login done.')),
          ]),
        }),
      ],
    },
    {
      titulo: t('TREE_CONNECT', 'TREE_CONNECT'),
      resumo: t(`Conecta em ${COMPARTILHAMENTO}`, `Connects to ${COMPARTILHAMENTO}`),
      descricao: t(
        'Logado, o cliente pede acesso ao compartilhamento docs. O caminho vai em UTF-16, como tudo de texto no SMB. O servidor confere as permissões, responde com o Tree ID 1 e diz quais direitos a ana tem ali.',
        'Logged in, the client asks for the docs share. The path is UTF-16, like all text in SMB. The server checks permissions, answers with Tree ID 1 and states which rights ana has there.',
      ),
      fatos: [
        [t('Compartilhamento', 'Share'), t(COMPARTILHAMENTO, COMPARTILHAMENTO)],
        [t('Tipo', 'Type'), t('Disco', 'Disk')],
        [t('Tree ID', 'Tree ID'), t('1', '1')],
      ],
      pacotes: [
        c.cliente({
          proto: 'SMB2',
          rotulo: t('TREE CONNECT', 'TREE CONNECT'),
          info: t(`Tree Connect Request Tree: ${COMPARTILHAMENTO}`, `Tree Connect Request Tree: ${COMPARTILHAMENTO}`),
          tipo: 'pedido',
          resumo: t(COMPARTILHAMENTO, COMPARTILHAMENTO),
          dt: 1,
          carga: smb2({ comando: 3, id: 3, resposta: false, sessao: true, assinado: true }, [
            hex(t('Parâmetros', 'Parameters'), `09 00 00 00 48 00 ${le(COMPARTILHAMENTO.length * 2, 2)}`, `9, path ${COMPARTILHAMENTO.length * 2} bytes`),
            hex(t('Caminho', 'Path'), utf16(COMPARTILHAMENTO), COMPARTILHAMENTO, t('Servidor e compartilhamento, em UTF-16.', 'Server and share, in UTF-16.')),
          ]),
        }),
        c.servidor({
          proto: 'SMB2',
          rotulo: t('TREE OK', 'TREE OK'),
          info: t('Tree Connect Response', 'Tree Connect Response'),
          tipo: 'resposta',
          resumo: t('Tree ID 1, disco', 'Tree ID 1, disk'),
          dt: 1,
          carga: smb2({ comando: 3, id: 3, resposta: true, sessao: true, assinado: true, arvore: 1 }, [
            hex(t('Tamanho, tipo', 'Size, type'), '10 00 01 00', '16, DISK'),
            hex(t('Flags, capacidades', 'Flags, capabilities'), '00 00 00 00 00 00 00 00', '0'),
            hex(t('Acesso máximo', 'Maximal access'), 'ff 01 1f 00', 'FULL_CONTROL', t('O que esta usuária pode fazer aqui.', 'What this user may do here.')),
          ]),
        }),
      ],
    },
    {
      titulo: t('CREATE e READ', 'CREATE and READ'),
      resumo: t('Abre e lê o arquivo', 'Opens and reads the file'),
      descricao: t(
        'Apesar do nome, CREATE também abre arquivos existentes: aqui pede só leitura de relatorio.xlsx. O servidor devolve um FileId e o tamanho. Com ele, READ pede até 64 KB a partir do byte 0, e a resposta chega em vários segmentos TCP.',
        'Despite the name, CREATE also opens existing files: here it asks for read-only access to relatorio.xlsx. The server returns a FileId and the size. With it, READ asks for up to 64 KB from byte 0, and the reply arrives over several TCP segments.',
      ),
      fatos: [
        [t('Arquivo', 'File'), t(ARQUIVO, ARQUIVO)],
        [t('Acesso', 'Access'), t('GENERIC_READ, FILE_OPEN', 'GENERIC_READ, FILE_OPEN')],
        [t('Tamanho', 'Size'), t('20.480 bytes', '20,480 bytes')],
        [t('Leitura', 'Read'), t('65.536 bytes a partir do 0', '65,536 bytes from offset 0')],
      ],
      pacotes: [
        c.cliente({
          proto: 'SMB2',
          rotulo: t('CREATE', 'CREATE'),
          info: t(`Create Request File: ${ARQUIVO}`, `Create Request File: ${ARQUIVO}`),
          tipo: 'pedido',
          resumo: t(`Abrir ${ARQUIVO} para leitura`, `Open ${ARQUIVO} for reading`),
          dt: 3,
          carga: smb2({ comando: 5, id: 4, resposta: false, sessao: true, assinado: true, arvore: 1 }, [
            hex(t('Tamanho', 'Size'), '39 00', '57'),
            hex(t('Acesso desejado', 'Desired access'), '89 00 12 00', 'GENERIC_READ', t('Só leitura.', 'Read only.')),
            hex(t('Compartilhamento', 'Share access'), '07 00 00 00', 'READ, WRITE, DELETE', t('O que outros podem fazer enquanto está aberto.', 'What others may do while it is open.')),
            hex(t('Disposição', 'Disposition'), '01 00 00 00', 'FILE_OPEN', t('Abrir; falhar se não existir.', 'Open; fail if missing.')),
            hex(t('Nome', 'Name'), utf16(ARQUIVO), ARQUIVO, t('Relativo ao compartilhamento, em UTF-16.', 'Relative to the share, in UTF-16.')),
          ]),
        }),
        c.servidor({
          proto: 'SMB2',
          rotulo: t('CREATE OK', 'CREATE OK'),
          info: t(`Create Response File: ${ARQUIVO}`, `Create Response File: ${ARQUIVO}`),
          tipo: 'resposta',
          resumo: t('FileId e tamanho 20.480 B', 'FileId and size 20,480 B'),
          dt: 1,
          carga: smb2({ comando: 5, id: 4, resposta: true, sessao: true, assinado: true, arvore: 1 }, [
            hex(t('Tamanho, ação', 'Size, action'), '59 00 00 00 01 00 00 00', '89, FILE_OPENED'),
            opaco(t('Datas', 'Timestamps'), 32, t('Criação, acesso, escrita e mudança.', 'Creation, access, write and change.')),
            hex(t('Tamanho do arquivo', 'End of file'), le(20480, 8), '20480 bytes'),
            hex(t('FileId', 'FileId'), FILE_ID, '0x0000001d', t('O identificador usado nos próximos comandos.', 'The handle used in the next commands.'), true),
          ]),
        }),
        c.cliente({
          proto: 'SMB2',
          rotulo: t('READ', 'READ'),
          info: t(`Read Request Len:65536 Off:0 File: ${ARQUIVO}`, `Read Request Len:65536 Off:0 File: ${ARQUIVO}`),
          tipo: 'pedido',
          resumo: t('Ler 64 KB do byte 0', 'Read 64 KB from byte 0'),
          dt: 1,
          carga: smb2({ comando: 8, id: 5, resposta: false, sessao: true, assinado: true, arvore: 1 }, [
            hex(t('Tamanho, preenchimento', 'Size, padding'), '31 00 50 00', '49, 80'),
            hex(t('Comprimento', 'Length'), le(65536, 4), '65536 bytes'),
            hex(t('Posição', 'Offset'), le(0, 8), '0'),
            hex(t('FileId', 'FileId'), FILE_ID, '0x0000001d'),
            hex(t('Mínimo, canal, restante', 'Minimum, channel, remaining'), '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00', '0'),
          ]),
        }),
        c.servidor({
          proto: 'SMB2',
          rotulo: t('READ OK', 'READ OK'),
          info: t('Read Response, 20480 bytes', 'Read Response, 20480 bytes'),
          tipo: 'resposta',
          resumo: t('PK… (o .xlsx é um zip)', 'PK… (an .xlsx is a zip)'),
          nota: t('+13 SEGMENTOS', '+13 SEGMENTS'),
          dt: 2,
          carga: smb2({ comando: 8, id: 5, resposta: true, sessao: true, assinado: true, arvore: 1 }, [
            hex(t('Tamanho, deslocamento', 'Size, offset'), '11 00 50 00', '17, 80'),
            hex(t('Bytes lidos', 'Data length'), le(20480, 4), '20480 bytes'),
            hex(t('Restante', 'Remaining'), '00 00 00 00 00 00 00 00', '0'),
            hex(t('Início do arquivo', 'File start'), '50 4b 03 04', 'PK\\x03\\x04', t('Todo .xlsx é um arquivo zip por dentro.', 'Every .xlsx is a zip file inside.')),
            opaco(t('Conteúdo', 'Contents'), 1300, t('O começo do arquivo; o resto vem nos próximos segmentos.', 'The start of the file; the rest follows in the next segments.')),
          ]),
        }),
      ],
    },
    {
      titulo: t('CLOSE', 'CLOSE'),
      resumo: t('Libera o arquivo', 'Releases the file'),
      descricao: t(
        'Com os bytes em mãos, o cliente fecha o FileId para o servidor liberar o arquivo a outras pessoas. A sessão e o compartilhamento continuam abertos para os próximos acessos; só caem com LOGOFF ou depois de um tempo parados.',
        'With the bytes in hand, the client closes the FileId so the server releases the file to others. The session and share stay open for future access; they end with LOGOFF or after some idle time.',
      ),
      fatos: [
        [t('FileId', 'FileId'), t('0x0000001d, fechado', '0x0000001d, closed')],
        [t('Sessão', 'Session'), t('Continua aberta', 'Stays open')],
      ],
      pacotes: [
        c.cliente({
          proto: 'SMB2',
          rotulo: t('CLOSE', 'CLOSE'),
          info: t(`Close Request File: ${ARQUIVO}`, `Close Request File: ${ARQUIVO}`),
          tipo: 'pedido',
          resumo: t(`Fechar ${ARQUIVO}`, `Close ${ARQUIVO}`),
          dt: 6,
          carga: smb2({ comando: 6, id: 6, resposta: false, sessao: true, assinado: true, arvore: 1 }, [
            hex(t('Tamanho, flags', 'Size, flags'), '18 00 00 00 00 00 00 00', '24, 0'),
            hex(t('FileId', 'FileId'), FILE_ID, '0x0000001d'),
          ]),
        }),
        c.servidor({
          proto: 'SMB2',
          rotulo: t('CLOSE OK', 'CLOSE OK'),
          info: t(`Close Response File: ${ARQUIVO}`, `Close Response File: ${ARQUIVO}`),
          tipo: 'resposta',
          resumo: t('Arquivo liberado', 'File released'),
          dt: 1,
          carga: smb2({ comando: 6, id: 6, resposta: true, sessao: true, assinado: true, arvore: 1 }, [
            hex(t('Tamanho, flags', 'Size, flags'), '3c 00 00 00 00 00 00 00', '60, 0'),
            opaco(t('Datas e atributos', 'Timestamps and attributes'), 52),
          ]),
        }),
      ],
    },
  ],
};
