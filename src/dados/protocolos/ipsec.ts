import { hex, no, opaco, t } from '../base';
import type { Campo, Pacote, Protocolo } from '../tipos';

const SPI_I = 'a1 b2 c3 d4 e5 f6 07 18';
const SPI_R = '5e 8c 21 f0 9a 37 c4 6b';

const cabecalhoIke = (spiR: string, proximo: string, troca: string, flags: string, mensagem: string, tamanho: string, resumo: string): Campo[] => [
  hex(t('SPI do iniciador', 'Initiator SPI'), SPI_I, `0x${SPI_I.replace(/ /g, '')}`, t('Identifica esta associação IKE do lado da filial.', 'Identifies this IKE association on the branch side.'), true),
  hex(
    t('SPI do respondedor', 'Responder SPI'),
    spiR,
    `0x${spiR.replace(/ /g, '')}`,
    spiR.startsWith('00') ? t('Zero: a matriz ainda não escolheu o dela.', 'Zero: headquarters has not picked its own yet.') : t('Escolhido pela matriz.', 'Picked by headquarters.'),
    !spiR.startsWith('00'),
  ),
  hex(t('Próximo payload, versão', 'Next payload, version'), `${proximo} 20`, `${resumo}, IKEv2`),
  hex(t('Troca, flags', 'Exchange, flags'), `${troca} ${flags}`, troca === '22' ? 'IKE_SA_INIT' : 'IKE_AUTH', t('Tipo da troca; as flags dizem quem inicia e se é resposta.', 'Exchange type; the flags say who initiates and whether it is a response.')),
  hex(t('ID da mensagem', 'Message ID'), mensagem, String(parseInt(mensagem.replace(/ /g, ''), 16))),
  hex(t('Tamanho', 'Length'), tamanho, `${parseInt(tamanho.replace(/ /g, ''), 16)} bytes`),
];

const propostas = (): Campo[] => [
  hex(t('Payload SA', 'SA payload'), '22 00 00 28', '40 bytes', t('As propostas de criptografia para o próprio IKE.', 'The cryptographic proposals for IKE itself.')),
  hex(t('Proposta 1', 'Proposal 1'), '00 00 00 24 01 01 00 03', 'IKE, 3 transforms'),
  hex(t('Cifra', 'Encryption'), '03 00 00 0c 01 00 00 14 80 0e 01 00', 'AES-GCM-16, 256 bits', t('Cifra autenticada: dispensa um algoritmo de integridade separado.', 'Authenticated cipher: no separate integrity algorithm needed.')),
  hex(t('PRF', 'PRF'), '03 00 00 08 02 00 00 05', 'HMAC-SHA2-256'),
  hex(t('Grupo DH', 'DH group'), '00 00 00 08 04 00 00 1f', 'Curve25519 (31)'),
  hex(t('Payload KE', 'KE payload'), '28 00 00 28 00 1f 00 00', 'Curve25519, 32 bytes', t('A metade pública da troca Diffie-Hellman.', 'The public half of the Diffie-Hellman exchange.')),
  opaco(t('Chave pública', 'Public key'), 32),
  hex(t('Payload Nonce', 'Nonce payload'), '00 00 00 24', '32 bytes'),
  opaco(t('Nonce', 'Nonce'), 32, t('Aleatório: entra no cálculo das chaves.', 'Random: goes into the key derivation.')),
];

const ike = (deFilial: boolean, porta: number, base: Omit<Pacote, 'de' | 'para' | 'proto' | 'quadro'>, carga: Campo[]): Pacote => ({
  ...base,
  de: deFilial ? 'gwfilial' : 'gwmatriz',
  para: deFilial ? 'gwmatriz' : 'gwfilial',
  proto: 'ISAKMP',
  quadro: { ...(deFilial ? {} : { ttl: 55 }), udp: { origem: porta, destino: porta }, camada: 'IKEv2', carga },
});

