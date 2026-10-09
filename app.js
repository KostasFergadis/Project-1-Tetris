// ---------- Constants ----------
const WIDTH = 10;
const HEIGHT = 20;
const LINE_SCORE = 50;
const LINES_PER_LEVEL = 5;
const FALL_SPEEDS = [1000, 450, 200]; // ms per step for levels 1-3
const MIN_FALL_SPEED = 100;

// Each tetromino is a matrix of 1s; rotations are derived by rotating the matrix.
const TETROMINOS = [
  { color: "orange", shape: [[0, 1, 0], [0, 1, 0], [0, 1, 1]] }, // L
  { color: "red", shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] }, // Z
  { color: "purple", shape: [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]] }, // I
  { color: "green", shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] }, // T
  { color: "blue", shape: [[1, 1], [1, 1]] }, // O
  { color: "teal", shape: [[0, 1, 0], [0, 1, 0], [1, 1, 0]] }, // J
  { color: "hotpink", shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] }, // S
];

const SOUNDS = {
  lock: ["audioFiles/mixkit-quick-lock-sound-2854.wav", 0.1],
  rotate: ["audioFiles/mixkit-arcade-game-jump-coin-216.mp3", 0.1],
  line: ["audioFiles/mixkit-retro-arcade-casino-notification-211.wav", 0.2],
  level: ["audioFiles/mixkit-arcade-retro-changing-tab-206.wav", 0.2],
  gameOver: ["audioFiles/mixkit-arcade-retro-game-over-213.wav", 0.2],
  pause: ["audioFiles/mixkit-positive-interface-beep-221.wav", 0.1],
  resume: ["audioFiles/mixkit-arcade-score-interface-217.wav", 0.1],
  reset: ["audioFiles/mixkit-game-flute-bonus-2313.wav", 0.1],
};

// ---------- DOM ----------
const gridEl = document.querySelector(".grid");
const smallGridEl = document.querySelector(".small-grid");
const scoreEl = document.querySelector(".score");
const linesEl = document.querySelector(".lines");
const levelEl = document.querySelector(".level");
const overlayEl = document.querySelector(".overlay");
const overlayTextEl = document.querySelector(".overlay-text");
const playPauseBtn = document.querySelector(".play-pause");
const resetBtn = document.querySelector(".reset");

function createCells(container, count) {
  return Array.from({ length: count }, () =>
    container.appendChild(document.createElement("div"))
  );
}

const cells = createCells(gridEl, WIDTH * HEIGHT);
const previewCells = createCells(smallGridEl, 16);

const audio = Object.fromEntries(
  Object.entries(SOUNDS).map(([name, [src, volume]]) => {
    const a = new Audio(src);
    a.volume = volume;
    return [name, a];
  })
);

function play(name) {
  const a = audio[name];
  a.currentTime = 0;
  a.play().catch(() => {}); // autoplay restrictions are not fatal
}

// ---------- State ----------
let board; // flat array, one entry per cell: a colour string or null
let piece; // { type, rotation, x, y }
let nextType;
let score, lines, level;
let timerId = null;
let isGameOver;

const randomType = () => Math.floor(Math.random() * TETROMINOS.length);

function rotateMatrix(matrix) {
  return matrix[0].map((_, col) => matrix.map((row) => row[col]).reverse());
}

function getShape(type, rotation) {
  let shape = TETROMINOS[type].shape;
  for (let i = 0; i < rotation; i++) shape = rotateMatrix(shape);
  return shape;
}

// Board coordinates [x, y] of every filled square of a piece
function getSquares({ type, rotation, x, y }) {
  const squares = [];
  getShape(type, rotation).forEach((row, dy) =>
    row.forEach((filled, dx) => {
      if (filled) squares.push([x + dx, y + dy]);
    })
  );
  return squares;
}

function collides(p) {
  return getSquares(p).some(
    ([x, y]) =>
      x < 0 || x >= WIDTH || y >= HEIGHT || (y >= 0 && board[y * WIDTH + x])
  );
}

// ---------- Rendering ----------
function render() {
  cells.forEach((cell, i) => {
    cell.style.backgroundColor = board[i] || "";
  });
  if (piece) {
    const color = TETROMINOS[piece.type].color;
    getSquares(piece).forEach(([x, y]) => {
      if (y >= 0) cells[y * WIDTH + x].style.backgroundColor = color;
    });
  }
}

function renderPreview() {
  previewCells.forEach((cell) => (cell.style.backgroundColor = ""));
  const shape = getShape(nextType, 0);
  const offsetX = Math.floor((4 - shape[0].length) / 2);
  const offsetY = Math.floor((4 - shape.length) / 2);
  shape.forEach((row, dy) =>
    row.forEach((filled, dx) => {
      if (filled) {
        previewCells[(dy + offsetY) * 4 + dx + offsetX].style.backgroundColor =
          TETROMINOS[nextType].color;
      }
    })
  );
}

