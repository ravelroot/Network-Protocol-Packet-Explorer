import { nomePaleta } from '../app/aparencia';
import { protocoloAtual, type Contexto } from '../app/contexto';
import { idiomaAtual, nomeCamada, ui } from '../i18n/textos';
import { MARCA } from '../marca';
import { h, trocar } from './dom';

export const montarBarraStatus = (ctx: Contexto): HTMLElement => {
  const { loja } = ctx;
  const esquerda = h('div', { class: 'barra-status-lado' });
  const direita = h('div', { class: 'barra-status-lado direita' });

  const atualizar = (): void => {
    const e = loja.atual;
    const p = protocoloAtual(ctx);
    const velocidade = `${String(e.velocidade).replace('.', idiomaAtual() === 'pt' ? ',' : '.')}×`;
    trocar(
      esquerda,
      h('span', {}, `${MARCA.nome} ${MARCA.versao}`),
      h('span', {}, `${p.sigla} · ${nomeCamada(p.camada)}, ${ui('camadaN', { n: p.camada })}`),
      h('span', {}, e.vista === 'rede' ? ui('rede') : ui('sequencia')),
      h('span', {}, ui('velocidadeAtual', { v: velocidade })),
    );
    trocar(
      direita,
      h('span', {}, e.tema === 'escuro' ? ui('temaEscuro') : ui('temaClaro')),
      h('span', {}, ui('paletaNome', { nome: nomePaleta(e.paleta) })),
      h('span', {}, ui('prefsSalvas')),
    );
  };

  atualizar();
  loja.assinar((e, a) => {
    if (e.idioma !== a.idioma || e.protocoloId !== a.protocoloId || e.vista !== a.vista || e.velocidade !== a.velocidade || e.tema !== a.tema || e.paleta !== a.paleta) {
      atualizar();
    }
  });
  return h('footer', { class: 'barra-status' }, esquerda, direita);
};
