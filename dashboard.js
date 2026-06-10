// ── Shared config ────────────────────────────────────────────────────────────
Chart.defaults.color       = "#7a7a96";
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size   = 12;

const C = {
  purple:  "#a78bfa",
  green:   "#1db954",
  red:     "#d51007",
  teal:    "#2dd4bf",
  amber:   "#fbbf24",
  pink:    "#f472b6",
  blue:    "#60a5fa",
  indigo:  "#818cf8",
  palette: ["#a78bfa","#2dd4bf","#f472b6","#fbbf24","#60a5fa","#34d399","#f87171","#818cf8","#fb923c","#38bdf8"],
};

let activeRange    = "short_term";
let artistsChart   = null;
let tracksChart    = null;
let obscurityChart = null;
let timelineChart  = null;
let genresChart    = null;

// ── Helpers ──────────────────────────────────────────────────────────────────
async function apiFetch(endpoint) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(`${endpoint}${sep}platform=${PLATFORM}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function destroyChart(c) { if (c) c.destroy(); return null; }

function hexA(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function hGrad(ctx, chartArea, color) {
  const g = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
  g.addColorStop(0, hexA(color, 0.85));
  g.addColorStop(1, hexA(color, 0.25));
  return g;
}

function hideSection(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

// ── Section visibility ────────────────────────────────────────────────────────
function applyVisibility() {
  if (PLATFORM !== "spotify") {
    hideSection("obscurity-card");
  }
}

// ── Now Playing ───────────────────────────────────────────────────────────────
async function loadNowPlaying() {
  try {
    const d = await apiFetch("/api/now-playing");
    const statusEl = document.getElementById("np-status");
    const trackEl  = document.getElementById("np-track");
    const artistEl = document.getElementById("np-artist");
    const artEl    = document.getElementById("np-art");
    const barEl    = document.getElementById("np-bar");
    const pulseEl  = document.getElementById("np-pulse");

    if (!d.name) {
      statusEl.textContent = "Nothing playing";
      trackEl.textContent  = "—";
      artistEl.textContent = "—";
      return;
    }

    statusEl.textContent = d.playing ? "▶  Now playing" : "◼  Last played";
    trackEl.textContent  = d.name;
    artistEl.textContent = d.artist;

    if (d.image) { artEl.src = d.image; artEl.style.display = "block"; }

    if (d.playing) {
      pulseEl.classList.add("active");
      const pct = d.duration > 0 ? (d.progress / d.duration) * 100 : 0;
      barEl.style.width = pct + "%";
      document.getElementById("np-bar-wrap").style.display = "block";
    } else {
      document.getElementById("np-bar-wrap").style.display = "none";
    }
  } catch (e) { console.warn("Now playing unavailable", e); }
}

// ── Personality ───────────────────────────────────────────────────────────────
async function loadPersonality() {
  try {
    const d = await apiFetch("/api/personality");
    document.getElementById("p-title").textContent     = d.title;
    document.getElementById("p-subtitle").textContent  = d.subtitle;
    document.getElementById("p-desc").textContent      = d.description;
    document.getElementById("p-peak").textContent      = d.peak_hour;
    document.getElementById("p-genre").textContent     = d.top_genre;
    document.getElementById("p-obscurity").textContent = d.obscurity + "%";
  } catch (e) { console.warn("Personality unavailable", e); }
}

// ── Top Artists ───────────────────────────────────────────────────────────────
async function loadTopArtists() {
  try {
    const data   = await apiFetch(`/api/top-artists?range=${activeRange}`);
    const names  = data.map(a => a.name);
    const values = data.map(a => a.plays);
    const max    = Math.max(...values, 1);

    // Render image list
    const list = document.getElementById("artists-list");
    list.innerHTML = data.map((a, i) => `
      <div class="artist-row">
        ${a.image ? `<img class="artist-img" src="${a.image}" alt="${a.name}" loading="lazy" />` : `<div class="artist-img"></div>`}
        <div class="artist-meta">
          <span class="artist-name">${i + 1}. ${a.name}</span>
          <div class="artist-bar-track"><div class="artist-bar-fill" style="width:${(a.plays/max*100).toFixed(1)}%"></div></div>
        </div>
        <span class="artist-plays">${PLATFORM === "lastfm" ? a.plays.toLocaleString() + " plays" : "pop " + a.plays}</span>
      </div>
    `).join("");

    const canvas = document.getElementById("artists-chart");
    artistsChart = destroyChart(artistsChart);
    artistsChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: names,
        datasets: [{
          label: PLATFORM === "lastfm" ? "Plays" : "Popularity",
          data: values,
          backgroundColor: (ctx) => {
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea) return hexA(C.purple, 0.6);
            return hGrad(c, chartArea, C.purple);
          },
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#7a7a96" }, border: { display: false } },
          y: { grid: { display: false }, ticks: { color: "#e8e8f0" }, border: { display: false } },
        },
        animation: { duration: 700, easing: "easeOutQuart" },
      }
    });
  } catch (e) { console.warn("Top artists unavailable", e); }
}

// ── Top Tracks ────────────────────────────────────────────────────────────────
async function loadTopTracks() {
  try {
    const data   = await apiFetch(`/api/top-tracks?range=${activeRange}`);
    const names  = data.map(t => `${t.name} — ${t.artist}`);
    const values = data.map(t => t.plays);

    const canvas = document.getElementById("tracks-chart");
    tracksChart  = destroyChart(tracksChart);
    tracksChart  = new Chart(canvas, {
      type: "bar",
      data: {
        labels: names,
        datasets: [{
          label: PLATFORM === "lastfm" ? "Plays" : "Popularity",
          data: values,
          backgroundColor: (ctx) => {
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea) return hexA(C.teal, 0.6);
            return hGrad(c, chartArea, C.teal);
          },
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#7a7a96" }, border: { display: false } },
          y: { grid: { display: false }, ticks: { color: "#e8e8f0", font: { size: 11 } }, border: { display: false } },
        },
        animation: { duration: 700, easing: "easeOutQuart" },
      }
    });
  } catch (e) { console.warn("Top tracks unavailable", e); }
}

// ── Top Genres ────────────────────────────────────────────────────────────────
async function loadTopGenres() {
  try {
    const data = await apiFetch(`/api/top-genres?range=${activeRange}`);
    if (!data.length) { hideSection("genres-card"); return; }

    // Bubble tags
    const bubblesEl = document.getElementById("genres-bubbles");
    bubblesEl.innerHTML = data.map((g, i) => `
      <span class="genre-bubble" style="--c:${C.palette[i % C.palette.length]};font-size:${Math.max(0.72, 0.72 + g.pct / 100)}rem">${g.genre}</span>
    `).join("");

    // Horizontal bar chart
    const canvas = document.getElementById("genres-chart");
    genresChart  = destroyChart(genresChart);
    genresChart  = new Chart(canvas, {
      type: "bar",
      data: {
        labels: data.map(g => g.genre),
        datasets: [{
          data: data.map(g => g.pct),
          backgroundColor: data.map((_, i) => hexA(C.palette[i % C.palette.length], 0.75)),
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#7a7a96", callback: v => v + "%" }, border: { display: false } },
          y: { grid: { display: false }, ticks: { color: "#e8e8f0" }, border: { display: false } },
        },
        animation: { duration: 700, easing: "easeOutQuart" },
      }
    });
  } catch (e) { console.warn("Genres unavailable", e); }
}

// ── Obscurity ─────────────────────────────────────────────────────────────────
async function loadObscurity() {
  if (PLATFORM !== "spotify") return;
  try {
    const d = await apiFetch("/api/obscurity");
    document.getElementById("obs-score").textContent = d.score;
    document.getElementById("obs-label").textContent = d.label;

    const canvas = document.getElementById("obscurity-chart");
    obscurityChart = destroyChart(obscurityChart);

    if (d.buckets) {
      const bucketColors = [hexA(C.green,0.8), hexA(C.teal,0.75), hexA(C.purple,0.75), hexA(C.indigo,0.8), hexA(C.red,0.8)];
      obscurityChart = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: Object.keys(d.buckets),
          datasets: [{
            data: Object.values(d.buckets),
            backgroundColor: bucketColors,
            borderColor: "#111118",
            borderWidth: 2,
            hoverOffset: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 10, padding: 10, font: { size: 10 } } }
          },
          cutout: "68%",
          animation: { animateRotate: true, duration: 900, easing: "easeOutCubic" },
        }
      });
    }
  } catch (e) { console.warn("Obscurity unavailable", e); }
}

// ── Listening Clock ───────────────────────────────────────────────────────────
async function loadListeningClock() {
  try {
    const hours  = await apiFetch("/api/listening-clock");
    const canvas = document.getElementById("clock-canvas");
    const ctx    = canvas.getContext("2d");
    const DPR    = window.devicePixelRatio || 1;
    const SIZE   = 320;
    canvas.width  = SIZE * DPR;
    canvas.height = SIZE * DPR;
    canvas.style.width  = SIZE + "px";
    canvas.style.height = SIZE + "px";
    ctx.scale(DPR, DPR);

    const cx = SIZE / 2, cy = SIZE / 2;
    const maxVal = Math.max(...hours, 1);

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Subtle rings
    [45, 70, 95, 118].forEach(r => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth   = 1;
      ctx.stroke();
    });

    // Gradient per bar based on activity intensity
    for (let i = 0; i < 24; i++) {
      const angle   = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const norm    = hours[i] / maxVal;
      const barLen  = norm * 68;
      const innerR  = 47;
      const outerR  = innerR + barLen;
      const halfW   = (Math.PI * 2 / 24) * 0.4;

      // Pick color: night=indigo, morning=amber, afternoon=teal, evening=purple
      let color = C.purple;
      if (i >= 6  && i < 12) color = C.amber;
      else if (i >= 12 && i < 18) color = C.teal;
      else if (i >= 18 && i < 22) color = C.pink;

      ctx.beginPath();
      ctx.arc(cx, cy, innerR, angle - halfW, angle + halfW);
      ctx.arc(cx, cy, outerR, angle + halfW, angle - halfW, true);
      ctx.closePath();

      const alpha = 0.25 + norm * 0.75;
      const [r,g,b] = [
        parseInt(color.slice(1,3),16),
        parseInt(color.slice(3,5),16),
        parseInt(color.slice(5,7),16),
      ];
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
    }

    // Hour labels every 3h
    ctx.font         = "9px Inter, sans-serif";
    ctx.fillStyle    = "#7a7a96";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 24; i += 3) {
      const angle  = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const labelR = 135;
      const lx = cx + Math.cos(angle) * labelR;
      const ly = cy + Math.sin(angle) * labelR;
      const label = i === 0 ? "12am" : i === 12 ? "12pm" : i < 12 ? `${i}am` : `${i-12}pm`;
      ctx.fillText(label, lx, ly);
    }

    // Center
    const peakHour = hours.indexOf(Math.max(...hours));
    const peakFmt  = peakHour === 0 ? "12am" : peakHour === 12 ? "12pm"
                     : peakHour < 12 ? `${peakHour}am` : `${peakHour-12}pm`;
    ctx.fillStyle    = "#e8e8f0";
    ctx.font         = "bold 16px 'Instrument Serif', serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(peakFmt, cx, cy - 8);
    ctx.fillStyle = "#7a7a96";
    ctx.font      = "9px Inter, sans-serif";
    ctx.fillText("peak hour", cx, cy + 10);

    // Update sub with sample count
    const total = hours.reduce((s, v) => s + v, 0);
    document.getElementById("clock-sub").textContent = `Based on ${total.toLocaleString()} recent tracks`;
  } catch (e) { console.warn("Clock unavailable", e); }
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
async function loadHeatmap() {
  try {
    const grid = await apiFetch("/api/listening-heatmap"); // 7×24
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const allVals = grid.flat();
    const maxVal  = Math.max(...allVals, 1);

    const container = document.getElementById("heatmap-grid");
    // Build: hour labels row + day rows
    let html = `<div class="hm-table">`;

    // Top hour labels (every 3)
    html += `<div class="hm-row hm-header"><div class="hm-day-label"></div>`;
    for (let h = 0; h < 24; h++) {
      const lbl = h % 3 === 0 ? (h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h-12}p`) : "";
      html += `<div class="hm-hour-label">${lbl}</div>`;
    }
    html += `</div>`;

    // Day rows
    for (let d = 0; d < 7; d++) {
      html += `<div class="hm-row"><div class="hm-day-label">${days[d]}</div>`;
      for (let h = 0; h < 24; h++) {
        const val   = grid[d][h];
        const norm  = val / maxVal;
        const alpha = norm < 0.01 ? 0.04 : 0.08 + norm * 0.88;
        html += `<div class="hm-cell" style="background:rgba(167,139,250,${alpha.toFixed(3)})" title="${days[d]} ${h}:00 — ${val} tracks"></div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  } catch (e) { console.warn("Heatmap unavailable", e); }
}

// ── Activity Timeline ──────────────────────────────────────────────────────────
async function loadTimeline() {
  try {
    const d = await apiFetch("/api/scrobble-timeline");

    // Update sub
    const total = d.values.reduce((s, v) => s + v, 0);
    document.getElementById("timeline-sub").textContent =
      `${total.toLocaleString()} tracks across ${d.labels.length} days`;

    const canvas = document.getElementById("timeline-chart");
    timelineChart = destroyChart(timelineChart);
    timelineChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: d.labels,
        datasets: [{
          label: "Tracks",
          data: d.values,
          borderColor: C.purple,
          backgroundColor: (ctx) => {
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea) return hexA(C.purple, 0.1);
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, hexA(C.purple, 0.35));
            g.addColorStop(1, hexA(C.purple, 0.01));
            return g;
          },
          borderWidth: 2,
          fill: true,
          tension: 0.45,
          pointRadius: d.labels.length > 20 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: C.purple,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1a1a28",
            borderColor: "rgba(167,139,250,0.3)",
            borderWidth: 1,
            titleColor: "#e8e8f0",
            bodyColor: "#a78bfa",
            padding: 10,
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#7a7a96", maxTicksLimit: 8, font: { size: 10 } }, border: { display: false } },
          y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#7a7a96" }, border: { display: false } },
        },
        animation: { duration: 900, easing: "easeOutCubic" },
      }
    });
  } catch (e) { console.warn("Timeline unavailable", e); }
}

// ── Range buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll(".range-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".range-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeRange = btn.dataset.range;
    loadTopArtists();
    loadTopTracks();
    loadTopGenres();
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async function init() {
  applyVisibility();
  await loadNowPlaying();
  loadPersonality();
  loadTopArtists();
  loadTopTracks();
  loadTopGenres();
  loadObscurity();
  loadListeningClock();
  loadHeatmap();
  loadTimeline();
  setInterval(loadNowPlaying, 30_000);
})();