# Resonance — Spotify & Last.fm Visualizer

A beautiful personal listening dashboard built with Flask + vanilla JS.

## Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Get your API credentials

**Spotify:**
1. Go to https://developer.spotify.com/dashboard
2. Create an app
3. Add `http://localhost:5000/callback/spotify` as a Redirect URI
4. Copy your Client ID and Client Secret

**Last.fm:**
1. Go to https://www.last.fm/api/account/create
2. Register an application
3. Set callback URL to `http://localhost:5000/callback/lastfm`
4. Copy your API Key and Shared Secret

### 3. Set environment variables

**Mac/Linux:**
```bash
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"
export LASTFM_API_KEY="your_api_key"
export LASTFM_API_SECRET="your_api_secret"
```

**Windows:**
```cmd
set SPOTIFY_CLIENT_ID=your_client_id
set SPOTIFY_CLIENT_SECRET=your_client_secret
set LASTFM_API_KEY=your_api_key
set LASTFM_API_SECRET=your_api_secret
```

Or create a `.env` file and load it (install `python-dotenv` and add `load_dotenv()` to app.py).

### 4. Run
```bash
python app.py
```

Visit http://localhost:5000

## Features

- **Now Playing** — Live track with animated pulse ring, auto-refreshes every 30s
- **Personality Card** — Generated listening identity from your real data
- **Top Artists & Tracks** — Bar charts with 4-week / 6-month / all-time toggle
- **Sound Fingerprint** — Radar chart of your average audio features (Spotify only)
- **Obscurity Score** — How mainstream vs niche your taste is
- **Listening Clock** — Radial 24hr chart of when you listen most
- **Activity Timeline** — Line chart of your listening density over time

## Notes

- You can connect both Spotify and Last.fm and toggle between them
- Nothing is stored server-side — data lives only in your Flask session
- The Sound Fingerprint and detailed Obscurity breakdown require Spotify
- Last.fm gives better timeline/clock data (more historical scrobbles)
