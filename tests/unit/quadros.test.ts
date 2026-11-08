import { describe, expect, it } from 'vitest';
import { linhaDoTempo } from '../../src/app/linha-do-tempo';
import { ORDEM, PROTOCOLOS } from '../../src/dados/protocolos';
import { http } from '../../src/dados/protocolos/http';
import { analisar } from '../../src/rede/quadros';
import { rota } from '../../src/rede/rotas';

const soma16 = (bytes: Uint8Array, inicio: number, fim: number, extra: number[] = []): number => {
  const dados = [...extra, ...bytes.slice(inicio, fim)];
  let soma = 0;
  for (let i = 0; i < dados.length; i += 2) soma += ((dados[i] ?? 0) << 8) + (dados[i + 1] ?? 0);
  while (soma >> 16) soma = (soma & 0xffff) + (soma >> 16);
  return soma;
};

const pacotes = http.passos.flatMap((p) => p.pacotes);

describe('catálogo', () => {
  it('tem os 33 protocolos do vídeo, sem repetição, na ordem da lista', () => {
    expect(PROTOCOLOS.map((p) => p.id)).toEqual([...ORDEM]);
    expect(new Set(PROTOCOLOS.map((p) => p.id)).size).toBe(33);
  });

  it('divide as categorias em 8 de núcleo, 16 de aplicação e 9 de segurança', () => {
    const conta = (c: string): number => PROTOCOLOS.filter((p) => p.categoria === c).length;
    expect([conta('core'), conta('aplicacao'), conta('seguranca')]).toEqual([8, 16, 9]);
  });
});

describe('quadros', () => {
  it('monta a consulta DNS com 75 bytes, como numa captura real', () => {
    const a = analisar(http, pacotes[0]!, 0);
    expect(a.bytes.length).toBe(75);
    expect(a.camadas.map((c) => (typeof c.nome === 'string' ? c.nome : c.nome.en))).toEqual(['Ethernet', 'IPv4', 'UDP', 'DNS']);
  });

  it('gera checksums IPv4, UDP e TCP válidos', () => {
    pacotes.forEach((pacote, i) => {
      const a = analisar(http, pacote, i);
      expect(soma16(a.bytes, 14, 34)).toBe(0xffff);
      const origem = [...a.bytes.slice(26, 34)];
      const proto = a.bytes[23] ?? 0;
      const tamanho = a.bytes.length - 34;
      expect(soma16(a.bytes, 34, a.bytes.length, [...origem, 0, proto, tamanho >> 8, tamanho & 0xff])).toBe(0xffff);
    });
  });

  it('é determinístico: o mesmo pacote gera sempre os mesmos bytes', () => {
    const a = analisar(http, pacotes[5]!, 5);
    const b = analisar(http, pacotes[5]!, 5);
    expect([...a.bytes]).toEqual([...b.bytes]);
  });

  it('cobre todos os bytes com camadas contíguas', () => {
    for (const p of PROTOCOLOS) {
      linhaDoTempo(p).entradas.forEach((e) => {
        const a = analisar(p, e.pacote, e.indice);
        let cursor = 0;
        for (const c of a.camadas) {
          expect(c.inicio).toBe(cursor);
          cursor = c.fim;
        }
        expect(cursor).toBe(a.bytes.length);
      });
    }
  });
});

describe('rotas', () => {
  it('encontra o caminho pelo roteador e pela internet', () => {
    expect(rota(http, 'cliente', 'servidor')).toEqual(['cliente', 'roteador', 'internet', 'servidor']);
  });
});

describe('linha do tempo', () => {
  it('acumula o tempo e marca o fim de cada passo', () => {
    const l = linhaDoTempo(http);
    expect(l.entradas).toHaveLength(7);
    expect(l.fimPasso).toEqual([0, 2, 5, 7, 7]);
    expect(l.entradas[0]!.tempo).toBe(0);
    expect(l.entradas[1]!.tempo).toBe(12);
  });
});
