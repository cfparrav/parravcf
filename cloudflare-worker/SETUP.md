# Setup guide — Spotify song suggestions backend

Everything in this folder runs on Cloudflare's free tier. Follow these steps
in order. You'll end up with a URL like
`https://cfparrav-song-suggestions.<your-subdomain>.workers.dev` — save it,
the site's frontend needs it.

## 1. Register a Spotify app

1. Go to https://developer.spotify.com/dashboard and log in with your
   Premium account.
2. Click **Create app**.
3. Fill in a name/description. For **Redirect URI**, enter exactly:
   `http://127.0.0.1:8888/callback`
   (Spotify no longer accepts `localhost` here — must be `127.0.0.1`.)
4. Save. Open **Settings** and copy your **Client ID** and **Client Secret**
   — you'll need both shortly.

## 2. Get a one-time refresh token for your account

This authorizes the app to add tracks to your playlist. You only do this
once — the refresh token keeps working after that.

1. Pick (or create) the Spotify playlist you want suggestions added to.
   Open it in Spotify, click **Share → Copy link to playlist**, and pull the
   ID out of the URL (the part after `/playlist/` and before any `?`).
   Save this as your **Playlist ID**.

2. In a browser, visit (replace `YOUR_CLIENT_ID`):

   ```
   https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://127.0.0.1:8888/callback&scope=playlist-modify-public%20playlist-modify-private
   ```

3. Log in and approve. You'll land on a page that fails to load (that's
   expected — nothing is running on 127.0.0.1:8888). Copy the `code` value
   from the browser's address bar.

4. In a terminal, exchange that code for a refresh token.

   **On Mac/Linux**, replace the placeholders and run:

   ```bash
   curl -X POST https://accounts.spotify.com/api/token \
     -H "Authorization: Basic $(echo -n 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' | base64)" \
     -d grant_type=authorization_code \
     -d code=THE_CODE_YOU_COPIED \
     -d redirect_uri=http://127.0.0.1:8888/callback
   ```

   **On Windows** (PowerShell — e.g. VS Code's built-in terminal), run these in
   order, replacing the placeholders:

   ```powershell
   $bytes = [System.Text.Encoding]::UTF8.GetBytes("YOUR_CLIENT_ID:YOUR_CLIENT_SECRET")
   $base64 = [System.Convert]::ToBase64String($bytes)
   curl.exe -X POST https://accounts.spotify.com/api/token -H "Authorization: Basic $base64" -d "grant_type=authorization_code" -d "code=THE_CODE_YOU_COPIED" -d "redirect_uri=http://127.0.0.1:8888/callback"
   ```

   (Use `curl.exe` specifically on Windows — plain `curl` in PowerShell can
   resolve to a different built-in command that doesn't behave the same way.)

5. The response includes a `refresh_token` — save it. This is the one that
   goes into the worker's secrets below.

## 3. Set up Cloudflare

1. Create a free account at https://dash.cloudflare.com/sign-up if you don't
   have one.
2. Install Wrangler (Cloudflare's CLI) — needs Node.js installed first:

   ```bash
   npm install -g wrangler
   wrangler login
   ```

3. From inside this `cloudflare-worker` folder, create the KV namespace
   that stores suggestions:

   ```bash
   wrangler kv namespace create SUGGESTIONS
   ```

   It prints an `id`. Paste that into `wrangler.toml` where it says
   `PASTE_YOUR_KV_NAMESPACE_ID_HERE`.

4. Set your secrets (it'll prompt you to paste each value):

   ```bash
   wrangler secret put SPOTIFY_CLIENT_ID
   wrangler secret put SPOTIFY_CLIENT_SECRET
   wrangler secret put SPOTIFY_REFRESH_TOKEN
   wrangler secret put SPOTIFY_PLAYLIST_ID
   wrangler secret put ADMIN_KEY
   ```

   `ADMIN_KEY` is just a password you make up yourself (not from Spotify) —
   it's what lets you delete suggestions from the "admin" toggle on the
   site. Pick anything memorable but not guessable.

5. Deploy:

   ```bash
   wrangler deploy
   ```

   It prints your worker's URL. That's the one the site's frontend needs.

## 4. Tell me the worker URL

Once deployed, send me the `https://....workers.dev` URL and I'll wire it
into the suggestion form on the site.

## Notes

- The refresh token doesn't expire unless you revoke access from your
  Spotify account settings, so step 2 is truly one-time.
- `ALLOWED_ORIGIN` in `worker.js` is set to `"*"` (any site can call it) —
  once your real domain is live, tighten it to just that domain.
