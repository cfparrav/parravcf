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
 *   GET    /comments          -> list comments for a page (?page=...)
 *   POST   /comment           -> post a comment on a page
 *   DELETE /comments          -> (admin) delete a comment by its KV key
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
    // delete_token is a private capability -- returned once, here, to the
    // submitter only. It's stripped from the public listing (see
    // handleListSuggestions) so it lets the original submitter delete their
    // own mistaken suggestion without needing the admin key, while nobody
    // else can use it since they never see it.
    const record = {
        name: (name && name.trim()) || "Anonymous",
        track_name,
        track_artist,
        track_image: track_image || null,
        track_uri,
        added_at: new Date().toISOString(),
        delete_token: crypto.randomUUID(),
    };
    const key = `suggestion:${Date.now()}:${crypto.randomUUID()}`;
    await env.SUGGESTIONS.put(key, JSON.stringify(record));

    return json({ success: true, key, ...record });
}

async function handleListSuggestions(env) {
    const list = await env.SUGGESTIONS.list({ prefix: "suggestion:" });
    const records = await Promise.all(
        list.keys.map(async (k) => {
            const val = await env.SUGGESTIONS.get(k.name);
            if (!val) return null;
            // Strip delete_token -- it must never be visible to anyone but
            // the original submitter (who already has it from the /suggest
            // response), otherwise anyone could use it to delete any
            // suggestion.
            const { delete_token, ...record } = JSON.parse(val);
            return { key: k.name, ...record };
        })
    );
    const cleaned = records
        .filter(Boolean)
        .sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
        .slice(0, 100);

    return json({ suggestions: cleaned });
}

// Best-effort removal from the actual Spotify playlist. Failures here don't
// block the KV delete -- worst case the site owner still cleans it up
// manually in Spotify, same as before this existed.
async function removeFromSpotifyPlaylist(env, trackUri) {
    if (!trackUri) return;
    try {
        const userToken = await getUserAccessToken(env);
        await fetch(`https://api.spotify.com/v1/playlists/${env.SPOTIFY_PLAYLIST_ID}/tracks`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${userToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ tracks: [{ uri: trackUri }] }),
        });
    } catch {
        // Swallow -- see comment above.
    }
}

// Delete a suggestion by its KV key, and best-effort remove it from the
// Spotify playlist too. Two ways to authorize:
//   - X-Admin-Key header matching the ADMIN_KEY secret (deletes anything)
//   - delete_token in the body matching the record's own token (lets the
//     original submitter remove only their own suggestion)
async function handleDeleteSuggestion(request, env) {
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid body" }, 400);
    }

    if (!body?.key || !body.key.startsWith("suggestion:")) {
        return json({ error: "invalid key" }, 400);
    }

    const adminKey = request.headers.get("X-Admin-Key");
    const isAdmin = adminKey && adminKey === env.ADMIN_KEY;

    const raw = await env.SUGGESTIONS.get(body.key);
    if (!raw) {
        return json({ error: "not found" }, 404);
    }
    const record = JSON.parse(raw);

    if (!isAdmin) {
        if (!body.delete_token || body.delete_token !== record.delete_token) {
            return json({ error: "unauthorized" }, 401);
        }
    }

    await removeFromSpotifyPlaylist(env, record.track_uri);
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

// Comments on journal/photo pages. Key is namespaced per page so listing a
// page's comments is a cheap prefix scan, same pattern as suggestions.
function commentKey(page, timestamp, id) {
    return `comment:${page}:${timestamp}:${id}`;
}

async function handleListComments(request, env) {
    const url = new URL(request.url);
    const page = url.searchParams.get("page");
    if (!page) return json({ comments: [] });

    const list = await env.SUGGESTIONS.list({ prefix: `comment:${page}:` });
    const records = await Promise.all(
        list.keys.map(async (k) => {
            const val = await env.SUGGESTIONS.get(k.name);
            if (!val) return null;
            return { key: k.name, ...JSON.parse(val) };
        })
    );
    const cleaned = records
        .filter(Boolean)
        .sort((a, b) => new Date(a.posted_at) - new Date(b.posted_at))
        .slice(-200);

    return json({ comments: cleaned });
}

async function handlePostComment(request, env) {
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid body" }, 400);
    }

    const { page, name, message } = body || {};
    const trimmedMessage = (message || "").trim();
    if (!page || !trimmedMessage) {
        return json({ error: "missing page or message" }, 400);
    }
    if (trimmedMessage.length > 2000) {
        return json({ error: "comment too long" }, 400);
    }

    const record = {
        name: (name && name.trim().slice(0, 80)) || "Anonymous",
        message: trimmedMessage,
        posted_at: new Date().toISOString(),
    };
    const key = commentKey(page, Date.now(), crypto.randomUUID());
    await env.SUGGESTIONS.put(key, JSON.stringify(record));

    return json({ success: true });
}

// Admin-only: delete a comment by its KV key, same auth as suggestion deletes.
async function handleDeleteComment(request, env) {
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

    if (!body?.key || !body.key.startsWith("comment:")) {
        return json({ error: "invalid key" }, 400);
    }

    await env.SUGGESTIONS.delete(body.key);
    return json({ success: true });
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
            if (url.pathname === "/comments" && request.method === "GET") {
                return await handleListComments(request, env);
            }
            if (url.pathname === "/comment" && request.method === "POST") {
                return await handlePostComment(request, env);
            }
            if (url.pathname === "/comments" && request.method === "DELETE") {
                return await handleDeleteComment(request, env);
            }
            return json({ error: "not found" }, 404);
        } catch (err) {
            return json({ error: "server error", detail: String(err) }, 500);
        }
    },
};
