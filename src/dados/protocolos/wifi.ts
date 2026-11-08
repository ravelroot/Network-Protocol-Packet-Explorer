import { hex, IP, no, nos, opaco, t, texto } from '../base';
import type { Campo, Pacote, Protocolo, QuadroWifi, Texto } from '../tipos';

const SSID = 'MinhaRede';
const IP_CELULAR = '192.168.1.23';
const MAC_CELULAR = '00:00:5e:00:53:23';
const RSN = '30 14 01 00 00 0f ac 04 01 00 00 0f ac 04 01 00 00 0f ac 02 0c 00';
const zeros = (n: number): string => Array.from({ length: n }, () => '00').join(' ');

const ssid: Campo[] = [
  hex(t('SSID: elemento, tamanho', 'SSID: element, length'), '00 09', '0, 9', t('Elemento 0 (nome da rede), com 9 bytes.', 'Element 0 (network name), 9 bytes long.')),
  texto(t('SSID', 'SSID'), SSID, t('O nome da rede, em texto aberto.', 'The network name, in plain text.')),
];

const taxas = hex(t('Taxas suportadas', 'Supported rates'), '01 08 8c 12 98 24 b0 48 60 6c', '6, 9, 12, 18, 24, 36, 48, 54 Mb/s', t('As velocidades básicas do 802.11a/g; as marcadas com 0x80 são obrigatórias.', 'The 802.11a/g base rates; those flagged with 0x80 are mandatory.'));

const rsn = hex(t('RSN (segurança)', 'RSN (security)'), RSN, 'WPA2-PSK, CCMP', t('Cifra AES-CCMP para tudo e autenticação por senha compartilhada (PSK).', 'AES-CCMP cipher for everything and pre-shared key (PSK) authentication.'));

const capacidade = hex(t('Capacidades', 'Capabilities'), '11 04', 'ESS, Privacy, Short Slot', t('É um ponto de acesso (ESS) e exige criptografia (Privacy).', 'It is an access point (ESS) and requires encryption (Privacy).'));

const anuncio = (): Campo[] => [
  hex(t('Carimbo de tempo', 'Timestamp'), '80 1a 06 3c 00 00 00 00', '1007032960 µs', t('O relógio do ponto de acesso; os aparelhos se sincronizam por ele.', 'The access point’s clock; devices sync to it.'), true),
  hex(t('Intervalo do beacon', 'Beacon interval'), '64 00', '100 TU (102,4 ms)', t('De quanto em quanto tempo o anúncio se repete.', 'How often the announcement repeats.')),
  capacidade,
  ...ssid,
  taxas,
  hex(t('Canal', 'Channel'), '03 01 24', '36 (5180 MHz)', t('Canal 36, na faixa de 5 GHz.', 'Channel 36, in the 5 GHz band.')),
  rsn,
];

const gerencia = (de: string, para: string, wifi: QuadroWifi, rotulo: Texto, info: Texto, resumo: Texto, dt: number, carga: Campo[]): Pacote => ({
  de,
  para,
  proto: '802.11',
  rotulo,
  info,
  tipo: 'gerencia',
  resumo,
  dt,
  quadro: { enlace: 'wifi', wifi, rede: 'nenhuma', camada: '802.11 Mgmt', carga },
});

interface Mensagem {
  readonly n: 1 | 2 | 3 | 4;
  readonly info: string;
  readonly leitura: string;
  readonly explica: Texto;
}

const MENSAGENS: Record<1 | 2 | 3 | 4, Mensagem> = {
  1: { n: 1, info: '00 8a', leitura: 'Pairwise, ACK', explica: t('Chave por par, pedindo resposta; ainda sem MIC.', 'Pairwise key, asking for a reply; no MIC yet.') },
  2: { n: 2, info: '01 0a', leitura: 'Pairwise, MIC', explica: t('Agora com MIC: prova que o celular sabe a senha.', 'Now with a MIC: proof the phone knows the password.') },
  3: { n: 3, info: '13 ca', leitura: 'Pairwise, Install, ACK, MIC, Secure, Encrypted', explica: t('Instale a chave; os dados da chave vão cifrados.', 'Install the key; the key data travels encrypted.') },
  4: { n: 4, info: '03 0a', leitura: 'Pairwise, MIC, Secure', explica: t('Confirmação final, já protegida.', 'Final confirmation, already protected.') },
};

