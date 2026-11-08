import { apertoDeMao, nos, opaco, t, texto } from '../base';
import type { Pacote, Protocolo } from '../tipos';

const CLIENTE = 49152;
const SERVIDOR = 80;

const segmento = (
  de: 'cliente' | 'servidor',
  flags: string,
  seq: number,
  ack: number,
  tipo: string,
  rotulo: string,
  extra: Partial<Pacote> = {},
  len = 0,
): Pacote => {
  const origem = de === 'cliente' ? CLIENTE : SERVIDOR;
  const destino = de === 'cliente' ? SERVIDOR : CLIENTE;
  const info = `${origem} → ${destino} [${flags.replace(/,/g, ', ')}] Seq=${seq} Ack=${ack}${len ? ` Len=${len}` : ''}`;
  return {
    de,
    para: de === 'cliente' ? 'servidor' : 'cliente',
    proto: 'TCP',
    rotulo: t(rotulo, rotulo),
    info: t(info, info),
    tipo,
    ...extra,
    quadro: {
      ...(de === 'servidor' ? { ttl: 52 } : {}),
      tcp: { origem, destino, seq, ack, flags, janela: de === 'cliente' ? 502 : 509 },
      ...(extra.quadro ?? {}),
    },
  };
};

const pedido = [
  texto(t('Linha de pedido', 'Request line'), 'GET / HTTP/1.1\r\n', t('O que a aplicação entregou ao TCP para enviar.', 'What the application handed to TCP to send.')),
  texto(t('Host', 'Host'), 'Host: www.example.com\r\n'),
  texto(t('User-Agent', 'User-Agent'), 'User-Agent: curl/8.9.1\r\n'),
  texto(t('Accept', 'Accept'), 'Accept: */*\r\n'),
  texto(t('Fim dos cabeçalhos', 'End of headers'), '\r\n', t('78 bytes ao todo: os bytes 1 a 78 do fluxo.', '78 bytes in total: bytes 1 to 78 of the stream.')),
];

const primeiroSegmento = [
  texto(t('Linha de status', 'Status line'), 'HTTP/1.1 200 OK\r\n'),
  texto(t('Content-Type', 'Content-Type'), 'Content-Type: text/html\r\n'),
  texto(t('Content-Length', 'Content-Length'), 'Content-Length: 2854\r\n'),
  texto(t('Fim dos cabeçalhos', 'End of headers'), '\r\n'),
  opaco(t('Corpo (início)', 'Body (start)'), 1394, t('Bytes 1 a 1460 do fluxo do servidor.', 'Bytes 1 to 1460 of the server’s stream.')),
];

const segundoSegmento = [opaco(t('Corpo (continuação)', 'Body (continued)'), 1460, t('Bytes 1461 a 2920 do fluxo do servidor.', 'Bytes 1461 to 2920 of the server’s stream.'))];

