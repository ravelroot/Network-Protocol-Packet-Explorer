import { hex, no, nos, opaco, t } from '../base';
import { ascii, chaveEapol } from '../conversa';
import type { Campo, Protocolo } from '../tipos';

const SSID = 'CasaLab';
const RSN_SAE = '30 14 01 00 00 0f ac 04 01 00 00 0f ac 04 01 00 00 0f ac 08 c0 00';

const ssid = (): Campo =>
  hex(t('SSID', 'SSID'), `00 ${SSID.length.toString(16).padStart(2, '0')} ${ascii(SSID)}`, SSID, t('O nome da rede.', 'The network name.'));

const rsn = (): Campo =>
  hex(
    t('RSN', 'RSN'),
    RSN_SAE,
    'CCMP, AKM 8 (SAE), MFPR',
    t(
      'Cifra CCMP, autenticação SAE (AKM 8) e proteção de quadros de gerência obrigatória.',
      'CCMP cipher, SAE authentication (AKM 8) and mandatory management frame protection.',
    ),
  );

const sae = (seq: 1 | 2): Campo[] => [
  hex(t('Algoritmo', 'Algorithm'), '03 00', 'SAE (3)', t('Autenticação SAE, a "Dragonfly".', 'SAE authentication, the "Dragonfly".')),
  hex(t('Sequência', 'Sequence'), seq === 1 ? '01 00' : '02 00', seq === 1 ? 'Commit (1)' : 'Confirm (2)'),
  hex(t('Status', 'Status'), '00 00', '0 (OK)', t('0 significa sucesso.', '0 means success.')),
];

const commit: Campo[] = [
  ...sae(1),
  hex(t('Grupo', 'Group'), '13 00', '19 (NIST P-256)', t('A curva elíptica usada nos cálculos.', 'The elliptic curve used for the math.')),
  opaco(
    t('Escalar', 'Scalar'),
    32,
    t('Número aleatório combinado com a senha; muda a cada tentativa.', 'A random number mixed with the password; changes every attempt.'),
  ),
  opaco(
    t('Elemento', 'Element'),
    64,
    t('Ponto da curva derivado da senha: não serve para testar senhas offline.', 'A curve point derived from the password: useless for offline guessing.'),
  ),
];

const confirm: Campo[] = [
  ...sae(2),
  hex(t('Contador', 'Send-confirm'), '01 00', '1', t('Conta quantos Confirm foram enviados.', 'Counts how many Confirms were sent.')),
  opaco(
    t('Confirmação', 'Confirm'),
    32,
    t('Hash que prova que os dois chegaram à mesma chave (PMK).', 'A hash proving both sides reached the same key (PMK).'),
  ),
];