const chave = (n: 1 | 2 | 3 | 4, dt: number): Pacote => {
  const m = MENSAGENS[n];
  const doAp = n === 1 || n === 3;
  const nonce: Campo =
    n === 4
      ? hex(t('Nonce', 'Nonce'), zeros(32), '0', t('Não é mais necessário.', 'No longer needed.'))
      : opaco(
          t(doAp ? 'ANonce' : 'SNonce', doAp ? 'ANonce' : 'SNonce'),
          32,
          doAp ? t('Número aleatório do ponto de acesso.', 'The access point’s random number.') : t('Número aleatório do celular.', 'The phone’s random number.'),
        );
  const dadosChave: Campo[] =
    n === 2
      ? [hex(t('Dados da chave', 'Key data'), `00 16 ${RSN}`, 'RSN: WPA2-PSK, CCMP', t('O celular repete o que pediu na associação, para impedir rebaixamento.', 'The phone repeats what it asked for at association, to block downgrades.'))]
      : n === 3
        ? [hex(t('Tamanho dos dados', 'Key data length'), '00 38', '56 bytes'), opaco(t('Dados da chave (GTK)', 'Key data (GTK)'), 56, t('A chave de grupo, para broadcast, cifrada com a nova chave.', 'The group key, for broadcasts, encrypted with the new key.'))]
        : [hex(t('Dados da chave', 'Key data'), '00 00', '0 bytes')];
  return {
    de: doAp ? 'ap' : 'celular',
    para: doAp ? 'celular' : 'ap',
    proto: 'EAPOL',
    rotulo: t(`M${n} DE 4`, `M${n} OF 4`),
    info: t(`Key (Mensagem ${n} de 4)`, `Key (Message ${n} of 4)`),
    tipo: 'chaves',
    resumo: t(`EAPOL-Key, mensagem ${n} de 4`, `EAPOL-Key, message ${n} of 4`),
    dt,
    quadro: {
      enlace: 'wifi',
      wifi: 'dados',
      rede: 'eapol',
      eapolTipo: 3,
      camada: 'EAPOL-Key',
      carga: [
        hex(t('Tipo de descritor', 'Descriptor type'), '02', 'RSN', t('Formato do 802.11i (WPA2).', 'The 802.11i (WPA2) format.')),
        hex(t('Informações da chave', 'Key information'), m.info, m.leitura, m.explica),
        hex(t('Tamanho da chave', 'Key length'), doAp ? '00 10' : '00 00', doAp ? '16' : '0', t('16 bytes de chave temporal para o CCMP.', '16 bytes of temporal key for CCMP.')),
        hex(t('Contador anti-repetição', 'Replay counter'), `00 00 00 00 00 00 00 0${n < 3 ? 1 : 2}`, n < 3 ? '1' : '2', t('Sobe a cada pedido; a resposta repete o valor.', 'Goes up with each request; the reply echoes it.')),
        nonce,
        hex(t('IV, RSC, reservado', 'IV, RSC, reserved'), zeros(32), '0', t('Campos zerados no WPA2.', 'Fields left at zero in WPA2.')),
        n === 1
          ? hex(t('MIC', 'MIC'), zeros(16), '0', t('Ainda não há chave para assinar.', 'There is no key to sign with yet.'))
          : opaco(t('MIC', 'MIC'), 16, t('Código que prova a posse da PTK sem revelar a senha.', 'A code proving possession of the PTK without revealing the password.')),
        ...dadosChave,
      ],
    },
  };
};