export const tcp: Protocolo = {
  id: 'tcp',
  sigla: 'TCP',
  nome: t('Protocolo de Controle de Transmissão', 'Transmission Control Protocol'),
  resumo: t('Protocolo de Controle de Transmissão', 'Transmission Control Protocol'),
  categoria: 'core',
  camada: 4,
  descricao: t(
    'O TCP transforma a entrega de melhor esforço da internet em um fluxo de bytes confiável e ordenado. Ele numera cada byte, confirma o que chega, reenvia o que se perde e regula o ritmo de quem envia para não afogar nem o outro lado nem a rede.',
    'TCP turns the internet’s best-effort packet delivery into a reliable, ordered stream of bytes. It numbers every byte, acknowledges what arrives, resends what goes missing and paces the sender so neither the other side nor the network is overwhelmed.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Transporte (camada 4)', 'Transport (Layer 4)')],
    [t('Conexão', 'Connection'), t('Aperto de mão em três vias', 'Three-way handshake')],
    [t('Confiabilidade', 'Reliability'), t('Números de sequência + ACKs', 'Sequence numbers + ACKs')],
    [t('Recuperação', 'Recovery'), t('Retransmissão', 'Retransmission')],
    [t('Cabeçalho', 'Header'), t('20–60 bytes', '20–60 bytes')],
    [t('Definido em', 'Defined in'), t('RFC 9293', 'RFC 9293')],
  ],
  legenda: {
    controle: { nome: t('Aperto de mão e ACKs', 'Handshake and ACKs'), cor: 'oliva' },
    notebook: { nome: t('Dados do notebook', 'Data from laptop'), cor: 'ouro' },
    servidor: { nome: t('Dados do servidor', 'Data from server'), cor: 'brasa' },
    fim: { nome: t('Encerramento (FIN)', 'Closing (FIN)'), cor: 'neutra' },
  },
  nos: [nos.cliente(), nos.roteador(), nos.internet(), nos.servidor()],
  ligacoes: [
    ['cliente', 'roteador'],
    ['roteador', 'internet'],
    ['internet', 'servidor'],
  ],
  faixas: ['cliente', 'servidor'],
  passos: [
    {
      titulo: t('Abrir conexão', 'Open connection'),
      resumo: t('Aperto de mão em três vias', 'Three-way handshake'),
      descricao: t(
        'O notebook manda um SYN com seu número de sequência inicial. O servidor responde SYN-ACK: confirma o número do notebook e envia o seu. O ACK final fecha o acordo. Os números reais são aleatórios; aqui contam a partir de 0, como o Wireshark mostra.',
        'The laptop sends a SYN with its initial sequence number. The server answers SYN-ACK: it acknowledges the laptop’s number and sends its own. The final ACK seals the deal. Real numbers are random; here they count from 0, as Wireshark shows them.',
      ),
      fatos: [
        [t('Portas', 'Ports'), t('49152 → 80', '49152 → 80')],
        [t('MSS', 'MSS'), t('1460 bytes por segmento', '1460 bytes per segment')],
        [t('Opções do SYN', 'SYN options'), t('MSS, SACK permitido, escala de janela', 'MSS, SACK permitted, window scale')],
        [t('Custo', 'Cost'), t('1 RTT antes do primeiro dado', '1 RTT before the first data')],
      ],
      pacotes: apertoDeMao({ de: 'cliente', para: 'servidor', portaCliente: CLIENTE, portaServidor: SERVIDOR, tipo: 'controle' }).map((p, i) => ({
        ...p,
        dt: i === 0 ? 0 : 17,
        quadro: { ...p.quadro, ...(i === 1 ? { ttl: 52 } : {}) },
      })),
    },
    {
      titulo: t('Enviar dados', 'Send data'),
      resumo: t('Cada byte é numerado', 'Every byte is numbered'),
      descricao: t(
        'O notebook envia 78 bytes de pedido. Eles ocupam as posições 1 a 78 do fluxo, então o servidor confirma com Ack=79: "recebi tudo até o 78, mande o 79". O TCP não conta mensagens, conta bytes.',
        'The laptop sends a 78-byte request. It fills positions 1 to 78 of the stream, so the server acknowledges with Ack=79: "I have everything up to 78, send 79 next". TCP does not count messages, it counts bytes.',
      ),
      fatos: [
        [t('Bytes enviados', 'Bytes sent'), t('78 (posições 1–78)', '78 (positions 1–78)')],
        [t('Flags', 'Flags'), t('PSH: entregue logo à aplicação', 'PSH: hand it to the app right away')],
        [t('Confirmação', 'Acknowledgement'), t('Ack=79, o próximo byte esperado', 'Ack=79, the next byte expected')],
      ],
      pacotes: [
        segmento('cliente', 'PSH,ACK', 1, 1, 'notebook', 'DATA', { dt: 0, quadro: { carga: pedido, camada: 'HTTP' } }, 78),
        segmento('servidor', 'ACK', 1, 79, 'controle', 'ACK', { dt: 17 }),
      ],
    },
    {
      titulo: t('Dois segmentos de volta', 'Two segments back'),
      resumo: t('Um deles se perde', 'One of them is lost'),
      descricao: t(
        'A resposta tem 2920 bytes, então o servidor a corta em dois segmentos de 1460, o tamanho máximo combinado no SYN. O primeiro se perde no caminho, por exemplo numa fila cheia de um roteador. O segundo chega normalmente.',
        'The response is 2920 bytes, so the server cuts it into two 1460-byte segments, the maximum agreed in the SYN. The first one is lost on the way, for example in a router’s full queue. The second one arrives normally.',
      ),
      fatos: [
        [t('Segmento 1', 'Segment 1'), t('Bytes 1–1460: perdido', 'Bytes 1–1460: lost')],
        [t('Segmento 2', 'Segment 2'), t('Bytes 1461–2920: chegou', 'Bytes 1461–2920: arrived')],
        [t('Causa comum', 'Common cause'), t('Fila cheia em um roteador', 'A full queue in a router')],
      ],
      pacotes: [
        segmento('servidor', 'ACK', 1, 79, 'servidor', 'DATA', { dt: 1, perdido: true, nota: t('SEGMENTO 1 PERDIDO', 'SEGMENT 1 LOST'), quadro: { carga: primeiroSegmento, camada: 'HTTP' } }, 1460),
        segmento('servidor', 'PSH,ACK', 1461, 79, 'servidor', 'DATA', { dt: 0, quadro: { carga: segundoSegmento, camada: 'HTTP' } }, 1460),
      ],
    },
    {
      titulo: t('Uma lacuna é notada', 'A gap is noticed'),
      resumo: t('ACK duplicado com SACK', 'Duplicate ACK with SACK'),
      descricao: t(
        'O notebook recebeu os bytes 1461 a 2920, mas não o começo. Ele não pode entregar nada fora de ordem à aplicação, então repete Ack=1 ("ainda espero o byte 1") e, com SACK, avisa exatamente qual bloco já tem.',
        'The laptop received bytes 1461 to 2920, but not the start. It cannot hand anything out of order to the application, so it repeats Ack=1 ("still waiting for byte 1") and, with SACK, says exactly which block it already has.',
      ),
      fatos: [
        [t('ACK duplicado', 'Duplicate ACK'), t('Ack=1 de novo', 'Ack=1 again')],
        [t('SACK', 'SACK'), t('Já tenho 1461–2921', 'Already have 1461–2921')],
        [t('Buffer', 'Buffer'), t('1460 bytes guardados fora de ordem', '1460 bytes held out of order')],
      ],
      pacotes: [
        {
          ...segmento('cliente', 'ACK', 79, 1, 'controle', 'DUP ACK', {
            dt: 17,
            quadro: { tcp: { origem: CLIENTE, destino: SERVIDOR, seq: 79, ack: 1, flags: 'ACK', janela: 502, sack: [1461, 2921] } },
          }),
          info: t('[ACK duplicado] 49152 → 80 [ACK] Seq=79 Ack=1 SLE=1461 SRE=2921', '[TCP Dup ACK] 49152 → 80 [ACK] Seq=79 Ack=1 SLE=1461 SRE=2921'),
        },
      ],
    },
    {
      titulo: t('Reenviar a lacuna', 'Resend the gap'),
      resumo: t('Só os bytes que faltam', 'Only the missing bytes'),
      descricao: t(
        'Graças ao SACK, o servidor reenvia apenas os bytes 1 a 1460, sem esperar o temporizador expirar (retransmissão rápida). Com a lacuna preenchida, o notebook confirma tudo de uma vez: Ack=2921.',
        'Thanks to SACK, the server resends only bytes 1 to 1460, without waiting for the timer to expire (fast retransmit). With the gap filled, the laptop acknowledges everything at once: Ack=2921.',
      ),
      fatos: [
        [t('Reenviado', 'Resent'), t('Bytes 1–1460', 'Bytes 1–1460')],
        [t('Gatilho', 'Trigger'), t('ACK duplicado + SACK, sem esperar o RTO', 'Duplicate ACK + SACK, no RTO wait')],
        [t('Confirmação final', 'Final acknowledgement'), t('Ack=2921', 'Ack=2921')],
      ],
      pacotes: [
        {
          ...segmento('servidor', 'ACK', 1, 79, 'servidor', 'RETX', { dt: 18, quadro: { carga: primeiroSegmento, camada: 'HTTP' } }, 1460),
          info: t('[Retransmissão rápida] 80 → 49152 [ACK] Seq=1 Ack=79 Len=1460', '[TCP Fast Retransmission] 80 → 49152 [ACK] Seq=1 Ack=79 Len=1460'),
        },
        segmento('cliente', 'ACK', 79, 2921, 'controle', 'ACK', { dt: 17 }),
      ],
    },
    {
      titulo: t('Fechar conexão', 'Close connection'),
      resumo: t('Cada lado se despede', 'Each side says goodbye'),
      descricao: t(
        'Cada direção do fluxo é fechada separadamente. O notebook envia FIN, o servidor confirma e depois manda o próprio FIN, que o notebook confirma. O notebook ainda espera um pouco em TIME_WAIT para absorver pacotes atrasados.',
        'Each direction of the stream is closed separately. The laptop sends FIN, the server acknowledges it and then sends its own FIN, which the laptop acknowledges. The laptop still waits a while in TIME_WAIT to absorb late packets.',
      ),
      fatos: [
        [t('Mensagens', 'Messages'), t('FIN, ACK, FIN, ACK', 'FIN, ACK, FIN, ACK')],
        [t('Estado final', 'Final state'), t('TIME_WAIT no notebook (2×MSL)', 'TIME_WAIT on the laptop (2×MSL)')],
        [t('FIN conta', 'FIN counts'), t('Ocupa 1 número de sequência', 'Uses up 1 sequence number')],
      ],
      pacotes: [
        segmento('cliente', 'FIN,ACK', 79, 2921, 'fim', 'FIN', { dt: 5 }),
        segmento('servidor', 'ACK', 2921, 80, 'fim', 'ACK', { dt: 17 }),
        segmento('servidor', 'FIN,ACK', 2921, 80, 'fim', 'FIN', { dt: 0 }),
        segmento('cliente', 'ACK', 80, 2922, 'fim', 'ACK', { dt: 17 }),
      ],
    },
  ],
};
