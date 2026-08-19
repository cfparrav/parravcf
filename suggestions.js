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

    let i18nDict = {};
    document.addEventListener("i18n:change", (e) => {
        i18nDict = (e.detail && e.detail.dict) || {};
    });
    function t(key, fallback) {
        return i18nDict[key] || fallback;
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function formatWhen(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    // Lets a visitor delete their own just-submitted suggestion (e.g. picked
    // the wrong song) without needing the admin key. The server only accepts
    // a delete_token that matches the one it handed back at submit time, so
    // this only ever works for suggestions made from this browser.
    const MY_SUGGESTIONS_KEY = "my-suggestions";

    function getMySuggestions() {
        try {
            return JSON.parse(localStorage.getItem(MY_SUGGESTIONS_KEY) || "[]");
        } catch {
            return [];
        }
    }

    function rememberMySuggestion(key, deleteToken) {
        const mine = getMySuggestions();
        mine.push({ key, delete_token: deleteToken });
        localStorage.setItem(MY_SUGGESTIONS_KEY, JSON.stringify(mine));
    }

    function forgetMySuggestion(key) {
        localStorage.setItem(
            MY_SUGGESTIONS_KEY,
            JSON.stringify(getMySuggestions().filter((m) => m.key !== key))
        );
    }

    function myDeleteToken(key) {
        const match = getMySuggestions().find((m) => m.key === key);
        return match ? match.delete_token : null;
    }

    async function fetchRating(title, artist) {
        try {
            const res = await fetch(`${API_BASE}/rating?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
            if (!res.ok) return { up: 0, down: 0 };
            return await res.json();
        } catch {
            return { up: 0, down: 0 };
        }
    }

    async function submitRating(title, artist, rating) {
        try {
            const res = await fetch(`${API_BASE}/rate-song`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, artist, rating }),
            });
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }

    // Appends locally rather than re-fetching -- KV writes take a few seconds
    // to become visible to reads, so a re-fetch right after posting often
    // shows the comment as missing even though it saved.
    function appendItemComment(listInner, comment) {
        if (listInner.querySelector(".suggest-empty")) listInner.innerHTML = "";
        listInner.insertAdjacentHTML(
            "beforeend",
            `<div class="comment">
                <span class="who">${escapeHtml(comment.name)}</span>
                <span class="when">${formatWhen(comment.posted_at)}</span>
                <p>${escapeHtml(comment.message)}</p>
            </div>`
        );
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

    function suggestionItemHtml(s, adminKey) {
        const canDelete = adminKey || myDeleteToken(s.key);
        return `
            <li class="suggestion-item" data-key="${s.key}">
                <div class="suggestion-main">
                    ${s.track_image ? `<img src="${s.track_image}" alt="">` : ""}
                    <span>
                        <strong>${s.track_name}</strong> — ${s.track_artist}<br>
                        <span class="suggest-by">suggested by ${s.name}</span>
                    </span>
                    ${canDelete ? `<button type="button" class="suggest-delete" data-key="${s.key}" title="${adminKey ? "Delete" : "Delete your suggestion"}">×</button>` : ""}
                </div>
                <div class="suggestion-rating">
                    <button type="button" class="suggestion-rate-up" title="I like this one">👍</button>
                    <button type="button" class="suggestion-rate-down" title="Not for me">👎</button>
                    <span class="suggestion-rating-counts"></span>
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
            </li>`;
    }

    // Wires up rating/delete/comments behavior for a single suggestion <li>.
    // Used both for the initial batch render and for a freshly-inserted
    // optimistic item.
    function wireSuggestionItem(li, adminKey, s) {
        const upBtn = li.querySelector(".suggestion-rate-up");
        const downBtn = li.querySelector(".suggestion-rate-down");
        const countsEl = li.querySelector(".suggestion-rating-counts");
        let voted = false;

        fetchRating(s.track_name, s.track_artist).then((counts) => {
            countsEl.textContent = `👍 ${counts.up} · 👎 ${counts.down}`;
        });

        function castVote(rating) {
            if (voted) return;
            voted = true;
            upBtn.disabled = true;
            downBtn.disabled = true;
            submitRating(s.track_name, s.track_artist, rating).then((counts) => {
                if (counts) countsEl.textContent = `👍 ${counts.up} · 👎 ${counts.down}`;
            });
        }

        upBtn.addEventListener("click", () => castVote("up"));
        downBtn.addEventListener("click", () => castVote("down"));

        const deleteBtn = li.querySelector(".suggest-delete");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", async () => {
                const key = deleteBtn.getAttribute("data-key");
                const headers = { "Content-Type": "application/json" };
                const body = { key };
                if (adminKey) {
                    headers["X-Admin-Key"] = adminKey;
                } else {
                    body.delete_token = myDeleteToken(key);
                }
                try {
                    const res = await fetch(`${API_BASE}/suggestions`, {
                        method: "DELETE",
                        headers,
                        body: JSON.stringify(body),
                    });
                    const data = await res.json();
                    if (data.success) {
                        li.remove();
                        forgetMySuggestion(key);
                    } else {
                        alert(adminKey ? "Delete failed — wrong admin key?" : "Delete failed.");
                    }
                } catch {
                    alert("Delete failed.");
                }
            });
        }

        const toggle = li.querySelector(".comments-toggle");
        toggle.addEventListener("click", () => {
            const body = toggle.nextElementSibling;
            const listInner = body.querySelector(".suggestion-comments-list");
            if (body.hasAttribute("hidden")) {
                body.removeAttribute("hidden");
                toggle.textContent = "💬 hide comments";
                if (!listInner.dataset.loaded) {
                    listInner.dataset.loaded = "1";
                    loadItemComments(toggle.getAttribute("data-key"), listInner);
                }
            } else {
                body.setAttribute("hidden", "");
                toggle.textContent = "💬 comments";
            }
        });

        const commentForm = li.querySelector(".suggestion-comment-form");
        commentForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const key = commentForm.getAttribute("data-key");
            const scNameInput = commentForm.querySelector(".sc-name");
            const scMsgInput = commentForm.querySelector(".sc-msg");
            const message = scMsgInput.value.trim();
            if (!message) return;

            const submitBtn = commentForm.querySelector("button");
            submitBtn.disabled = true;
            try {
                const res = await fetch(`${API_BASE}/comment`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ page: key, name: scNameInput.value, message }),
                });
                const data = await res.json();
                if (data.success) {
                    const listInner = commentForm.closest(".suggestion-comments-body").querySelector(".suggestion-comments-list");
                    appendItemComment(listInner, {
                        name: (scNameInput.value && scNameInput.value.trim()) || "Anonymous",
                        message,
                        posted_at: new Date().toISOString(),
                    });
                    scNameInput.value = "";
                    scMsgInput.value = "";
                }
            } catch {
                // silently ignore — the form stays filled so the visitor can retry
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!selectedTrack) {
                statusEl.textContent = t("music.status.pick_first", "Pick a song from the search results first.");
                return;
            }
            statusEl.textContent = t("music.status.sending", "Sending...");
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
                    statusEl.textContent = t("music.status.added", "Added! Thanks for the suggestion.");
                    selectedTrack = null;
                    selectedEl.innerHTML = "";
                    nameInput.value = "";

                    if (data.delete_token) {
                        rememberMySuggestion(data.key, data.delete_token);
                    }

                    // Insert locally instead of re-fetching -- see the comment
                    // note above about KV's eventual consistency.
                    if (listEl) {
                        const emptyMsg = listEl.querySelector(".suggest-empty");
                        if (emptyMsg) listEl.innerHTML = "";
                        const adminKey = localStorage.getItem("admin-key");
                        listEl.insertAdjacentHTML("afterbegin", suggestionItemHtml(data, adminKey));
                        wireSuggestionItem(listEl.firstElementChild, adminKey, data);
                    }
                } else {
                    statusEl.textContent = t("music.status.error", "Something went wrong — try again?");
                }
            } catch {
                statusEl.textContent = t("music.status.error", "Something went wrong — try again?");
            }
        });
    }

    async function loadSuggestions() {
        if (!listEl) return;
        const adminKey = localStorage.getItem("admin-key");
        const countEl = document.getElementById("suggest-count");
        try {
            const res = await fetch(`${API_BASE}/suggestions`);
            const data = await res.json();
            const suggestions = data.suggestions || [];
            if (countEl) {
                const total = typeof data.total === "number" ? data.total : suggestions.length;
                countEl.textContent = total === 1 ? "1 song suggested so far" : `${total} songs suggested so far`;
            }
            if (!suggestions.length) {
                listEl.innerHTML = "<p class=\"suggest-empty\">No suggestions yet — be the first.</p>";
                return;
            }
            listEl.innerHTML = suggestions.map((s) => suggestionItemHtml(s, adminKey)).join("");
            listEl.querySelectorAll(".suggestion-item").forEach((li, i) => wireSuggestionItem(li, adminKey, suggestions[i]));
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
