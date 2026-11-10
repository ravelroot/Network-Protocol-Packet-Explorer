export type Tema = 'escuro' | 'claro';
export type Paleta = 'ocelo' | 'bento' | 'sonda' | 'nexo';

export interface DefinicaoPaleta {
  readonly id: Paleta;
  readonly nome: string;
  readonly cores: readonly string[];
}

export const PALETAS: readonly DefinicaoPaleta[] = [
  { id: 'ocelo', nome: 'Ocelo', cores: ['#E6DDCE', '#A3B4BE', '#F6E4A6', '#5D1C16'] },
  { id: 'bento', nome: 'Bento', cores: ['#F5F4F4', '#BAB7B6', '#4D4B4B', '#000000'] },
  { id: 'sonda', nome: 'Sonda', cores: ['#F3F1EC', '#7FA7B8', '#17212B', '#A8235A'] },
  { id: 'nexo', nome: 'Nexo', cores: ['#E8E8E8', '#D9D1CE', '#AB9D9D', '#000000'] },
];

export const PALETA_PADRAO: Paleta = 'ocelo';

export const ehPaleta = (valor: unknown): valor is Paleta => PALETAS.some((p) => p.id === valor);

export const nomePaleta = (id: Paleta): string => PALETAS.find((p) => p.id === id)?.nome ?? id;

export const proximaPaleta = (id: Paleta): Paleta => {
  const i = PALETAS.findIndex((p) => p.id === id);
  return PALETAS[(i + 1) % PALETAS.length]?.id ?? PALETA_PADRAO;
};

export const temaDoSistema = (): Tema =>
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';

export const aplicarAparencia = (tema: Tema, paleta: Paleta): void => {
  const raiz = document.documentElement;
  raiz.dataset.tema = tema;
  if (paleta === PALETA_PADRAO) delete raiz.dataset.paleta;
  else raiz.dataset.paleta = paleta;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', tema === 'escuro' ? 'dark' : 'light');
  const superficie = getComputedStyle(raiz).getPropertyValue('--surface').trim();
  if (superficie) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', superficie);
};
