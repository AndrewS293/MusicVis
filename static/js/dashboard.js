// ── Shared config ───────────────────────────────────────────────────────────
const CHART_DEFAULTS = {
  font:   { family: "'Inter', sans-serif", size: 12 },
  color:  "#7a7a96",
};
Chart.defaults.color        = CHART_DEFAULTS.color;
Chart.defaults.font.family  = CHART_DEFAULTS.font.family;
Chart.defaults.font.size    = CHART_DEFAULTS.font.size;

const ACCENT_PURPLE = "#a78bfa";
const ACCENT_GREEN  = "#1db954";
const ACCENT_RED    = "#d51007";

let activeRange    = "medium_term";
let artistsChart   = null;
let tracksChart    = null;
let radarChart     = null;
let obscurityChart = null;
let timelineChart  = null;

// ── Helpers ──────────────────────────────────────────────────────────────────
async function apiFetch(endpoint) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(`${endpoint}${sep}platform=${PLATFORM}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function destroyChart(instance) {
  if (instance) instance.destroy();
  return null;
}

function gradientBar(ctx, chartArea, color) {
  const grad = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
  grad.addColorStop(0, color + "cc");
  grad.addColorStop(1, color + "44");
  return grad;
}

// ── Now Playing ──────────────────────────────────────────────────────────────
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

    if (d.image) {
      artEl.src   = d.image;
      artEl.style.display = "block";
    }

    if (d.playing) {
      pulseEl.classList.add("active");
      const pct = d.duration > 0 ? (d.progress / d.duration) * 100 : 0;
      barEl.style.width = pct + "%";
      document.getElementById("np-bar-wrap").style.display = "block";
    } else {
      document.getElementById("np-bar-wrap").style.display = "none";
    }
  } catch (e) {
    console.warn("Now playing unavailable", e);
  }
}

// ── Personality ──────────────────────────────────────────────────────────────
async function loadPersonality() {
  try {
    const d = await apiFetch("/api/personality");
    document.getElementById("p-title").textContent     = d.title;
    document.getElementById("p-subtitle").textContent  = d.subtitle;
    document.getElementById("p-desc").textContent      = d.description;
    document.getElementById("p-peak").textContent      = d.peak_hour;
    document.getElementById("p-genre").textContent     = d.top_genre;
    document.getElementById("p-obscurity").textContent = d.obscurity + "%";
  } catch (e) {
    console.warn("Personality unavailable", e);
  }
}

// ── Top Artists ───────────────────────────────────────────────────────────────
async function loadTopArtists() {
  try {
    const data = await apiFetch(`/api/top-artists?range=${activeRange}`);
    const names  = data.map(a => a.name);
    const values = data.map(a => a.plays);

    // Render artist list with images
    const list = document.getElementById("artists-list");
    list.innerHTML = data.map((a, i) => `
      <div class="artist-row">
        ${a.image ? `<img class="artist-img" src="${a.image}" alt="${a.name}" loading="lazy" />` : `<div class="artist-img"></div>`}
        <span class="artist-name">${i + 1}. ${a.name}</span>
        <span class="artist-plays">${PLATFORM === "lastfm" ? a.plays.toLocaleString() + " plays" : "popularity " + a.plays}</span>
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
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return ACCENT_PURPLE + "88";
            return gradientBar(c, chartArea, ACCENT_PURPLE);
          },
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
          x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#7a7a96" } },
          y: { grid: { display: false }, ticks: { color: "#e8e8f0" } },
        },
      }
    });
  } catch (e) {
    console.warn("Top artists unavailable", e);
  }
}

// ── Top Tracks ────────────────────────────────────────────────────────────────
async function loadTopTracks() {
  try {
    const data = await apiFetch(`/api/top-tracks?range=${activeRange}`);
    const names  = data.map(t => `${t.name} — ${t.artist}`);
    const values = data.map(t => t.plays);

    const canvas = document.getElementById("tracks-chart");
    tracksChart  = destroyChart(tracksChart);

    tracksChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: names,
        datasets: [{
          label: PLATFORM === "lastfm" ? "Plays" : "Popularity",
          data: values,
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return ACCENT_GREEN + "88";
            return gradientBar(c, chartArea, ACCENT_GREEN);
          },
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
          x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#7a7a96" } },
          y: { grid: { display: false }, ticks: { color: "#e8e8f0", font: { size: 11 } } },
        },
      }
    });
  } catch (e) {
    console.warn("Top tracks unavailable", e);
  }
}

// ── Taste Radar ───────────────────────────────────────────────────────────────
async function loadTasteRadar() {
  const card = document.getElementById("radar-card");
  if (PLATFORM !== "spotify") {
    card.style.opacity = "0.45";
    card.querySelector(".card-sub").textContent = "Connect Spotify to see your sound fingerprint";
    return;
  }
  try {
    const d = await apiFetch("/api/taste-radar");
    const keys   = ["danceability", "energy", "valence", "acousticness", "instrumentalness", "speechiness"];
    const labels = ["Danceability", "Energy", "Positivity", "Acousticness", "Instrumentalness", "Speechiness"];
    const values = keys.map(k => d[k] || 0);

    const canvas = document.getElementById("radar-chart");
    radarChart   = destroyChart(radarChart);

    radarChart = new Chart(canvas, {
      type: "radar",
      data: {
        labels,
        datasets: [{
          label: "Your sound",
          data: values,
          backgroundColor: ACCENT_PURPLE + "22",
          borderColor:     ACCENT_PURPLE,
          pointBackgroundColor: ACCENT_PURPLE,
          pointRadius: 4,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0, max: 100,
            ticks:     { display: false, stepSize: 25 },
            grid:      { color: "rgba(255,255,255,0.06)" },
            pointLabels: { color: "#7a7a96", font: { size: 11 } },
            angleLines: { color: "rgba(255,255,255,0.06)" },
          }
        },
        plugins: { legend: { display: false } },
      }
    });
  } catch (e) {
    console.warn("Radar unavailable", e);
  }
}

