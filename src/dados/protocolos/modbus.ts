import { apertoDeMao, hex, no, t } from '../base';
import { criarFluxo, numeroHex } from '../fluxo-tcp';
import type { Campo, Protocolo } from '../tipos';

const operador = criarFluxo('scada', 'plc', 49200, 502);
const intruso = criarFluxo('invasor', 'plc', 53001, 502);

const mbap = (transacao: number, tamanho: number): Campo[] => [
  hex(t('ID da transação', 'Transaction ID'), numeroHex(transacao, 2), String(transacao), t('Casa cada resposta com o seu pedido.', 'Matches each response to its request.')),
  hex(t('ID do protocolo', 'Protocol ID'), '00 00', '0 (Modbus)', t('Sempre 0 no Modbus.', 'Always 0 for Modbus.')),
  hex(t('Tamanho', 'Length'), numeroHex(tamanho, 2), `${tamanho} bytes`, t('Quantos bytes vêm depois: unidade mais PDU.', 'How many bytes follow: unit plus PDU.')),
  hex(t('Unidade', 'Unit ID'), '01', '1', t('Escravo de destino, herança das redes seriais.', 'Target slave, a legacy of serial networks.')),
];

const consulta = (transacao: number, funcao: string) =>
  t(`Consulta: Trans: ${transacao}; Unidade: 1, Função ${funcao}`, `Query: Trans: ${transacao}; Unit: 1, Func: ${funcao}`);

const resposta = (transacao: number, funcao: string) =>
  t(`Resposta: Trans: ${transacao}; Unidade: 1, Função ${funcao}`, `Response: Trans: ${transacao}; Unit: 1, Func: ${funcao}`);

const escrita = (transacao: number, valor: string, exibicao: string): Campo[] => [
  ...mbap(transacao, 6),
  hex(t('Função', 'Function'), '06', 'Write Single Register (6)', t('Grava um único registrador.', 'Writes a single register.')),
  hex(t('Registrador', 'Register'), '00 0a', '10 (40011): setpoint', t('O ponto de ajuste da temperatura do forno.', "The oven's temperature setpoint.")),
  hex(t('Valor', 'Value'), valor, exibicao, t('Em décimos de grau.', 'In tenths of a degree.')),
];

