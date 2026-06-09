import os
import json
import time
import hashlib
import requests
from flask import Flask, redirect, request, session, jsonify, render_template, url_for
from urllib.parse import urlencode
from collections import Counter
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24))

# ── Config ──────────────────────────────────────────────────────────────────
SPOTIFY_CLIENT_ID     = os.environ.get("SPOTIFY_CLIENT_ID", "YOUR_SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET", "YOUR_SPOTIFY_CLIENT_SECRET")
SPOTIFY_REDIRECT_URI  = "http://musicvis.onrender.com/callback/spotify"
SPOTIFY_SCOPES        = "user-top-read user-read-recently-played user-read-currently-playing user-read-playback-state"

LASTFM_API_KEY    = os.environ.get("LASTFM_API_KEY", "YOUR_LASTFM_API_KEY")
LASTFM_API_SECRET = os.environ.get("LASTFM_API_SECRET", "YOUR_LASTFM_API_SECRET")
LASTFM_REDIRECT_URI = "http://musicvis.onrender.com/callback/lastfm"

# ── Landing ──────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    spotify_connected = "spotify_token" in session
    lastfm_connected  = "lastfm_token" in session
    return render_template("index.html",
                           spotify_connected=spotify_connected,
                           lastfm_connected=lastfm_connected)

@app.route("/debug-redirect")
def debug_redirect():
    from urllib.parse import urlencode
    params = {
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "scope": SPOTIFY_SCOPES,
    }
    return f"<pre>Redirect URI being sent:\n{SPOTIFY_REDIRECT_URI}\n\nFull URL:\nhttps://accounts.spotify.com/authorize?{urlencode(params)}</pre>"

@app.route("/dashboard")
def dashboard():
    spotify_connected = "spotify_token" in session
    lastfm_connected  = "lastfm_token" in session
    if not spotify_connected and not lastfm_connected:
        return redirect(url_for("index"))
    active = session.get("active_platform", "spotify" if spotify_connected else "lastfm")
    return render_template("dashboard.html",
                           spotify_connected=spotify_connected,
                           lastfm_connected=lastfm_connected,
                           active=active,
                           lastfm_user=session.get("lastfm_user", ""))

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))

@app.route("/switch/<platform>")
def switch(platform):
    if platform in ("spotify", "lastfm"):
        session["active_platform"] = platform
    return redirect(url_for("dashboard"))

# ── Spotify OAuth ────────────────────────────────────────────────────────────
@app.route("/login/spotify")
def login_spotify():
    params = {
        "client_id":     SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri":  SPOTIFY_REDIRECT_URI,
        "scope":         SPOTIFY_SCOPES,
        "show_dialog":   "true",
        "state":         state,
    }
    return redirect("https://accounts.spotify.com/authorize?" + urlencode(params))

@app.route("/callback/spotify")
def callback_spotify():
    state = request.args.get("state")
    if state != session.get("spotify_state"):
        return "State mismatch — possible CSRF attack", 400
    code = request.args.get("code")
    if not code:
        return redirect(url_for("index"))
    resp = requests.post("https://accounts.spotify.com/api/token", data={
        "grant_type":    "authorization_code",
        "code":          code,
        "redirect_uri":  SPOTIFY_REDIRECT_URI,
        "client_id":     SPOTIFY_CLIENT_ID,
        "client_secret": SPOTIFY_CLIENT_SECRET,
    })
    tokens = resp.json()
    session["spotify_token"]   = tokens.get("access_token")
    session["spotify_refresh"] = tokens.get("refresh_token")
    session["spotify_expiry"]  = time.time() + tokens.get("expires_in", 3600)
    session["active_platform"] = "spotify"
    return redirect(url_for("dashboard"))

def get_spotify_token():
    if time.time() > session.get("spotify_expiry", 0) - 60:
        resp = requests.post("https://accounts.spotify.com/api/token", data={
            "grant_type":    "refresh_token",
            "refresh_token": session["spotify_refresh"],
            "client_id":     SPOTIFY_CLIENT_ID,
            "client_secret": SPOTIFY_CLIENT_SECRET,
        })
        tokens = resp.json()
        session["spotify_token"]  = tokens.get("access_token")
        session["spotify_expiry"] = time.time() + tokens.get("expires_in", 3600)
    return session.get("spotify_token")

def spotify_get(endpoint, params=None):
    token = get_spotify_token()
    r = requests.get(f"https://api.spotify.com/v1{endpoint}",
                     headers={"Authorization": f"Bearer {token}"},
                     params=params or {})
    return r.json()

