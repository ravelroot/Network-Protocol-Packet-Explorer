import type { Camada, Categoria, Idioma, Texto } from '../dados/tipos';

const textos = {
  slogan: { pt: 'Aprenda como a internet funciona', en: 'Learn how the internet works' },
  camadaOsi: { pt: 'Camada OSI', en: 'OSI layer' },
  buscar: { pt: 'Buscar protocolos', en: 'Search protocols' },
  protocolosInternet: { pt: 'Protocolos da internet', en: 'Internet protocols' },
  rede: { pt: 'Rede', en: 'Network' },
  sequencia: { pt: 'Sequência', en: 'Sequence' },
  fluxo: { pt: 'Fluxo de pacotes', en: 'Packet flow' },
  visaoGeral: { pt: 'Visão geral do protocolo', en: 'Protocol overview' },
  detalhesPasso: { pt: 'Detalhes do passo', en: 'Step details' },
  voltarVisao: { pt: 'Visão geral', en: 'Overview' },
  passoDe: { pt: 'Passo {a} de {b}', en: 'Step {a} of {b}' },
  passoCurto: { pt: 'Passo {n}', en: 'Step {n}' },
  pacoteDe: { pt: 'Pacote {a} de {b}', en: 'Packet {a} of {b}' },
  tocar: { pt: 'Tocar', en: 'Play' },
  pausar: { pt: 'Pausar', en: 'Pause' },
  passo: { pt: 'Passo', en: 'Step' },
  reiniciar: { pt: 'Reiniciar', en: 'Reset' },
  voltar: { pt: 'Voltar um passo', en: 'Back one step' },
  velocidade: { pt: 'Velocidade', en: 'Speed' },
  semPacotes: { pt: 'Nenhum pacote no fio ainda.', en: 'No packets on the wire yet.' },
  semPacotesPasso: { pt: 'Este passo acontece dentro do aparelho: nada vai para o fio.', en: 'This step happens inside the device: nothing goes on the wire.' },
  perdido: { pt: 'Perdido', en: 'Lost' },
  colNo: { pt: 'Nº', en: 'No.' },
  colTempo: { pt: 'Tempo', en: 'Time' },
  colOrigem: { pt: 'Origem', en: 'Source' },
  colDestino: { pt: 'Destino', en: 'Destination' },
  colProtocolo: { pt: 'Protocolo', en: 'Protocol' },
  colInfo: { pt: 'Info', en: 'Info' },
  colTamanho: { pt: 'Tamanho', en: 'Size' },
  bytes: { pt: 'Bytes', en: 'Bytes' },
  nesteQuadro: { pt: '{n} neste quadro', en: '{n} in this frame' },
  exemplo: { pt: 'ex.', en: 'e.g.' },
  legendaExemplo: { pt: 'valor de exemplo: muda em cada captura real', en: 'an example value: it differs in every real capture' },
  legendaOpaco: {
    pt: 'bytes que a lição não mostra: cifrados, aleatórios ou conteúdo de arquivo',
    en: "bytes the lesson can't show: encrypted, random, or a file's contents",
  },
  anterior: { pt: 'Pacote anterior', en: 'Previous packet' },
  proximo: { pt: 'Próximo pacote', en: 'Next packet' },
  fechar: { pt: 'Fechar', en: 'Close' },
  alternarLista: { pt: 'Mostrar ou ocultar a lista', en: 'Toggle the protocol list' },
  alternarFluxo: { pt: 'Mostrar ou ocultar o fluxo de pacotes', en: 'Toggle the packet flow' },
  modoFoco: { pt: 'Modo foco', en: 'Focus mode' },
  atalhos: { pt: 'Atalhos de teclado', en: 'Keyboard shortcuts' },
  codigoFonte: { pt: 'Código-fonte', en: 'Source code' },
  idioma: { pt: 'Idioma', en: 'Language' },
  tema: { pt: 'Alternar tema claro e escuro', en: 'Toggle light and dark theme' },
  paleta: { pt: 'Paleta de cores', en: 'Color palette' },
  paletaNome: { pt: 'Paleta {nome}', en: '{nome} palette' },
  paletaPadrao: { pt: 'Paleta {nome} (padrão)', en: '{nome} palette (default)' },
  temaClaro: { pt: 'Tema claro', en: 'Light theme' },
  temaEscuro: { pt: 'Tema escuro', en: 'Dark theme' },
  prefsSalvas: { pt: 'Preferências salvas neste navegador', en: 'Preferences saved in this browser' },
  velocidadeAtual: { pt: 'Velocidade {v}', en: 'Speed {v}' },
  camadaN: { pt: 'camada {n}', en: 'layer {n}' },
  nenhumResultado: { pt: 'Nenhum protocolo encontrado.', en: 'No protocol found.' },
  navegar: { pt: 'navegar', en: 'navigate' },
  abrir: { pt: 'abrir', en: 'open' },
  filtrarCamada: { pt: 'Filtrar pela camada {n}', en: 'Filter by layer {n}' },
  filtroCamada: { pt: 'Camada {n}', en: 'Layer {n}' },
  limparFiltro: { pt: 'Limpar filtro', en: 'Clear filter' },
  semProtocolosCamada: { pt: 'Nenhum protocolo nesta camada com o filtro atual.', en: 'No protocol at this layer with the current filter.' },
  atalhoTocar: { pt: 'Tocar ou pausar', en: 'Play or pause' },
  atalhoPasso: { pt: 'Próximo passo', en: 'Next step' },
  atalhoVoltar: { pt: 'Passo anterior', en: 'Previous step' },
  atalhoReiniciar: { pt: 'Reiniciar', en: 'Reset' },
  atalhoVelocidade: { pt: 'Mais devagar ou mais rápido (− e +)', en: 'Slower or faster (− and +)' },
  atalhoVista: { pt: 'Alternar rede e sequência', en: 'Switch network and sequence' },
  atalhoProtocolo: { pt: 'Protocolo anterior ou seguinte', en: 'Previous or next protocol' },
  atalhoBuscar: { pt: 'Buscar protocolos', en: 'Search protocols' },
  atalhoPaineis: { pt: 'Mostrar ou ocultar lista e fluxo', en: 'Toggle list and packet flow' },
  atalhoFoco: { pt: 'Modo foco', en: 'Focus mode' },
  atalhoTema: { pt: 'Tema claro ou escuro', en: 'Light or dark theme' },
  atalhoPaleta: { pt: 'Próxima paleta de cores', en: 'Next color palette' },
  atalhoIdioma: { pt: 'Português ou inglês', en: 'Portuguese or English' },
  atalhoFechar: { pt: 'Fechar inspetor ou janela', en: 'Close inspector or dialog' },
  atalhoAjuda: { pt: 'Esta lista', en: 'This list' },
  carregando: { pt: 'Carregando', en: 'Loading' },
} as const satisfies Record<string, Texto>;

