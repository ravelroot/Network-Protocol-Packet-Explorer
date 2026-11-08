import { hex, no, nos, t } from '../base';
import type { Campo, Pacote, Protocolo, Texto } from '../tipos';

const IP_ESTRATO2 = '203.0.113.123';
const IP_ESTRATO1 = '198.51.100.123';
const ZERO = '00 00 00 00 00 00 00 00';

const leituraRaiz = (raiz: string): string => {
  const v = raiz.split(' ').map((b) => parseInt(b, 16));
  const ms = (i: number): string => ((((v[i] ?? 0) << 24) + ((v[i + 1] ?? 0) << 16) + ((v[i + 2] ?? 0) << 8) + (v[i + 3] ?? 0)) / 65.536).toFixed(1);
  return `${ms(0)} ms, ${ms(4)} ms`;
};

interface Marcas {
  readonly referencia: string;
  readonly origem: string;
  readonly recebido: string;
  readonly transmitido: string;
}

const mensagem = (servidor: boolean, estrato: number, precisao: string, raiz: string, refId: string, refIdLegivel: string, m: Marcas, leituras: readonly [string, string, string, string]): Campo[] => [
  hex(
    t('LI, versão, modo', 'LI, version, mode'),
    servidor ? '24' : '23',
    servidor ? '0, 4, 4' : '0, 4, 3',
    servidor
      ? t('Sem aviso de segundo bissexto, NTPv4, modo 4: resposta de servidor.', 'No leap-second warning, NTPv4, mode 4: a server reply.')
      : t('Sem aviso de segundo bissexto, NTPv4, modo 3: pedido de cliente.', 'No leap-second warning, NTPv4, mode 3: a client request.'),
  ),
  hex(
    t('Estrato', 'Stratum'),
    estrato.toString(16).padStart(2, '0'),
    String(estrato),
    estrato === 0
      ? t('0 no pedido: o cliente não se declara fonte de nada.', '0 in a request: the client claims to be no source.')
      : estrato === 1
        ? t('1: ligado direto a um relógio de referência (GPS).', '1: wired straight to a reference clock (GPS).')
        : t('2: sincroniza com um servidor de estrato 1.', '2: syncs from a stratum 1 server.'),
  ),
  hex(t('Intervalo de consulta', 'Poll interval'), '06', '2^6 = 64 s', t('De quanto em quanto tempo o cliente volta a perguntar.', 'How often the client asks again.')),
  hex(t('Precisão', 'Precision'), precisao, precisao === 'e9' ? '2^-23 s' : '2^-25 s', t('A resolução do relógio de quem envia, em potência de 2.', 'The sender’s clock resolution, as a power of 2.')),
  hex(t('Atraso e dispersão até a raiz', 'Root delay and dispersion'), raiz, leituraRaiz(raiz), t('Quanto atraso e incerteza se acumulam até o relógio de referência.', 'How much delay and uncertainty pile up back to the reference clock.')),
  hex(t('ID de referência', 'Reference ID'), refId, refIdLegivel, t('Quem é a fonte deste relógio: um código (estrato 1) ou o IP do servidor acima (estrato 2).', 'Where this clock comes from: a code (stratum 1) or the upstream server’s IP (stratum 2).')),
  hex(t('Marca de referência', 'Reference timestamp'), m.referencia, leituras[0], t('Quando este relógio foi acertado pela última vez.', 'When this clock was last set.')),
  hex(t('Marca de origem (T1)', 'Origin timestamp (T1)'), m.origem, leituras[1], t('A hora que o cliente pôs no pedido, devolvida para casar a resposta.', 'The time the client put in its request, echoed back to match the reply.')),
  hex(t('Marca de recebimento (T2)', 'Receive timestamp (T2)'), m.recebido, leituras[2], t('Quando o pedido chegou ao servidor.', 'When the request reached the server.')),
  hex(t('Marca de envio (T3)', 'Transmit timestamp (T3)'), m.transmitido, leituras[3], t('Quando a mensagem saiu. Segundos desde 1900 + fração de 2^-32 s.', 'When the message left. Seconds since 1900 + a fraction in 2^-32 s.')),
];

