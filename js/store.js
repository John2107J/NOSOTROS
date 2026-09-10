/**
 * Store — capa de persistencia (localStorage).
 * Ningún otro módulo debe tocar localStorage directamente: todo pasa por acá.
 */
const KEY_FRASES = 'frases_v2';
const KEY_IDX    = 'fraseIdx_v2';
const KEY_FECHA  = 'fechaInicio_v2';

const DEFAULT_FRASES = [
  "Desde ese día, todo tiene más color.",
  "Cada día contigo es mi favorito.",
  "Te elegí ayer, te elijo hoy, te elegiré siempre.",
  "Gracias por aparecer en mi historia.",
];

function leer(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function escribir(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage no disponible */ }
}

function cargarFrases()     { return leer(KEY_FRASES, [...DEFAULT_FRASES]); }
function guardarFrases(arr) { escribir(KEY_FRASES, arr); }

function cargarIdx()   { return leer(KEY_IDX, 0); }
function guardarIdx(n) { escribir(KEY_IDX, n); }

function cargarFecha() {
  const saved = localStorage.getItem(KEY_FECHA);
  const el    = document.getElementById('fechaInicio');
  if (saved) {
    el.value = saved;
  } else {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    el.value = d.toISOString().split('T')[0];
  }
}

function guardarFecha() {
  const val = document.getElementById('fechaInicio').value;
  try { localStorage.setItem(KEY_FECHA, val); } catch { /* storage no disponible */ }
  // Notificamos al Contador mediante un evento en vez de importarlo directamente,
  // así Store no depende de Contador (evita dependencias circulares).
  document.dispatchEvent(new CustomEvent('fecha:cambiada'));
}

function getFecha() {
  return localStorage.getItem(KEY_FECHA) || document.getElementById('fechaInicio').value || '';
}

export const Store = {
  cargarFrases, guardarFrases,
  cargarIdx, guardarIdx,
  cargarFecha, guardarFecha, getFecha,
};
