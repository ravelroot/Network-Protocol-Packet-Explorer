import type { Protocolo } from '../tipos';

export const ORDEM = [
  'http',
  'https',
  'websocket',
  'webrtc',
  'quic',
  'tcp',
  'udp',
  'ip',
  'bgp',
  'ipv6',
  'dns',
  'doh',
  'dnssec',
  'dhcp',
  'icmp',
  'ntp',
  'wifi',
  'wpa3',
  'radius',
  'captive',
  'smtp',
  'pop3',
  'imap',
  'ftp',
  'smb',
  'ssh',
  'tls',
  'proxy',
  'socks5',
  'reverseproxy',
  'wireguard',
  'ipsec',
  'modbus',
] as const;

const modulos = import.meta.glob<Record<string, unknown>>(['./*.ts', '!./index.ts'], { eager: true });

const ehProtocolo = (valor: unknown): valor is Protocolo =>
  typeof valor === 'object' && valor !== null && 'passos' in valor && 'sigla' in valor;

const posicao = (id: string): number => {
  const i = (ORDEM as readonly string[]).indexOf(id);
  return i === -1 ? ORDEM.length : i;
};

export const PROTOCOLOS: readonly Protocolo[] = Object.values(modulos)
  .flatMap((m) => Object.values(m).filter(ehProtocolo))
  .sort((a, b) => posicao(a.id) - posicao(b.id));

export const protocoloPorId = (id: string): Protocolo | undefined => PROTOCOLOS.find((p) => p.id === id);
