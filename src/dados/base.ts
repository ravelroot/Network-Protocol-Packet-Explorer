import type { Campo, Dispositivo, No, Pacote, Texto } from './tipos';

export const t = (pt: string, en: string): Texto => ({ pt, en });

export const no = (
  id: string,
  tipo: Dispositivo,
  nome: Texto,
  x: number,
  y: number,
  ip?: string,
  mac?: string,
): No => ({ id, tipo, nome, x, y, ...(ip ? { ip } : {}), ...(mac ? { mac } : {}) });

export const IP = {
  cliente: '192.168.1.10',
  roteador: '192.168.1.1',
  servidor: '203.0.113.10',
  resolvedor: '8.8.8.8',
  raiz: '198.41.0.4',
  tld: '192.5.6.30',
  autoritativo: '198.51.100.53',
} as const;

export const nos = {
  cliente: (x = 16, y = 70): No => no('cliente', 'notebook', t('Cliente', 'Client'), x, y, IP.cliente),
  roteador: (x = 42, y = 56): No => no('roteador', 'roteador', t('Roteador', 'Router'), x, y, IP.roteador),
  internet: (x = 66, y = 74): No => no('internet', 'internet', t('Internet', 'Internet'), x, y),
  servidor: (x = 86, y = 30): No => no('servidor', 'servidor', t('Servidor Web', 'Web Server'), x, y, IP.servidor),
  resolvedor: (x = 56, y = 22): No => no('resolvedor', 'pilha', t('Resolvedor DNS', 'DNS Resolver'), x, y, IP.resolvedor),
};

export const texto = (nome: Texto, valor: string, explicacao?: Texto): Campo => ({
  nome,
  texto: valor,
  ...(explicacao ? { explicacao } : {}),
});

export const hex = (nome: Texto, valor: string, exibicao?: string, explicacao?: Texto, exemplo?: boolean): Campo => ({
  nome,
  hex: valor,
  ...(exibicao ? { valor: exibicao } : {}),
  ...(explicacao ? { explicacao } : {}),
  ...(exemplo ? { exemplo } : {}),
});

export const opaco = (nome: Texto, bytes: number, explicacao?: Texto): Campo => ({
  nome,
  opaco: bytes,
  ...(explicacao ? { explicacao } : {}),
});

interface Conexao {
  readonly de: string;
  readonly para: string;
  readonly portaCliente: number;
  readonly portaServidor: number;
  readonly tipo: string;
  readonly isnCliente?: number;
  readonly isnServidor?: number;
}

export const apertoDeMao = (c: Conexao): Pacote[] => {
  const a = c.isnCliente ?? 0;
  const b = c.isnServidor ?? 0;
  return [
    {
      de: c.de,
      para: c.para,
      proto: 'TCP',
      rotulo: t('SYN', 'SYN'),
      info: t(`${c.portaCliente} → ${c.portaServidor} [SYN] Seq=${a}`, `${c.portaCliente} → ${c.portaServidor} [SYN] Seq=${a}`),
      tipo: c.tipo,
      quadro: { tcp: { origem: c.portaCliente, destino: c.portaServidor, seq: a, flags: 'SYN', janela: 64240 } },
    },
    {
      de: c.para,
      para: c.de,
      proto: 'TCP',
      rotulo: t('SYN-ACK', 'SYN-ACK'),
      info: t(
        `${c.portaServidor} → ${c.portaCliente} [SYN, ACK] Seq=${b} Ack=${a + 1}`,
        `${c.portaServidor} → ${c.portaCliente} [SYN, ACK] Seq=${b} Ack=${a + 1}`,
      ),
      tipo: c.tipo,
      quadro: { tcp: { origem: c.portaServidor, destino: c.portaCliente, seq: b, ack: a + 1, flags: 'SYN,ACK', janela: 65535 } },
    },
    {
      de: c.de,
      para: c.para,
      proto: 'TCP',
      rotulo: t('ACK', 'ACK'),
      info: t(
        `${c.portaCliente} → ${c.portaServidor} [ACK] Seq=${a + 1} Ack=${b + 1}`,
        `${c.portaCliente} → ${c.portaServidor} [ACK] Seq=${a + 1} Ack=${b + 1}`,
      ),
      tipo: c.tipo,
      quadro: { tcp: { origem: c.portaCliente, destino: c.portaServidor, seq: a + 1, ack: b + 1, flags: 'ACK', janela: 502 } },
    },
  ];
};

export const nomeDns = (nome: string): string =>
  nome
    .split('.')
    .filter(Boolean)
    .map((parte) => parte.length.toString(16).padStart(2, '0') + ' ' + [...parte].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '))
    .join(' ') + ' 00';
