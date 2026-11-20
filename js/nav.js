import { Store } from './store.js?v=202611202343';
import { Frases } from './frases.js?v=202611202343';
import { Contador } from './contador.js?v=202611202343';
import { Sync } from './sync.js?v=202611202343';

/**
 * Nav — controla la transición entre la portada y la pantalla principal.
 */
function entrar() {
  const portada = document.getElementById('portada');
  const cine    = document.getElementById('cine');
  portada.style.opacity       = '0';
  portada.style.pointerEvents = 'none';
  setTimeout(() => {
    portada.style.display = 'none';
    cine.style.display    = 'flex';
    cine.classList.add('visible');
    Store.cargarFecha();
    Frases.cargar();
    Frases.mostrarActual();
    Contador.iniciar();
    Sync.iniciar();   // fecha y frases compartidas con la pareja (si hay sesión)
  }, 800);
}

function volver() {
  Contador.detener();
  const cine    = document.getElementById('cine');
  const portada = document.getElementById('portada');
  cine.classList.remove('visible');
  cine.style.display          = 'none';
  portada.style.display       = 'flex';
  portada.style.pointerEvents = '';
  portada.style.opacity       = '0';
  setTimeout(() => { portada.style.opacity = '1'; }, 30);
}

/** Muestra una pantalla y oculta las demás. */
const PANTALLAS = ['cine', 'poro', 'mom'];
function mostrar(id) {
  PANTALLAS.forEach(p => {
    const e = document.getElementById(p);
    if (!e) return;
    const visible = p === id;
    e.style.display = visible ? 'flex' : 'none';
    e.classList.toggle('visible', visible);
  });
  window.scrollTo(0, 0);
}

function errorCarga(contenedor) {
  document.getElementById(contenedor).innerHTML =
    '<div class="poro-card"><p class="poro-desc">No se pudo cargar la sección. Revisá tu conexión.</p></div>';
}

/**
 * Las secciones Corazoncitos y Momentos se cargan recién al abrirse (import dinámico):
 * así Firebase no se descarga ni bloquea el resto de la app si no hay internet.
 */
function irPorotitos() {
  Contador.detener();
  mostrar('poro');
  import('./porotitos.js?v=202611202343')
    .then(m => m.Porotitos.abrir())
    .catch(() => errorCarga('poroContenido'));
}

function irMomentos() {
  Contador.detener();
  mostrar('mom');
  import('./momentos.js?v=202611202343')
    .then(m => m.Momentos.abrir())
    .catch(() => errorCarga('momContenido'));
}

function volverAlInicio() {
  mostrar('cine');
  Contador.detener();
  Contador.iniciar();
}

export const Nav = {
  entrar, volver, irPorotitos, irMomentos,
  volverDePorotitos: volverAlInicio, volverDeMomentos: volverAlInicio,
};
