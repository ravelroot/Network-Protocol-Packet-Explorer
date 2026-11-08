import type { Contexto } from '../app/contexto';
import type { Vista } from '../app/estado';
import { ui } from '../i18n/textos';
import { h } from './dom';
import { icone } from './icones';
import { montarInspetor } from './inspetor';
import { montarRede } from './rede';
import { montarSequencia } from './sequencia';

export const montarPalco = (ctx: Contexto): HTMLElement => {
  const { loja } = ctx;
  const rede = montarRede(ctx);
  const sequencia = montarSequencia(ctx);
  const inspetor = montarInspetor(ctx);
  const rotulos: Record<Vista, HTMLSpanElement> = { rede: h('span', {}), sequencia: h('span', {}) };
  const botoes: Record<Vista, HTMLButtonElement> = {
    rede: h('button', { class: 'vista-botao', type: 'button', onclick: () => loja.alterar({ vista: 'rede' }) }, icone('camadas'), rotulos.rede),
    sequencia: h('button', { class: 'vista-botao', type: 'button', onclick: () => loja.alterar({ vista: 'sequencia' }) }, icone('sequencia'), rotulos.sequencia),
  };
  const corpoRede = h('div', { class: 'vista vista-rede' }, rede.elemento);
  const corpoSequencia = h('div', { class: 'vista vista-sequencia' }, sequencia.elemento);
  const palco = h(
    'section',
    { class: 'palco caixa' },
    h('div', { class: 'palco-topo' }, h('div', { class: 'alternador', role: 'group' }, botoes.rede, botoes.sequencia)),
    corpoRede,
    corpoSequencia,
    inspetor.elemento,
  );

  const atualizar = (): void => {
    const e = loja.atual;
    rotulos.rede.textContent = ui('rede');
    rotulos.sequencia.textContent = ui('sequencia');
    for (const v of ['rede', 'sequencia'] as const) botoes[v].setAttribute('aria-pressed', String(e.vista === v));
    corpoRede.hidden = e.vista !== 'rede';
    corpoSequencia.hidden = e.vista !== 'sequencia';
    palco.classList.toggle('inspecionando', e.inspecionado !== null);
  };

  loja.assinar((e, a) => {
    if (e.vista !== a.vista || e.idioma !== a.idioma || e.inspecionado !== a.inspecionado) atualizar();
    if (e.vista !== a.vista && e.vista === 'rede') rede.atualizar();
  });
  atualizar();
  return palco;
};