export const modbus: Protocolo = {
  id: 'modbus',
  sigla: 'Modbus',
  nome: t('Modbus/TCP', 'Modbus/TCP'),
  resumo: t('Controle industrial (OT)', 'Industrial control (OT)'),
  categoria: 'aplicacao',
  camada: 7,
  descricao: t(
    'O Modbus é o idioma mais antigo e comum das fábricas: um supervisório (SCADA) lê e grava registradores de 16 bits em controladores lógicos (CLPs) que comandam fornos, bombas e válvulas. A versão TCP só põe um cabeçalho de 7 bytes, o MBAP, na frente da mensagem serial de 1979. Não há login nem criptografia: qualquer aparelho que alcance a porta 502 pode ler e mandar.',
    'Modbus is the oldest and most common language on the factory floor: a supervisory system (SCADA) reads and writes 16-bit registers on programmable logic controllers (PLCs) that drive ovens, pumps and valves. The TCP version just puts a 7-byte header, MBAP, in front of the 1979 serial message. There is no login and no encryption: any device that can reach port 502 can read and command.',
  ),
  fatos: [
    [t('Camada', 'Layer'), t('Aplicação (camada 7)', 'Application (Layer 7)')],
    [t('Porta', 'Port'), t('TCP 502 (802 com TLS)', 'TCP 502 (802 with TLS)')],
    [t('Transporte', 'Transport'), t('TCP, ou serial RTU/ASCII', 'TCP, or serial RTU/ASCII')],
    [t('Modelo', 'Model'), t('Cliente/servidor, registradores de 16 bits', 'Client/server, 16-bit registers')],
    [t('Segurança', 'Security'), t('Nenhuma autenticação nem criptografia', 'No authentication, no encryption')],
    [t('Definido em', 'Defined in'), t('Modbus Application Protocol v1.1b3', 'Modbus Application Protocol v1.1b3')],
  ],
  legenda: {
    tcp: { nome: t('TCP', 'TCP'), cor: 'oliva' },
    leitura: { nome: t('Leitura', 'Read'), cor: 'anil' },
    escrita: { nome: t('Escrita', 'Write'), cor: 'ouro' },
    alerta: { nome: t('Exceção e risco', 'Exception and risk'), cor: 'brasa' },
  },
  observacao: t('ACKs puros não aparecem', 'Bare ACKs not shown'),
  nos: [
    no('scada', 'servidor', t('SCADA / IHM', 'SCADA / HMI'), 16, 70, '10.10.0.5'),
    no('invasor', 'notebook', t('Notebook na rede', 'Rogue laptop'), 32, 24, '10.10.0.99'),
    no('plc', 'plc', t('CLP do forno', 'Oven PLC'), 78, 48, '10.10.0.20'),
  ],
  ligacoes: [
    ['scada', 'plc'],
    ['invasor', 'plc'],
  ],
  faixas: ['scada', 'invasor', 'plc'],
  passos: [
    {
      titulo: t('Conexão TCP', 'TCP connection'),
      resumo: t('O SCADA chega à porta 502', 'SCADA reaches port 502'),
      descricao: t(
        'O supervisório abre uma conexão TCP com o CLP do forno na porta 502 e a mantém aberta, consultando o equipamento a cada segundo. Tudo acontece na rede industrial (OT), que deveria ser separada da rede do escritório.',
        'The supervisory system opens a TCP connection to the oven PLC on port 502 and keeps it open, polling the device every second. It all happens on the industrial (OT) network, which should be separate from the office network.',
      ),
      fatos: [
        [t('CLP', 'PLC'), t('10.10.0.20:502', '10.10.0.20:502')],
        [t('Ciclo de leitura', 'Polling cycle'), t('1 segundo', '1 second')],
        [t('Rede', 'Network'), t('OT, segmentada', 'OT, segmented')],
      ],
      pacotes: apertoDeMao({ de: 'scada', para: 'plc', portaCliente: 49200, portaServidor: 502, tipo: 'tcp' }).map((p, i) => ({ ...p, dt: i === 0 ? 0 : 1 })),
    },
    {
      titulo: t('Leitura de registradores', 'Read registers'),
      resumo: t('Função 03: temperatura e pressão', 'Function 03: temperature and pressure'),
      descricao: t(
        'O SCADA pede dois holding registers a partir do endereço 0. O CLP responde com 4 bytes: 0x00E6 (230, ou seja, 23,0 °C) e 0x012C (300, ou 3,00 bar). O Modbus só transporta números; o significado e a escala de cada registrador vêm da documentação do equipamento.',
        'SCADA asks for two holding registers starting at address 0. The PLC answers with 4 bytes: 0x00E6 (230, meaning 23.0 °C) and 0x012C (300, or 3.00 bar). Modbus only carries numbers; the meaning and scale of each register come from the device documentation.',
      ),
      fatos: [
        [t('Função', 'Function'), t('03 Read Holding Registers', '03 Read Holding Registers')],
        [t('Endereços', 'Addresses'), t('0 e 1 (40001–40002)', '0 and 1 (40001–40002)')],
        [t('Valores', 'Values'), t('23,0 °C e 3,00 bar', '23.0 °C and 3.00 bar')],
      ],
      pacotes: [
        operador.cliente({
          proto: 'Modbus/TCP',
          rotulo: t('LER 2 REGS', 'READ 2 REGS'),
          info: consulta(1, '3: Read Holding Registers'),
          tipo: 'leitura',
          resumo: t('Ler 2 registradores a partir do 0', 'Read 2 registers from 0'),
          dt: 1,
          camada: 'Modbus',
          carga: [
            ...mbap(1, 6),
            hex(t('Função', 'Function'), '03', 'Read Holding Registers (3)', t('Ler registradores de 16 bits.', 'Read 16-bit registers.')),
            hex(t('Endereço inicial', 'Start address'), '00 00', '0 (40001)'),
            hex(t('Quantidade', 'Quantity'), '00 02', '2'),
          ],
        }),
        operador.servidor({
          proto: 'Modbus/TCP',
          rotulo: t('23,0 °C · 3,00 bar', '23.0 °C · 3.00 bar'),
          info: resposta(1, '3: Read Holding Registers'),
          tipo: 'leitura',
          resumo: t('0x00E6 = 23,0 °C · 0x012C = 3,00 bar', '0x00E6 = 23.0 °C · 0x012C = 3.00 bar'),
          dt: 4,
          camada: 'Modbus',
          carga: [
            ...mbap(1, 7),
            hex(t('Função', 'Function'), '03', 'Read Holding Registers (3)'),
            hex(t('Contagem de bytes', 'Byte count'), '04', '4'),
            hex(t('Registrador 0', 'Register 0'), '00 e6', '230 → 23,0 °C', t('Temperatura em décimos de grau.', 'Temperature in tenths of a degree.')),
            hex(t('Registrador 1', 'Register 1'), '01 2c', '300 → 3,00 bar', t('Pressão em centésimos de bar.', 'Pressure in hundredths of a bar.')),
          ],
        }),
      ],
    },
    {
      titulo: t('Escrita de um registrador', 'Write a register'),
      resumo: t('Função 06: novo setpoint', 'Function 06: new setpoint'),
      descricao: t(
        'O operador ajusta o forno para 25,0 °C na tela do SCADA. A função 06 grava o valor 250 no registrador 10. Quando dá certo, o CLP devolve exatamente a mesma mensagem como confirmação.',
        'The operator sets the oven to 25.0 °C on the SCADA screen. Function 06 writes the value 250 to register 10. On success, the PLC echoes the exact same message back as confirmation.',
      ),
      fatos: [
        [t('Função', 'Function'), t('06 Write Single Register', '06 Write Single Register')],
        [t('Registrador', 'Register'), t('10 (40011): setpoint', '10 (40011): setpoint')],
        [t('Confirmação', 'Confirmation'), t('Eco idêntico do pedido', 'Identical echo of the request')],
      ],
      pacotes: [
        operador.cliente({ proto: 'Modbus/TCP', rotulo: t('GRAVAR 25,0 °C', 'WRITE 25.0 °C'), info: consulta(2, '6: Write Single Register'), tipo: 'escrita', resumo: t('Setpoint = 250 (25,0 °C)', 'Setpoint = 250 (25.0 °C)'), dt: 600, camada: 'Modbus', carga: escrita(2, '00 fa', '250 → 25,0 °C') }),
        operador.servidor({ proto: 'Modbus/TCP', rotulo: t('ECO', 'ECHO'), info: resposta(2, '6: Write Single Register'), tipo: 'escrita', resumo: t('Gravado: o CLP repete o pedido', 'Written: the PLC repeats the request'), dt: 5, camada: 'Modbus', carga: escrita(2, '00 fa', '250 → 25,0 °C') }),
      ],
    },
    {
      titulo: t('Exceção', 'Exception'),
      resumo: t('Endereço que não existe', 'An address that does not exist'),
      descricao: t(
        'Um pedido mal configurado tenta ler o registrador 10000, que este CLP não tem. Em vez de dados, ele responde com o código da função somado a 0x80 (0x83) e o código de exceção 02, Illegal Data Address. É assim que o Modbus avisa de erros.',
        'A misconfigured request tries to read register 10000, which this PLC does not have. Instead of data, it answers with the function code plus 0x80 (0x83) and exception code 02, Illegal Data Address. That is how Modbus reports errors.',
      ),
      fatos: [
        [t('Resposta', 'Response'), t('Função 0x83 = 0x03 + 0x80', 'Function 0x83 = 0x03 + 0x80')],
        [t('Código', 'Code'), t('02 Illegal Data Address', '02 Illegal Data Address')],
        [t('Outros', 'Others'), t('01 função ilegal, 03 valor ilegal, 04 falha no escravo', '01 illegal function, 03 illegal value, 04 slave failure')],
      ],
      pacotes: [
        operador.cliente({
          proto: 'Modbus/TCP',
          rotulo: t('LER 10000', 'READ 10000'),
          info: consulta(3, '3: Read Holding Registers'),
          tipo: 'leitura',
          resumo: t('Ler 1 registrador no endereço 10000', 'Read 1 register at address 10000'),
          dt: 400,
          camada: 'Modbus',
          carga: [
            ...mbap(3, 6),
            hex(t('Função', 'Function'), '03', 'Read Holding Registers (3)'),
            hex(t('Endereço inicial', 'Start address'), '27 10', '10000', t('Fora do mapa de memória do CLP.', "Outside the PLC's memory map.")),
            hex(t('Quantidade', 'Quantity'), '00 01', '1'),
          ],
        }),
        operador.servidor({
          proto: 'Modbus/TCP',
          rotulo: t('EXCEÇÃO 02', 'EXCEPTION 02'),
          info: t('Resposta: Trans: 3; Unidade: 1, Função 3: Read Holding Registers. Exceção retornada', 'Response: Trans: 3; Unit: 1, Func: 3: Read Holding Registers. Exception returned'),
          tipo: 'alerta',
          resumo: t('0x83 · 02 Illegal Data Address', '0x83 · 02 Illegal Data Address'),
          dt: 4,
          nota: t('ENDEREÇO ILEGAL', 'ILLEGAL ADDRESS'),
          camada: 'Modbus',
          carga: [
            ...mbap(3, 3),
            hex(t('Função', 'Function'), '83', '0x03 + 0x80', t('O bit mais alto ligado indica erro.', 'The top bit set signals an error.')),
            hex(t('Código de exceção', 'Exception code'), '02', 'Illegal Data Address'),
          ],
        }),
      ],
    },
    {
      titulo: t('Sem autenticação', 'No authentication'),
      resumo: t('Qualquer um na rede pode mandar', 'Anyone on the network can command'),
      descricao: t(
        'Um notebook ligado à rede industrial abre sua própria conexão e grava 1000 (100,0 °C) no setpoint. O CLP obedece e confirma, porque o Modbus não tem como saber quem está falando. A defesa fica fora do protocolo: segmentar a rede OT, liberar só os IPs do SCADA no firewall, monitorar escritas e, onde possível, usar Modbus/TCP Security com TLS na porta 802.',
        'A laptop plugged into the industrial network opens its own connection and writes 1000 (100.0 °C) to the setpoint. The PLC obeys and confirms, because Modbus has no way to know who is talking. The defence lives outside the protocol: segment the OT network, allow only SCADA IPs on the firewall, monitor writes and, where possible, use Modbus/TCP Security with TLS on port 802.',
      ),
      fatos: [
        [t('Origem', 'Source'), t('10.10.0.99 (não autorizado)', '10.10.0.99 (unauthorised)')],
        [t('Resultado', 'Result'), t('Setpoint alterado para 100,0 °C', 'Setpoint changed to 100.0 °C')],
        [t('Defesa', 'Defence'), t('Segmentação, allow-list, monitoramento, TLS (802)', 'Segmentation, allow-list, monitoring, TLS (802)')],
      ],
      pacotes: [
        ...apertoDeMao({ de: 'invasor', para: 'plc', portaCliente: 53001, portaServidor: 502, tipo: 'tcp' }).map((p, i) => ({ ...p, dt: i === 0 ? 900 : 1 })),
        intruso.cliente({ proto: 'Modbus/TCP', rotulo: t('GRAVAR 100,0 °C', 'WRITE 100.0 °C'), info: consulta(1, '6: Write Single Register'), tipo: 'alerta', resumo: t('Setpoint = 1000 (100,0 °C), sem nenhuma senha', 'Setpoint = 1000 (100.0 °C), with no password at all'), dt: 1, nota: t('SEM LOGIN', 'NO LOGIN'), camada: 'Modbus', carga: escrita(1, '03 e8', '1000 → 100,0 °C') }),
        intruso.servidor({ proto: 'Modbus/TCP', rotulo: t('ECO', 'ECHO'), info: resposta(1, '6: Write Single Register'), tipo: 'alerta', resumo: t('Aceito: o CLP não sabe quem pediu', 'Accepted: the PLC cannot tell who asked'), dt: 5, camada: 'Modbus', carga: escrita(1, '03 e8', '1000 → 100,0 °C') }),
      ],
    },
  ],
};
