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

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function formatWhen(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    async function loadItemComments(key, listInner) {
        try {
            const res = await fetch(`${API_BASE}/comments?page=${encodeURIComponent(key)}`);
            const data = await res.json();
            const comments = data.comments || [];
            listInner.innerHTML = comments.length
                ? comments
                      .map(
                          (c) => `
                    <div class="comment">
                        <span class="who">${escapeHtml(c.name)}</span>
                        <span class="when">${formatWhen(c.posted_at)}</span>
                        <p>${escapeHtml(c.message)}</p>
                    </div>`
                      )
                      .join("")
                : `<p class="suggest-empty">No comments yet.</p>`;
        } catch {
            listInner.innerHTML = "";
        }
    }

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
                        <div class="suggestion-main">
                            ${s.track_image ? `<img src="${s.track_image}" alt="">` : ""}
                            <span>
                                <strong>${s.track_name}</strong> — ${s.track_artist}<br>
                                <span class="suggest-by">suggested by ${s.name}</span>
                            </span>
                            ${adminKey ? `<button type="button" class="suggest-delete" data-key="${s.key}">×</button>` : ""}
                        </div>
                        <div class="suggestion-comments">
                            <button type="button" class="comments-toggle" data-key="${s.key}">💬 comments</button>
                            <div class="suggestion-comments-body" hidden>
                                <div class="suggestion-comments-list"></div>
                                <form class="suggestion-comment-form" data-key="${s.key}">
                                    <input type="text" class="sc-name" placeholder="name (optional)">
                                    <input type="text" class="sc-msg" placeholder="say something about this pick...">
                                    <button type="submit">Post</button>
                                </form>
                            </div>
                        </div>
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

            listEl.querySelectorAll(".comments-toggle").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const body = btn.nextElementSibling;
                    const listInner = body.querySelector(".suggestion-comments-list");
                    if (body.hasAttribute("hidden")) {
                        body.removeAttribute("hidden");
                        btn.textContent = "💬 hide comments";
                        if (!listInner.dataset.loaded) {
                            listInner.dataset.loaded = "1";
                            loadItemComments(btn.getAttribute("data-key"), listInner);
                        }
                    } else {
                        body.setAttribute("hidden", "");
                        btn.textContent = "💬 comments";
                    }
                });
            });

            listEl.querySelectorAll(".suggestion-comment-form").forEach((form) => {
                form.addEventListener("submit", async (e) => {
                    e.preventDefault();
                    const key = form.getAttribute("data-key");
                    const nameInput = form.querySelector(".sc-name");
                    const msgInput = form.querySelector(".sc-msg");
                    const message = msgInput.value.trim();
                    if (!message) return;

                    const submitBtn = form.querySelector("button");
                    submitBtn.disabled = true;
                    try {
                        const res = await fetch(`${API_BASE}/comment`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ page: key, name: nameInput.value, message }),
                        });
                        const data = await res.json();
                        if (data.success) {
                            nameInput.value = "";
                            msgInput.value = "";
                            const listInner = form.closest(".suggestion-comments-body").querySelector(".suggestion-comments-list");
                            loadItemComments(key, listInner);
                        }
                    } catch {
                        // silently ignore — the form stays filled so the visitor can retry
                    } finally {
                        submitBtn.disabled = false;
                    }
                });
            });
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
