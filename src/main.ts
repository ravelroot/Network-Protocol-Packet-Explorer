import './css/estilo.css';
import { aplicarAparencia, proximaPaleta } from './app/aparencia';
import type { Contexto } from './app/contexto';
import { criarEstado, Loja } from './app/estado';
import { Reprodutor } from './app/reprodutor';
import { PROTOCOLOS, protocoloPorId } from './dados/protocolos';
import { definirIdioma } from './i18n/textos';
import { montarCabecalho } from './ui/cabecalho';
import { montarAjuda, montarBusca } from './ui/dialogos';
import { h } from './ui/dom';
import { montarFluxo } from './ui/fluxo';
import { visiveis, montarLista } from './ui/lista';
import { montarPainel } from './ui/painel';
import { montarPalco } from './ui/palco';
import { montarBarraStatus } from './ui/barra-status';

const idDoEndereco = (): string | undefined => {
  const id = decodeURIComponent(location.hash.replace(/^#\/?/, '')).toLowerCase();
  return protocoloPorId(id)?.id;
};

const inicial = idDoEndereco() ?? PROTOCOLOS[0]?.id ?? 'http';
const loja = new Loja(criarEstado(inicial));
const reprodutor = new Reprodutor(loja);
const ctx: Contexto = { loja, reprodutor };

definirIdioma(loja.atual.idioma);

const aplicarTema = (): void => aplicarAparencia(loja.atual.tema, loja.atual.paleta);
aplicarTema();

loja.assinar((e, a) => {
  if (e.idioma !== a.idioma) {
    definirIdioma(e.idioma);
    document.title = `${document.title.split(' · ')[0]} · ${e.idioma === 'pt' ? 'Explorador de protocolos' : 'Protocol explorer'}`;
  }
  if (e.tema !== a.tema || e.paleta !== a.paleta) aplicarTema();
  if (e.lista !== a.lista || e.fluxo !== a.fluxo || e.foco !== a.foco) aplicarLayout();
  if (e.tocando !== a.tocando) document.documentElement.dataset.tocando = String(e.tocando);
});

const corpo = h('main', { class: 'corpo' }, montarLista(ctx), montarPalco(ctx), montarPainel(ctx), montarFluxo(ctx));
const app = h('div', { class: 'app' }, montarCabecalho(ctx), corpo, montarBarraStatus(ctx), montarBusca(ctx), montarAjuda(ctx));

const aplicarLayout = (): void => {
  const e = loja.atual;
  app.dataset.lista = String(e.lista && !e.foco);
  app.dataset.fluxo = String(e.fluxo && !e.foco);
  app.dataset.foco = String(e.foco);
};
aplicarLayout();

window.addEventListener('hashchange', () => {
  const id = idDoEndereco();
  if (id && id !== loja.atual.protocoloId) reprodutor.selecionar(id);
});

const vizinho = (direcao: 1 | -1): void => {
  const e = loja.atual;
  const lista = visiveis(e.filtro, e.camada);
  if (lista.length === 0) return;
  const i = lista.findIndex((p) => p.id === e.protocoloId);
  const alvo = lista[(i + direcao + lista.length) % lista.length];
  if (!alvo) return;
  reprodutor.selecionar(alvo.id);
  if (!loja.atual.expandido) loja.alterar({ expandido: true });
  history.replaceState(null, '', `#/${alvo.id}`);
};

document.addEventListener('keydown', (ev) => {
  const e = loja.atual;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
    ev.preventDefault();
    loja.alterar({ busca: !e.busca, ajuda: false });
    return;
  }
  if (e.busca || e.ajuda) return;
  const alvo = ev.target as HTMLElement | null;
  if (alvo && (alvo.closest('input, select, textarea') || (alvo.isContentEditable ?? false))) return;
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const acoes: Record<string, () => void> = {
    ' ': () => reprodutor.alternar(),
    ArrowRight: () => reprodutor.avancarPasso(),
    ArrowLeft: () => reprodutor.voltarPasso(),
    ArrowDown: () => vizinho(1),
    ArrowUp: () => vizinho(-1),
    r: () => reprodutor.reiniciar(),
    '+': () => reprodutor.acelerar(1),
    '=': () => reprodutor.acelerar(1),
    '-': () => reprodutor.acelerar(-1),
    _: () => reprodutor.acelerar(-1),
    v: () => loja.alterar({ vista: e.vista === 'rede' ? 'sequencia' : 'rede' }),
    '/': () => loja.alterar({ busca: true }),
    '[': () => loja.alterar({ lista: !e.lista, foco: false }),
    ']': () => loja.alterar({ fluxo: !e.fluxo, foco: false }),
    f: () => loja.alterar({ foco: !e.foco }),
    t: () => loja.alterar({ tema: e.tema === 'escuro' ? 'claro' : 'escuro' }),
    c: () => loja.alterar({ paleta: proximaPaleta(e.paleta) }),
    l: () => loja.alterar({ idioma: e.idioma === 'pt' ? 'en' : 'pt' }),
    '?': () => loja.alterar({ ajuda: true }),
    Escape: () => {
      if (e.inspecionado !== null) loja.alterar({ inspecionado: null });
      else if (e.foco) loja.alterar({ foco: false });
    },
  };
  const acao = acoes[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key] ?? acoes[ev.key];
  if (!acao) return;
  if (ev.key === ' ' && alvo?.closest('button, a, [tabindex]')) return;
  ev.preventDefault();
  acao();
});

const raiz = document.getElementById('app');
if (raiz) raiz.replaceWith(app);
