import type { No, Protocolo } from '../dados/tipos';

const cache = new WeakMap<Protocolo, Map<string, readonly string[]>>();

export const noPorId = (protocolo: Protocolo, id: string): No => {
  const encontrado = protocolo.nos.find((n) => n.id === id);
  if (!encontrado) throw new Error(`Nó "${id}" não existe em ${protocolo.id}`);
  return encontrado;
};

export const rota = (protocolo: Protocolo, de: string, para: string): readonly string[] => {
  let porProtocolo = cache.get(protocolo);
  if (!porProtocolo) {
    porProtocolo = new Map();
    cache.set(protocolo, porProtocolo);
  }
  const chave = `${de}>${para}`;
  const salvo = porProtocolo.get(chave);
  if (salvo) return salvo;

  const vizinhos = new Map<string, string[]>();
  for (const [a, b] of protocolo.ligacoes) {
    vizinhos.set(a, [...(vizinhos.get(a) ?? []), b]);
    vizinhos.set(b, [...(vizinhos.get(b) ?? []), a]);
  }
  const anterior = new Map<string, string>();
  const fila = [de];
  const visitados = new Set([de]);
  while (fila.length > 0) {
    const atual = fila.shift() as string;
    if (atual === para) break;
    for (const proximo of vizinhos.get(atual) ?? []) {
      if (visitados.has(proximo)) continue;
      visitados.add(proximo);
      anterior.set(proximo, atual);
      fila.push(proximo);
    }
  }
  const caminho = [para];
  let passo = para;
  while (passo !== de) {
    const antes = anterior.get(passo);
    if (!antes) {
      const direto = [de, para];
      porProtocolo.set(chave, direto);
      return direto;
    }
    caminho.unshift(antes);
    passo = antes;
  }
  porProtocolo.set(chave, caminho);
  return caminho;
};
