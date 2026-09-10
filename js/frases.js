import { Store } from './store.js';

/**
 * Frases — rotación secuencial de frases + edición.
 *
 * Contrato de índice:
 * - Store guarda siempre el índice de la PRÓXIMA frase a mostrar.
 * - cargar() lee ese índice en la variable local `idx`.
 * - mostrarActual() muestra lista[idx] y escribe idx+1 en Store.
 * - idx local queda apuntando a la frase visible (para editar).
 */
let lista = [];
let idx   = 0;

function cargar() {
  lista = Store.cargarFrases();
  idx   = Store.cargarIdx();
  if (idx >= lista.length) { idx = 0; Store.guardarIdx(0); }
}

function mostrarActual() {
  _renderFrase(idx);
  Store.guardarIdx((idx + 1) % lista.length);
}

function _renderFrase(i) {
  document.getElementById('fraseDisplay').textContent = '\u201c' + lista[i] + '\u201d';
  document.getElementById('fraseEditArea').value      = lista[i];
}

function toggleEdit() {
  const display = document.getElementById('fraseDisplay');
  const area    = document.getElementById('fraseEditArea');
  if (area.style.display === 'block') {
    guardar();
  } else {
    area.style.display    = 'block';
    display.style.display = 'none';
    area.focus();
  }
}

function guardar() {
  const area    = document.getElementById('fraseEditArea');
  const display = document.getElementById('fraseDisplay');
  const nuevo   = area.value.trim();
  if (nuevo) {
    lista[idx] = nuevo;
    Store.guardarFrases(lista);
  }
  display.textContent   = '\u201c' + lista[idx] + '\u201d';
  area.style.display    = 'none';
  display.style.display = 'block';
  renderLista();
}

function renderLista() {
  const cont = document.getElementById('frasesLista');
  cont.innerHTML = '';
  lista.forEach((fr, i) => {
    const row = document.createElement('div');
    row.className = 'frase-item';

    const inp = document.createElement('input');
    inp.type  = 'text';
    inp.value = fr;
    inp.addEventListener('change', () => { lista[i] = inp.value; Store.guardarFrases(lista); });
    row.appendChild(inp);

    if (lista.length > 1) {
      const del = document.createElement('button');
      del.className   = 'del-frase-btn';
      del.textContent = '×';
      del.addEventListener('click', () => {
        lista.splice(i, 1);
        if (i < idx) idx = Math.max(0, idx - 1);
        idx = idx % lista.length;
        Store.guardarFrases(lista);
        Store.guardarIdx(idx);
        renderLista();
      });
      row.appendChild(del);
    }

    cont.appendChild(row);
  });
}

function agregar() {
  lista.push('Escribí tu frase aquí...');
  Store.guardarFrases(lista);
  renderLista();
}

function reemplazar(nuevaLista) {
  lista = nuevaLista;
  idx   = 0;
  Store.guardarFrases(lista);
  Store.guardarIdx(0);
  _renderFrase(0);
  renderLista();
}

function getLista() { return lista; }

export const Frases = {
  cargar, mostrarActual, toggleEdit, guardar,
  renderLista, agregar, reemplazar, getLista,
};
