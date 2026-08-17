// Song suggestion widget.
// Talks to the Cloudflare Worker backend (see /cloudflare-worker/SETUP.md).
// Replace API_BASE below with your deployed worker URL once you have it.

const API_BASE = "https://cfparrav-song-suggestions.carlitosfer6.workers.dev";

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("suggest-search");
    const resultsEl = document.getElementById("suggest-results");
    const form = document.getElementById("suggest-form");
    const nameInput = document.getElementById("suggest-name");
    const selectedEl = document.getElementById("suggest-selected");
    const statusEl = document.getElementById("suggest-status");
    const listEl = document.getElementById("suggestions-list");

    if (!searchInput || API_BASE.startsWith("REPLACE_WITH")) {
        if (statusEl) {
            statusEl.textContent = "Suggestions aren't connected yet.";
        }
        return;
    }

    let selectedTrack = null;
    let debounceTimer = null;

    function renderResults(tracks) {
        if (!tracks.length) {
            resultsEl.innerHTML = "";
            return;
        }
        resultsEl.innerHTML = tracks
            .map(
                (t, i) => `
                <li class="suggest-result" data-index="${i}">
                    ${t.image ? `<img src="${t.image}" alt="">` : ""}
                    <span>
                        <strong>${t.name}</strong><br>
                        <span class="suggest-artist">${t.artist}</span>
                    </span>
                </li>`
            )
            .join("");

        resultsEl.querySelectorAll(".suggest-result").forEach((el) => {
            el.addEventListener("click", () => {
                const track = tracks[Number(el.getAttribute("data-index"))];
                selectedTrack = track;
                selectedEl.innerHTML = `
                    Confirmed: <strong>${track.name}</strong> — ${track.artist}
                    ${track.spotify_url ? `<a href="${track.spotify_url}" target="_blank" rel="noopener">(open in Spotify)</a>` : ""}
                `;
                resultsEl.innerHTML = "";
                searchInput.value = "";
            });
        });
    }

    searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        const q = searchInput.value.trim();
        if (q.length < 2) {
            resultsEl.innerHTML = "";
            return;
        }
        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                renderResults(data.tracks || []);
            } catch {
                resultsEl.innerHTML = "";
            }
        }, 350);
    });

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!selectedTrack) {
                statusEl.textContent = "Pick a song from the search results first.";
                return;
            }
            statusEl.textContent = "Sending...";
            try {
                const res = await fetch(`${API_BASE}/suggest`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: nameInput.value,
                        track_uri: selectedTrack.uri,
                        track_name: selectedTrack.name,
                        track_artist: selectedTrack.artist,
                        track_image: selectedTrack.image,
                    }),
                });
                const data = await res.json();
                if (data.success) {
                    statusEl.textContent = "Added! Thanks for the suggestion.";
                    selectedTrack = null;
                    selectedEl.innerHTML = "";
                    nameInput.value = "";
                    loadSuggestions();
                } else {
                    statusEl.textContent = "Something went wrong — try again?";
                }
            } catch {
                statusEl.textContent = "Something went wrong — try again?";
            }
        });
    }

    async function loadSuggestions() {
        if (!listEl) return;
        const adminKey = localStorage.getItem("admin-key");
        try {
            const res = await fetch(`${API_BASE}/suggestions`);
            const data = await res.json();
            const suggestions = data.suggestions || [];
            if (!suggestions.length) {
                listEl.innerHTML = "<p class=\"suggest-empty\">No suggestions yet — be the first.</p>";
                return;
            }
            listEl.innerHTML = suggestions
                .map(
                    (s) => `
                    <li class="suggestion-item">
                        ${s.track_image ? `<img src="${s.track_image}" alt="">` : ""}
                        <span>
                            <strong>${s.track_name}</strong> — ${s.track_artist}<br>
                            <span class="suggest-by">suggested by ${s.name}</span>
                        </span>
                        ${adminKey ? `<button type="button" class="suggest-delete" data-key="${s.key}">×</button>` : ""}
                    </li>`
                )
                .join("");

            if (adminKey) {
                listEl.querySelectorAll(".suggest-delete").forEach((btn) => {
                    btn.addEventListener("click", async () => {
                        const key = btn.getAttribute("data-key");
                        try {
                            const res = await fetch(`${API_BASE}/suggestions`, {
                                method: "DELETE",
                                headers: {
                                    "Content-Type": "application/json",
                                    "X-Admin-Key": adminKey,
                                },
                                body: JSON.stringify({ key }),
                            });
                            const data = await res.json();
                            if (data.success) {
                                loadSuggestions();
                            } else {
                                alert("Delete failed — wrong admin key?");
                            }
                        } catch {
                            alert("Delete failed.");
                        }
                    });
                });
            }
        } catch {
            listEl.innerHTML = "";
        }
    }

    // Admin toggle: click "admin" near the suggestions list to set/clear
    // your delete key. Stored in this browser only, via localStorage.
    const adminToggle = document.getElementById("admin-toggle");
    if (adminToggle) {
        updateAdminToggleLabel();
        adminToggle.addEventListener("click", () => {
            if (localStorage.getItem("admin-key")) {
                localStorage.removeItem("admin-key");
            } else {
                const key = prompt("Enter admin key:");
                if (key) localStorage.setItem("admin-key", key);
            }
            updateAdminToggleLabel();
            loadSuggestions();
        });
    }

    function updateAdminToggleLabel() {
        if (!adminToggle) return;
        adminToggle.textContent = localStorage.getItem("admin-key") ? "exit admin" : "admin";
    }

    loadSuggestions();
});
