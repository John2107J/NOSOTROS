import { Store } from './store.js';
import { Frases } from './frases.js';
import { Contador } from './contador.js';

/**
 * Sync — exporta/importa los datos (fecha + frases) como texto JSON
 * para sincronizar manualmente entre dos dispositivos.
 */
function exportar() {
  const datos = { version: 1, fechaInicio: Store.getFecha(), frases: Frases.getLista() };
  document.getElementById('exportJson').value          = JSON.stringify(datos);
  document.getElementById('exportModal').style.display = 'flex';
}

function copiarJson() {
  const ta = document.getElementById('exportJson');
  ta.select();
  ta.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(ta.value)
    .then(() => _msg('✅ Copiado al portapapeles', false))
    .catch(() => { document.execCommand('copy'); _msg('✅ Copiado al portapapeles', false); });
  cerrarModal();
}

function cerrarModal() {
  document.getElementById('exportModal').style.display = 'none';
}

function importarDesdeTexto() {
  const texto = document.getElementById('importTextarea').value.trim();
  if (!texto) { _msg('❌ Pegá el código primero', true); return; }
  _procesar(texto);
  document.getElementById('importTextarea').value = '';
}

function _procesar(texto) {
  try {
    const datos = JSON.parse(texto);
    if (!datos.frases || !Array.isArray(datos.frases)) throw new Error('Formato inválido');
    if (datos.fechaInicio) {
      document.getElementById('fechaInicio').value = datos.fechaInicio;
      Store.guardarFecha();
    }
    Frases.reemplazar(datos.frases);
    Contador.actualizar();
    _msg('💕 Datos importados correctamente', false);
  } catch {
    _msg('❌ Código inválido. Copialo completo desde la exportación.', true);
  }
}

function _msg(texto, esError) {
  const el = document.getElementById('syncMsg');
  el.textContent = texto;
  el.className   = 'sync-msg' + (esError ? ' error' : '');
  setTimeout(() => { el.textContent = ''; el.className = 'sync-msg'; }, 5000);
}

export const Sync = { exportar, copiarJson, cerrarModal, importarDesdeTexto };