# ── Last.fm OAuth ────────────────────────────────────────────────────────────
@app.route("/login/lastfm")
def login_lastfm():
    params = {"api_key": LASTFM_API_KEY, "cb": LASTFM_REDIRECT_URI}
    return redirect("https://www.last.fm/api/auth/?" + urlencode(params))

@app.route("/callback/lastfm")
def callback_lastfm():
    token = request.args.get("token")
    if not token:
        return redirect(url_for("index"))
    sig_str = f"api_key{LASTFM_API_KEY}methodauth.getSessiontoken{token}{LASTFM_API_SECRET}"
    api_sig = hashlib.md5(sig_str.encode()).hexdigest()
    resp = requests.get("https://ws.audioscrobbler.com/2.0/", params={
        "method":  "auth.getSession",
        "api_key": LASTFM_API_KEY,
        "token":   token,
        "api_sig": api_sig,
        "format":  "json",
    })
    data = resp.json()
    sess = data.get("session", {})
    session["lastfm_token"]    = sess.get("key")
    session["lastfm_user"]     = sess.get("name")
    session["active_platform"] = "lastfm"
    return redirect(url_for("dashboard"))

def lastfm_get(method, extra=None):
    params = {
        "method":  method,
        "api_key": LASTFM_API_KEY,
        "user":    session.get("lastfm_user"),
        "format":  "json",
    }
    if extra:
        params.update(extra)
    r = requests.get("https://ws.audioscrobbler.com/2.0/", params=params)
    return r.json()

# ── API: Top Artists ──────────────────────────────────────────────────────────
@app.route("/api/top-artists")
def api_top_artists():
    platform   = request.args.get("platform", session.get("active_platform", "spotify"))
    time_range = request.args.get("range", "medium_term")

    if platform == "spotify":
        data = spotify_get("/me/top/artists", {"time_range": time_range, "limit": 10})
        artists = [{"name": a["name"],
                    "plays": a["popularity"],
                    "image": a["images"][0]["url"] if a["images"] else None}
                   for a in data.get("items", [])]
    else:
        period_map = {"short_term": "1month", "medium_term": "6month", "long_term": "overall"}
        period = period_map.get(time_range, "overall")
        data = lastfm_get("user.gettopartists", {"period": period, "limit": 10})
        artists = [{"name": a["name"],
                    "plays": int(a["playcount"]),
                    "image": next((img["#text"] for img in a.get("image", []) if img["size"] == "large"), None)}
                   for a in data.get("topartists", {}).get("artist", [])]
    return jsonify(artists)

# ── API: Top Tracks ───────────────────────────────────────────────────────────
@app.route("/api/top-tracks")
def api_top_tracks():
    platform   = request.args.get("platform", session.get("active_platform", "spotify"))
    time_range = request.args.get("range", "medium_term")

    if platform == "spotify":
        data = spotify_get("/me/top/tracks", {"time_range": time_range, "limit": 10})
        tracks = [{"name": t["name"],
                   "artist": t["artists"][0]["name"],
                   "plays": t["popularity"],
                   "image": t["album"]["images"][0]["url"] if t["album"]["images"] else None}
                  for t in data.get("items", [])]
    else:
        period_map = {"short_term": "1month", "medium_term": "6month", "long_term": "overall"}
        period = period_map.get(time_range, "overall")
        data = lastfm_get("user.gettoptracks", {"period": period, "limit": 10})
        tracks = [{"name": t["name"],
                   "artist": t["artist"]["name"],
                   "plays": int(t["playcount"]),
                   "image": next((img["#text"] for img in t.get("image", []) if img["size"] == "large"), None)}
                  for t in data.get("toptracks", {}).get("track", [])]
    return jsonify(tracks)

# ── API: Taste Radar (Spotify only) ──────────────────────────────────────────
@app.route("/api/taste-radar")
def api_taste_radar():
    data   = spotify_get("/me/top/tracks", {"time_range": "medium_term", "limit": 50})
    ids    = [t["id"] for t in data.get("items", [])]
    if not ids:
        return jsonify({})
    features_data = spotify_get("/audio-features", {"ids": ",".join(ids)})
    feats = [f for f in features_data.get("audio_features", []) if f]
    if not feats:
        return jsonify({})
    keys = ["danceability", "energy", "valence", "acousticness", "instrumentalness", "speechiness"]
    avg  = {k: round(sum(f[k] for f in feats) / len(feats) * 100, 1) for k in keys}
    return jsonify(avg)

