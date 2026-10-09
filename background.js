// Decorative background: faint tetrominoes drifting down behind the game
const canvas = document.querySelector(".bg");
const ctx = canvas.getContext("2d");
const SHAPES = [
  [[0, 1, 0], [0, 1, 0], [0, 1, 1]], // L
  [[0, 1, 0], [0, 1, 0], [1, 1, 0]], // J
  [[1, 1, 0], [0, 1, 1]], // Z
  [[0, 1, 1], [1, 1, 0]], // S
  [[1], [1], [1], [1]], // I
  [[0, 1, 0], [1, 1, 1]], // T
  [[1, 1], [1, 1]], // O
];
const COLORS = ["#ff9f1c", "#ff4d6d", "#b300ff", "#3ddc84", "#3a7bff", "#14b8b8", "#ff6ec7", "#50eaea"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let pieces = [];
let last = 0;

const rand = (min, max) => min + Math.random() * (max - min);

function makePiece(anywhere) {
  const size = rand(14, 34);
  return {
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size,
    x: rand(0, canvas.width),
    y: anywhere ? rand(0, canvas.height) : -size * 5,
    speed: rand(14, 40), // px per second
    angle: rand(0, Math.PI * 2),
    spin: rand(-0.4, 0.4), // radians per second
    alpha: rand(0.12, 0.3),
  };
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const count = Math.round((canvas.width * canvas.height) / 40000) + 6;
  pieces = Array.from({ length: count }, () => makePiece(true));
  draw();
}

function drawPiece(p) {
  const w = p.shape[0].length * p.size;
  const h = p.shape.length * p.size;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.shadowColor = p.color;
  ctx.shadowBlur = p.size;
  p.shape.forEach((row, r) =>
    row.forEach((filled, c) => {
      if (filled) {
        ctx.fillRect(c * p.size - w / 2, r * p.size - h / 2, p.size - 2, p.size - 2);
      }
    })
  );
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  pieces.forEach(drawPiece);
}

function tick(time) {
  const dt = Math.min((time - last) / 1000, 0.1);
  last = time;
  pieces.forEach((p, i) => {
    p.y += p.speed * dt;
    p.angle += p.spin * dt;
    if (p.y - p.size * 5 > canvas.height) pieces[i] = makePiece(false);
  });
  draw();
  requestAnimationFrame(tick);
}

window.addEventListener("resize", resize);
resize();
if (!reduceMotion.matches) requestAnimationFrame(tick);