const esp = (deFilial: boolean, spi: string, base: Omit<Pacote, 'de' | 'para' | 'proto' | 'quadro'>): Pacote => ({
  ...base,
  de: deFilial ? 'gwfilial' : 'gwmatriz',
  para: deFilial ? 'gwmatriz' : 'gwfilial',
  proto: 'ESP',
  quadro: {
    ...(deFilial ? {} : { ttl: 55 }),
    ipProtocolo: 50,
    camada: 'ESP',
    carga: [
      hex(t('SPI', 'SPI'), spi, `0x${spi.replace(/ /g, '')}`, t('Diz ao receptor qual SA (chaves e regras) usar.', 'Tells the receiver which SA (keys and rules) to use.'), true),
      hex(t('Sequência', 'Sequence'), '00 00 00 01', '1', t('Cresce a cada pacote: cópias repetidas são descartadas.', 'Grows with every packet: replayed copies are dropped.')),
      opaco(t('IV', 'IV'), 8, t('Vetor de inicialização do AES-GCM.', 'AES-GCM initialisation vector.')),
      opaco(t('Pacote original (cifrado)', 'Original packet (encrypted)'), 56, t('O pacote IP inteiro, com os IPs internos, mais o trailer ESP: tudo cifrado.', 'The whole IP packet, with the inner IPs, plus the ESP trailer: all encrypted.')),
      opaco(t('ICV', 'ICV'), 16, t('Etiqueta de integridade: qualquer bit alterado é detectado.', 'Integrity tag: any flipped bit is detected.')),
    ],
  },
});

const syn = { origem: 50322, destino: 443, seq: 0, flags: 'SYN', janela: 64240 };
const synAck = { origem: 443, destino: 50322, seq: 0, ack: 1, flags: 'SYN,ACK', janela: 65535 };