# ── API: Listening Clock (Last.fm) ────────────────────────────────────────────
@app.route("/api/listening-clock")
def api_listening_clock():
    platform = request.args.get("platform", session.get("active_platform", "spotify"))
    hours = [0] * 24

    if platform == "lastfm":
        data   = lastfm_get("user.getrecenttracks", {"limit": 200})
        tracks = data.get("recenttracks", {}).get("track", [])
        for t in tracks:
            uts = t.get("date", {}).get("uts")
            if uts:
                h = datetime.utcfromtimestamp(int(uts)).hour
                hours[h] += 1
    else:
        data   = spotify_get("/me/player/recently-played", {"limit": 50})
        items  = data.get("items", [])
        for item in items:
            played_at = item.get("played_at", "")
            if played_at:
                h = int(played_at[11:13])
                hours[h] += 1
    return jsonify(hours)

# ── API: Scrobble Timeline (Last.fm) ─────────────────────────────────────────
@app.route("/api/scrobble-timeline")
def api_scrobble_timeline():
    platform = request.args.get("platform", session.get("active_platform", "spotify"))

    if platform == "lastfm":
        data   = lastfm_get("user.getrecenttracks", {"limit": 200})
        tracks = data.get("recenttracks", {}).get("track", [])
        by_day = Counter()
        for t in tracks:
            uts = t.get("date", {}).get("uts")
            if uts:
                day = datetime.utcfromtimestamp(int(uts)).strftime("%Y-%m-%d")
                by_day[day] += 1
        sorted_days = sorted(by_day.items())
        return jsonify({"labels": [d[0] for d in sorted_days],
                        "values": [d[1] for d in sorted_days]})
    else:
        data  = spotify_get("/me/player/recently-played", {"limit": 50})
        items = data.get("items", [])
        by_day = Counter()
        for item in items:
            played_at = item.get("played_at", "")
            if played_at:
                day = played_at[:10]
                by_day[day] += 1
        sorted_days = sorted(by_day.items())
        return jsonify({"labels": [d[0] for d in sorted_days],
                        "values": [d[1] for d in sorted_days]})

# ── API: Personality Card ─────────────────────────────────────────────────────
@app.route("/api/personality")
def api_personality():
    platform = request.args.get("platform", session.get("active_platform", "spotify"))

    # Gather data
    top_artists = []
    obscurity   = 50
    peak_hour   = 22
    top_genre   = "Unknown"

    if platform == "spotify":
        artists_data = spotify_get("/me/top/artists", {"time_range": "medium_term", "limit": 10})
        items        = artists_data.get("items", [])
        top_artists  = [a["name"] for a in items[:3]]
        if items:
            obscurity = round(100 - sum(a["popularity"] for a in items) / len(items))
        genres = []
        for a in items:
            genres.extend(a.get("genres", []))
        if genres:
            top_genre = Counter(genres).most_common(1)[0][0].title()

        clock_data = spotify_get("/me/player/recently-played", {"limit": 50})
        hours = [0] * 24
        for item in clock_data.get("items", []):
            played_at = item.get("played_at", "")
            if played_at:
                hours[int(played_at[11:13])] += 1
        peak_hour = hours.index(max(hours)) if max(hours) > 0 else 22

    else:
        period_map = {"short_term": "1month", "medium_term": "6month", "long_term": "overall"}
        data       = lastfm_get("user.gettopartists", {"period": "overall", "limit": 10})
        artists    = data.get("topartists", {}).get("artist", [])
        top_artists = [a["name"] for a in artists[:3]]

        clock_data = lastfm_get("user.getrecenttracks", {"limit": 200})
        tracks     = clock_data.get("recenttracks", {}).get("track", [])
        hours      = [0] * 24
        for t in tracks:
            uts = t.get("date", {}).get("uts")
            if uts:
                hours[datetime.utcfromtimestamp(int(uts)).hour] += 1
        peak_hour = hours.index(max(hours)) if max(hours) > 0 else 22

    # Generate personality
    time_label = ("Night Owl" if peak_hour >= 22 or peak_hour < 5
                  else "Early Bird" if peak_hour < 10
                  else "Midday Listener" if peak_hour < 17
                  else "Evening Drifter")

    niche_label = ("Underground Devotee" if obscurity > 70
                   else "Indie Explorer" if obscurity > 45
                   else "Mainstream Enjoyer" if obscurity > 25
                   else "Chart Regular")

    peak_fmt = f"{'12' if peak_hour % 12 == 0 else peak_hour % 12}{'am' if peak_hour < 12 else 'pm'}"

    artist_str = (f"{top_artists[0]}" if len(top_artists) == 1
                  else f"{top_artists[0]} & {top_artists[1]}" if len(top_artists) == 2
                  else f"{top_artists[0]}, {top_artists[1]} & {top_artists[2]}" if top_artists
                  else "your go-to artists")

    return jsonify({
        "title":      f"The {time_label}",
        "subtitle":   niche_label,
        "peak_hour":  peak_fmt,
        "top_genre":  top_genre,
        "obsession":  artist_str,
        "obscurity":  obscurity,
        "description": f"You peak at {peak_fmt}, can't stop playing {artist_str}, and your taste sits at {obscurity}% niche. A true {time_label.lower()} with {niche_label.lower()} tendencies.",
    })

