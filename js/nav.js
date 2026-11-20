import { Store } from './store.js?v=202611202251';
import { Frases } from './frases.js?v=202611202251';
import { Contador } from './contador.js?v=202611202251';
import { Sync } from './sync.js?v=202611202251';

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

/**
 * La sección de puntos (Corazoncitos) se carga recién al abrirse (import dinámico): así Firebase
 * no se descarga ni bloquea el resto de la app si no hay internet.
 */
function irPorotitos() {
  Contador.detener();
  const cine = document.getElementById('cine');
  const poro = document.getElementById('poro');
  cine.classList.remove('visible');
  cine.style.display = 'none';
  poro.style.display = 'flex';
  poro.classList.add('visible');
  window.scrollTo(0, 0);
  import('./porotitos.js?v=202611202251')
    .then(m => m.Porotitos.abrir())
    .catch(() => {
      document.getElementById('poroContenido').innerHTML =
        '<div class="poro-card"><p class="poro-desc">No se pudo cargar la sección. Revisá tu conexión.</p></div>';
    });
}

function volverDePorotitos() {
  const cine = document.getElementById('cine');
  const poro = document.getElementById('poro');
  poro.classList.remove('visible');
  poro.style.display = 'none';
  cine.style.display = 'flex';
  cine.classList.add('visible');
  window.scrollTo(0, 0);
  Contador.iniciar();
}

export const Nav = { entrar, volver, irPorotitos, volverDePorotitos };
