import { Petals }   from './petals.js';
import { Store }    from './store.js';
import { Contador } from './contador.js';
import { Frases }   from './frases.js';
import { Sync }     from './sync.js';
import { UI }        from './ui.js';
import { Nav }       from './nav.js';

/**
 * main.js — punto de entrada de la app.
 *
 * El HTML sigue usando atributos onclick="Nav.entrar()", etc. por simplicidad,
 * así que exponemos los módulos en window. Si en el futuro se quiere eliminar
 * el HTML inline, alcanza con reemplazar estas líneas por addEventListener()
 * sobre cada elemento, sin tocar el resto de los módulos.
 */
window.Store    = Store;
window.Contador = Contador;
window.Frases   = Frases;
window.Sync     = Sync;
window.UI       = UI;
window.Nav      = Nav;

Petals.init();

// Nombre de la sección de puntos (lo elige la pareja; se guarda una copia local
// para mostrarlo en el botón de entrada sin tener que conectarse).
try {
  const n = localStorage.getItem('seccionNombre_v1');
  if (n) document.getElementById('poroEntryNombre').textContent = n;
} catch { /* sin storage */ }