# ── API: Now Playing ──────────────────────────────────────────────────────────
@app.route("/api/now-playing")
def api_now_playing():
    platform = request.args.get("platform", session.get("active_platform", "spotify"))

    if platform == "spotify":
        data = spotify_get("/me/player/currently-playing")
        if data and data.get("item"):
            item = data["item"]
            return jsonify({
                "playing": data.get("is_playing", False),
                "name":    item["name"],
                "artist":  item["artists"][0]["name"],
                "image":   item["album"]["images"][0]["url"] if item["album"]["images"] else None,
                "progress": data.get("progress_ms", 0),
                "duration": item.get("duration_ms", 1),
            })
        # Fall back to recently played
        recent = spotify_get("/me/player/recently-played", {"limit": 1})
        items  = recent.get("items", [])
        if items:
            track = items[0]["track"]
            return jsonify({
                "playing": False,
                "name":    track["name"],
                "artist":  track["artists"][0]["name"],
                "image":   track["album"]["images"][0]["url"] if track["album"]["images"] else None,
                "progress": 0,
                "duration": track.get("duration_ms", 1),
            })
    else:
        data = lastfm_get("user.getrecenttracks", {"limit": 1})
        tracks = data.get("recenttracks", {}).get("track", [])
        if tracks:
            t       = tracks[0] if isinstance(tracks, list) else tracks
            playing = t.get("@attr", {}).get("nowplaying") == "true"
            image   = next((img["#text"] for img in t.get("image", []) if img["size"] == "large"), None)
            return jsonify({
                "playing": playing,
                "name":    t.get("name"),
                "artist":  t.get("artist", {}).get("#text", ""),
                "image":   image,
                "progress": 0,
                "duration": 1,
            })

    return jsonify({"playing": False, "name": None})

# ── API: Obscurity Score ──────────────────────────────────────────────────────
@app.route("/api/obscurity")
def api_obscurity():
    if session.get("active_platform") != "spotify":
        data      = lastfm_get("user.gettopartists", {"period": "overall", "limit": 20})
        artists   = data.get("topartists", {}).get("artist", [])
        total     = sum(int(a["playcount"]) for a in artists)
        top3      = [a["name"] for a in artists[:3]]
        return jsonify({"score": 55, "label": "Indie Explorer",
                        "top_artists": top3, "note": "Obscurity scoring requires Spotify"})

    data    = spotify_get("/me/top/artists", {"time_range": "medium_term", "limit": 20})
    items   = data.get("items", [])
    if not items:
        return jsonify({"score": 50, "label": "Unknown", "top_artists": []})

    score   = round(100 - sum(a["popularity"] for a in items) / len(items))
    label   = ("Underground Devotee" if score > 70
               else "Indie Explorer" if score > 45
               else "Mainstream Enjoyer" if score > 25
               else "Chart Regular")
    buckets = {"Very Mainstream (80-100)": 0, "Popular (60-79)": 0,
               "Mid-tier (40-59)": 0, "Indie (20-39)": 0, "Underground (<20)": 0}
    for a in items:
        p = a["popularity"]
        if p >= 80:   buckets["Very Mainstream (80-100)"] += 1
        elif p >= 60: buckets["Popular (60-79)"] += 1
        elif p >= 40: buckets["Mid-tier (40-59)"] += 1
        elif p >= 20: buckets["Indie (20-39)"] += 1
        else:         buckets["Underground (<20)"] += 1

    return jsonify({"score": score, "label": label,
                    "top_artists": [a["name"] for a in items[:3]],
                    "buckets": buckets})

if __name__ == "__main__":
    app.run()