function renderStats() {
  scoreEl.innerText = score;
  linesEl.innerText = lines;
  levelEl.innerText = `Level ${level}`;
}

function showOverlay(text) {
  overlayTextEl.innerText = text;
  overlayEl.hidden = false;
}

// ---------- Game logic ----------
function fallSpeed() {
  return (
    FALL_SPEEDS[level - 1] ??
    Math.max(MIN_FALL_SPEED, FALL_SPEEDS.at(-1) - (level - FALL_SPEEDS.length) * 20)
  );
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(stepDown, fallSpeed());
}

function spawn() {
  const type = nextType;
  nextType = randomType();
  piece = { type, rotation: 0, x: Math.floor((WIDTH - 4) / 2) + 1, y: 0 };
  renderPreview();
  if (collides(piece)) endGame();
}

function move(dx) {
  const moved = { ...piece, x: piece.x + dx };
  if (!collides(moved)) piece = moved;
}

function rotate() {
  const rotated = { ...piece, rotation: (piece.rotation + 1) % 4 };
  // Try nudging sideways (and up) so rotating next to a wall or block still works
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
    const kicked = { ...rotated, x: rotated.x + dx, y: rotated.y + dy };
    if (!collides(kicked)) {
      piece = kicked;
      play("rotate");
      return;
    }
  }
}

function stepDown() {
  const moved = { ...piece, y: piece.y + 1 };
  if (!collides(moved)) {
    piece = moved;
  } else {
    lockPiece();
  }
  if (!isGameOver) render();
}

function lockPiece() {
  const color = TETROMINOS[piece.type].color;
  getSquares(piece).forEach(([x, y]) => {
    if (y >= 0) board[y * WIDTH + x] = color;
  });
  const cleared = clearLines();
  play(cleared ? "line" : "lock");
  spawn();
}

function clearLines() {
  const remaining = [];
  for (let y = 0; y < HEIGHT; y++) {
    const row = board.slice(y * WIDTH, (y + 1) * WIDTH);
    if (!row.every(Boolean)) remaining.push(row);
  }
  const cleared = HEIGHT - remaining.length;
  if (!cleared) return 0;

  const emptyRows = Array.from({ length: cleared }, () => Array(WIDTH).fill(null));
  board = [...emptyRows, ...remaining].flat();

  score += cleared * LINE_SCORE;
  lines += cleared;
  const newLevel = Math.floor(lines / LINES_PER_LEVEL) + 1;
  if (newLevel > level) {
    level = newLevel;
    play("level");
    startTimer();
  }
  renderStats();
  return cleared;
}

function endGame() {
  isGameOver = true;
  clearInterval(timerId);
  timerId = null;
  play("gameOver");
  showOverlay("GAME OVER");
  render();
}

function resetGame() {
  clearInterval(timerId);
  timerId = null;
  board = Array(WIDTH * HEIGHT).fill(null);
  score = 0;
  lines = 0;
  level = 1;
  isGameOver = false;
  overlayEl.hidden = true;
  nextType = randomType();
  spawn();
  renderStats();
  render();
  showOverlay("PRESS PLAY");
}

function togglePause() {
  if (isGameOver) resetGame();
  if (timerId) {
    play("pause");
    clearInterval(timerId);
    timerId = null;
    showOverlay("PAUSED");
  } else {
    play("resume");
    overlayEl.hidden = true;
    startTimer();
  }
}

// ---------- Input ----------
const isRunning = () => timerId !== null && !isGameOver;

const ACTIONS = {
  left: () => move(-1),
  right: () => move(1),
  rotate: () => rotate(),
  down: () => {
    score++;
    renderStats();
    stepDown();
  },
};

function doAction(name) {
  if (!isRunning()) return;
  ACTIONS[name]();
  if (!isGameOver) render();
}

const KEY_ACTIONS = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "rotate",
  ArrowDown: "down",
};

document.addEventListener("keydown", (event) => {
  if (event.code in KEY_ACTIONS || event.code === "Space") {
    event.preventDefault(); // stop the page from scrolling
  }
  const action = KEY_ACTIONS[event.code];
  if (!action || (action === "rotate" && event.repeat)) return;
  doAction(action);
});

// On-screen buttons: hold to repeat (except rotate)
let holdTimer = null;
const stopHold = () => {
  clearInterval(holdTimer);
  holdTimer = null;
};

document.querySelectorAll(".touch-controls button").forEach((button) => {
  const action = button.dataset.action;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    doAction(action);
    if (action !== "rotate") {
      stopHold();
      holdTimer = setInterval(() => doAction(action), 120);
    }
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((type) =>
    button.addEventListener(type, stopHold)
  );
});

playPauseBtn.addEventListener("click", () => {
  playPauseBtn.blur(); // keep Space/Enter from re-triggering the button
  togglePause();
});

resetBtn.addEventListener("click", () => {
  resetBtn.blur();
  play("reset");
  resetGame();
});

resetGame();
