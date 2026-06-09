// Animated waveform background for landing page
const canvas = document.getElementById("bg-canvas");
const ctx    = canvas.getContext("2d");

let W, H, lines;
const COLORS = ["#a78bfa", "#7c3aed", "#1db954", "#d51007"];

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  buildLines();
}

function buildLines() {
  lines = Array.from({ length: 5 }, (_, i) => ({
    amp:    60 + i * 18,
    freq:   0.004 + i * 0.0008,
    speed:  0.0008 + i * 0.0003,
    phase:  Math.random() * Math.PI * 2,
    y:      H * (0.3 + i * 0.1),
    color:  COLORS[i % COLORS.length],
    width:  1 + i * 0.3,
  }));
}

let t = 0;
function draw() {
  ctx.clearRect(0, 0, W, H);
  t += 1;

  for (const line of lines) {
    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth   = line.width;
    ctx.globalAlpha = 0.25;

    for (let x = 0; x <= W; x += 3) {
      const y = line.y
        + Math.sin(x * line.freq + t * line.speed + line.phase) * line.amp
        + Math.sin(x * line.freq * 0.5 + t * line.speed * 0.7) * (line.amp * 0.3);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
resize();
draw();
