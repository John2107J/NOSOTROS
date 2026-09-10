/**
 * Petals — animación decorativa de pétalos flotando en la portada.
 * No depende de ningún otro módulo.
 */
const COLORS = ['#fbb6ce', '#86efac', '#fed7aa', '#c4b5fd', '#a7f3d0', '#fbcfe8'];
let canvas, ctx, petals = [];

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function make() {
  return {
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height,
    r:     6 + Math.random() * 10,
    vx:    (Math.random() - 0.5) * 0.4,
    vy:    -0.3 - Math.random() * 0.5,
    rot:   Math.random() * Math.PI * 2,
    vRot:  (Math.random() - 0.5) * 0.03,
    alpha: 0.15 + Math.random() * 0.25,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

function draw(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle   = p.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  petals.forEach(p => {
    p.x   += p.vx;
    p.y   += p.vy;
    p.rot += p.vRot;
    if (p.y < -20) { p.y = canvas.height + 20; p.x = Math.random() * canvas.width; }
    draw(p);
  });
  requestAnimationFrame(loop);
}

function init(count = 28) {
  canvas = document.getElementById('petalCanvas');
  ctx    = canvas.getContext('2d');
  resize();
  petals = Array.from({ length: count }, make);
  window.addEventListener('resize', resize);
  loop();
}

export const Petals = { init };
