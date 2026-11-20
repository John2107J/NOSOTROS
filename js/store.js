/**
 * Store — capa de persistencia local (localStorage).
 * Ningún otro módulo debe tocar localStorage directamente: todo pasa por acá.
 *
 * Cada cambio hecho por la persona dispara el evento `datos:local`, que Sync usa
 * para subirlo a la nube. Los cambios que llegan de la nube entran por
 * `aplicarFechaRemota` / `guardarFrases(arr, false)` y no disparan ese evento.
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
function guardarFrases(arr, avisar = true) {
  escribir(KEY_FRASES, arr);
  if (avisar) avisarCambio({ frases: arr });
}

function avisarCambio(campos) {
  document.dispatchEvent(new CustomEvent('datos:local', { detail: campos }));
}

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
  if (val) avisarCambio({ fechaInicio: val });
}

/** Fecha que llegó de la nube: se guarda y se muestra, sin volver a subirla. */
function aplicarFechaRemota(val) {
  try { localStorage.setItem(KEY_FECHA, val); } catch { /* storage no disponible */ }
  const el = document.getElementById('fechaInicio');
  if (el && el.value !== val) el.value = val;
  document.dispatchEvent(new CustomEvent('fecha:cambiada'));
}

/** Fecha elegida explícitamente (no la de "hace 2 meses" que se muestra por defecto). */
function fechaGuardada() {
  try { return localStorage.getItem(KEY_FECHA) || ''; } catch { return ''; }
}

function getFecha() {
  return localStorage.getItem(KEY_FECHA) || document.getElementById('fechaInicio').value || '';
}

export const Store = {
  cargarFrases, guardarFrases,
  cargarIdx, guardarIdx,
  cargarFecha, guardarFecha, getFecha, aplicarFechaRemota, fechaGuardada,
};
