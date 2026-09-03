# Setup — "Now playing" homepage widget

The worker now has a `/now-playing` route, but it needs a Spotify permission
your current refresh token doesn't have. Your existing token (from the
original SETUP.md) was only authorized for `playlist-modify-public` and
`playlist-modify-private` — enough to add tracks to your playlist, but not
enough to read what you're listening to. You need to redo the one-time
authorization with two extra scopes added: `user-read-currently-playing` and
`user-read-recently-played`.

This replaces your refresh token entirely (the new one covers everything —
playlist adds still keep working).

## 1. Re-authorize with the expanded scopes

In a browser, visit (replace `YOUR_CLIENT_ID` with the one from your Spotify
app — same one already in your `SPOTIFY_CLIENT_ID` secret):

```
https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://127.0.0.1:8888/callback&scope=playlist-modify-public%20playlist-modify-private%20user-read-currently-playing%20user-read-recently-played
```

Log in and approve. You'll land on a page that fails to load — that's
expected. Copy the `code` value out of the browser's address bar.

## 2. Exchange the code for a new refresh token

**Windows (PowerShell):**

```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes("YOUR_CLIENT_ID:YOUR_CLIENT_SECRET")
$base64 = [System.Convert]::ToBase64String($bytes)
curl.exe -X POST https://accounts.spotify.com/api/token -H "Authorization: Basic $base64" -d "grant_type=authorization_code" -d "code=THE_CODE_YOU_COPIED" -d "redirect_uri=http://127.0.0.1:8888/callback"
```

**Mac/Linux:**

```bash
curl -X POST https://accounts.spotify.com/api/token \
  -H "Authorization: Basic $(echo -n 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' | base64)" \
  -d grant_type=authorization_code \
  -d code=THE_CODE_YOU_COPIED \
  -d redirect_uri=http://127.0.0.1:8888/callback
```

Copy the `refresh_token` from the response.

## 3. Update the secret

From inside the `cloudflare-worker` folder:

```bash
wrangler secret put SPOTIFY_REFRESH_TOKEN
```

Paste the new refresh token when prompted.

## 4. Clear the cached rotated token — important, don't skip this

The worker caches the latest rotated refresh token in KV and checks that
*before* the secret (see `getUserAccessToken` in `worker.js`). If you skip
this step, it'll keep using your old, narrower-scoped token from KV and the
widget will fail even though the secret is updated. Clear it:

```bash
wrangler kv key delete "spotify:refresh_token" --binding=SUGGESTIONS
```

## 5. Deploy

```bash
wrangler deploy
```

## 6. Test it

Visit `https://cfparrav-song-suggestions.carlitosfer6.workers.dev/now-playing`
directly in a browser. You should get back JSON like:

```json
{"is_playing": true, "track_name": "...", "artist": "...", "spotify_url": "..."}
```

If you get an error instead, double check steps 3–4 — a stale KV token is
the most likely culprit.

Once that's working, the homepage widget (already wired up in `index.html`
and `now-playing.js`) will pick it up automatically on next page load — no
frontend changes needed after this.
