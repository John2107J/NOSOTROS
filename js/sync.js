import { Store } from './store.js?v=202611202322';
import { Frases } from './frases.js?v=202611202322';

/**
 * Sync — sincroniza la fecha y las frases con la pareja, en tiempo real.
 *
 * Cuando los dos iniciaron sesión con Google y están vinculados (ver Corazoncitos),
 * la fecha y las frases viven en el documento de la pareja en Firestore:
 *  - Cada cambio local (evento `datos:local` de Store) se sube.
 *  - Cada cambio que llega de la nube se aplica en pantalla y se guarda local,
 *    así la app abre igual sin internet.
 *  - La primera vez, si la pareja todavía no tiene fecha o frases en la nube,
 *    se suben las de este dispositivo.
 *
 * Reemplaza al viejo exportar/importar por código.
 */
let Nube = null;
let iniciado = false;
let estado = null;
let inicialSubido = null;   // coupleId para el que ya se hizo la subida inicial
let error = false;

let enlazado = false;

export function iniciar() {
  if (iniciado) return;
  iniciado = true;
  if (!enlazado) {
    enlazado = true;
    document.addEventListener('datos:local', e => subir(e.detail));
    document.getElementById('cuentaEstado')?.addEventListener('click', onClick);
  }
  pintar();

  import('./nube.js?v=202611202322')
    .then(m => {
      Nube = m;
      if (!m.configurado) { pintar(); return; }
      return m.iniciar().then(() => m.suscribir(onEstado));
    })
    .catch(() => { error = true; iniciado = false; pintar(); });
}

function onEstado(e) {
  estado = e;
  error = false;
  if (e.coupleId && Nube.esMiembro(e)) aplicar(e);
  pintar();
}

function aplicar(e) {
  const c = e.couple;

  // Subida inicial: lo que la nube todavía no tenga, lo aporta este dispositivo.
  if (inicialSubido !== e.coupleId) {
    inicialSubido = e.coupleId;
    const faltan = {};
    if (!c.fechaInicio && Store.fechaGuardada()) faltan.fechaInicio = Store.fechaGuardada();
    if (!Array.isArray(c.frases)) faltan.frases = Store.cargarFrases();
    if (Object.keys(faltan).length) Nube.actualizarPareja(faltan).catch(errorSubida);
  }

  if (c.fechaInicio && c.fechaInicio !== Store.fechaGuardada()) Store.aplicarFechaRemota(c.fechaInicio);
  if (Array.isArray(c.frases) && JSON.stringify(c.frases) !== JSON.stringify(Store.cargarFrases())) {
    Frases.aplicarRemoto(c.frases);
  }
}

function subir(campos) {
  if (!Nube || !estado?.coupleId || !Nube.esMiembro(estado)) return;
  Nube.actualizarPareja(campos).catch(errorSubida);
}

function errorSubida(err) {
  if (err?.message === 'sin-pareja') return;   // se desvinculó o cerró sesión en el medio
  console.error(err);
  error = true; pintar();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tarjeta de estado de la cuenta (pantalla principal)
// ─────────────────────────────────────────────────────────────────────────────
function pintar() {
  const el = document.getElementById('cuentaEstado');
  if (!el) return;
  if (Nube && !Nube.configurado) { el.hidden = true; return; }
  el.hidden = false;

  let icono, titulo, detalle = '', boton = '';
  if (error && !estado?.listo) {
    icono = '📴'; titulo = 'Sin conexión';
    detalle = 'Los cambios se guardan en este celular.';
    boton = '<button class="cuenta-btn" data-a="reintentar">Reintentar</button>';
  } else if (!estado?.listo) {
    icono = '⏳'; titulo = 'Conectando…';
  } else if (!estado.user) {
    icono = '☁️'; titulo = 'Sincronizá con tu pareja';
    detalle = 'Iniciá sesión con Google para que la fecha y las frases se actualicen solas en los dos celulares.';
    boton = '<button class="cuenta-btn primary" data-a="login">Entrar con Google</button>';
  } else if (!Nube.esMiembro(estado)) {
    icono = '🔗'; titulo = 'Falta vincularte con tu pareja';
    detalle = `Conectado como ${esc(estado.user.email || '')}. Uno crea el espacio y el otro se une con el código.`;
    boton = '<button class="cuenta-btn primary" data-a="vincular">Vincular</button>';
  } else if (!Nube.parejaCompleta(estado)) {
    icono = '💌'; titulo = 'Esperando a tu pareja';
    detalle = `Pasale el código <strong>${esc(estado.coupleId)}</strong> para que se una.`;
    boton = '<button class="cuenta-btn" data-a="vincular">Ver código</button>';
  } else {
    const otro = estado.couple.members.find(u => u !== estado.user.uid);
    icono = '💞';
    titulo = `Sincronizado con ${esc(estado.couple.nombres?.[otro] || 'tu pareja')}`;
    detalle = error
      ? 'No se pudo guardar el último cambio. Se reintenta al volver la conexión.'
      : `La fecha y las frases se actualizan solas · ${esc(estado.user.email || '')}`;
  }

  el.innerHTML = `
    <span class="cuenta-icono">${icono}</span>
    <span class="cuenta-txt"><strong>${titulo}</strong>${detalle ? `<small>${detalle}</small>` : ''}</span>
    ${boton}`;
}

function onClick(e) {
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'login') Nube.login().catch(err => { console.error(err); });
  if (a === 'vincular') window.Nav?.irPorotitos();
  if (a === 'reintentar') { error = false; iniciar(); }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const Sync = { iniciar };
