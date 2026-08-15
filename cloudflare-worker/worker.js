/**
 * cfparrav song-suggestions worker
 *
 * Three routes:
 *   GET    /search?q=...      -> search Spotify's public catalog (Client Credentials auth)
 *   POST   /suggest           -> add a confirmed track to your playlist + log the suggestion
 *   GET    /suggestions       -> list logged suggestions (for the site to display)
 *   DELETE /suggestions       -> (admin) delete a suggestion by its KV key
 *   GET    /rating            -> get up/down counts for a song (?title=...&artist=...)
 *   POST   /rate-song         -> submit an up/down vote for a song
 *
 * Uses POST /playlists/{id}/items (not the deprecated /tracks path -- Spotify's
 * Feb 2026 API migration removed /tracks for Development Mode apps).
 *
 * Required secrets (set with `wrangler secret put <NAME>`):
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *   SPOTIFY_REFRESH_TOKEN   <- from your one-time authorization (see SETUP.md)
 *   SPOTIFY_PLAYLIST_ID     <- the playlist you want suggestions added to
 *   ADMIN_KEY               <- a password you make up, for the delete button
 *
 * Required binding (in wrangler.toml):
 *   KV namespace bound as SUGGESTIONS
 */

const ALLOWED_ORIGIN = "*"; // domain is decided (parravcf.com) but not live yet —
// switch this to "https://parravcf.com" once the site is actually deployed there,
// otherwise local testing (file:// or localhost) will get blocked by CORS

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    };
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
}

// App-only token, for searching the public catalog. No user login involved,
// so this isn't subject to Spotify's development-mode "5 authorized users" cap.
async function getAppAccessToken(env) {
    const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`Spotify app token failed: ${res.status}`);
    const data = await res.json();
    return data.access_token;
}

// User token via your stored refresh token, for adding tracks to your playlist.
// Only your account is authorized here -- visitors never log in to Spotify.
//
// Spotify may rotate the refresh token on each use (issuing a new one and
// invalidating the old). So this checks KV first for the latest rotated
// token, falling back to the original secret on first run, and always
// saves whatever Spotify returns for next time.
async function getUserAccessToken(env) {
    const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
    const storedToken = await env.SUGGESTIONS.get("spotify:refresh_token");
    const refreshToken = storedToken || env.SPOTIFY_REFRESH_TOKEN;

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    if (!res.ok) throw new Error(`Spotify refresh failed: ${res.status}`);
    const data = await res.json();

    // If Spotify rotated the refresh token, persist the new one for next time.
    if (data.refresh_token) {
        await env.SUGGESTIONS.put("spotify:refresh_token", data.refresh_token);
    }

    return data.access_token;
}

async function handleSearch(request, env) {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    if (!q || q.trim().length < 2) return json({ tracks: [] });

    const token = await getAppAccessToken(env);
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=8`;
    const res = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return json({ error: "search failed" }, 502);

    const data = await res.json();
    const tracks = (data.tracks?.items || []).map((t) => ({
        uri: t.uri,
        name: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        image: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || null,
        spotify_url: t.external_urls?.spotify || null,
    }));

    return json({ tracks });
}

async function handleSuggest(request, env) {
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid body" }, 400);
    }

    const { name, track_uri, track_name, track_artist, track_image } = body || {};
    if (!track_uri || !track_name || !track_artist) {
        return json({ error: "missing track info" }, 400);
    }

    // Add to playlist using your (the site owner's) authorized account.
    // Note: Spotify's Feb 2026 API migration deprecated POST /playlists/{id}/tracks
    // in favor of POST /playlists/{id}/items -- the old path now 403s for
    // Development Mode apps.
    const userToken = await getUserAccessToken(env);
    const addRes = await fetch(
        `https://api.spotify.com/v1/playlists/${env.SPOTIFY_PLAYLIST_ID}/items`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${userToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris: [track_uri] }),
        }
    );
    if (!addRes.ok) {
        const errText = await addRes.text();
        return json({ error: "failed to add to playlist", detail: errText }, 502);
    }

    // Log the suggestion so the site can display who suggested what.
    const record = {
        name: (name && name.trim()) || "Anonymous",
        track_name,
        track_artist,
        track_image: track_image || null,
        added_at: new Date().toISOString(),
    };
    const key = `suggestion:${Date.now()}:${crypto.randomUUID()}`;
    await env.SUGGESTIONS.put(key, JSON.stringify(record));

    return json({ success: true });
}

async function handleListSuggestions(env) {
    const list = await env.SUGGESTIONS.list({ prefix: "suggestion:" });
    const records = await Promise.all(
        list.keys.map(async (k) => {
            const val = await env.SUGGESTIONS.get(k.name);
            if (!val) return null;
            return { key: k.name, ...JSON.parse(val) };
        })
    );
    const cleaned = records
        .filter(Boolean)
        .sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
        .slice(0, 100);

    return json({ suggestions: cleaned });
}

// Admin-only: delete a suggestion by its KV key. Requires the X-Admin-Key
// header to match the ADMIN_KEY secret.
async function handleDeleteSuggestion(request, env) {
    const adminKey = request.headers.get("X-Admin-Key");
    if (!adminKey || adminKey !== env.ADMIN_KEY) {
        return json({ error: "unauthorized" }, 401);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid body" }, 400);
    }

    if (!body?.key || !body.key.startsWith("suggestion:")) {
        return json({ error: "invalid key" }, 400);
    }

    await env.SUGGESTIONS.delete(body.key);
    return json({ success: true });
}

// Rating a song from the "give me a song" generator. Key is derived from
// title+artist so repeated recommendations of the same song accumulate.
function ratingKey(title, artist) {
    return `rating:${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;
}

async function handleGetRating(request, env) {
    const url = new URL(request.url);
    const title = url.searchParams.get("title");
    const artist = url.searchParams.get("artist");
    if (!title || !artist) return json({ up: 0, down: 0 });

    const raw = await env.SUGGESTIONS.get(ratingKey(title, artist));
    const counts = raw ? JSON.parse(raw) : { up: 0, down: 0 };
    return json(counts);
}

async function handleRateSong(request, env) {
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid body" }, 400);
    }

    const { title, artist, rating } = body || {};
    if (!title || !artist || (rating !== "up" && rating !== "down")) {
        return json({ error: "missing or invalid fields" }, 400);
    }

    const key = ratingKey(title, artist);
    const raw = await env.SUGGESTIONS.get(key);
    const counts = raw ? JSON.parse(raw) : { up: 0, down: 0 };
    counts[rating] += 1;
    await env.SUGGESTIONS.put(key, JSON.stringify(counts));

    return json(counts);
}

export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders() });
        }

        const url = new URL(request.url);

        try {
            if (url.pathname === "/search" && request.method === "GET") {
                return await handleSearch(request, env);
            }
            if (url.pathname === "/suggest" && request.method === "POST") {
                return await handleSuggest(request, env);
            }
            if (url.pathname === "/suggestions" && request.method === "GET") {
                return await handleListSuggestions(env);
            }
            if (url.pathname === "/suggestions" && request.method === "DELETE") {
                return await handleDeleteSuggestion(request, env);
            }
            if (url.pathname === "/rating" && request.method === "GET") {
                return await handleGetRating(request, env);
            }
            if (url.pathname === "/rate-song" && request.method === "POST") {
                return await handleRateSong(request, env);
            }
            return json({ error: "not found" }, 404);
        } catch (err) {
            return json({ error: "server error", detail: String(err) }, 500);
        }
    },
};
