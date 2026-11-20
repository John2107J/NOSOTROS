/**
 * Momentos — recuerdos de la pareja: título, foto, fecha, hora, lugar y comentario.
 * Los dos pueden crear, editar y borrar. El nombre de la sección es editable.
 *
 * Datos (Firestore, validados por firestore.rules):
 *   couples/{cid}/momentos/{id}       → { titulo, fecha, hora, lugar, comentario, miniatura, creador, creado, ... }
 *   couples/{cid}/momentosFotos/{id}  → { foto }   (tamaño completo, se baja solo al abrir el momento)
 *
 * Las fotos se achican en el celular antes de subir (no hay almacenamiento de archivos:
 * se guardan como texto dentro de la base, con límite de ~1 MB por documento).
 */
import * as Nube from './nube.js?v=202611202343';

export const NOMBRE_DEFAULT = 'Momentos';
const KEY_NOMBRE = 'momentosNombre_v1';

const FOTO_LADO = 1600, FOTO_MAX = 900_000;     // caracteres del dataURL (≈ 650 KB)
const MINI_LADO = 480,  MINI_MAX = 120_000;

let fb = null;
let iniciado = false;
let sub = null;
let cidEscuchado = null;

const st = {
  cargando: true,
  user: null, coupleId: null, couple: null,
  lista: [],
  vista: 'lista',          // 'lista' | 'form' | 'detalle'
  abierto: null,           // id del momento en detalle / edición
  borrador: null,          // { titulo, fecha, hora, lugar, comentario, foto, miniatura, fotoCambio }
  fotos: {},               // id → dataURL completo (caché en memoria)
  procesando: false,
  guardando: false,
  renombrando: false,
  confirmarBorrar: false,
  aviso: '', error: false,
};

// ─────────────────────────────────────────────────────────────────────────────
export async function abrir() {
  const root = el();
  if (!Nube.configurado) {
    root.innerHTML = card('<p class="poro-desc">Falta configurar Firebase (ver FIREBASE_SETUP.md).</p>');
    return;
  }
  if (iniciado) { render(); return; }
  iniciado = true;
  root.innerHTML = card('<p class="poro-desc">Cargando…</p>');
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  document.getElementById('momRenombrar')?.addEventListener('click', () => {
    if (!Nube.esMiembro(st)) return;
    st.renombrando = !st.renombrando; render();
  });
  try {
    fb = await Nube.iniciar();
  } catch {
    iniciado = false;
    root.innerHTML = card('<p class="poro-desc">No se pudo conectar. Revisá tu conexión a internet y volvé a entrar.</p>');
    return;
  }
  Nube.suscribir(onEstado, mostrarError);
}

function onEstado(e) {
  st.cargando = !e.listo;
  st.user = e.user; st.coupleId = e.coupleId; st.couple = e.couple;
  if (e.couple?.nombreMomentos) {
    try { localStorage.setItem(KEY_NOMBRE, e.couple.nombreMomentos); } catch { /* sin storage */ }
  }
  const cid = Nube.esMiembro(e) ? e.coupleId : null;
  if (cid !== cidEscuchado) {
    sub?.(); sub = null;
    st.lista = []; st.fotos = {};
    cidEscuchado = cid;
    if (cid) {
      const q = fb.query(fb.collection(fb.db, 'couples', cid, 'momentos'), fb.orderBy('fecha', 'desc'));
      sub = fb.onSnapshot(q, s => {
        st.lista = s.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.hora || '').localeCompare(a.hora || ''));
        if (st.abierto && !st.lista.some(m => m.id === st.abierto) && st.vista === 'detalle') {
          st.vista = 'lista'; st.abierto = null;           // lo borró la otra persona
        }
        render();
      }, mostrarError);
    }
  }
  render();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fotos: achicar en el celular antes de subir
// ─────────────────────────────────────────────────────────────────────────────
async function leerImagen(file) {
  if (!file.type.startsWith('image/')) throw new Error('no-imagen');
  let fuente;
  try {
    fuente = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Respaldo para navegadores sin createImageBitmap con opciones.
    fuente = await new Promise((ok, mal) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => mal(new Error('no-decodifica'));
      img.src = URL.createObjectURL(file);
    });
  }
  return fuente;
}