const bootp = (op: 1 | 2, yiaddr: string, tipo: 1 | 2): Campo[] => [
  hex(t('Operação, hardware', 'Op, hardware'), `0${op} 01 06 00`, op === 1 ? 'BOOTREQUEST' : 'BOOTREPLY', t('Cabeçalho BOOTP: Ethernet, MAC de 6 bytes.', 'BOOTP header: Ethernet, 6-byte MAC.')),
  hex(t('ID da transação', 'Transaction ID'), '5d 2c 81 0e', '0x5d2c810e', t('Liga o pedido à resposta.', 'Ties the request to the reply.'), true),
  hex(t('Segundos, flags, ciaddr', 'Seconds, flags, ciaddr'), zeros(8), '0', t('Ainda sem endereço.', 'No address yet.')),
  hex(
    t('yiaddr, siaddr, giaddr', 'yiaddr, siaddr, giaddr'),
    `${yiaddr.split('.').map((p) => Number(p).toString(16).padStart(2, '0')).join(' ')} ${zeros(8)}`,
    yiaddr,
    t('O endereço oferecido (zero no pedido).', 'The address on offer (zero in the request).'),
  ),
  hex(t('MAC do cliente', 'Client MAC'), `${MAC_CELULAR.split(':').join(' ')} ${zeros(10)}`, MAC_CELULAR, t('Quem está pedindo.', 'Who is asking.'), true),
  hex(t('sname + file', 'sname + file'), zeros(192), '192 × 00', t('Herança do BOOTP, vazia.', 'BOOTP legacy, empty.')),
  hex(t('Magic cookie', 'Magic cookie'), '63 82 53 63', 'DHCP'),
  hex(t('Opção 53', 'Option 53'), `35 01 0${tipo}`, tipo === 1 ? 'DHCP Discover' : 'DHCP Offer', t('O tipo da mensagem; detalhes na lição de DHCP.', 'The message type; details in the DHCP lesson.')),
  hex(t('Fim', 'End'), 'ff', '255'),
];

