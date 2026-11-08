export const PALETAS = [
  { id: 'bento', cores: ['#F5F4F4', '#BAB7B6', '#4D4B4B', '#000000'] },
  { id: 'nexo', cores: ['#E8E8E8', '#D9D1CE', '#AB9D9D', '#000000'] },
] as const;

export type Paleta = (typeof PALETAS)[number]['id'];

export const ehPaleta = (valor: unknown): valor is Paleta => PALETAS.some((p) => p.id === valor);