function achicar(fuente, lado, maximo) {
  const w0 = fuente.width, h0 = fuente.height;
  let escala = Math.min(1, lado / Math.max(w0, h0));
  for (let intento = 0; intento < 8; intento++) {
    const w = Math.max(1, Math.round(w0 * escala)), h = Math.max(1, Math.round(h0 * escala));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);     // fondo blanco para PNG con transparencia
    ctx.drawImage(fuente, 0, 0, w, h);
    for (const q of [0.85, 0.75, 0.65, 0.55]) {
      const url = c.toDataURL('image/jpeg', q);
      if (url.length <= maximo) return url;
    }
    escala *= 0.8;
  }
  throw new Error('muy-grande');
}

async function cargarFoto(file) {
  st.procesando = true; render();
  try {
    const fuente = await leerImagen(file);
    st.borrador.foto = achicar(fuente, FOTO_LADO, FOTO_MAX);
    st.borrador.miniatura = achicar(fuente, MINI_LADO, MINI_MAX);
    st.borrador.fotoCambio = true;
    fuente.close?.();
  } catch (err) {
    console.error(err);
    aviso(err.message === 'no-imagen' ? 'Elegí una foto (los videos no se pueden subir).'
        : 'No se pudo leer esa foto. Probá con otra o sacale una captura.', true);
  } finally {
    st.procesando = false; render();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Acciones
// ─────────────────────────────────────────────────────────────────────────────
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nuevo() {
  st.borrador = { titulo: '', fecha: hoy(), hora: '', lugar: '', comentario: '', foto: null, miniatura: null, fotoCambio: false };
  st.abierto = null; st.vista = 'form'; render();
  window.scrollTo(0, 0);
}

async function editar(id) {
  const m = st.lista.find(x => x.id === id);
  if (!m) return;
  st.borrador = {
    titulo: m.titulo, fecha: m.fecha || '', hora: m.hora || '', lugar: m.lugar || '', comentario: m.comentario || '',
    foto: st.fotos[id] || null, miniatura: m.miniatura || null, fotoCambio: false,
  };
  st.abierto = id; st.vista = 'form'; render();
  window.scrollTo(0, 0);
}

async function guardar() {
  const b = st.borrador;
  const titulo = b.titulo.trim().slice(0, 80);
  if (!titulo) { aviso('Ponele un título al momento.', true); return; }
  if (st.procesando) { aviso('Esperá a que termine de cargar la foto.', true); return; }

  const datos = {
    titulo,
    fecha: b.fecha || '',
    hora: b.hora || '',
    lugar: b.lugar.trim().slice(0, 100),
    comentario: b.comentario.trim().slice(0, 500),
    miniatura: b.miniatura || null,
  };
  const col = fb.collection(fb.db, 'couples', st.coupleId, 'momentos');
  const ref = st.abierto ? fb.doc(col, st.abierto) : fb.doc(col);
  const fotoRef = fb.doc(fb.db, 'couples', st.coupleId, 'momentosFotos', ref.id);
  const batch = fb.writeBatch(fb.db);
  if (st.abierto) {
    batch.update(ref, { ...datos, editadoPor: st.user.uid, editado: fb.serverTimestamp() });
  } else {
    batch.set(ref, { ...datos, creador: st.user.uid, creado: fb.serverTimestamp() });
  }
  if (b.fotoCambio) {
    if (b.foto) batch.set(fotoRef, { foto: b.foto });
    else batch.delete(fotoRef);
  }

  st.guardando = true; render();
  try {
    await batch.commit();
    if (b.fotoCambio) { if (b.foto) st.fotos[ref.id] = b.foto; else delete st.fotos[ref.id]; }
    st.borrador = null;
    st.abierto = ref.id; st.vista = 'detalle';
    aviso('Momento guardado 📸');
    cargarFotoGrande(ref.id);
  } catch (err) {
    mostrarError(err);
  } finally {
    st.guardando = false; render();
  }
}

async function borrar(id) {
  const batch = fb.writeBatch(fb.db);
  batch.delete(fb.doc(fb.db, 'couples', st.coupleId, 'momentos', id));
  batch.delete(fb.doc(fb.db, 'couples', st.coupleId, 'momentosFotos', id));
  try {
    await batch.commit();
    delete st.fotos[id];
    st.vista = 'lista'; st.abierto = null; st.confirmarBorrar = false;
    aviso('Momento borrado.');
  } catch (err) { mostrarError(err); }
}

async function abrirDetalle(id) {
  st.abierto = id; st.vista = 'detalle'; st.confirmarBorrar = false; render();
  window.scrollTo(0, 0);
  cargarFotoGrande(id);
}

async function cargarFotoGrande(id) {
  const m = st.lista.find(x => x.id === id);
  if (st.fotos[id] || (m && !m.miniatura)) return;
  try {
    const s = await fb.getDoc(fb.doc(fb.db, 'couples', st.coupleId, 'momentosFotos', id));
    if (s.exists()) { st.fotos[id] = s.data().foto; render(); }
  } catch (err) { console.error(err); }
}

async function renombrar(nombre) {
  const n = (nombre || '').trim().slice(0, 30);
  if (!n) { aviso('Escribí un nombre.', true); return; }
  try {
    await Nube.actualizarPareja({ nombreMomentos: n });
    st.renombrando = false;
    aviso(`Ahora la sección se llama "${n}" 📸`);
  } catch (err) { mostrarError(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Eventos
// ─────────────────────────────────────────────────────────────────────────────
function onClick(e) {
  const btn = e.target.closest('[data-a]');
  if (!btn) return;
  const { a, id } = btn.dataset;
  switch (a) {
    case 'login': Nube.login().catch(mostrarError); break;
    case 'vincular': window.Nav?.irPorotitos(); break;
    case 'nuevo': nuevo(); break;
    case 'abrir': abrirDetalle(id); break;
    case 'editar': editar(id); break;
    case 'cancelar':
      st.borrador = null;
      st.vista = st.abierto ? 'detalle' : 'lista'; render(); break;
    case 'volver-lista': st.vista = 'lista'; st.abierto = null; render(); break;
    case 'borrar':
      if (st.confirmarBorrar) borrar(id);
      else { st.confirmarBorrar = true; render(); }
      break;
    case 'no-borrar': st.confirmarBorrar = false; render(); break;
    case 'elegir-foto': el().querySelector('input[type=file]')?.click(); break;
    case 'quitar-foto':
      Object.assign(st.borrador, { foto: null, miniatura: null, fotoCambio: true }); render(); break;
    case 'cancelar-renombre': st.renombrando = false; render(); break;
    case 'nombre-default': renombrar(NOMBRE_DEFAULT); break;
  }
}

function onSubmit(e) {
  e.preventDefault();
  document.activeElement?.blur();
  const f = e.target;
  if (f.dataset.f === 'momento') guardar();
  if (f.dataset.f === 'renombrar') renombrar(new FormData(f).get('nombre'));
}

// El borrador se guarda en memoria con cada tecla: así los datos que llegan en
// tiempo real (la otra persona agregando algo) no borran lo que estás escribiendo.
function onInput(e) {
  const t = e.target;
  if (st.borrador && t.form?.dataset.f === 'momento' && t.name in st.borrador) st.borrador[t.name] = t.value;
}

function onChange(e) {
  const t = e.target;
  if (t.type === 'file' && t.files?.[0] && st.borrador) { cargarFoto(t.files[0]); t.value = ''; }
  else onInput(e);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Render
// ─────────────────────────────────────────────────────────────────────────────
let ultimoHtml = '';
function render() {
  const root = el();
  if (!root || !fb) return;
  const activo = document.activeElement;
  // Si se está escribiendo en el formulario, no lo redibujamos (el borrador ya guarda lo tipeado).
  const escribiendo = activo && root.contains(activo) && ['INPUT', 'TEXTAREA'].includes(activo.tagName) && activo.type !== 'file';
  const html = vista() + avisoHtml();
  if (escribiendo && st.vista === 'form') { pintarAviso(); pintarNombre(); return; }
  if (html !== ultimoHtml) { root.innerHTML = html; ultimoHtml = html; }
  pintarNombre();
}

export function pintarNombre() {
  const n = seccion();
  const t = document.getElementById('momTitulo');
  const e = document.getElementById('momEntryNombre');
  const r = document.getElementById('momRenombrar');
  if (t) t.textContent = n;
  if (e) e.textContent = n;
  if (r) r.hidden = !Nube.esMiembro(st);
}

function vista() {
  if (st.cargando) return card('<p class="poro-desc">Cargando…</p>');
  if (!st.user) return card(`
    <p class="poro-title">📸 ${esc(seccion())}</p>
    <p class="poro-desc">Guarden sus recuerdos con foto, fecha, lugar y un comentario. Para compartirlos,
    cada uno inicia sesión con su cuenta de Google.</p>
    <button class="poro-btn primary" data-a="login">Entrar con Google</button>`);
  if (!Nube.esMiembro(st)) return card(`
    <p class="poro-title">Falta vincularte con tu pareja</p>
    <p class="poro-desc">Uno crea el espacio y el otro se une con el código.</p>
    <button class="poro-btn primary" data-a="vincular">Vincular</button>`);

  const renombre = st.renombrando ? card(`
    <p class="poro-title">Nombre de la sección</p>
    <form data-f="renombrar" class="poro-row">
      <input name="nombre" maxlength="30" class="poro-input" value="${esc(seccion())}" required />
      <button class="poro-btn primary">Guardar</button>
    </form>
    <div class="poro-row">
      <button type="button" class="poro-link" data-a="nombre-default">Volver a "${NOMBRE_DEFAULT}"</button>
      <button type="button" class="poro-link" data-a="cancelar-renombre">Cancelar</button>
    </div>`) : '';

  if (st.vista === 'form' && st.borrador) return renombre + vistaForm();
  if (st.vista === 'detalle') {
    const m = st.lista.find(x => x.id === st.abierto);
    if (m) return renombre + vistaDetalle(m);
  }
  return renombre + vistaLista();
}

function vistaLista() {
  const boton = `<button class="poro-btn primary mom-nuevo" data-a="nuevo">＋ Nuevo momento</button>`;
  if (!st.lista.length) return boton + card(`
    <p class="poro-desc">Todavía no guardaron ningún momento. Empiecen por uno: la primera cita,
    un viaje, una salida tranqui… 💕</p>`);
  return boton + `<div class="mom-lista">${st.lista.map(m => `
    <button class="mom-item" data-a="abrir" data-id="${m.id}">
      ${m.miniatura
        ? `<img class="mom-mini" src="${m.miniatura}" alt="" loading="lazy" />`
        : '<span class="mom-mini vacia">📸</span>'}
      <span class="mom-item-txt">
        <strong>${esc(m.titulo)}</strong>
        <small>${esc(cuando(m))}${m.lugar ? ` · 📍 ${esc(m.lugar)}` : ''}</small>
        ${m.comentario ? `<em>${esc(m.comentario)}</em>` : ''}
      </span>
    </button>`).join('')}</div>`;
}

function vistaDetalle(m) {
  const foto = st.fotos[m.id] || m.miniatura;
  const quien = m.editadoPor && m.editadoPor !== m.creador
    ? `Lo agregó ${esc(nombre(m.creador))} · editado por ${esc(nombre(m.editadoPor))}`
    : `Lo agregó ${esc(nombre(m.creador))}`;
  return `
    <button class="poro-link mom-volver" data-a="volver-lista">← Todos los momentos</button>
    <div class="poro-card mom-detalle">
      ${foto ? `<img class="mom-foto" src="${foto}" alt="${esc(m.titulo)}" />` : ''}
      <p class="mom-titulo">${esc(m.titulo)}</p>
      <div class="mom-datos">
        ${m.fecha || m.hora ? `<span>📅 ${esc(cuando(m, true))}</span>` : ''}
        ${m.lugar ? `<span>📍 ${esc(m.lugar)}</span>` : ''}
      </div>
      ${m.comentario ? `<p class="mom-comentario">${esc(m.comentario)}</p>` : ''}
      <p class="poro-mini">${quien}</p>
      <div class="poro-row">
        <button class="poro-btn" data-a="editar" data-id="${m.id}">Editar</button>
        ${st.confirmarBorrar
          ? `<button class="poro-btn resta" data-a="borrar" data-id="${m.id}">Sí, borrar</button>
             <button class="poro-btn" data-a="no-borrar">No</button>`
          : `<button class="poro-btn resta" data-a="borrar" data-id="${m.id}">Borrar</button>`}
      </div>
    </div>`;
}

function vistaForm() {
  const b = st.borrador;
  const foto = b.foto || b.miniatura;
  return card(`
    <p class="poro-title">${st.abierto ? 'Editar momento' : 'Nuevo momento'}</p>
    <form data-f="momento" class="poro-form">
      <input type="file" accept="image/*" hidden />
      ${st.procesando
        ? '<div class="mom-foto-caja vacia">Preparando la foto…</div>'
        : foto
          ? `<div class="mom-foto-caja"><img src="${foto}" alt="" /></div>
             <div class="poro-row">
               <button type="button" class="poro-btn" data-a="elegir-foto">Cambiar foto</button>
               <button type="button" class="poro-btn resta" data-a="quitar-foto">Quitar foto</button>
             </div>`
          : '<button type="button" class="mom-foto-caja vacia" data-a="elegir-foto">📷 Agregar una foto</button>'}
      <input name="titulo" maxlength="80" class="poro-input" placeholder="Título (ej: Nuestra primera cena)" value="${esc(b.titulo)}" required />
      <div class="poro-row">
        <label class="mom-campo">Fecha<input name="fecha" type="date" class="poro-input" value="${esc(b.fecha)}" /></label>
        <label class="mom-campo">Hora<input name="hora" type="time" class="poro-input" value="${esc(b.hora)}" /></label>
      </div>
      <input name="lugar" maxlength="100" class="poro-input" placeholder="📍 Lugar" value="${esc(b.lugar)}" />
      <textarea name="comentario" maxlength="500" rows="3" class="poro-input" placeholder="Comentario (ej: salida tranqui, nos reímos un montón)">${esc(b.comentario)}</textarea>
      <div class="poro-row">
        <button class="poro-btn primary" ${st.guardando || st.procesando ? 'disabled' : ''}>${st.guardando ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" class="poro-btn" data-a="cancelar">Cancelar</button>
      </div>
    </form>`);
}

// ── Avisos ───────────────────────────────────────────────────────────────────
let avisoTimer = null;
function aviso(texto, esError = false) {
  st.aviso = texto; st.error = esError;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { st.aviso = ''; pintarAviso(); }, 4500);
  render();
}
function avisoHtml() { return st.aviso ? `<div class="poro-aviso ${st.error ? 'error' : ''}">${esc(st.aviso)}</div>` : ''; }
function pintarAviso() {
  const root = el();
  root.querySelector('.poro-aviso')?.remove();
  root.insertAdjacentHTML('beforeend', avisoHtml());
  ultimoHtml = '';
}
function mostrarError(err) {
  console.error(err);
  aviso(err?.code === 'permission-denied' ? 'Esa acción no está permitida.'
      : err?.code === 'unavailable' ? 'Sin conexión. Probá de nuevo en un rato.'
      : 'Algo salió mal. Probá de nuevo.', true);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function el() { return document.getElementById('momContenido'); }
function card(html) { return `<div class="poro-card">${html}</div>`; }
function seccion() {
  if (st.couple?.nombreMomentos) return st.couple.nombreMomentos;
  try { return localStorage.getItem(KEY_NOMBRE) || NOMBRE_DEFAULT; } catch { return NOMBRE_DEFAULT; }
}
function nombre(uid) { return uid === st.user?.uid ? 'vos' : (st.couple?.nombres?.[uid] || 'tu pareja'); }
function cuando(m, largo = false) {
  let t = '';
  if (m.fecha) {
    const [y, mo, d] = m.fecha.split('-').map(Number);
    t = new Date(y, mo - 1, d).toLocaleDateString('es-AR',
      largo ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (m.hora) t += (t ? ' · ' : '') + m.hora + ' hs';
  return t || 'Sin fecha';
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const Momentos = { abrir, pintarNombre };
