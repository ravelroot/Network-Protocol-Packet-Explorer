import { no, nos, opaco, t, texto } from '../base';
import { conversa } from '../conversa';
import type { Protocolo } from '../tipos';

const c = conversa({ id: 'cliente', porta: 52610 }, { id: 'mail', porta: 143, ttl: 54 });

export const imap: Protocolo = {
  id: 'imap',
  sigla: 'IMAP',
  nome: t('Internet Message Access Protocol', 'Internet Message Access Protocol'),
  resumo: t('Internet Message Access', 'Internet Message Access'),
  categoria: 'aplicacao',
  camada: 7,
  descricao: t(
    'Com IMAP o e-mail mora no servidor, e cada aparelho só vê e mexe nas mesmas pastas. Lido no celular aparece lido no notebook. Cada comando leva uma etiqueta (a001, a002...), então o cliente pode mandar vários e casar cada resposta pela etiqueta; respostas com * são avisos do servidor.',
    'With IMAP, e-mail lives on the server and every device just views and changes the same folders. Read on the phone shows as read on the laptop. Every command carries a tag (a001, a002...), so the client can send several and match each reply by tag; lines starting with * are server updates.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Portas', 'Ports'), t('143 (texto/STARTTLS), 993 (TLS)', '143 (plain/STARTTLS), 993 (TLS)')],
    [t('Transporte', 'Transport'), t('TCP', 'TCP')],
    [t('Modelo', 'Model'), t('Mensagens ficam no servidor', 'Messages stay on the server')],
    [t('Tempo real', 'Real time'), t('IDLE (o servidor avisa)', 'IDLE (the server pushes)')],
    [t('Definido em', 'Defined in'), t('RFC 9051 (IMAP4rev2), RFC 2177', 'RFC 9051 (IMAP4rev2), RFC 2177')],
  ],
  legenda: {
    tcp: { nome: t('TCP', 'TCP'), cor: 'oliva' },
    comando: { nome: t('Comando', 'Command'), cor: 'ouro' },
    resposta: { nome: t('Resposta', 'Response'), cor: 'brasa' },
    aviso: { nome: t('Aviso do servidor', 'Server push'), cor: 'anil' },
  },
  observacao: t('Porta 143 para mostrar o texto; use 993 na prática', 'Port 143 to show the text; use 993 in practice'),
  nos: [nos.cliente(16, 70), nos.roteador(40, 56), nos.internet(64, 72), no('mail', 'email', t('Servidor de e-mail', 'Mail server'), 86, 30, '203.0.113.25')],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'mail'],
  ],
  faixas: ['cliente', 'mail'],
  passos: [
    {
      titulo: t('Conexão', 'Connect'),
      resumo: t('O servidor lista o que suporta', 'The server lists what it supports'),
      descricao: t(
        'Aberta a conexão TCP, o servidor cumprimenta com * OK e já informa as capacidades: IMAP4rev2, STARTTLS, os métodos de login e IDLE. O cliente usa essa lista para decidir como continuar.',
        'Once TCP is up, the server greets with * OK and already lists its capabilities: IMAP4rev2, STARTTLS, the login methods and IDLE. The client uses that list to decide how to go on.',
      ),
      fatos: [
        [t('Servidor', 'Server'), t('mail.example.com:143', 'mail.example.com:143')],
        [t('Capacidades', 'Capabilities'), t('IMAP4rev2, STARTTLS, AUTH=PLAIN, IDLE', 'IMAP4rev2, STARTTLS, AUTH=PLAIN, IDLE')],
        [t('Estado', 'State'), t('Não autenticado', 'Not authenticated')],
      ],
      pacotes: [
        ...c.abrir('tcp'),
        c.servidor({
          proto: 'IMAP',
          rotulo: t('* OK', '* OK'),
          info: t('S: * OK [CAPABILITY IMAP4rev2 STARTTLS AUTH=PLAIN IDLE] ready', 'S: * OK [CAPABILITY IMAP4rev2 STARTTLS AUTH=PLAIN IDLE] ready'),
          tipo: 'aviso',
          resumo: t('* OK pronto, com capacidades', '* OK ready, with capabilities'),
          dt: 25,
          carga: [
            texto(
              t('Saudação', 'Greeting'),
              '* OK [CAPABILITY IMAP4rev2 STARTTLS AUTH=PLAIN IDLE] mail.example.com ready\r\n',
              t('O * marca uma resposta sem etiqueta: aviso do servidor.', 'The * marks an untagged response: a server notice.'),
            ),
          ],
        }),
      ],
    },
    {
      titulo: t('Login', 'Login'),
      resumo: t('Comando com etiqueta a001', 'Command tagged a001'),
      descricao: t(
        'O cliente envia a001 LOGIN com usuário e senha. A resposta final repete a etiqueta: a001 OK. Na porta 143 sem STARTTLS a senha passa legível, por isso os programas de e-mail usam a 993, com TLS desde o primeiro byte.',
        'The client sends a001 LOGIN with username and password. The final reply repeats the tag: a001 OK. On port 143 without STARTTLS the password is readable, which is why mail apps use port 993, with TLS from the first byte.',
      ),
      fatos: [
        [t('Etiqueta', 'Tag'), t('a001', 'a001')],
        [t('Alternativa', 'Alternative'), t('AUTHENTICATE PLAIN / XOAUTH2', 'AUTHENTICATE PLAIN / XOAUTH2')],
        [t('Estado', 'State'), t('Autenticado', 'Authenticated')],
      ],
      pacotes: [
        c.cliente({
          proto: 'IMAP',
          rotulo: t('a001 LOGIN', 'a001 LOGIN'),
          info: t('C: a001 LOGIN ana ********', 'C: a001 LOGIN ana ********'),
          tipo: 'comando',
          resumo: t('a001 LOGIN ana correto-cavalo', 'a001 LOGIN ana correto-cavalo'),
          nota: t('SENHA VISÍVEL', 'PASSWORD VISIBLE'),
          dt: 3,
          carga: [
            texto(t('Etiqueta', 'Tag'), 'a001 ', t('Identifica este comando na resposta.', 'Identifies this command in the reply.')),
            texto(t('Comando', 'Command'), 'LOGIN ana correto-cavalo\r\n', t('Usuário e senha em texto aberto.', 'Username and password in plain text.')),
          ],
        }),
        c.servidor({
          proto: 'IMAP',
          rotulo: t('a001 OK', 'a001 OK'),
          info: t('S: a001 OK Logged in', 'S: a001 OK Logged in'),
          tipo: 'resposta',
          resumo: t('a001 OK autenticado', 'a001 OK logged in'),
          dt: 41,
          carga: [texto(t('Resposta', 'Reply'), 'a001 OK Logged in\r\n', t('A etiqueta casa com o pedido.', 'The tag matches the request.'))],
        }),
      ],
    },
    {
      titulo: t('Abrir a caixa', 'Open the mailbox'),
      resumo: t('SELECT INBOX', 'SELECT INBOX'),
      descricao: t(
        'SELECT INBOX abre a caixa de entrada. Antes do OK final vêm vários avisos com *: quantas mensagens existem, qual a primeira não lida, as flags possíveis e o UIDVALIDITY, que permite ao cliente reaproveitar o que já tem em cache.',
        'SELECT INBOX opens the inbox. Before the final OK come several * notices: how many messages exist, the first unseen one, the possible flags and the UIDVALIDITY, which lets the client reuse its cache.',
      ),
      fatos: [
        [t('Mensagens', 'Messages'), t('12', '12')],
        [t('Primeira não lida', 'First unseen'), t('11', '11')],
        [t('Modo', 'Mode'), t('READ-WRITE', 'READ-WRITE')],
      ],
      pacotes: [
        c.cliente({
          proto: 'IMAP',
          rotulo: t('a002 SELECT', 'a002 SELECT'),
          info: t('C: a002 SELECT INBOX', 'C: a002 SELECT INBOX'),
          tipo: 'comando',
          resumo: t('a002 SELECT INBOX', 'a002 SELECT INBOX'),
          dt: 3,
          carga: [texto(t('Comando', 'Command'), 'a002 SELECT INBOX\r\n', t('Abre a caixa de entrada para leitura e escrita.', 'Opens the inbox for reading and writing.'))],
        }),
        c.servidor({
          proto: 'IMAP',
          rotulo: t('a002 OK', 'a002 OK'),
          info: t('S: * 12 EXISTS | * OK [UNSEEN 11] | a002 OK [READ-WRITE]', 'S: * 12 EXISTS | * OK [UNSEEN 11] | a002 OK [READ-WRITE]'),
          tipo: 'resposta',
          resumo: t('12 mensagens, não lida a partir da 11', '12 messages, unseen from 11'),
          dt: 22,
          carga: [
            texto(t('Existentes', 'Exists'), '* 12 EXISTS\r\n', t('Total de mensagens na caixa.', 'Total messages in the mailbox.')),
            texto(t('Flags', 'Flags'), '* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)\r\n', t('As marcas que podem ser usadas.', 'The flags that may be used.')),
            texto(t('Não lida', 'Unseen'), '* OK [UNSEEN 11] First unseen\r\n'),
            texto(t('Validade dos UIDs', 'UID validity'), '* OK [UIDVALIDITY 1730900000] UIDs valid\r\n', t('Se mudar, o cache local deve ser descartado.', 'If it changes, the local cache must be dropped.')),
            texto(t('Conclusão', 'Completion'), 'a002 OK [READ-WRITE] SELECT completed\r\n'),
          ],
        }),
      ],
    },
    {
      titulo: t('Ler e marcar', 'Read and flag'),
      resumo: t('FETCH e STORE \\Seen', 'FETCH and STORE \\Seen'),
      descricao: t(
        'O cliente busca a mensagem 12 com BODY.PEEK[], que não altera nada. Depois que você a abre, ele grava a flag \\Seen com STORE. Como a flag fica no servidor, o celular e o webmail também passam a mostrá-la como lida.',
        'The client fetches message 12 with BODY.PEEK[], which changes nothing. Once you open it, the client sets the \\Seen flag with STORE. Since the flag lives on the server, the phone and webmail show it as read too.',
      ),
      fatos: [
        [t('Busca', 'Fetch'), t('BODY.PEEK[] (não marca como lida)', 'BODY.PEEK[] (does not mark as read)')],
        [t('Tamanho', 'Size'), t('1.200 bytes', '1,200 bytes')],
        [t('Flag', 'Flag'), t('\\Seen, salva no servidor', '\\Seen, stored on the server')],
      ],
      pacotes: [
        c.cliente({
          proto: 'IMAP',
          rotulo: t('a003 FETCH', 'a003 FETCH'),
          info: t('C: a003 FETCH 12 (FLAGS BODY.PEEK[])', 'C: a003 FETCH 12 (FLAGS BODY.PEEK[])'),
          tipo: 'comando',
          resumo: t('a003 FETCH 12 (FLAGS BODY.PEEK[])', 'a003 FETCH 12 (FLAGS BODY.PEEK[])'),
          dt: 4,
          carga: [texto(t('Comando', 'Command'), 'a003 FETCH 12 (FLAGS BODY.PEEK[])\r\n', t('Traz as flags e a mensagem inteira sem marcá-la.', 'Gets the flags and the full message without flagging it.'))],
        }),
        c.servidor({
          proto: 'IMF',
          rotulo: t('* 12 FETCH', '* 12 FETCH'),
          info: t('S: * 12 FETCH (FLAGS () BODY[] {1200}) | a003 OK', 'S: * 12 FETCH (FLAGS () BODY[] {1200}) | a003 OK'),
          tipo: 'resposta',
          resumo: t('Mensagem 12, 1.200 bytes', 'Message 12, 1,200 bytes'),
          dt: 24,
          carga: [
            texto(t('Cabeçalho do FETCH', 'FETCH header'), '* 12 FETCH (FLAGS () BODY[] {1200}\r\n', t('{1200} avisa quantos bytes literais vêm a seguir.', '{1200} announces how many literal bytes follow.')),
            opaco(t('Mensagem (RFC 5322)', 'Message (RFC 5322)'), 1200, t('Cabeçalhos e corpo da mensagem.', 'Message headers and body.')),
            texto(t('Conclusão', 'Completion'), ')\r\na003 OK FETCH completed\r\n'),
          ],
        }),
        c.cliente({
          proto: 'IMAP',
          rotulo: t('a004 STORE', 'a004 STORE'),
          info: t('C: a004 STORE 12 +FLAGS (\\Seen)', 'C: a004 STORE 12 +FLAGS (\\Seen)'),
          tipo: 'comando',
          resumo: t('a004 STORE 12 +FLAGS (\\Seen)', 'a004 STORE 12 +FLAGS (\\Seen)'),
          dt: 2600,
          carga: [texto(t('Comando', 'Command'), 'a004 STORE 12 +FLAGS (\\Seen)\r\n', t('Acrescenta a flag de lida.', 'Adds the read flag.'))],
        }),
        c.servidor({
          proto: 'IMAP',
          rotulo: t('a004 OK', 'a004 OK'),
          info: t('S: * 12 FETCH (FLAGS (\\Seen)) | a004 OK', 'S: * 12 FETCH (FLAGS (\\Seen)) | a004 OK'),
          tipo: 'resposta',
          resumo: t('Marcada como lida', 'Marked as read'),
          dt: 19,
          carga: [
            texto(t('Novas flags', 'New flags'), '* 12 FETCH (FLAGS (\\Seen))\r\n'),
            texto(t('Conclusão', 'Completion'), 'a004 OK STORE completed\r\n'),
          ],
        }),
      ],
    },
    {
      titulo: t('IDLE', 'IDLE'),
      resumo: t('O servidor avisa na hora', 'The server notifies instantly'),
      descricao: t(
        'Em vez de perguntar de minuto em minuto, o cliente entra em IDLE e a conexão fica parada. Quando chega um e-mail, o servidor manda * 13 EXISTS na hora. O cliente sai com DONE para buscar a novidade; servidores costumam encerrar o IDLE depois de 29 minutos.',
        'Instead of polling every minute, the client enters IDLE and the connection sits quiet. When an e-mail arrives, the server sends * 13 EXISTS immediately. The client leaves with DONE to fetch it; servers usually end IDLE after 29 minutes.',
      ),
      fatos: [
        [t('Comando', 'Command'), t('a005 IDLE', 'a005 IDLE')],
        [t('Aviso', 'Notice'), t('* 13 EXISTS', '* 13 EXISTS')],
        [t('Limite', 'Limit'), t('Renovar antes de 29 min', 'Renew before 29 min')],
      ],
      pacotes: [
        c.cliente({
          proto: 'IMAP',
          rotulo: t('a005 IDLE', 'a005 IDLE'),
          info: t('C: a005 IDLE', 'C: a005 IDLE'),
          tipo: 'comando',
          resumo: t('a005 IDLE', 'a005 IDLE'),
          dt: 5,
          carga: [texto(t('Comando', 'Command'), 'a005 IDLE\r\n', t('Fica esperando avisos.', 'Waits for notices.'))],
        }),
        c.servidor({
          proto: 'IMAP',
          rotulo: t('+ idling', '+ idling'),
          info: t('S: + idling', 'S: + idling'),
          tipo: 'resposta',
          resumo: t('Esperando', 'Waiting'),
          dt: 18,
          carga: [texto(t('Continuação', 'Continuation'), '+ idling\r\n', t('O + indica que o comando continua em aberto.', 'The + means the command is still open.'))],
        }),
        c.servidor({
          proto: 'IMAP',
          rotulo: t('* 13 EXISTS', '* 13 EXISTS'),
          info: t('S: * 13 EXISTS', 'S: * 13 EXISTS'),
          tipo: 'aviso',
          resumo: t('Chegou um e-mail novo', 'A new e-mail arrived'),
          nota: t('42 S DEPOIS', '42 S LATER'),
          dt: 42000,
          carga: [texto(t('Aviso', 'Notice'), '* 13 EXISTS\r\n', t('Agora há 13 mensagens: uma nova.', 'There are now 13 messages: one new.'))],
        }),
        c.cliente({
          proto: 'IMAP',
          rotulo: t('DONE', 'DONE'),
          info: t('C: DONE', 'C: DONE'),
          tipo: 'comando',
          resumo: t('DONE', 'DONE'),
          dt: 3,
          carga: [texto(t('Fim do IDLE', 'End of IDLE'), 'DONE\r\n', t('Sai do IDLE para poder mandar comandos.', 'Leaves IDLE to send commands again.'))],
        }),
        c.servidor({
          proto: 'IMAP',
          rotulo: t('a005 OK', 'a005 OK'),
          info: t('S: a005 OK IDLE terminated', 'S: a005 OK IDLE terminated'),
          tipo: 'resposta',
          resumo: t('IDLE encerrado', 'IDLE ended'),
          dt: 18,
          carga: [texto(t('Conclusão', 'Completion'), 'a005 OK IDLE terminated\r\n')],
        }),
      ],
    },
    {
      titulo: t('Sair', 'Log out'),
      resumo: t('LOGOUT e * BYE', 'LOGOUT and * BYE'),
      descricao: t(
        'LOGOUT encerra a sessão. O servidor manda * BYE antes do OK e fecha a conexão. Nada foi apagado: as 13 mensagens continuam no servidor, prontas para o próximo aparelho.',
        'LOGOUT ends the session. The server sends * BYE before the OK and closes the connection. Nothing was deleted: all 13 messages remain on the server, ready for the next device.',
      ),
      fatos: [
        [t('Comando', 'Command'), t('a006 LOGOUT', 'a006 LOGOUT')],
        [t('Mensagens no servidor', 'Messages on server'), t('13', '13')],
      ],
      pacotes: [
        c.cliente({
          proto: 'IMAP',
          rotulo: t('a006 LOGOUT', 'a006 LOGOUT'),
          info: t('C: a006 LOGOUT', 'C: a006 LOGOUT'),
          tipo: 'comando',
          resumo: t('a006 LOGOUT', 'a006 LOGOUT'),
          dt: 4,
          carga: [texto(t('Comando', 'Command'), 'a006 LOGOUT\r\n')],
        }),
        c.servidor({
          proto: 'IMAP',
          rotulo: t('* BYE', '* BYE'),
          info: t('S: * BYE Logging out | a006 OK', 'S: * BYE Logging out | a006 OK'),
          tipo: 'resposta',
          resumo: t('Até logo', 'Goodbye'),
          dt: 18,
          carga: [
            texto(t('Aviso', 'Notice'), '* BYE Logging out\r\n', t('O servidor vai fechar a conexão.', 'The server will close the connection.')),
            texto(t('Conclusão', 'Completion'), 'a006 OK Logout completed\r\n'),
          ],
        }),
      ],
    },
  ],
};
