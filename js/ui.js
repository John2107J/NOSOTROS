import { Frases } from './frases.js';

/**
 * UI — utilidades genéricas de interfaz (paneles colapsables, etc).
 * Es el lugar para agregar futuros helpers visuales que no tengan un módulo propio.
 */
const estados = {};

function togglePanel(panelId, arrowId) {
  estados[panelId] = !estados[panelId];
  document.getElementById(panelId).classList.toggle('open', estados[panelId]);
  document.getElementById(arrowId).textContent = estados[panelId] ? '▾' : '▸';
  if (panelId === 'frasesPanel' && estados[panelId]) Frases.renderLista();
}

export const UI = { togglePanel };
