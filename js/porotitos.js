/**
 * Corazoncitos (antes "Porotitos"; el nombre lo elige la pareja) — puntos que te da
 * (o te saca) tu pareja y que podés gastar en premios.
 *
 * Reglas (validadas en el servidor por firestore.rules):
 *  - Solo la otra persona puede sumarte o restarte puntos. Podés quedar en negativo.
 *  - Vos solo bajás tus puntos al comprar un premio que es para vos (si te alcanza) → recibís un cupón.
 *  - Cualquiera crea premios, para sí o para el otro; cualquiera los edita o borra.
 *  - El precio lo pone siempre quien NO recibe el premio. Uno cargado para uno mismo
 *    queda "esperando precio" (y vuelve a quedar así si le cambiás nombre o detalle).
 *  - Cualquiera de los dos puede tildar un cupón como canjeado.
 *  - El nombre de la sección es compartido y editable (por defecto "Corazoncitos").
 *
 * Este módulo se carga solo cuando se abre la sección (import dinámico).
 * La sesión y la pareja las maneja nube.js (compartido con el resto de la app).
 */
import * as Nube from './nube.js?v=202611202322';
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para que no se confundan
export const NOMBRE_DEFAULT = 'Corazoncitos';
export const ICONO = '💗';
const KEY_NOMBRE = 'seccionNombre_v1';   // copia local para mostrar el nombre antes de conectarse

let fb = null;        // { auth, db, ...funciones del SDK }
let iniciado = false;

const st = {
  cargando: true,
  user: null,
  coupleId: null,
  couple: null,
  premios: [],
  cupones: [],
  movs: [],
  tab: 'canjear',
  editando: null,       // id del premio en edición
  confirmar: null,      // id del premio cuya compra espera confirmación
  renombrando: false,
  error: '',
  aviso: '',
};

let subsPareja = [];      // listeners de premios/cupones/movimientos
let cidEscuchado = null;

