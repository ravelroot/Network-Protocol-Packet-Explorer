import { describe, expect, it } from 'vitest';
import type { Protocolo, Texto } from '../../src/dados/tipos';
import { analisar } from '../../src/rede/quadros';
import { rota } from '../../src/rede/rotas';

const modulos = import.meta.glob<Record<string, unknown>>('../../src/dados/protocolos/*.ts', { eager: true });

const protocolos: Protocolo[] = Object.entries(modulos)
  .filter(([caminho]) => !caminho.endsWith('/index.ts'))
  .flatMap(([, m]) => Object.values(m).filter((v): v is Protocolo => typeof v === 'object' && v !== null && 'passos' in v));

const textoOk = (x: Texto | undefined): boolean => !!x && x.pt.trim().length > 0 && x.en.trim().length > 0;

describe.each(protocolos.map((p) => [p.id, p] as const))('%s', (_id, p) => {
  it('tem identidade e visão geral completas', () => {
    expect(p.id).toMatch(/^[a-z0-9-]+$/);
    expect(textoOk(p.nome) && textoOk(p.resumo) && textoOk(p.descricao)).toBe(true);
    expect(p.fatos.length).toBeGreaterThanOrEqual(4);
    for (const [r, v] of p.fatos) expect(textoOk(r) && textoOk(v)).toBe(true);
    expect(Object.keys(p.legenda).length).toBeGreaterThanOrEqual(1);
  });

  it('tem nós, ligações e faixas coerentes', () => {
    const ids = new Set(p.nos.map((n) => n.id));
    expect(ids.size).toBe(p.nos.length);
    for (const n of p.nos) {
      expect(textoOk(n.nome)).toBe(true);
      expect(n.x).toBeGreaterThanOrEqual(6);
      expect(n.x).toBeLessThanOrEqual(94);
      expect(n.y).toBeGreaterThanOrEqual(12);
      expect(n.y).toBeLessThanOrEqual(88);
    }
    for (const [a, b] of p.ligacoes) expect(ids.has(a) && ids.has(b)).toBe(true);
    for (const f of p.faixas ?? []) expect(ids.has(f)).toBe(true);
  });

  it('tem passos e pacotes válidos, montáveis byte a byte', () => {
    expect(p.passos.length).toBeGreaterThanOrEqual(3);
    expect(p.passos.length).toBeLessThanOrEqual(7);
    const ids = new Set(p.nos.map((n) => n.id));
    const faixas = new Set(p.faixas ?? p.nos.map((n) => n.id));
    let indice = 0;
    let total = 0;
    for (const passo of p.passos) {
      expect(textoOk(passo.titulo) && textoOk(passo.resumo) && textoOk(passo.descricao)).toBe(true);
      for (const [r, v] of passo.fatos ?? []) expect(textoOk(r) && textoOk(v)).toBe(true);
      for (const pacote of passo.pacotes) {
        total++;
        expect(ids.has(pacote.de) && ids.has(pacote.para)).toBe(true);
        expect(faixas.has(pacote.de) && faixas.has(pacote.para)).toBe(true);
        expect(p.legenda[pacote.tipo]).toBeDefined();
        expect(textoOk(pacote.rotulo) && textoOk(pacote.info)).toBe(true);
        expect(rota(p, pacote.de, pacote.para).length).toBeGreaterThanOrEqual(2);
        const a = analisar(p, pacote, indice++);
        expect(a.bytes.length).toBeGreaterThan(0);
        expect(a.bytes.length).toBeLessThanOrEqual(1600);
        for (const camada of a.camadas) {
          for (const campo of camada.campos) {
            expect(campo.fim).toBeGreaterThanOrEqual(campo.inicio);
            expect(campo.fim).toBeLessThanOrEqual(a.bytes.length);
          }
        }
      }
    }
    expect(total).toBeGreaterThanOrEqual(3);
  });
});
