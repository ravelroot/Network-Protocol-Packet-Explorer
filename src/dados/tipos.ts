export type Idioma = 'pt' | 'en';

export type Texto = Readonly<Record<Idioma, string>>;

export type Categoria = 'core' | 'aplicacao' | 'seguranca';

export type Camada = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Cor = 'anil' | 'oliva' | 'ouro' | 'brasa' | 'neutra';

export type Dispositivo =
  | 'notebook'
  | 'celular'
  | 'roteador'
  | 'internet'
  | 'servidor'
  | 'pilha'
  | 'ponto-acesso'
  | 'escudo'
  | 'relogio'
  | 'plc'
  | 'armazenamento'
  | 'email';

export interface No {
  readonly id: string;
  readonly tipo: Dispositivo;
  readonly nome: Texto;
  readonly ip?: string;
  readonly mac?: string;
  readonly x: number;
  readonly y: number;
}

export interface Campo {
  readonly nome: Texto;
  readonly texto?: string;
  readonly hex?: string;
  readonly opaco?: number;
  readonly valor?: string;
  readonly explicacao?: Texto;
  readonly exemplo?: boolean;
}

export interface Tcp {
  readonly origem: number;
  readonly destino: number;
  readonly seq: number;
  readonly ack?: number;
  readonly flags: string;
  readonly janela?: number;
  readonly sack?: readonly [number, number];
}

export interface Udp {
  readonly origem: number;
  readonly destino: number;
}

export interface Icmp {
  readonly tipo: number;
  readonly codigo: number;
  readonly id?: number;
  readonly seq?: number;
}

export type QuadroWifi =
  | 'beacon'
  | 'probe-req'
  | 'probe-resp'
  | 'auth'
  | 'assoc-req'
  | 'assoc-resp'
  | 'deauth'
  | 'dados';

export interface Quadro {
  readonly enlace?: 'ethernet' | 'wifi';
  readonly wifi?: QuadroWifi;
  readonly rede?: 'ipv4' | 'ipv6' | 'arp' | 'eapol' | 'nenhuma';
  readonly origemIp?: string;
  readonly destinoIp?: string;
  readonly ttl?: number;
  readonly ipProtocolo?: number;
  readonly tcp?: Tcp;
  readonly udp?: Udp;
  readonly icmp?: Icmp;
  readonly arp?: { readonly operacao: 1 | 2 };
  readonly eapolTipo?: 0 | 1 | 3;
  readonly camada?: string;
  readonly carga?: readonly Campo[];
}

export interface Pacote {
  readonly de: string;
  readonly para: string;
  readonly proto: string;
  readonly rotulo: Texto;
  readonly info: Texto;
  readonly tipo: string;
  readonly resumo?: Texto;
  readonly dt?: number;
  readonly perdido?: boolean;
  readonly nota?: Texto;
  readonly quadro: Quadro;
}

export type Fato = readonly [Texto, Texto];

export interface Passo {
  readonly titulo: Texto;
  readonly resumo: Texto;
  readonly descricao: Texto;
  readonly fatos?: readonly Fato[];
  readonly pacotes: readonly Pacote[];
}

export interface ItemLegenda {
  readonly nome: Texto;
  readonly cor: Cor;
}

export interface Protocolo {
  readonly id: string;
  readonly sigla: string;
  readonly nome: Texto;
  readonly resumo: Texto;
  readonly categoria: Categoria;
  readonly camada: Camada;
  readonly descricao: Texto;
  readonly fatos: readonly Fato[];
  readonly legenda: Readonly<Record<string, ItemLegenda>>;
  readonly observacao?: Texto;
  readonly nos: readonly No[];
  readonly ligacoes: readonly (readonly [string, string])[];
  readonly faixas?: readonly string[];
  readonly passos: readonly Passo[];
}