// ─────────────────────────────────────────────────────────────────────────────
//  Arranque
// ─────────────────────────────────────────────────────────────────────────────
export async function abrir() {
  const root = el();
  if (!Nube.configurado) {
    root.innerHTML = card(`
      <p class="poro-title">Falta conectar la base de datos</p>
      <p class="poro-desc">Para usar esta sección hay que configurar Firebase una sola vez.
      Seguí los pasos de <strong>FIREBASE_SETUP.md</strong> y pegá la configuración en
      <code>js/firebase-config.js</code>.</p>`);
    return;
  }
  if (iniciado) { render(); return; }
  iniciado = true;
  root.innerHTML = card('<p class="poro-desc">Cargando…</p>');
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('change', onChange);
  root.addEventListener('focusout', onFocusOut);
  document.getElementById('poroRenombrar')?.addEventListener('click', () => {
    if (!st.couple || st.couple.members?.length < 2) return;
    st.renombrando = !st.renombrando; render();
  });

  try {
    fb = await Nube.iniciar();
  } catch (e) {
    iniciado = false;
    root.innerHTML = card('<p class="poro-desc">No se pudo conectar. Revisá tu conexión a internet y volvé a entrar.</p>');
    return;
  }
  Nube.suscribir(onEstado, mostrarError);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Suscripciones en tiempo real
// ─────────────────────────────────────────────────────────────────────────────
function onEstado(e) {
  st.cargando = !e.listo;
  st.user = e.user;
  st.coupleId = e.coupleId;
  st.couple = e.couple;
  if (st.couple?.nombreSeccion) {
    try { localStorage.setItem(KEY_NOMBRE, st.couple.nombreSeccion); } catch { /* sin storage */ }
  }
  // Las subcolecciones solo se pueden leer siendo miembro.
  const cid = Nube.esMiembro(e) ? e.coupleId : null;
  if (cid !== cidEscuchado) {
    subsPareja.forEach(u => u()); subsPareja = [];
    st.premios = []; st.cupones = []; st.movs = [];
    cidEscuchado = cid;
    if (cid) escucharSub(cid);
  }
  render();
}

function escucharSub(cid) {
  const col = n => fb.collection(fb.db, 'couples', cid, n);
  const lista = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
  subsPareja.push(
    fb.onSnapshot(fb.query(col('premios'), fb.orderBy('precio')), s => { st.premios = lista(s); render(); }, mostrarError),
    fb.onSnapshot(fb.query(col('cupones'), fb.orderBy('ts', 'desc')), s => { st.cupones = lista(s); render(); }, mostrarError),
    fb.onSnapshot(fb.query(col('movimientos'), fb.orderBy('ts', 'desc'), fb.limit(60)), s => { st.movs = lista(s); render(); }, mostrarError),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Acciones
// ─────────────────────────────────────────────────────────────────────────────
async function login() {
  try { await Nube.login(); } catch (err) { mostrarError(err); }
}

function miNombre() {
  return (st.user.displayName || st.user.email || 'Yo').split(' ')[0].slice(0, 40);
}

async function crearPareja() {
  for (let intento = 0; intento < 5; intento++) {
    const codigo = Array.from({ length: 6 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
    const ref = fb.doc(fb.db, 'couples', codigo);
    try {
      const existe = await fb.getDoc(ref).then(s => s.exists()).catch(() => true);
      if (existe) continue;
      await fb.setDoc(ref, {
        members: [st.user.uid],
        nombres: { [st.user.uid]: miNombre() },
        saldos:  { [st.user.uid]: 0 },
        creado:  fb.serverTimestamp(),
      });
      await fb.setDoc(fb.doc(fb.db, 'users', st.user.uid), { coupleId: codigo });
      return;
    } catch (err) {
      if (intento === 4) mostrarError(err);
    }
  }
}

async function unirse(codigo) {
  codigo = codigo.trim().toUpperCase().replace(/\s/g, '');
  if (codigo.length !== 6) { aviso('El código tiene 6 caracteres.', true); return; }
  const ref = fb.doc(fb.db, 'couples', codigo);
  let snap;
  try { snap = await fb.getDoc(ref); }
  catch { aviso('Ese código ya está en uso por otra pareja.', true); return; }
  if (!snap.exists()) { aviso('No encontramos ese código. Revisalo.', true); return; }

  const c = snap.data();
  const uid = st.user.uid;
  try {
    if (!c.members.includes(uid)) {
      await fb.updateDoc(ref, {
        members: fb.arrayUnion(uid),
        [`nombres.${uid}`]: miNombre(),
        [`saldos.${uid}`]: 0,
      });
    }
    await fb.setDoc(fb.doc(fb.db, 'users', uid), { coupleId: codigo });
  } catch (err) { mostrarError(err); }
}

async function ajustar(signo, cantidad, motivo) {
  const n = Math.trunc(Number(cantidad));
  if (!n || n < 1 || n > 1000) { aviso('Elegí una cantidad entre 1 y 1000.', true); return; }
  const otro = otroUid();
  const delta = signo * n;
  const cref = fb.doc(fb.db, 'couples', st.coupleId);
  const mref = fb.doc(fb.collection(cref, 'movimientos'));
  const b = fb.writeBatch(fb.db);
  b.set(mref, { tipo: 'ajuste', de: st.user.uid, para: otro, delta, motivo: (motivo || '').trim().slice(0, 140), ts: fb.serverTimestamp() });
  b.update(cref, { [`saldos.${otro}`]: fb.increment(delta), ultimoMov: mref.id });
  try {
    await b.commit();
    aviso(`${delta > 0 ? 'Le sumaste' : 'Le restaste'} ${n} ${plural(n)} a ${nombre(otro)}.`);
  } catch (err) { mostrarError(err); }
}

async function comprar(premioId) {
  const p = st.premios.find(x => x.id === premioId);
  if (!p) return;
  const uid = st.user.uid;
  if (p.para !== uid || p.precio == null) return;
  if (saldo(uid) < p.precio) { aviso(`No te alcanzan los ${unidad(2)}.`, true); return; }

  const cref = fb.doc(fb.db, 'couples', st.coupleId);
  const mref = fb.doc(fb.collection(cref, 'movimientos'));
  const kref = fb.doc(fb.collection(cref, 'cupones'));
  const b = fb.writeBatch(fb.db);
  b.set(kref, {
    premioId: p.id, nombre: p.nombre, precio: p.precio,
    comprador: uid, vendedor: otroUid(), movId: mref.id,
    canjeado: false, ts: fb.serverTimestamp(),
  });
  b.set(mref, { tipo: 'compra', de: uid, para: uid, delta: -p.precio, motivo: p.nombre, cuponId: kref.id, ts: fb.serverTimestamp() });
  b.update(cref, { [`saldos.${uid}`]: fb.increment(-p.precio), ultimoMov: mref.id });
  try {
    await b.commit();
    st.tab = 'cupones';
    aviso(`¡Listo! Tenés un cupón de "${p.nombre}" 🎟️`);
  } catch (err) { mostrarError(err); }
}

async function guardarPremio(datos, id) {
  const yo = st.user.uid;
  const nombreP = (datos.nombre || '').trim().slice(0, 60);
  const descripcion = (datos.descripcion || '').trim().slice(0, 200);
  if (!nombreP) { aviso('Ponele un nombre al premio.', true); return false; }

  const previo = id ? st.premios.find(x => x.id === id) : null;
  if (id && !previo) return false;
  // El destinatario no cambia una vez creado el premio.
  const para = previo ? previo.para : (st.couple.members.includes(datos.para) ? datos.para : otroUid());

  let precio;
  let avisoPrecio = '';
  if (para === yo) {
    // Premio para mí: el precio lo pone mi pareja. Si cambio el texto, lo pierde.
    const cambioTexto = previo && (previo.nombre !== nombreP || (previo.descripcion || '') !== descripcion);
    precio = !previo || cambioTexto ? null : (previo.precio ?? null);
    if (previo && cambioTexto && previo.precio != null) {
      avisoPrecio = `Cambiaste el premio, así que ${nombre(otroUid())} tiene que volver a ponerle precio.`;
    }
  } else {
    precio = Math.trunc(Number(datos.precio));
    if (!precio || precio < 1 || precio > 100000) { aviso('Ponele un precio de 1 en adelante.', true); return false; }
  }

  const col = fb.collection(fb.db, 'couples', st.coupleId, 'premios');
  try {
    if (id) {
      await fb.updateDoc(fb.doc(col, id), { nombre: nombreP, descripcion, precio });
    } else {
      await fb.addDoc(col, { nombre: nombreP, descripcion, precio, para, creador: yo, creado: fb.serverTimestamp() });
      if (para === yo) avisoPrecio = `Listo. Ahora ${nombre(otroUid())} tiene que ponerle precio.`;
    }
    if (avisoPrecio) aviso(avisoPrecio);
    return true;
  } catch (err) { mostrarError(err); return false; }
}

async function renombrar(nuevo) {
  const n = (nuevo || '').trim().slice(0, 30);
  if (!n) { aviso('Escribí un nombre.', true); return; }
  try {
    await Nube.actualizarPareja({ nombreSeccion: n });
    st.renombrando = false;
    aviso(`Ahora la sección se llama "${n}" ${ICONO}`);
  } catch (err) { mostrarError(err); }
}

async function borrarPremio(id) {
  try { await fb.deleteDoc(fb.doc(fb.db, 'couples', st.coupleId, 'premios', id)); }
  catch (err) { mostrarError(err); }
}

async function marcarCupon(id, canjeado) {
  const ref = fb.doc(fb.db, 'couples', st.coupleId, 'cupones', id);
  const datos = canjeado
    ? { canjeado: true, canjeadoPor: st.user.uid, canjeadoEn: fb.serverTimestamp() }
    : { canjeado: false };
  try { await fb.updateDoc(ref, datos); } catch (err) { mostrarError(err); render(); }
}

async function compartirCodigo() {
  const texto = `Unite a "Nosotros" 💕 con este código: ${st.coupleId}\n${location.href.split('#')[0]}`;
  try {
    if (navigator.share) { await navigator.share({ text: texto }); return; }
    await navigator.clipboard.writeText(texto);
    aviso('Código copiado 📋');
  } catch { /* el usuario canceló */ }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Eventos (delegados en el contenedor)
// ─────────────────────────────────────────────────────────────────────────────
function onClick(e) {
  const btn = e.target.closest('[data-a]');
  if (!btn) return;
  const { a, id } = btn.dataset;
  switch (a) {
    case 'login':    login(); break;
    case 'logout':   Nube.logout(); break;
    case 'crear':    crearPareja(); break;
    case 'compartir': compartirCodigo(); break;
    case 'tab':      st.tab = btn.dataset.tab; st.confirmar = null; st.editando = null; render(); break;
    case 'comprar':
      if (st.confirmar === id) { st.confirmar = null; comprar(id); }
      else { st.confirmar = id; render(); }
      break;
    case 'cancelar-compra': st.confirmar = null; render(); break;
    case 'editar':   st.editando = id; render(); break;
    case 'cancelar-edicion': st.editando = null; render(); break;
    case 'cancelar-renombre': st.renombrando = false; render(); break;
    case 'nombre-default': renombrar(NOMBRE_DEFAULT); break;
    case 'borrar':
      if (btn.dataset.seguro) borrarPremio(id);
      else { btn.dataset.seguro = '1'; btn.textContent = '¿Borrar?'; ultimoHtml = ''; }
      break;
  }
}

async function onSubmit(e) {
  e.preventDefault();
  const f = e.target;
  document.activeElement?.blur();   // cierra el teclado y permite refrescar la vista
  const datos = Object.fromEntries(new FormData(f));
  switch (f.dataset.f) {
    case 'unirse': unirse(datos.codigo || ''); break;
    case 'ajuste': {
      const signo = e.submitter?.value === 'restar' ? -1 : 1;
      await ajustar(signo, datos.cantidad, datos.motivo);
      break;
    }
    case 'renombrar': renombrar(datos.nombre); break;
    case 'premio':
      if (await guardarPremio(datos, f.dataset.id)) { st.editando = null; f.reset(); render(); }
      break;
  }
}

function onChange(e) {
  const c = e.target.closest('[data-cupon]');
  if (c) marcarCupon(c.dataset.cupon, c.checked);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Render
// ─────────────────────────────────────────────────────────────────────────────
function render() {
  const root = el();
  if (!root || !fb) return;
  // No pisamos lo que la persona está escribiendo en un formulario.
  const activo = document.activeElement;
  const escribiendo = activo && root.contains(activo) && ['INPUT', 'TEXTAREA'].includes(activo.tagName) && activo.type !== 'checkbox';
  if (escribiendo) { renderPendiente = true; renderAvisos(); return; }

  renderPendiente = false;
  const html = vista() + avisosHtml();
  // Solo redibujamos si algo cambió: evita parpadeos y toques perdidos.
  if (html !== ultimoHtml) { root.innerHTML = html; ultimoHtml = html; }
  pintarNombre();
}

/** Actualiza el título de la sección, el botón de entrada y el lápiz de renombrar. */
export function pintarNombre() {
  const n = seccion();
  const t = document.getElementById('poroTitulo');
  const e = document.getElementById('poroEntryNombre');
  const r = document.getElementById('poroRenombrar');
  if (t) t.textContent = n;
  if (e) e.textContent = n;
  if (r) r.hidden = !(st.couple?.members?.length === 2 && st.user && st.couple.members.includes(st.user.uid));
}

// Si llegaron datos nuevos mientras se escribía, refrescamos al salir del campo.
let renderPendiente = false;
let ultimoHtml = '';
function onFocusOut() {
  setTimeout(() => {
    const a = document.activeElement;
    const sigueEscribiendo = a && el().contains(a) && ['INPUT', 'TEXTAREA'].includes(a.tagName) && a.type !== 'checkbox';
    if (renderPendiente && !sigueEscribiendo) render();
  }, 0);
}

function vista() {
  if (st.cargando) return card('<p class="poro-desc">Cargando…</p>');
  if (!st.user) return vistaLogin();
  if (!st.coupleId) return vistaSinPareja() + pie();
  if (!st.couple) return card('<p class="poro-desc">Cargando pareja…</p>') + pie();
  if (!st.couple.members.includes(st.user.uid)) return vistaSinPareja() + pie();
  if (st.couple.members.length < 2) return vistaEsperando() + pie();
  return vistaPrincipal() + pie();
}

function vistaLogin() {
  return card(`
    <p class="poro-title">${ICONO} ${esc(seccion())}</p>
    <p class="poro-desc">Tu pareja te da ${esc(unidad(2))} (o te los saca 😅) y vos los canjeás
    por premios. Para que funcione en los dos celulares,
    cada uno inicia sesión con su cuenta de Google.</p>
    <button class="poro-btn primary" data-a="login">Entrar con Google</button>`);
}

function vistaSinPareja() {
  return card(`
      <p class="poro-title">Conectate con tu pareja</p>
      <p class="poro-desc">Uno de los dos crea el espacio y le pasa el código al otro.</p>
      <button class="poro-btn primary" data-a="crear">Crear nuestro espacio</button>`) +
    card(`
      <p class="poro-title">Tengo un código</p>
      <form data-f="unirse" class="poro-row">
        <input name="codigo" class="poro-input codigo" maxlength="6" placeholder="ABC234" autocapitalize="characters" autocomplete="off" required />
        <button class="poro-btn">Unirme</button>
      </form>`);
}

function vistaEsperando() {
  return card(`
    <p class="poro-title">Esperando a tu pareja 💌</p>
    <p class="poro-desc">Pasale este código para que se una desde su celular:</p>
    <p class="poro-codigo">${esc(st.coupleId)}</p>
    <button class="poro-btn primary" data-a="compartir">Compartir código</button>`);
}

function vistaPrincipal() {
  const yo = st.user.uid, otro = otroUid();
  const tabs = [
    ['canjear', 'Canjear'],
    ['premios', 'Premios'],
    ['cupones', 'Cupones'],
    ['historial', 'Historial'],
  ];
  const pendientes = st.cupones.filter(c => !c.canjeado).length;
  const porPreciar = st.premios.filter(p => p.precio == null && p.para !== yo).length;
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
  return `${renombre}
    <div class="poro-saldos">
      <div class="cont-card poro-saldo">
        <span class="cont-num ${saldo(yo) < 0 ? 'neg' : ''}">${saldo(yo)}</span>
        <span class="cont-label">Tus ${esc(unidad(2))}</span>
        <span class="poro-mini">Solo ${esc(nombre(otro))} puede cambiarlos</span>
      </div>
      <div class="cont-card poro-saldo">
        <span class="cont-num ${saldo(otro) < 0 ? 'neg' : ''}">${saldo(otro)}</span>
        <span class="cont-label">De ${esc(nombre(otro))}</span>
        <span class="poro-mini">Vos manejás estos</span>
      </div>
    </div>

    ${card(`
      <p class="poro-title">Darle o sacarle ${esc(unidad(2))} a ${esc(nombre(otro))}</p>
      <form data-f="ajuste" class="poro-ajuste">
        <input name="cantidad" type="number" inputmode="numeric" min="1" max="1000" value="1" class="poro-input cant" required />
        <input name="motivo" maxlength="140" class="poro-input" placeholder="¿Por qué? (opcional)" />
        <div class="poro-row">
          <button class="poro-btn suma" name="accion" value="sumar">＋ Sumar</button>
          <button class="poro-btn resta" name="accion" value="restar">− Restar</button>
        </div>
      </form>`)}

    <div class="poro-tabs">
      ${tabs.map(([k, t]) => `<button class="poro-tab ${st.tab === k ? 'on' : ''}" data-a="tab" data-tab="${k}">${t}${k === 'cupones' && pendientes ? ` <span class="poro-badge">${pendientes}</span>` : ''}${k === 'premios' && porPreciar ? ` <span class="poro-badge">${porPreciar}</span>` : ''}</button>`).join('')}
    </div>
    ${{ canjear: tabCanjear, premios: tabPremios, cupones: tabCupones, historial: tabHistorial }[st.tab]()}
  `;
}

function tabCanjear() {
  const lista = st.premios.filter(p => p.para === st.user.uid);
  const mio = saldo(st.user.uid);
  if (!lista.length) return card(`<p class="poro-desc">Todavía no hay premios para vos. Podés agregar los que te gustaría en la pestaña <strong>Premios</strong>, o pedirle a ${esc(nombre(otroUid()))} que te cargue alguno.</p>`);
  return lista.map(p => {
    const sinPrecio = p.precio == null;
    const falta = sinPrecio ? 0 : p.precio - mio;
    const conf = st.confirmar === p.id;
    let accion;
    if (sinPrecio) accion = `<span class="poro-falta espera">Esperando que ${esc(nombre(otroUid()))} le ponga precio</span>`;
    else if (falta > 0) accion = `<span class="poro-falta">Te faltan ${falta}</span>`;
    else if (conf) accion = `<button class="poro-btn primary" data-a="comprar" data-id="${p.id}">Confirmar</button>
                             <button class="poro-btn" data-a="cancelar-compra">No</button>`;
    else accion = `<button class="poro-btn primary" data-a="comprar" data-id="${p.id}">Canjear</button>`;
    return card(`
      <div class="poro-premio">
        <div>
          <p class="poro-premio-nombre">${esc(p.nombre)}</p>
          ${p.descripcion ? `<p class="poro-desc">${esc(p.descripcion)}</p>` : ''}
          ${sinPrecio ? '' : `<p class="poro-precio">${ICONO} ${p.precio}</p>`}
        </div>
        <div class="poro-acciones">${accion}</div>
      </div>`, falta > 0 || sinPrecio ? 'apagado' : '');
  }).join('');
}

function tabPremios() {
  const yo = st.user.uid, otro = otroUid();
  const campoPrecio = (valor = '') => `
    <input name="precio" type="number" inputmode="numeric" min="1" max="100000" class="poro-input cant poro-precio-campo" placeholder="Precio" value="${valor}" />`;

  const formNuevo = () => `
    <form data-f="premio" class="poro-form">
      <div class="poro-para">
        <label><input type="radio" name="para" value="${otro}" checked /> Para ${esc(nombre(otro))}</label>
        <label><input type="radio" name="para" value="${yo}" data-yo /> Para mí</label>
      </div>
      <input name="nombre" maxlength="60" class="poro-input" placeholder="Premio (ej: Masajes 15 min)" required />
      <input name="descripcion" maxlength="200" class="poro-input" placeholder="Detalle (opcional)" />
      <p class="poro-mini poro-nota-precio">El precio te lo pone ${esc(nombre(otro))}.</p>
      <div class="poro-row">
        ${campoPrecio()}
        <button class="poro-btn primary">Agregar</button>
      </div>
    </form>`;

  const formEditar = p => {
    const paraMi = p.para === yo;
    return `
    <form data-f="premio" data-id="${p.id}" class="poro-form">
      <p class="poro-mini">Para ${esc(nombre(p.para))}</p>
      <input name="nombre" maxlength="60" class="poro-input" placeholder="Premio" value="${esc(p.nombre)}" required />
      <input name="descripcion" maxlength="200" class="poro-input" placeholder="Detalle (opcional)" value="${esc(p.descripcion || '')}" />
      ${paraMi && p.precio != null ? `<p class="poro-mini">Si cambiás el nombre o el detalle, ${esc(nombre(otro))} tiene que volver a ponerle precio.</p>` : ''}
      <div class="poro-row">
        ${paraMi ? '' : campoPrecio(p.precio ?? '')}
        <button class="poro-btn primary">Guardar</button>
        <button type="button" class="poro-btn" data-a="cancelar-edicion">Cancelar</button>
      </div>
    </form>`;
  };

  const item = p => {
    if (st.editando === p.id) return card(formEditar(p));
    const sinPrecio = p.precio == null;
    const meToca = sinPrecio && p.para !== yo;     // premio que mi pareja se cargó: le pongo precio yo
    return card(`
    <div class="poro-premio">
      <div>
        <p class="poro-premio-nombre">${esc(p.nombre)}</p>
        ${p.descripcion ? `<p class="poro-desc">${esc(p.descripcion)}</p>` : ''}
        ${sinPrecio
          ? `<p class="poro-falta espera">${meToca ? 'Sin precio — ponéselo vos' : `Esperando precio de ${esc(nombre(otro))}`}</p>`
          : `<p class="poro-precio">${ICONO} ${p.precio}</p>`}
        <span class="poro-mini">Lo agregó ${esc(nombre(p.creador))}</span>
      </div>
      <div class="poro-acciones">
        <button class="poro-btn ${meToca ? 'primary' : ''}" data-a="editar" data-id="${p.id}">${meToca ? 'Poner precio' : 'Editar'}</button>
        <button class="poro-btn resta" data-a="borrar" data-id="${p.id}">Borrar</button>
      </div>
    </div>`, meToca ? 'destacado' : '');
  };
  const grupo = (titulo, lista) => `<p class="poro-subtitulo">${titulo}</p>` +
    (lista.length ? lista.map(item).join('') : card('<p class="poro-desc">Ninguno todavía.</p>'));

  return card(`
      <p class="poro-title">Nuevo premio</p>
      <p class="poro-desc">Cargá premios para ${esc(nombre(otro))} con su precio en ${esc(unidad(2))},
      o los que te gustaría ganarte vos: a esos les pone precio ${esc(nombre(otro))}.</p>
      ${st.editando ? '' : formNuevo()}`) +
    grupo(`Para ${esc(nombre(otro))}`, st.premios.filter(p => p.para === otro)) +
    grupo('Para vos', st.premios.filter(p => p.para === yo));
}

function tabCupones() {
  const yo = st.user.uid, otro = otroUid();
  const orden = arr => [...arr].sort((a, b) => Number(a.canjeado) - Number(b.canjeado));
  const item = c => `
    <label class="poro-cupon ${c.canjeado ? 'usado' : ''}">
      <input type="checkbox" data-cupon="${c.id}" ${c.canjeado ? 'checked' : ''} />
      <span class="poro-cupon-cuerpo">
        <span class="poro-premio-nombre">🎟️ ${esc(c.nombre)}</span>
        <span class="poro-mini">${ICONO} ${c.precio} · ${fecha(c.ts)}${c.canjeado ? ` · canjeado${c.canjeadoPor ? ' por ' + esc(nombre(c.canjeadoPor)) : ''}` : ''}</span>
      </span>
    </label>`;
  const mios = orden(st.cupones.filter(c => c.comprador === yo));
  const suyos = orden(st.cupones.filter(c => c.comprador === otro));
  return card(`
      <p class="poro-title">Mis cupones</p>
      ${mios.length ? mios.map(item).join('') : '<p class="poro-desc">Todavía no canjeaste nada.</p>'}`) +
    card(`
      <p class="poro-title">Cupones de ${esc(nombre(otro))} (te toca cumplirlos)</p>
      ${suyos.length ? suyos.map(item).join('') : '<p class="poro-desc">Nada pendiente.</p>'}`);
}

function tabHistorial() {
  const yo = st.user.uid;
  if (!st.movs.length) return card('<p class="poro-desc">Todavía no hay movimientos.</p>');
  return card(st.movs.map(m => {
    const n = Math.abs(m.delta);
    let txt;
    if (m.tipo === 'compra') {
      txt = m.de === yo ? `Canjeaste <strong>${esc(m.motivo)}</strong>` : `${esc(nombre(m.de))} canjeó <strong>${esc(m.motivo)}</strong>`;
    } else {
      const verbo = m.delta > 0 ? 'sumó' : 'restó';
      txt = m.de === yo
        ? `Le ${m.delta > 0 ? 'sumaste' : 'restaste'} a ${esc(nombre(m.para))}`
        : `${esc(nombre(m.de))} te ${verbo}`;
      if (m.motivo) txt += ` — <em>${esc(m.motivo)}</em>`;
    }
    return `<div class="poro-mov">
      <span class="poro-mov-delta ${m.delta < 0 ? 'neg' : 'pos'}">${m.delta > 0 ? '+' : '−'}${n}</span>
      <span class="poro-mov-txt">${txt}<span class="poro-mini">${fecha(m.ts)}</span></span>
    </div>`;
  }).join(''));
}

function pie() {
  return `<p class="poro-pie">${esc(st.user.email || '')}${st.coupleId ? ` · código ${esc(st.coupleId)}` : ''} ·
    <button class="poro-link" data-a="logout">Cerrar sesión</button></p>`;
}

// ── Avisos ───────────────────────────────────────────────────────────────────
let avisoTimer = null;
function aviso(texto, esError = false) {
  st.aviso = texto; st.error = esError ? texto : '';
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { st.aviso = ''; st.error = ''; renderAvisos(); }, 4500);
  render();
}
function avisosHtml() {
  return st.aviso ? `<div class="poro-aviso ${st.error ? 'error' : ''}">${esc(st.aviso)}</div>` : '';
}
function renderAvisos() {
  const root = el();
  root.querySelector('.poro-aviso')?.remove();
  root.insertAdjacentHTML('beforeend', avisosHtml());
  ultimoHtml = '';
}
function mostrarError(err) {
  console.error(err);
  const msg = err?.code === 'permission-denied'
    ? 'Esa acción no está permitida.'
    : err?.code === 'unavailable' ? 'Sin conexión. Probá de nuevo en un rato.'
    : 'Algo salió mal. Probá de nuevo.';
  aviso(msg, true);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function el() { return document.getElementById('poroContenido'); }
function card(html, extra = '') { return `<div class="poro-card ${extra}">${html}</div>`; }
function otroUid() { return st.couple.members.find(u => u !== st.user.uid); }
function saldo(uid) { return st.couple?.saldos?.[uid] ?? 0; }
function nombre(uid) { return uid === st.user?.uid ? 'vos' : (st.couple?.nombres?.[uid] || 'tu pareja'); }
function seccion() {
  if (st.couple?.nombreSeccion) return st.couple.nombreSeccion;
  try { return localStorage.getItem(KEY_NOMBRE) || NOMBRE_DEFAULT; } catch { return NOMBRE_DEFAULT; }
}
/** Nombre de la unidad en minúscula: "corazoncitos" / "corazoncito". */
function unidad(n) {
  const pl = seccion().toLowerCase();
  return n === 1 && pl.length > 1 && pl.endsWith('s') ? pl.slice(0, -1) : pl;
}
function plural(n) { return unidad(n); }
function fecha(ts) {
  if (!ts?.toDate) return 'recién';
  return ts.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const Porotitos = { abrir, pintarNombre };