export type ChaveTexto = keyof typeof textos;

const categorias: Record<Categoria | 'todos', Texto> = {
  todos: { pt: 'Todos', en: 'All' },
  core: { pt: 'Núcleo', en: 'Core' },
  aplicacao: { pt: 'Aplicação', en: 'Application' },
  seguranca: { pt: 'Segurança', en: 'Security' },
};

const camadas: Record<Camada, Texto> = {
  1: { pt: 'Física', en: 'Physical' },
  2: { pt: 'Enlace', en: 'Data link' },
  3: { pt: 'Rede', en: 'Network' },
  4: { pt: 'Transporte', en: 'Transport' },
  5: { pt: 'Sessão', en: 'Session' },
  6: { pt: 'Apresentação', en: 'Presentation' },
  7: { pt: 'Aplicação', en: 'Application' },
};

let atual: Idioma = 'pt';

export const definirIdioma = (idioma: Idioma): void => {
  atual = idioma;
  document.documentElement.lang = idioma === 'pt' ? 'pt-BR' : 'en';
};

export const idiomaAtual = (): Idioma => atual;

export const tr = (texto: Texto | string): string => (typeof texto === 'string' ? texto : texto[atual]);

export const ui = (chave: ChaveTexto, valores: Record<string, string | number> = {}): string =>
  Object.entries(valores).reduce<string>((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), textos[chave][atual]);

export const nomeCategoria = (c: Categoria | 'todos'): string => categorias[c][atual];

export const nomeCamada = (c: Camada): string => camadas[c][atual];