export const ipsec: Protocolo = {
  id: 'ipsec',
  sigla: 'IPsec',
  nome: t('Segurança do Protocolo de Internet', 'Internet Protocol Security'),
  resumo: t('Túneis VPN entre redes', 'Site-to-site VPN tunnels'),
  categoria: 'seguranca',
  camada: 3,
  descricao: t(
    'O IPsec protege pacotes IP na própria camada de rede. No modo túnel, dois gateways ligam a rede da filial à da matriz pela internet: cada pacote que vai de uma rede à outra é cifrado inteiro e embrulhado num novo pacote, entre os IPs públicos dos gateways. O IKEv2 negocia as chaves; o ESP carrega o tráfego cifrado. Os computadores das duas redes nem percebem.',
    'IPsec protects IP packets right at the network layer. In tunnel mode, two gateways link the branch network to headquarters across the internet: every packet from one network to the other is fully encrypted and wrapped in a new packet between the gateways’ public IPs. IKEv2 negotiates the keys; ESP carries the encrypted traffic. The computers on both networks never notice.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Rede (camada 3)', 'Network (Layer 3)')],
    [t('Portas', 'Ports'), t('UDP 500 e 4500 (IKE), protocolo IP 50 (ESP)', 'UDP 500 and 4500 (IKE), IP protocol 50 (ESP)')],
    [t('Modos', 'Modes'), t('Túnel (entre redes) e transporte (entre hosts)', 'Tunnel (network to network) and transport (host to host)')],
    [t('Chaves', 'Keys'), t('IKEv2 com Diffie-Hellman', 'IKEv2 with Diffie-Hellman')],
    [t('Criptografia', 'Cryptography'), t('AES-GCM, ChaCha20-Poly1305', 'AES-GCM, ChaCha20-Poly1305')],
    [t('Definido em', 'Defined in'), t('RFC 4301, RFC 4303, RFC 7296', 'RFC 4301, RFC 4303, RFC 7296')],
  ],
  legenda: {
    interno: { nome: t('Tráfego interno', 'Inner traffic'), cor: 'oliva' },
    ike: { nome: t('IKEv2', 'IKEv2'), cor: 'anil' },
    esp: { nome: t('ESP cifrado', 'Encrypted ESP'), cor: 'brasa' },
  },
  nos: [
    no('pc', 'notebook', t('PC da filial', 'Branch PC'), 10, 74, '10.1.0.10'),
    no('gwfilial', 'escudo', t('Gateway filial', 'Branch gateway'), 28, 52, '198.51.100.1'),
    no('internet', 'internet', t('Internet', 'Internet'), 50, 76),
    no('gwmatriz', 'escudo', t('Gateway matriz', 'HQ gateway'), 70, 50, '203.0.113.1'),
    no('servidor', 'servidor', t('Servidor da matriz', 'HQ server'), 90, 26, '10.2.0.20'),
  ],
  ligacoes: [
    ['pc', 'gwfilial'],
    ['gwfilial', 'internet'],
    ['internet', 'gwmatriz'],
    ['gwmatriz', 'servidor'],
  ],
  faixas: ['pc', 'gwfilial', 'gwmatriz', 'servidor'],
  passos: [
    {
      titulo: t('Tráfego interessante', 'Interesting traffic'),
      resumo: t('Um pacote rumo à matriz', 'A packet bound for headquarters'),
      descricao: t(
        'O PC da filial abre uma conexão com 10.2.0.20, um servidor da matriz. O pacote vai ao gateway como qualquer outro. O gateway vê que o destino casa com a política 10.1.0.0/16 ↔ 10.2.0.0/16 e que ainda não existe túnel: segura o pacote e começa a negociar.',
        'The branch PC opens a connection to 10.2.0.20, a server at headquarters. The packet goes to the gateway like any other. The gateway sees that the destination matches the 10.1.0.0/16 ↔ 10.2.0.0/16 policy and that no tunnel exists yet: it holds the packet and starts negotiating.',
      ),
      fatos: [
        [t('Política', 'Policy'), t('10.1.0.0/16 ↔ 10.2.0.0/16', '10.1.0.0/16 ↔ 10.2.0.0/16')],
        [t('Ação', 'Action'), t('Proteger (ESP em modo túnel)', 'Protect (ESP in tunnel mode)')],
        [t('Túnel', 'Tunnel'), t('Ainda não existe', 'Does not exist yet')],
      ],
      pacotes: [
        {
          de: 'pc',
          para: 'gwfilial',
          proto: 'TCP',
          rotulo: t('SYN', 'SYN'),
          info: t('50322 → 443 [SYN] Seq=0', '50322 → 443 [SYN] Seq=0'),
          tipo: 'interno',
          resumo: t('10.1.0.10 → 10.2.0.20, em claro na rede da filial', '10.1.0.10 → 10.2.0.20, in clear on the branch network'),
          dt: 0,
          nota: t('SEM TÚNEL AINDA', 'NO TUNNEL YET'),
          quadro: { destinoIp: '10.2.0.20', tcp: syn },
        },
      ],
    },
    {
      titulo: t('IKE_SA_INIT', 'IKE_SA_INIT'),
      resumo: t('Algoritmos e Diffie-Hellman', 'Algorithms and Diffie-Hellman'),
      descricao: t(
        'O gateway da filial propõe os algoritmos (AES-GCM, SHA-256, Curve25519) e já envia sua chave Diffie-Hellman e um nonce. A matriz aceita a proposta e responde com a dela. Os dois calculam um segredo comum, que protege o resto da negociação. Até aqui, nada foi autenticado.',
        'The branch gateway proposes algorithms (AES-GCM, SHA-256, Curve25519) and already sends its Diffie-Hellman key and a nonce. Headquarters accepts the proposal and answers with its own. Both compute a shared secret that protects the rest of the negotiation. So far, nothing has been authenticated.',
      ),
      fatos: [
        [t('Porta', 'Port'), t('UDP 500', 'UDP 500')],
        [t('Proposta', 'Proposal'), t('AES-GCM-256, HMAC-SHA2-256, Curve25519', 'AES-GCM-256, HMAC-SHA2-256, Curve25519')],
        [t('Resultado', 'Result'), t('IKE SA cifrada, ainda sem identidade', 'Encrypted IKE SA, identity not yet proven')],
      ],
      pacotes: [
        ike(
          true,
          500,
          { rotulo: t('IKE_SA_INIT', 'IKE_SA_INIT'), info: t('IKE_SA_INIT MID=00 Iniciador Pedido', 'IKE_SA_INIT MID=00 Initiator Request'), tipo: 'ike', resumo: t('SA, KE (Curve25519), Nonce', 'SA, KE (Curve25519), Nonce'), dt: 1 },
          [...cabecalhoIke('00 00 00 00 00 00 00 00', '21', '22', '08', '00 00 00 00', '00 00 00 90', 'SA'), ...propostas()],
        ),
        ike(
          false,
          500,
          { rotulo: t('IKE_SA_INIT', 'IKE_SA_INIT'), info: t('IKE_SA_INIT MID=00 Respondedor Resposta', 'IKE_SA_INIT MID=00 Responder Response'), tipo: 'ike', resumo: t('Proposta aceita, KE e Nonce da matriz', 'Proposal accepted, HQ KE and Nonce'), dt: 31 },
          [...cabecalhoIke(SPI_R, '21', '22', '20', '00 00 00 00', '00 00 00 90', 'SA'), ...propostas()],
        ),
      ],
    },
    {
      titulo: t('IKE_AUTH', 'IKE_AUTH'),
      resumo: t('Identidades e a SA do ESP', 'Identities and the ESP SA'),
      descricao: t(
        'Agora tudo vai cifrado e na porta 4500. Cada gateway envia sua identidade e uma prova (assinatura com certificado ou chave pré-compartilhada), além dos seletores de tráfego e da proposta para o ESP. Ao final existe uma CHILD_SA: um par de SPIs, um para cada sentido, com suas próprias chaves.',
        'Everything is now encrypted and on port 4500. Each gateway sends its identity and a proof (a certificate signature or a pre-shared key), plus the traffic selectors and the ESP proposal. At the end there is a CHILD_SA: a pair of SPIs, one per direction, each with its own keys.',
      ),
      fatos: [
        [t('Porta', 'Port'), t('UDP 4500 (com marcador não-ESP)', 'UDP 4500 (with non-ESP marker)')],
        [t('Autenticação', 'Authentication'), t('Certificados X.509 ou PSK', 'X.509 certificates or PSK')],
        [t('Seletores', 'Selectors'), t('TSi 10.1.0.0/16, TSr 10.2.0.0/16', 'TSi 10.1.0.0/16, TSr 10.2.0.0/16')],
        [t('CHILD_SA', 'CHILD_SA'), t('SPI 0xc81f22a0 / 0x7d40e193', 'SPI 0xc81f22a0 / 0x7d40e193')],
      ],
      pacotes: [
        ike(
          true,
          4500,
          { rotulo: t('IKE_AUTH', 'IKE_AUTH'), info: t('IKE_AUTH MID=01 Iniciador Pedido', 'IKE_AUTH MID=01 Initiator Request'), tipo: 'ike', resumo: t('IDi, AUTH, SAi2, TSi, TSr (cifrados)', 'IDi, AUTH, SAi2, TSi, TSr (encrypted)'), dt: 2 },
          [
            hex(t('Marcador não-ESP', 'Non-ESP marker'), '00 00 00 00', '0', t('Na porta 4500, separa IKE de ESP encapsulado.', 'On port 4500, tells IKE apart from encapsulated ESP.')),
            ...cabecalhoIke(SPI_R, '2e', '23', '08', '00 00 00 01', '00 00 01 08', 'SK'),
            hex(t('Payload cifrado (SK)', 'Encrypted payload (SK)'), '23 00 00 ec', '236 bytes'),
            opaco(t('IV', 'IV'), 8),
            opaco(t('Payloads cifrados', 'Encrypted payloads'), 208, t('Identidade, prova de autenticação e seletores de tráfego.', 'Identity, authentication proof and traffic selectors.')),
            opaco(t('ICV', 'ICV'), 16),
          ],
        ),
        ike(
          false,
          4500,
          { rotulo: t('IKE_AUTH', 'IKE_AUTH'), info: t('IKE_AUTH MID=01 Respondedor Resposta', 'IKE_AUTH MID=01 Responder Response'), tipo: 'ike', resumo: t('IDr, AUTH, SAr2, TSi, TSr (cifrados)', 'IDr, AUTH, SAr2, TSi, TSr (encrypted)'), dt: 34 },
          [
            hex(t('Marcador não-ESP', 'Non-ESP marker'), '00 00 00 00', '0'),
            ...cabecalhoIke(SPI_R, '2e', '23', '20', '00 00 00 01', '00 00 00 f8', 'SK'),
            hex(t('Payload cifrado (SK)', 'Encrypted payload (SK)'), '24 00 00 dc', '220 bytes'),
            opaco(t('IV', 'IV'), 8),
            opaco(t('Payloads cifrados', 'Encrypted payloads'), 192),
            opaco(t('ICV', 'ICV'), 16),
          ],
        ),
      ],
    },
    {
      titulo: t('ESP pelo túnel', 'ESP through the tunnel'),
      resumo: t('O pacote original vai cifrado', 'The original packet travels encrypted'),
      descricao: t(
        'O gateway da filial pega o SYN que estava segurando, cifra o pacote inteiro (com os IPs internos) e o coloca dentro de um ESP entre os IPs públicos. Na internet só se vê 198.51.100.1 falando com 203.0.113.1. Como não há NAT no caminho, o ESP vai direto sobre IP, protocolo 50. A matriz decifra e entrega o SYN original ao servidor.',
        'The branch gateway takes the SYN it was holding, encrypts the whole packet (inner IPs included) and puts it inside ESP between the public IPs. On the internet one only sees 198.51.100.1 talking to 203.0.113.1. With no NAT on the path, ESP rides directly on IP, protocol 50. Headquarters decrypts it and delivers the original SYN to the server.',
      ),
      fatos: [
        [t('IPs externos', 'Outer IPs'), t('198.51.100.1 → 203.0.113.1', '198.51.100.1 → 203.0.113.1')],
        [t('IPs internos', 'Inner IPs'), t('10.1.0.10 → 10.2.0.20 (cifrados)', '10.1.0.10 → 10.2.0.20 (encrypted)')],
        [t('Com NAT', 'With NAT'), t('ESP iria dentro de UDP 4500', 'ESP would go inside UDP 4500')],
      ],
      pacotes: [
        esp(true, 'c8 1f 22 a0', { rotulo: t('ESP', 'ESP'), info: t('ESP (SPI=0xc81f22a0)', 'ESP (SPI=0xc81f22a0)'), tipo: 'esp', resumo: t('SYN da filial, cifrado no túnel', 'Branch SYN, encrypted in the tunnel'), dt: 1 }),
        {
          de: 'gwmatriz',
          para: 'servidor',
          proto: 'TCP',
          rotulo: t('SYN', 'SYN'),
          info: t('50322 → 443 [SYN] Seq=0', '50322 → 443 [SYN] Seq=0'),
          tipo: 'interno',
          resumo: t('Decifrado e entregue: 10.1.0.10 → 10.2.0.20', 'Decrypted and delivered: 10.1.0.10 → 10.2.0.20'),
          dt: 16,
          quadro: { origemIp: '10.1.0.10', ttl: 62, tcp: syn },
        },
      ],
    },
    {
      titulo: t('A resposta volta', 'The reply comes back'),
      resumo: t('Mesmo túnel, outro SPI', 'Same tunnel, another SPI'),
      descricao: t(
        'O servidor responde ao PC normalmente, como se ele estivesse na mesma rede. O gateway da matriz cifra a resposta com a SA do sentido inverso, de SPI próprio, e a filial a entrega ao PC. Daqui em diante todo o tráfego entre as redes segue assim, e as chaves são renovadas periodicamente com CREATE_CHILD_SA.',
        'The server answers the PC as if it were on the same network. The headquarters gateway encrypts the reply with the reverse-direction SA, which has its own SPI, and the branch delivers it to the PC. From now on all traffic between the networks flows this way, and keys are renewed periodically with CREATE_CHILD_SA.',
      ),
      fatos: [
        [t('SPI de volta', 'Return SPI'), t('0x7d40e193', '0x7d40e193')],
        [t('Para os PCs', 'For the PCs'), t('Transparente: nada a configurar', 'Transparent: nothing to configure')],
        [t('Renovação', 'Rekeying'), t('CREATE_CHILD_SA', 'CREATE_CHILD_SA')],
      ],
      pacotes: [
        {
          de: 'servidor',
          para: 'gwmatriz',
          proto: 'TCP',
          rotulo: t('SYN-ACK', 'SYN-ACK'),
          info: t('443 → 50322 [SYN, ACK] Seq=0 Ack=1', '443 → 50322 [SYN, ACK] Seq=0 Ack=1'),
          tipo: 'interno',
          resumo: t('10.2.0.20 → 10.1.0.10', '10.2.0.20 → 10.1.0.10'),
          dt: 1,
          quadro: { destinoIp: '10.1.0.10', tcp: synAck },
        },
        esp(false, '7d 40 e1 93', { rotulo: t('ESP', 'ESP'), info: t('ESP (SPI=0x7d40e193)', 'ESP (SPI=0x7d40e193)'), tipo: 'esp', resumo: t('SYN-ACK cifrado de volta à filial', 'SYN-ACK encrypted back to the branch'), dt: 1 }),
        {
          de: 'gwfilial',
          para: 'pc',
          proto: 'TCP',
          rotulo: t('SYN-ACK', 'SYN-ACK'),
          info: t('443 → 50322 [SYN, ACK] Seq=0 Ack=1', '443 → 50322 [SYN, ACK] Seq=0 Ack=1'),
          tipo: 'interno',
          resumo: t('Entregue ao PC da filial', 'Delivered to the branch PC'),
          dt: 16,
          quadro: { origemIp: '10.2.0.20', ttl: 62, tcp: synAck },
        },
      ],
    },
  ],
};
