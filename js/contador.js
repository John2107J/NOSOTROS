/**
 * Contador — calcula y muestra el tiempo transcurrido desde la fecha de inicio.
 * Depende solo del DOM (lee el input #fechaInicio directamente).
 */
let timer = null;

function calcular(fechaStr) {
  const inicio = new Date(fechaStr + 'T00:00:00');
  const ahora  = new Date();
  const diffMs = ahora - inicio;
  if (diffMs < 0) return null;

  const totalSeg   = Math.floor(diffMs / 1000);
  const totalMin   = Math.floor(totalSeg   / 60);
  const totalHoras = Math.floor(totalMin   / 60);
  const totalDias  = Math.floor(totalHoras / 24);

  return {
    dias:   totalDias,
    meses:  Math.floor(totalDias / 30.4375),
    horas:  totalHoras,
    min:    totalMin % 60,
    seg:    totalSeg % 60,
    diaMes: inicio.getDate(),
  };
}

function render(d) {
  document.getElementById('numDias').textContent  = d.dias;
  document.getElementById('numMeses').textContent = d.meses;
  document.getElementById('numHoras').textContent = d.horas;
  document.getElementById('minSegLine').textContent =
    String(d.min).padStart(2, '0') + ' min  ' +
    String(d.seg).padStart(2, '0') + ' seg — actualizando ⏱';

  const badge = document.getElementById('mesBadge');
  if (new Date().getDate() === d.diaMes && d.meses > 0) {
    document.getElementById('mesNum').textContent = d.meses;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

function actualizar() {
  const val = document.getElementById('fechaInicio').value;
  if (!val) return;
  const data = calcular(val);
  if (data) render(data);
}

function iniciar() {
  actualizar();
  timer = setInterval(actualizar, 1000);
}

function detener() {
  if (timer) { clearInterval(timer); timer = null; }
}

// Cuando Store guarda una nueva fecha, nos actualizamos (desacoplado por evento).
document.addEventListener('fecha:cambiada', actualizar);

export const Contador = { iniciar, detener, actualizar, calcular };