export const wpa3: Protocolo = {
  id: 'wpa3',
  sigla: 'WPA3',
  nome: t('Wi-Fi Protected Access 3', 'Wi-Fi Protected Access 3'),
  resumo: t('Wi-Fi Protected Access 3', 'Wi-Fi Protected Access 3'),
  categoria: 'seguranca',
  camada: 2,
  descricao: t(
    'O WPA3 protege redes Wi-Fi com senha. Em vez de usar a senha direto na troca de chaves, como o WPA2, os dois lados fazem o SAE: uma troca baseada em curvas elípticas que gera uma chave nova a cada conexão. Quem grava o ar não consegue testar senhas offline, e os quadros de gerência passam a ser protegidos.',
    'WPA3 protects password-based Wi-Fi networks. Instead of feeding the password straight into the key exchange like WPA2, both sides run SAE: an elliptic-curve exchange that produces a fresh key on every connection. Someone recording the air cannot guess passwords offline, and management frames become protected.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Enlace (camada 2)', 'Data link (Layer 2)')],
    [t('Autenticação', 'Authentication'), t('SAE (Dragonfly, RFC 7664)', 'SAE (Dragonfly, RFC 7664)')],
    [t('Cifra', 'Cipher'), t('AES-CCMP 128 (GCMP-256 no Enterprise 192)', 'AES-CCMP 128 (GCMP-256 in Enterprise 192)')],
    [t('Proteção de gerência', 'Management protection'), t('PMF obrigatório (802.11w)', 'PMF mandatory (802.11w)')],
    [t('Sigilo futuro', 'Forward secrecy'), t('Sim: chave nova por conexão', 'Yes: a new key per connection')],
    [t('Definido em', 'Defined in'), t('IEEE 802.11-2020, Wi-Fi Alliance (2018)', 'IEEE 802.11-2020, Wi-Fi Alliance (2018)')],
  ],
  legenda: {
    anuncio: { nome: t('Beacon', 'Beacon'), cor: 'neutra' },
    sae: { nome: t('SAE', 'SAE'), cor: 'ouro' },
    associacao: { nome: t('Associação', 'Association'), cor: 'anil' },
    chaves: { nome: t('EAPOL-Key', 'EAPOL-Key'), cor: 'oliva' },
  },
  observacao: t('Senha nunca trafega', 'Password never on the air'),
  nos: [
    nos.cliente(16, 70),
    no('ap', 'ponto-acesso', t('Ponto de acesso', 'Access point'), 48, 48, '192.168.1.1', '00:00:5e:00:53:a1'),
    nos.roteador(70, 62),
    nos.internet(88, 34),
  ],
  ligacoes: [
    ['cliente', 'ap'],
    ['ap', 'roteador'],
    ['roteador', 'internet'],
  ],
  faixas: ['cliente', 'ap'],
  passos: [
    {
      titulo: t('Descoberta', 'Discovery'),
      resumo: t('O ponto de acesso se anuncia', 'The access point announces itself'),
      descricao: t(
        'Cerca de dez vezes por segundo, o ponto de acesso transmite um Beacon para todos. Nele vão o nome da rede e o elemento RSN, que diz o que a rede exige: SAE para autenticar, CCMP para cifrar e proteção dos quadros de gerência.',
        'About ten times per second, the access point broadcasts a Beacon to everyone. It carries the network name and the RSN element, which states what the network requires: SAE to authenticate, CCMP to encrypt and protected management frames.',
      ),
      fatos: [
        [t('SSID', 'SSID'), t(SSID, SSID)],
        [t('Intervalo', 'Interval'), t('100 TU (102,4 ms)', '100 TU (102.4 ms)')],
        [t('AKM', 'AKM'), t('8 = SAE', '8 = SAE')],
      ],
      pacotes: [
        {
          de: 'ap',
          para: 'cliente',
          proto: '802.11',
          rotulo: t('BEACON', 'BEACON'),
          info: t(`Beacon, SN=1, SSID="${SSID}"`, `Beacon frame, SN=1, SSID="${SSID}"`),
          tipo: 'anuncio',
          resumo: t(`SSID ${SSID} · RSN: SAE + CCMP`, `SSID ${SSID} · RSN: SAE + CCMP`),
          dt: 0,
          quadro: {
            enlace: 'wifi',
            wifi: 'beacon',
            rede: 'nenhuma',
            camada: 'Beacon',
            carga: [
              hex(t('Carimbo de tempo', 'Timestamp'), '40 2c 83 1a 05 00 00 00', '22 bilhões µs', t('Relógio do ponto de acesso, para sincronizar.', 'The access point clock, for synchronisation.'), true),
              hex(t('Intervalo', 'Interval'), '64 00', '100 TU', t('Tempo entre beacons (1 TU = 1024 µs).', 'Time between beacons (1 TU = 1024 µs).')),
              hex(t('Capacidades', 'Capabilities'), '31 04', 'ESS, Privacy', t('Rede com ponto de acesso e cifrada.', 'Infrastructure network, encrypted.')),
              ssid(),
              rsn(),
            ],
          },
        },
      ],
    },
    {
      titulo: t('SAE Commit', 'SAE Commit'),
      resumo: t('Cada lado se compromete', 'Each side commits'),
      descricao: t(
        'O notebook e o ponto de acesso enviam, ao mesmo tempo, um escalar e um elemento calculados a partir da senha e de números aleatórios. Os valores não revelam a senha e mudam a cada tentativa: gravar essa troca não ajuda a descobri-la.',
        'The laptop and the access point each send a scalar and an element computed from the password and random numbers. The values do not reveal the password and change on every attempt: recording this exchange does not help to crack it.',
      ),
      fatos: [
        [t('Grupo', 'Group'), t('19 (NIST P-256)', '19 (NIST P-256)')],
        [t('Ordem', 'Order'), t('Simétrica: qualquer lado pode começar', 'Symmetric: either side may start')],
        [t('Defesa', 'Defence'), t('Anti-clogging contra inundação', 'Anti-clogging against flooding')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'ap',
          proto: '802.11',
          rotulo: t('SAE COMMIT', 'SAE COMMIT'),
          info: t('Authentication, SAE Commit, Grupo 19', 'Authentication, SAE Commit, Group 19'),
          tipo: 'sae',
          resumo: t('Commit: escalar + elemento (P-256)', 'Commit: scalar + element (P-256)'),
          dt: 140,
          quadro: { enlace: 'wifi', wifi: 'auth', rede: 'nenhuma', camada: 'SAE', carga: commit },
        },
        {
          de: 'ap',
          para: 'cliente',
          proto: '802.11',
          rotulo: t('SAE COMMIT', 'SAE COMMIT'),
          info: t('Authentication, SAE Commit, Grupo 19', 'Authentication, SAE Commit, Group 19'),
          tipo: 'sae',
          resumo: t('Commit do ponto de acesso', 'Access point commit'),
          dt: 4,
          quadro: { enlace: 'wifi', wifi: 'auth', rede: 'nenhuma', camada: 'SAE', carga: commit },
        },
      ],
    },
    {
      titulo: t('SAE Confirm', 'SAE Confirm'),
      resumo: t('Provam que chegaram à mesma chave', 'They prove they reached the same key'),
      descricao: t(
        'Com os dois Commits, cada lado calcula a mesma chave mestra (PMK) sem que ela passe pelo ar. O Confirm é um hash que prova isso. Se a senha estiver errada, o hash não confere e a tentativa termina; o próximo palpite exige uma nova conexão ao vivo.',
        'With both Commits, each side computes the same master key (PMK) without sending it over the air. The Confirm is a hash proving it. With a wrong password the hash does not match and the attempt ends; the next guess needs a new live connection.',
      ),
      fatos: [
        [t('Resultado', 'Result'), t('PMK de 32 bytes', '32-byte PMK')],
        [t('Senha errada', 'Wrong password'), t('Confirm não confere', 'Confirm does not match')],
        [t('Ataque offline', 'Offline attack'), t('Impossível', 'Not possible')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'ap',
          proto: '802.11',
          rotulo: t('SAE CONFIRM', 'SAE CONFIRM'),
          info: t('Authentication, SAE Confirm', 'Authentication, SAE Confirm'),
          tipo: 'sae',
          resumo: t('Confirm: hash da chave', 'Confirm: key hash'),
          dt: 6,
          quadro: { enlace: 'wifi', wifi: 'auth', rede: 'nenhuma', camada: 'SAE', carga: confirm },
        },
        {
          de: 'ap',
          para: 'cliente',
          proto: '802.11',
          rotulo: t('SAE CONFIRM', 'SAE CONFIRM'),
          info: t('Authentication, SAE Confirm', 'Authentication, SAE Confirm'),
          tipo: 'sae',
          resumo: t('Confirm do ponto de acesso', 'Access point confirm'),
          dt: 3,
          quadro: { enlace: 'wifi', wifi: 'auth', rede: 'nenhuma', camada: 'SAE', carga: confirm },
        },
      ],
    },
    {
      titulo: t('Associação', 'Association'),
      resumo: t('O notebook entra na rede', 'The laptop joins the network'),
      descricao: t(
        'Autenticado, o notebook pede para se associar e repete o elemento RSN com as opções escolhidas. O ponto de acesso aceita e entrega o AID, o número do notebook nesta rede. A partir daqui os quadros de gerência, como o de desconexão, também serão protegidos.',
        'Once authenticated, the laptop asks to associate and repeats the RSN element with its chosen options. The access point accepts and hands out the AID, the laptop’s number on this network. From now on management frames, like disconnects, are protected too.',
      ),
      fatos: [
        [t('AID', 'AID'), t('1', '1')],
        [t('PMF', 'PMF'), t('Obrigatório (MFPR)', 'Required (MFPR)')],
        [t('Status', 'Status'), t('0 (sucesso)', '0 (success)')],
      ],
      pacotes: [
        {
          de: 'cliente',
          para: 'ap',
          proto: '802.11',
          rotulo: t('ASSOC REQ', 'ASSOC REQ'),
          info: t(`Association Request, SSID="${SSID}"`, `Association Request, SSID="${SSID}"`),
          tipo: 'associacao',
          resumo: t('Pede para entrar, com SAE + CCMP', 'Asks to join with SAE + CCMP'),
          dt: 5,
          quadro: {
            enlace: 'wifi',
            wifi: 'assoc-req',
            rede: 'nenhuma',
            camada: '802.11 Mgmt',
            carga: [
              hex(t('Capacidades', 'Capabilities'), '31 04', 'ESS, Privacy'),
              hex(t('Intervalo de escuta', 'Listen interval'), '0a 00', '10', t('De quantos em quantos beacons o notebook acorda.', 'How many beacons the laptop sleeps between wake-ups.')),
              ssid(),
              rsn(),
            ],
          },
        },
        {
          de: 'ap',
          para: 'cliente',
          proto: '802.11',
          rotulo: t('ASSOC RESP', 'ASSOC RESP'),
          info: t('Association Response, Status=0, AID=1', 'Association Response, Status=0, AID=1'),
          tipo: 'associacao',
          resumo: t('Aceito, AID 1', 'Accepted, AID 1'),
          dt: 3,
          quadro: {
            enlace: 'wifi',
            wifi: 'assoc-resp',
            rede: 'nenhuma',
            camada: '802.11 Mgmt',
            carga: [
              hex(t('Capacidades', 'Capabilities'), '31 04', 'ESS, Privacy'),
              hex(t('Status', 'Status'), '00 00', '0 (OK)'),
              hex(t('AID', 'AID'), '01 c0', '1', t('O número do notebook nesta rede.', 'The laptop’s number on this network.')),
            ],
          },
        },
      ],
    },
    {
      titulo: t('Aperto de mão de 4 vias', '4-way handshake'),
      resumo: t('Chaves de sessão instaladas', 'Session keys installed'),
      descricao: t(
        'Da PMK saem as chaves desta sessão. O ponto de acesso manda um nonce (ANonce), o notebook responde com o seu (SNonce) e um MIC, e os dois derivam a PTK. Na mensagem 3 vem a chave de grupo (GTK), cifrada; a 4 confirma a instalação.',
        'The session keys come from the PMK. The access point sends a nonce (ANonce), the laptop answers with its own (SNonce) and a MIC, and both derive the PTK. Message 3 carries the group key (GTK), encrypted; message 4 confirms installation.',
      ),
      fatos: [
        [t('PTK', 'PTK'), t('PMK + ANonce + SNonce + MACs', 'PMK + ANonce + SNonce + MACs')],
        [t('GTK', 'GTK'), t('Chave de grupo, para broadcast', 'Group key, for broadcast')],
        [t('Mesmo do WPA2?', 'Same as WPA2?'), t('Sim, mas a PMK vem do SAE', 'Yes, but the PMK comes from SAE')],
      ],
      pacotes: [
        {
          de: 'ap',
          para: 'cliente',
          proto: 'EAPOL',
          rotulo: t('MENSAGEM 1/4', 'MESSAGE 1/4'),
          info: t('Key (Mensagem 1 de 4)', 'Key (Message 1 of 4)'),
          tipo: 'chaves',
          resumo: t('ANonce', 'ANonce'),
          dt: 4,
          quadro: {
            enlace: 'wifi',
            rede: 'eapol',
            eapolTipo: 3,
            camada: 'EAPOL-Key',
            carga: chaveEapol({
              info: '00 88',
              infoValor: 'Pairwise, ACK',
              explicacao: t('Chave par a par; o ponto de acesso espera resposta.', 'Pairwise key; the access point expects an answer.'),
              tamanhoChave: 16,
              replay: 1,
              nonce: t('ANonce: número aleatório do ponto de acesso.', 'ANonce: the access point’s random number.'),
              mic: false,
            }),
          },
        },
        {
          de: 'cliente',
          para: 'ap',
          proto: 'EAPOL',
          rotulo: t('MENSAGEM 2/4', 'MESSAGE 2/4'),
          info: t('Key (Mensagem 2 de 4)', 'Key (Message 2 of 4)'),
          tipo: 'chaves',
          resumo: t('SNonce + MIC + RSN', 'SNonce + MIC + RSN'),
          dt: 3,
          quadro: {
            enlace: 'wifi',
            rede: 'eapol',
            eapolTipo: 3,
            camada: 'EAPOL-Key',
            carga: chaveEapol({
              info: '01 08',
              infoValor: 'Pairwise, MIC',
              explicacao: t('Agora já assinada com a PTK recém-calculada.', 'Now signed with the freshly derived PTK.'),
              tamanhoChave: 0,
              replay: 1,
              nonce: t('SNonce: número aleatório do notebook.', 'SNonce: the laptop’s random number.'),
              mic: true,
              rsn: RSN_SAE,
            }),
          },
        },
        {
          de: 'ap',
          para: 'cliente',
          proto: 'EAPOL',
          rotulo: t('MENSAGEM 3/4', 'MESSAGE 3/4'),
          info: t('Key (Mensagem 3 de 4)', 'Key (Message 3 of 4)'),
          tipo: 'chaves',
          resumo: t('Instalar PTK + GTK cifrada', 'Install PTK + encrypted GTK'),
          dt: 3,
          quadro: {
            enlace: 'wifi',
            rede: 'eapol',
            eapolTipo: 3,
            camada: 'EAPOL-Key',
            carga: chaveEapol({
              info: '13 c8',
              infoValor: 'Pairwise, Install, ACK, MIC, Secure, Encrypted',
              explicacao: t('Mande instalar a chave; os dados vão cifrados.', 'Install the key; the data is encrypted.'),
              tamanhoChave: 16,
              replay: 2,
              nonce: t('O mesmo ANonce da mensagem 1.', 'The same ANonce as message 1.'),
              mic: true,
              cifrado: 56,
            }),
          },
        },
        {
          de: 'cliente',
          para: 'ap',
          proto: 'EAPOL',
          rotulo: t('MENSAGEM 4/4', 'MESSAGE 4/4'),
          info: t('Key (Mensagem 4 de 4)', 'Key (Message 4 of 4)'),
          tipo: 'chaves',
          resumo: t('Chaves instaladas', 'Keys installed'),
          dt: 2,
          quadro: {
            enlace: 'wifi',
            rede: 'eapol',
            eapolTipo: 3,
            camada: 'EAPOL-Key',
            carga: chaveEapol({
              info: '03 08',
              infoValor: 'Pairwise, MIC, Secure',
              explicacao: t('Confirma: daqui em diante tudo vai cifrado.', 'Confirms: from here on everything is encrypted.'),
              tamanhoChave: 0,
              replay: 2,
              mic: true,
            }),
          },
        },
      ],
    },
    {
      titulo: t('Por que supera o WPA2', 'Why it beats WPA2'),
      resumo: t('Senha fraca já não basta para invadir', 'A weak password is no longer enough'),
      descricao: t(
        'No WPA2-Personal, quem grava o aperto de mão de 4 vias pode testar milhões de senhas por segundo em casa, sem tocar na rede. No WPA3 cada palpite exige uma troca SAE ao vivo com o ponto de acesso, e a chave nova a cada conexão impede decifrar tráfego antigo mesmo se a senha vazar depois.',
        'With WPA2-Personal, anyone who records the 4-way handshake can test millions of passwords per second at home, without touching the network. With WPA3 every guess needs a live SAE exchange with the access point, and the fresh key per connection keeps old traffic safe even if the password leaks later.',
      ),
      fatos: [
        [t('WPA2-PSK', 'WPA2-PSK'), t('Ataque de dicionário offline', 'Offline dictionary attack')],
        [t('WPA3-SAE', 'WPA3-SAE'), t('Um palpite por troca ao vivo', 'One guess per live exchange')],
        [t('Modo de transição', 'Transition mode'), t('WPA2 e WPA3 na mesma rede', 'WPA2 and WPA3 on one network')],
      ],
      pacotes: [],
    },
  ],
};