// ── Obscurity ─────────────────────────────────────────────────────────────────
async function loadObscurity() {
  try {
    const d = await apiFetch("/api/obscurity");
    document.getElementById("obs-score").textContent = d.score;
    document.getElementById("obs-label").textContent = d.label;

    const canvas = document.getElementById("obscurity-chart");
    obscurityChart = destroyChart(obscurityChart);

    if (d.buckets) {
      obscurityChart = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: Object.keys(d.buckets),
          datasets: [{
            data: Object.values(d.buckets),
            backgroundColor: [
              "#1db954cc", "#4ade80aa", "#a78bfaaa", "#7c3aedaa", "#d51007aa"
            ],
            borderColor: "#111118",
            borderWidth: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 10, padding: 10, font: { size: 10 } } }
          },
          cutout: "65%",
        }
      });
    }
  } catch (e) {
    console.warn("Obscurity unavailable", e);
  }
}

// ── Listening Clock ───────────────────────────────────────────────────────────
async function loadListeningClock() {
  try {
    const hours  = await apiFetch("/api/listening-clock");
    const canvas = document.getElementById("clock-canvas");
    const ctx    = canvas.getContext("2d");
    const DPR    = window.devicePixelRatio || 1;
    const SIZE   = 360;
    canvas.width  = SIZE * DPR;
    canvas.height = SIZE * DPR;
    canvas.style.width  = SIZE + "px";
    canvas.style.height = SIZE + "px";
    ctx.scale(DPR, DPR);

    const cx = SIZE / 2, cy = SIZE / 2;
    const maxVal = Math.max(...hours, 1);

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background rings
    for (let r of [60, 90, 120]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    // Hour bars
    for (let i = 0; i < 24; i++) {
      const angle    = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const barLen   = (hours[i] / maxVal) * 55;
      const innerR   = 62;
      const outerR   = innerR + barLen;
      const halfW    = (Math.PI * 2 / 24) * 0.38;

      const startA = angle - halfW;
      const endA   = angle + halfW;

      ctx.beginPath();
      ctx.arc(cx, cy, innerR, startA, endA);
      ctx.arc(cx, cy, outerR, endA, startA, true);
      ctx.closePath();

      const alpha   = 0.3 + (hours[i] / maxVal) * 0.7;
      ctx.fillStyle = ACCENT_PURPLE + Math.round(alpha * 255).toString(16).padStart(2, "0");
      ctx.fill();
    }

    // Hour labels
    ctx.font         = "10px Inter, sans-serif";
    ctx.fillStyle    = "#7a7a96";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < 24; i += 3) {
      const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const labelR = 145;
      const x = cx + Math.cos(angle) * labelR;
      const y = cy + Math.sin(angle) * labelR;
      const label = i === 0 ? "12am" : i === 12 ? "12pm" : i < 12 ? `${i}am` : `${i - 12}pm`;
      ctx.fillText(label, x, y);
    }

    // Center text
    const peakHour = hours.indexOf(Math.max(...hours));
    const peakFmt  = peakHour === 0 ? "12am" : peakHour === 12 ? "12pm"
                     : peakHour < 12 ? `${peakHour}am` : `${peakHour - 12}pm`;

    ctx.fillStyle    = "#e8e8f0";
    ctx.font         = "bold 18px 'Instrument Serif', serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(peakFmt, cx, cy - 8);

    ctx.fillStyle = "#7a7a96";
    ctx.font      = "10px Inter, sans-serif";
    ctx.fillText("peak hour", cx, cy + 12);

  } catch (e) {
    console.warn("Clock unavailable", e);
  }
}

// ── Timeline ──────────────────────────────────────────────────────────────────
async function loadTimeline() {
  try {
    const d = await apiFetch("/api/scrobble-timeline");

    const canvas = document.getElementById("timeline-chart");
    timelineChart = destroyChart(timelineChart);

    timelineChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: d.labels,
        datasets: [{
          label: "Tracks",
          data: d.values,
          borderColor: ACCENT_PURPLE,
          backgroundColor: ACCENT_PURPLE + "18",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: d.labels.length > 30 ? 0 : 3,
          pointHoverRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#7a7a96", maxTicksLimit: 8, font: { size: 10 } } },
          y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#7a7a96" } },
        },
      }
    });
  } catch (e) {
    console.warn("Timeline unavailable", e);
  }
}

// ── Range buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll(".range-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".range-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeRange = btn.dataset.range;
    loadTopArtists();
    loadTopTracks();
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async function init() {
  await loadNowPlaying();
  loadPersonality();
  loadTopArtists();
  loadTopTracks();
  loadTasteRadar();
  loadObscurity();
  loadListeningClock();
  loadTimeline();

  // Poll now-playing every 30s
  setInterval(loadNowPlaying, 30_000);
})();
