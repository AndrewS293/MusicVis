# Music Visualizer

Full-stack music analytics dashboard — Spotify + Last.fm.

## Project Structure

```
music-visualizer/
  backend/    → Node.js + Express API
  frontend/   → React + Vite
```

---

## Getting Started

### Backend

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:3001`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`

---

## Environment Variables

### Backend (`backend/.env`)
```
PORT=3001
CLIENT_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:3001
```

> Copy from the `.env.example` files in each folder.

---

## Health Check

With both servers running, visit `http://localhost:5173` — the dashboard will
call `GET /health` on the backend and display the response.

You can also test directly:
```
GET http://localhost:3001/health
→ { "status": "ok", "timestamp": "..." }
```

---

## Sections

- [x] Section 1 — Project Foundation (scaffold)
- [ ] Section 2 — Spotify Auth (OAuth)
- [ ] Section 3 — Data Pipeline (Spotify + Last.fm)
- [ ] Section 4 — Frontend Dashboard + Visualizations

---

## Deployment (Render)

- **Backend**: Deploy as a Web Service, root dir = `backend`, start command = `npm start`
- **Frontend**: Deploy as a Static Site, root dir = `frontend`, build command = `npm run build`, publish dir = `dist`
- Set environment variables in each Render service's dashboard