export const wifi: Protocolo = {
  id: 'wifi',
  sigla: 'Wi-Fi',
  nome: t('Rede sem fio IEEE 802.11', 'IEEE 802.11 wireless networking'),
  resumo: t('Entrando numa rede (WPA2)', 'Joining a network (WPA2)'),
  categoria: 'aplicacao',
  camada: 2,
  descricao: t(
    'Entrar numa rede Wi-Fi leva mais conversa do que parece. O celular ouve o anúncio da rede, se autentica e se associa ao ponto de acesso e, no WPA2, os dois provam que sabem a senha sem jamais enviá-la: o aperto de mão de 4 vias deriva chaves novas a cada conexão. Só depois disso passa o primeiro byte de dados.',
    'Joining a Wi-Fi network takes more talking than it seems. The phone hears the network’s announcement, authenticates and associates with the access point and, with WPA2, both sides prove they know the password without ever sending it: the 4-way handshake derives fresh keys for each connection. Only then does the first byte of data flow.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Enlace (camada 2)', 'Data link (Layer 2)')],
    [t('Padrão', 'Standard'), t('IEEE 802.11 (Wi-Fi 4 a 7)', 'IEEE 802.11 (Wi-Fi 4 to 7)')],
    [t('Frequências', 'Bands'), t('2,4, 5 e 6 GHz', '2.4, 5 and 6 GHz')],
    [t('Acesso ao meio', 'Medium access'), t('CSMA/CA: escuta antes de falar', 'CSMA/CA: listen before talking')],
    [t('Segurança', 'Security'), t('WPA2-PSK: 4 vias + AES-CCMP', 'WPA2-PSK: 4-way + AES-CCMP')],
    [t('Definido em', 'Defined in'), t('IEEE 802.11-2020 (inclui o 802.11i)', 'IEEE 802.11-2020 (includes 802.11i)')],
  ],
  legenda: {
    gerencia: { nome: t('Gerência (802.11)', 'Management (802.11)'), cor: 'anil' },
    chaves: { nome: t('Aperto de mão (EAPOL)', 'Handshake (EAPOL)'), cor: 'ouro' },
    dados: { nome: t('Dados', 'Data'), cor: 'oliva' },
  },
  observacao: t('Quadros de dados mostrados já decifrados', 'Data frames shown already decrypted'),
  nos: [
    no('celular', 'celular', t('Celular', 'Phone'), 14, 72, IP_CELULAR, MAC_CELULAR),
    no('ap', 'ponto-acesso', t('Ponto de acesso', 'Access Point'), 42, 40, undefined, '00:00:5e:00:53:a1'),
    nos.roteador(68, 62),
    nos.internet(88, 32),
  ],
  ligacoes: [
    ['celular', 'ap'],
    ['ap', 'roteador'],
    ['roteador', 'internet'],
  ],
  faixas: ['celular', 'ap', 'roteador'],
  passos: [
    {
      titulo: t('Beacon', 'Beacon'),
      resumo: t('A rede se anuncia', 'The network announces itself'),
      descricao: t(
        'Cerca de dez vezes por segundo, o ponto de acesso transmite um beacon para todos: nome da rede, canal, velocidades e o tipo de segurança exigido. É assim que a rede aparece na lista do celular.',
        'About ten times a second, the access point broadcasts a beacon to everyone: network name, channel, rates and the required security. That is how the network shows up in the phone’s list.',
      ),
      fatos: [
        [t('SSID', 'SSID'), t(SSID, SSID)],
        [t('Canal', 'Channel'), t('36 (5 GHz)', '36 (5 GHz)')],
        [t('Segurança', 'Security'), t('WPA2-PSK com AES-CCMP', 'WPA2-PSK with AES-CCMP')],
      ],
      pacotes: [
        gerencia(
          'ap',
          'celular',
          'beacon',
          t('BEACON', 'BEACON'),
          t(`Beacon, SN=1, BI=100, SSID="${SSID}"`, `Beacon frame, SN=1, BI=100, SSID="${SSID}"`),
          t(`"${SSID}" está aqui, canal 36`, `"${SSID}" is here, channel 36`),
          0,
          anuncio(),
        ),
      ],
    },
    {
      titulo: t('Probe', 'Probe'),
      resumo: t('O celular procura a rede', 'The phone looks for the network'),
      descricao: t(
        'Para não esperar o próximo beacon, o celular pergunta ativamente pela rede que já conhece. O ponto de acesso responde com as mesmas informações do beacon, só para ele.',
        'Rather than wait for the next beacon, the phone actively asks for a network it already knows. The access point replies with the same details as the beacon, just for it.',
      ),
      fatos: [
        [t('Pergunta', 'Asks for'), t(`SSID "${SSID}"`, `SSID "${SSID}"`)],
        [t('Resposta', 'Reply'), t('Probe Response (como um beacon)', 'Probe Response (like a beacon)')],
      ],
      pacotes: [
        gerencia(
          'celular',
          'ap',
          'probe-req',
          t('PROBE', 'PROBE'),
          t(`Probe Request, SSID="${SSID}"`, `Probe Request, SSID="${SSID}"`),
          t(`Cadê a "${SSID}"?`, `Where is "${SSID}"?`),
          41,
          [...ssid, taxas],
        ),
        gerencia(
          'ap',
          'celular',
          'probe-resp',
          t('PROBE RESP', 'PROBE RESP'),
          t(`Probe Response, SSID="${SSID}"`, `Probe Response, SSID="${SSID}"`),
          t('Aqui, canal 36, WPA2', 'Here, channel 36, WPA2'),
          2,
          anuncio(),
        ),
      ],
    },
    {
      titulo: t('Autenticação aberta', 'Open authentication'),
      resumo: t('Uma formalidade herdada', 'An inherited formality'),
      descricao: t(
        'O 802.11 original pedia uma autenticação antes da associação. No WPA2 ela é apenas "sistema aberto": um pedido e um ok. A segurança de verdade vem depois, no aperto de mão de 4 vias.',
        'The original 802.11 required authentication before association. With WPA2 it is just "open system": a request and an OK. The real security comes later, in the 4-way handshake.',
      ),
      fatos: [
        [t('Algoritmo', 'Algorithm'), t('0 (sistema aberto)', '0 (open system)')],
        [t('Resultado', 'Result'), t('Sucesso (status 0)', 'Success (status 0)')],
      ],
      pacotes: [
        gerencia('celular', 'ap', 'auth', t('AUTH', 'AUTH'), t('Authentication, SN=2', 'Authentication, SN=2'), t('Posso entrar?', 'May I come in?'), 3, [
          hex(t('Algoritmo', 'Algorithm'), '00 00', '0', t('Sistema aberto: sem segredo nesta etapa.', 'Open system: no secret at this stage.')),
          hex(t('Sequência', 'Sequence'), '01 00', '1', t('Primeira mensagem da autenticação.', 'First authentication message.')),
          hex(t('Status', 'Status'), '00 00', '0', t('Sem significado no pedido.', 'Meaningless in the request.')),
        ]),
        gerencia('ap', 'celular', 'auth', t('AUTH OK', 'AUTH OK'), t('Authentication, SN=3, status=Successful', 'Authentication, SN=3, status=Successful'), t('Pode', 'Go ahead'), 1, [
          hex(t('Algoritmo', 'Algorithm'), '00 00', '0', t('Sistema aberto.', 'Open system.')),
          hex(t('Sequência', 'Sequence'), '02 00', '2', t('A resposta.', 'The reply.')),
          hex(t('Status', 'Status'), '00 00', '0', t('Sucesso.', 'Success.')),
        ]),
      ],
    },
    {
      titulo: t('Associação', 'Association'),
      resumo: t('O celular entra na rede', 'The phone joins the network'),
      descricao: t(
        'O celular pede para se associar, repetindo o que suporta e qual segurança vai usar (o RSN). O ponto de acesso aceita e dá um número de associação (AID). O enlace existe, mas ainda nenhum dado pode passar: falta combinar as chaves.',
        'The phone asks to associate, restating what it supports and which security it will use (the RSN). The access point accepts and assigns an association ID (AID). The link exists, but no data may pass yet: the keys are still missing.',
      ),
      fatos: [
        [t('AID', 'AID'), t('1', '1')],
        [t('Escuta', 'Listen interval'), t('A cada 10 beacons', 'Every 10 beacons')],
        [t('Porta 802.1X', '802.1X port'), t('Fechada até as chaves', 'Blocked until keys are set')],
      ],
      pacotes: [
        gerencia('celular', 'ap', 'assoc-req', t('ASSOC', 'ASSOC'), t(`Association Request, SSID="${SSID}"`, `Association Request, SSID="${SSID}"`), t('Quero me associar, com WPA2', 'I want to join, with WPA2'), 2, [
          capacidade,
          hex(t('Intervalo de escuta', 'Listen interval'), '0a 00', '10', t('Quantos beacons o celular pode dormir.', 'How many beacons the phone may sleep through.')),
          ...ssid,
          taxas,
          rsn,
        ]),
        gerencia('ap', 'celular', 'assoc-resp', t('ASSOC OK', 'ASSOC OK'), t('Association Response, status=Successful, AID=1', 'Association Response, status=Successful, AID=1'), t('Associado, AID 1', 'Associated, AID 1'), 2, [
          capacidade,
          hex(t('Status', 'Status'), '00 00', '0', t('Sucesso.', 'Success.')),
          hex(t('ID de associação', 'Association ID'), '01 c0', '1', t('Os dois bits altos são sempre 1; sobra o número 1.', 'The two top bits are always 1; what remains is 1.')),
          taxas,
        ]),
      ],
    },
    {
      titulo: t('Aperto de mão de 4 vias', '4-way handshake'),
      resumo: t('Chaves novas, sem enviar a senha', 'Fresh keys, password never sent'),
      descricao: t(
        'Os dois lados já têm a PMK, derivada da senha e do SSID com PBKDF2. O ponto de acesso manda um número aleatório (ANonce); o celular gera o seu (SNonce), calcula a chave da sessão (PTK) e prova que a tem com um MIC. O ponto de acesso confirma, entrega a chave de grupo cifrada e os dois instalam as chaves. Quem capturar isso pode tentar adivinhar a senha offline, o que o WPA3 resolve.',
        'Both sides already hold the PMK, derived from the password and SSID with PBKDF2. The access point sends a random number (ANonce); the phone makes its own (SNonce), computes the session key (PTK) and proves it has it with a MIC. The access point confirms, hands over the encrypted group key and both install the keys. Anyone who captures this can try to guess the password offline, which WPA3 fixes.',
      ),
      fatos: [
        [t('PMK', 'PMK'), t('PBKDF2(senha, SSID, 4096, 256 bits)', 'PBKDF2(password, SSID, 4096, 256 bits)')],
        [t('PTK', 'PTK'), t('PMK + ANonce + SNonce + 2 MACs', 'PMK + ANonce + SNonce + 2 MACs')],
        [t('Chave de grupo', 'Group key'), t('GTK, cifrada na mensagem 3', 'GTK, encrypted in message 3')],
        [t('Ponto fraco', 'Weak spot'), t('Ataque de dicionário offline', 'Offline dictionary attack')],
      ],
      pacotes: [chave(1, 3), chave(2, 4), chave(3, 3), chave(4, 2)],
    },
    {
      titulo: t('Endereço IP', 'IP address'),
      resumo: t('O primeiro tráfego protegido', 'The first protected traffic'),
      descricao: t(
        'Com as chaves instaladas, a porta se abre. O primeiro tráfego costuma ser o DHCP, para conseguir um endereço. No ar, cada quadro vai cifrado com AES-CCMP; aqui ele aparece já decifrado. Entre o ponto de acesso e o roteador, o mesmo pacote segue por cabo, em Ethernet.',
        'With the keys installed, the port opens. The first traffic is usually DHCP, to get an address. Over the air every frame is encrypted with AES-CCMP; here it is shown already decrypted. Between the access point and the router, the same packet continues over cable, as Ethernet.',
      ),
      fatos: [
        [t('Primeiro pedido', 'First request'), t('DHCP Discover', 'DHCP Discover')],
        [t('Cifra no ar', 'Over-the-air cipher'), t('AES-CCMP (128 bits)', 'AES-CCMP (128-bit)')],
        [t('Endereço', 'Address'), t(IP_CELULAR, IP_CELULAR)],
      ],
      pacotes: [
        {
          de: 'celular',
          para: 'roteador',
          proto: 'DHCP',
          rotulo: t('DHCP DISCOVER', 'DHCP DISCOVER'),
          info: t('DHCP Discover - ID da transação 0x5d2c810e', 'DHCP Discover - Transaction ID 0x5d2c810e'),
          tipo: 'dados',
          resumo: t('Preciso de um IP', 'I need an IP'),
          dt: 12,
          quadro: {
            enlace: 'wifi',
            wifi: 'dados',
            origemIp: '0.0.0.0',
            destinoIp: '255.255.255.255',
            udp: { origem: 68, destino: 67 },
            carga: bootp(1, '0.0.0.0', 1),
          },
        },
        {
          de: 'roteador',
          para: 'celular',
          proto: 'DHCP',
          rotulo: t('DHCP OFFER', 'DHCP OFFER'),
          info: t('DHCP Offer - ID da transação 0x5d2c810e', 'DHCP Offer - Transaction ID 0x5d2c810e'),
          tipo: 'dados',
          resumo: t(`Que tal ${IP_CELULAR}?`, `How about ${IP_CELULAR}?`),
          dt: 4,
          quadro: { origemIp: IP.roteador, destinoIp: IP_CELULAR, udp: { origem: 67, destino: 68 }, carga: bootp(2, IP_CELULAR, 2) },
        },
      ],
    },
  ],
};
