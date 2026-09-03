// Homepage "now playing" widget. Fetches the worker's /now-playing route and
// fills in the placeholder from index.html. Fails silently (hides the whole
// line) if the worker errors or nothing has ever been played, rather than
// showing a broken or empty-looking widget.

const API_BASE = "https://cfparrav-song-suggestions.carlitosfer6.workers.dev";

document.addEventListener("DOMContentLoaded", async () => {
    const el = document.getElementById("now-playing");
    if (!el) return;

    try {
        const res = await fetch(`${API_BASE}/now-playing`);
        if (!res.ok) throw new Error(`now-playing failed: ${res.status}`);
        const data = await res.json();

        if (!data.track_name) {
            el.remove();
            return;
        }

        const label = data.is_playing ? "Now playing" : "Last played";
        const link = document.createElement(data.spotify_url ? "a" : "span");
        if (data.spotify_url) {
            link.href = data.spotify_url;
            link.target = "_blank";
            link.rel = "noopener";
        }
        link.textContent = `${data.track_name} — ${data.artist}`;

        el.textContent = `${label}: `;
        el.appendChild(link);
        el.hidden = false;
    } catch (err) {
        // Spotify/worker hiccup -- just hide the line instead of showing
        // broken or stale text.
        el.remove();
    }
});
