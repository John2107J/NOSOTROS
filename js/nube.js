/**
 * Nube — conexión con Firebase compartida por toda la app.
 *
 * Se encarga de: cargar el SDK (solo cuando hace falta), el login con Google,
 * el perfil del usuario (users/{uid}) y el documento de la pareja (couples/{codigo}).
 * Los demás módulos se suscriben con `suscribir(cb)` y reciben el estado:
 *
 *   { listo, user, coupleId, couple }
 *
 * El SDK se importa desde la CDN de Google con import dinámico, así la app
 * abre igual aunque no haya internet o Firebase no esté configurado.
 */
import { firebaseConfig, firebaseConfigurado } from './firebase-config.js?v=202611202322';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

export const configurado = firebaseConfigurado;

let fb = null;
let promesa = null;
let subUser = null;
let subCouple = null;

const estado = { listo: false, user: null, coupleId: null, couple: null };
const oyentes = new Set();
const oyentesError = new Set();

/** Carga el SDK y arranca la escucha de sesión. Se puede llamar muchas veces. */
export function iniciar() {
  if (!firebaseConfigurado) return Promise.reject(new Error('sin-config'));
  if (promesa) return promesa;
  promesa = (async () => {
    const [app, auth, fs] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const a = app.initializeApp(firebaseConfig);
    let db;
    try {
      // Caché persistente: la app muestra los últimos datos y guarda cambios aunque no haya señal.
      db = fs.initializeFirestore(a, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
    } catch {
      db = fs.getFirestore(a);
    }
    fb = { ...auth, ...fs, auth: auth.getAuth(a), db };
    fb.getRedirectResult(fb.auth).catch(error);
    fb.onAuthStateChanged(fb.auth, user => {
      estado.user = user;
      estado.listo = true;
      escucharUsuario();
      emitir();
    });
    return fb;
  })();
  promesa.catch(() => { promesa = null; });   // permite reintentar si falló la red
  return promesa;
}

/** cb(estado) se llama enseguida y con cada cambio. Devuelve la función para desuscribirse. */
export function suscribir(cb, cbError) {
  oyentes.add(cb);
  if (cbError) oyentesError.add(cbError);
  cb(estado);
  return () => { oyentes.delete(cb); oyentesError.delete(cbError); };
}

export function getFb() { return fb; }
export function getEstado() { return estado; }

/** ¿El usuario actual es miembro de su pareja? (puede faltar la otra persona) */
export function esMiembro(e = estado) {
  return !!(e.user && e.couple?.members?.includes(e.user.uid));
}
/** ¿Están los dos vinculados? */
export function parejaCompleta(e = estado) {
  return esMiembro(e) && e.couple.members.length === 2;
}

export async function login() {
  await iniciar();
  const prov = new fb.GoogleAuthProvider();
  try {
    await fb.signInWithPopup(fb.auth, prov);
  } catch (err) {
    // En algunos celulares (sobre todo la app instalada en iPhone) el popup no se puede abrir.
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment',
         'auth/cancelled-popup-request'].includes(err.code)) {
      await fb.signInWithRedirect(fb.auth, prov);
    } else if (err.code !== 'auth/popup-closed-by-user') {
      throw err;
    }
  }
}

export function logout() { return fb ? fb.signOut(fb.auth) : Promise.resolve(); }

/** Actualiza campos del documento de la pareja (fecha, frases, nombre de la sección…). */
export function actualizarPareja(campos) {
  if (!fb || !estado.coupleId) return Promise.reject(new Error('sin-pareja'));
  return fb.updateDoc(fb.doc(fb.db, 'couples', estado.coupleId), campos);
}

// ─────────────────────────────────────────────────────────────────────────────
function escucharUsuario() {
  subUser?.(); subUser = null;
  if (!estado.user) { escucharPareja(null); return; }

  const ref = fb.doc(fb.db, 'users', estado.user.uid);
  subUser = fb.onSnapshot(ref, snap => {
    const cid = snap.exists() ? snap.data().coupleId || null : null;
    if (!snap.exists() && !snap.metadata?.fromCache) fb.setDoc(ref, { coupleId: null }).catch(error);
    if (cid !== estado.coupleId) escucharPareja(cid);
  }, error);
}

function escucharPareja(cid) {
  subCouple?.(); subCouple = null;
  estado.coupleId = cid;
  estado.couple = null;
  emitir();
  if (!cid) return;

  subCouple = fb.onSnapshot(fb.doc(fb.db, 'couples', cid), snap => {
    estado.couple = snap.exists() ? snap.data() : null;
    emitir();
  }, err => {
    // Código de una pareja ya completa a la que no pertenecemos.
    if (err.code === 'permission-denied') { estado.couple = { members: [] }; emitir(); }
    else error(err);
  });
}

function emitir() { oyentes.forEach(cb => { try { cb(estado); } catch (e) { console.error(e); } }); }
function error(err) {
  console.error(err);
  oyentesError.forEach(cb => { try { cb(err); } catch { /* nada */ } });
}