const pacote = (de: string, para: string, servidor: boolean, legenda: string, rotulo: Texto, info: Texto, resumo: Texto, dt: number, ttl: number, carga: Campo[]): Pacote => ({
  de,
  para,
  proto: 'NTP',
  rotulo,
  info,
  tipo: legenda,
  resumo,
  dt,
  quadro: { ttl, udp: servidor ? { origem: 123, destino: de === 'estrato1' ? 123 : 51004 } : { origem: de === 'estrato2' ? 123 : 51004, destino: 123 }, carga },
});

const pedidoCliente = (transmitido: string, leitura: string): Campo[] =>
  mensagem(false, 0, 'e9', ZERO, '00 00 00 00', '—', { referencia: ZERO, origem: ZERO, recebido: ZERO, transmitido }, ['0', '0', '0', leitura]);

export const ntp: Protocolo = {
  id: 'ntp',
  sigla: 'NTP',
  nome: t('Protocolo de Tempo de Rede', 'Network Time Protocol'),
  resumo: t('Protocolo de Tempo de Rede', 'Network Time Protocol'),
  categoria: 'aplicacao',
  camada: 7,
  descricao: t(
    'O NTP mantém os relógios dos computadores certos, com erro de poucos milissegundos pela internet. Os servidores formam camadas (estratos): o estrato 1 lê um relógio de referência, como GPS ou relógio atômico, e cada nível abaixo sincroniza com o de cima. Com quatro marcas de tempo, o cliente separa o atraso da rede do erro do próprio relógio.',
    'NTP keeps computer clocks right, to within a few milliseconds across the internet. Servers form layers (strata): stratum 1 reads a reference clock such as GPS or an atomic clock, and every level below syncs from the one above. With four timestamps, the client separates network delay from its own clock error.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Porta', 'Port'), t('UDP 123', 'UDP 123')],
    [t('Mensagem', 'Message'), t('48 bytes, 4 marcas de 64 bits', '48 bytes, four 64-bit timestamps')],
    [t('Hierarquia', 'Hierarchy'), t('Estratos 1 a 15 (16 = sem sincronia)', 'Strata 1 to 15 (16 = unsynchronised)')],
    [t('Precisão', 'Accuracy'), t('~1 ms em rede local, ~10 ms na internet', '~1 ms on a LAN, ~10 ms over the internet')],
    [t('Definido em', 'Defined in'), t('RFC 5905', 'RFC 5905')],
  ],
  legenda: {
    pedido: { nome: t('Pedido (modo 3)', 'Request (mode 3)'), cor: 'ouro' },
    resposta: { nome: t('Resposta (modo 4)', 'Reply (mode 4)'), cor: 'oliva' },
    acima: { nome: t('Sincronia acima', 'Upstream sync'), cor: 'anil' },
  },
  observacao: t('Horários de 08/11/2026, em UTC', 'Times on 2026-11-08, in UTC'),
  nos: [
    nos.cliente(14, 72),
    nos.roteador(34, 56),
    nos.internet(56, 74),
    no('estrato2', 'relogio', t('Servidor NTP (estrato 2)', 'NTP Server (stratum 2)'), 64, 26, IP_ESTRATO2),
    no('estrato1', 'relogio', t('Estrato 1 (GPS)', 'Stratum 1 (GPS)'), 88, 44, IP_ESTRATO1),
  ],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'estrato2'],
    ['internet', 'estrato1'],
  ],
  faixas: ['cliente', 'estrato2', 'estrato1'],
  passos: [
    {
      titulo: t('Sincronia acima', 'Upstream sync'),
      resumo: t('O estrato 2 acerta com o estrato 1', 'Stratum 2 syncs from stratum 1'),
      descricao: t(
        'Antes de atender alguém, o servidor de estrato 2 pergunta a hora a um servidor de estrato 1, que tem um receptor GPS e se identifica com o código "GPS". O formato é o mesmo que o cliente vai usar: o NTP é igual em todos os níveis.',
        'Before serving anyone, the stratum 2 server asks a stratum 1 server for the time; that one has a GPS receiver and identifies itself with the code "GPS". The format is the same the client will use: NTP looks the same at every level.',
      ),
      fatos: [
        [t('Estrato 1', 'Stratum 1'), t(`${IP_ESTRATO1}, refid "GPS"`, `${IP_ESTRATO1}, refid "GPS"`)],
        [t('Estrato 2', 'Stratum 2'), t(IP_ESTRATO2, IP_ESTRATO2)],
        [t('Atraso', 'Delay'), t('0,4 ms', '0.4 ms')],
      ],
      pacotes: [
        pacote(
          'estrato2',
          'estrato1',
          false,
          'acima',
          t('PEDIDO NTP', 'NTP REQUEST'),
          t('NTP Version 4, client', 'NTP Version 4, client'),
          t('Que horas são?', 'What time is it?'),
          0,
          64,
          mensagem(false, 2, 'e7', '00 00 00 06 00 00 00 0e', 'c6 33 64 7b', IP_ESTRATO1, { referencia: 'ee 9a e0 04 80 00 00 00', origem: ZERO, recebido: ZERO, transmitido: 'ee 9a e2 84 19 99 99 99' }, [
            '11:48:20.500',
            '0',
            '0',
            '11:59:00.100',
          ]),
        ),
        pacote(
          'estrato1',
          'estrato2',
          true,
          'acima',
          t('RESPOSTA NTP', 'NTP REPLY'),
          t('NTP Version 4, server', 'NTP Version 4, server'),
          t('Hora do GPS', 'GPS time'),
          1,
          59,
          mensagem(true, 1, 'e7', '00 00 00 00 00 00 00 0a', '47 50 53 00', '"GPS"', { referencia: 'ee 9a e2 bf 00 00 00 00', origem: 'ee 9a e2 84 19 99 99 99', recebido: 'ee 9a e2 84 1a 9f be 76', transmitido: 'ee 9a e2 84 1a a6 4c 2f' }, [
            '11:59:59.000',
            '11:59:00.100',
            '11:59:00.104',
            '11:59:00.104',
          ]),
        ),
      ],
    },
    {
      titulo: t('Cliente pergunta', 'Client asks'),
      resumo: t('Envia a própria hora (T1)', 'Sends its own time (T1)'),
      descricao: t(
        'O notebook manda um pedido de 48 bytes quase todo em branco. Só a marca de envio é preenchida, com a hora do próprio relógio: T1 = 12:00:00,000. O relógio dele está atrasado, mas ele ainda não sabe quanto.',
        'The laptop sends a 48-byte request that is almost entirely blank. Only the transmit timestamp is filled, with its own clock’s time: T1 = 12:00:00.000. Its clock is behind, but it doesn’t yet know by how much.',
      ),
      fatos: [
        [t('T1 (relógio do cliente)', 'T1 (client clock)'), t('12:00:00,000', '12:00:00.000')],
        [t('Para', 'To'), t(`${IP_ESTRATO2}:123`, `${IP_ESTRATO2}:123`)],
        [t('Modo', 'Mode'), t('3 (cliente)', '3 (client)')],
      ],
      pacotes: [
        pacote(
          'cliente',
          'estrato2',
          false,
          'pedido',
          t('PEDIDO NTP', 'NTP REQUEST'),
          t('NTP Version 4, client', 'NTP Version 4, client'),
          t('T1 = 12:00:00,000', 'T1 = 12:00:00.000'),
          59900,
          64,
          pedidoCliente('ee 9a e2 c0 00 00 00 00', '12:00:00.000'),
        ),
      ],
    },
    {
      titulo: t('Servidor responde', 'Server replies'),
      resumo: t('Devolve T1 e acrescenta T2 e T3', 'Echoes T1 and adds T2 and T3'),
      descricao: t(
        'O servidor anota quando o pedido chegou (T2) e quando a resposta saiu (T3), devolve o T1 do cliente e informa o estrato 2 e quem é a fonte dele. O notebook marca a chegada com o próprio relógio: T4.',
        'The server notes when the request arrived (T2) and when the reply left (T3), echoes the client’s T1 and reports stratum 2 and its upstream source. The laptop stamps the arrival with its own clock: T4.',
      ),
      fatos: [
        [t('T2 (servidor)', 'T2 (server)'), t('12:00:00,262', '12:00:00.262')],
        [t('T3 (servidor)', 'T3 (server)'), t('12:00:00,263', '12:00:00.263')],
        [t('T4 (cliente)', 'T4 (client)'), t('12:00:00,026', '12:00:00.026')],
      ],
      pacotes: [
        pacote(
          'estrato2',
          'cliente',
          true,
          'resposta',
          t('RESPOSTA NTP', 'NTP REPLY'),
          t('NTP Version 4, server', 'NTP Version 4, server'),
          t('T2 = ,262 · T3 = ,263', 'T2 = .262 · T3 = .263'),
          25,
          57,
          mensagem(true, 2, 'e7', '00 00 00 1a 00 00 00 3b', 'c6 33 64 7b', IP_ESTRATO1, { referencia: 'ee 9a e0 04 80 00 00 00', origem: 'ee 9a e2 c0 00 00 00 00', recebido: 'ee 9a e2 c0 43 12 6e 97', transmitido: 'ee 9a e2 c0 43 53 f7 ce' }, [
            '11:48:20.500',
            '12:00:00.000',
            '12:00:00.262',
            '12:00:00.263',
          ]),
        ),
      ],
    },
    {
      titulo: t('Calcula o ajuste', 'Compute the offset'),
      resumo: t('Separa atraso de erro do relógio', 'Separates delay from clock error'),
      descricao: t(
        'Com as quatro marcas, o atraso de ida e volta é (T4 − T1) − (T3 − T2) = 25 ms, e o erro do relógio é ((T2 − T1) + (T3 − T4)) / 2 = +249,5 ms. A conta supõe que ida e volta levam o mesmo tempo; por isso a precisão cai em caminhos assimétricos.',
        'With the four timestamps, the round-trip delay is (T4 − T1) − (T3 − T2) = 25 ms and the clock offset is ((T2 − T1) + (T3 − T4)) / 2 = +249.5 ms. The math assumes both directions take the same time, so accuracy drops on asymmetric paths.',
      ),
      fatos: [
        [t('Atraso (δ)', 'Delay (δ)'), t('25 ms ida e volta', '25 ms round trip')],
        [t('Ajuste (θ)', 'Offset (θ)'), t('+249,5 ms (o cliente está atrasado)', '+249.5 ms (the client is behind)')],
        [t('Correção', 'Correction'), t('Acima de 128 ms: salta; abaixo: acelera aos poucos', 'Above 128 ms: step; below: slew gradually')],
      ],
      pacotes: [],
    },
    {
      titulo: t('Próximas consultas', 'Next polls'),
      resumo: t('Mantém o relógio na linha', 'Keeps the clock in line'),
      descricao: t(
        'Com o relógio acertado, o cliente volta a perguntar a cada 64 segundos e, conforme fica estável, espaça as consultas até 1024 segundos. Agora o ajuste medido é de só alguns milissegundos e é corrigido aos poucos, sem saltos.',
        'With the clock set, the client asks again every 64 seconds and, as things stabilise, stretches the interval up to 1024 seconds. The measured offset is now just a few milliseconds and is corrected gradually, with no jumps.',
      ),
      fatos: [
        [t('Intervalo', 'Interval'), t('64 s, subindo até 1024 s', '64 s, growing to 1024 s')],
        [t('Ajuste agora', 'Offset now'), t('+0,4 ms', '+0.4 ms')],
        [t('Correção', 'Correction'), t('Gradual (slew)', 'Gradual (slew)')],
      ],
      pacotes: [
        pacote(
          'cliente',
          'estrato2',
          false,
          'pedido',
          t('PEDIDO NTP', 'NTP REQUEST'),
          t('NTP Version 4, client', 'NTP Version 4, client'),
          t('T1 = 12:01:04,000', 'T1 = 12:01:04.000'),
          63975,
          64,
          pedidoCliente('ee 9a e3 00 00 00 00 00', '12:01:04.000'),
        ),
        pacote(
          'estrato2',
          'cliente',
          true,
          'resposta',
          t('RESPOSTA NTP', 'NTP REPLY'),
          t('NTP Version 4, server', 'NTP Version 4, server'),
          t('T2 = ,012 · T3 = ,012', 'T2 = .012 · T3 = .012'),
          25,
          57,
          mensagem(true, 2, 'e7', '00 00 00 1a 00 00 00 3b', 'c6 33 64 7b', IP_ESTRATO1, { referencia: 'ee 9a e0 04 80 00 00 00', origem: 'ee 9a e3 00 00 00 00 00', recebido: 'ee 9a e3 00 03 12 6e 97', transmitido: 'ee 9a e3 00 03 18 fc 50' }, [
            '11:48:20.500',
            '12:01:04.000',
            '12:01:04.012',
            '12:01:04.012',
          ]),
        ),
      ],
    },
  ],
};
