// "Listening to" widget for the Now page. Fetches the worker's /now-playing
// route and fills in the now-item placeholder from now.html. Fails silently
// (hides the whole list item) if the worker errors or nothing has ever been
// played, so it never shows broken or empty-looking content.

const API_BASE = "https://cfparrav-song-suggestions.carlitosfer6.workers.dev";

document.addEventListener("DOMContentLoaded", async () => {
    const item = document.getElementById("now-playing-item");
    const label = document.getElementById("now-playing-label");
    const body = document.getElementById("now-playing-body");
    if (!item || !label || !body) return;

    try {
        const res = await fetch(`${API_BASE}/now-playing`);
        if (!res.ok) throw new Error(`now-playing failed: ${res.status}`);
        const data = await res.json();

        if (!data.track_name) {
            item.remove();
            return;
        }

        label.textContent = data.is_playing ? "Listening to" : "Last listened to";

        const link = document.createElement(data.spotify_url ? "a" : "span");
        if (data.spotify_url) {
            link.href = data.spotify_url;
            link.target = "_blank";
            link.rel = "noopener";
        }
        link.textContent = `${data.track_name} — ${data.artist}`;

        body.textContent = "";
        body.appendChild(link);
        item.hidden = false;
    } catch (err) {
        // Spotify/worker hiccup -- just hide the item instead of showing
        // broken or stale content.
        item.remove();
    }
});
