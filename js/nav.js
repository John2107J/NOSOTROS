import { Store } from './store.js';
import { Frases } from './frases.js';
import { Contador } from './contador.js';

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

export const Nav = { entrar, volver };
