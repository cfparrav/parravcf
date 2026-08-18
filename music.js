const RATING_API_BASE = "https://cfparrav-song-suggestions.carlitosfer6.workers.dev";

document.addEventListener("DOMContentLoaded", () => {
    const card = document.getElementById("song-card");
    if (!card || typeof SONGS === "undefined" || SONGS.length === 0) return;

    let lastIndex = -1;

    function pickSong() {
        if (SONGS.length === 1) return SONGS[0];
        let index;
        do {
            index = Math.floor(Math.random() * SONGS.length);
        } while (index === lastIndex);
        lastIndex = index;
        return SONGS[index];
    }

    function renderPrompt() {
        card.innerHTML = `
            <p class="song-prompt">What should I listen to?</p>
            <div class="song-actions">
                <button type="button" id="get-song">Give me a song</button>
            </div>
        `;
        document.getElementById("get-song").addEventListener("click", () => {
            renderSong(pickSong());
        });
    }

    async function fetchArtwork(title, artist) {
        try {
            const term = encodeURIComponent(`${title} ${artist}`);
            const res = await fetch(
                `https://itunes.apple.com/search?term=${term}&entity=song&limit=1`
            );
            if (!res.ok) return null;
            const data = await res.json();
            if (!data.results || data.results.length === 0) return null;
            // Request higher-res artwork than the default 100x100.
            return data.results[0].artworkUrl100.replace(
                "100x100bb",
                "600x600bb"
            );
        } catch (err) {
            return null;
        }
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

    function songCommentsKey(title, artist) {
        return `song:${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;
    }

    // Appends locally rather than re-fetching -- KV writes take a few seconds
    // to become visible to reads, so a re-fetch right after posting often
    // shows the comment as missing even though it saved.
    function appendSongComment(listInner, comment) {
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

    async function loadSongComments(key, listInner) {
        try {
            const res = await fetch(`${RATING_API_BASE}/comments?page=${encodeURIComponent(key)}`);
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

    async function fetchRating(title, artist) {
        try {
            const res = await fetch(
                `${RATING_API_BASE}/rating?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
            );
            if (!res.ok) return { up: 0, down: 0 };
            return await res.json();
        } catch {
            return { up: 0, down: 0 };
        }
    }

    async function submitRating(title, artist, rating) {
        try {
            const res = await fetch(`${RATING_API_BASE}/rate-song`, {
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

    function renderRatingCounts(counts) {
        const el = document.getElementById("song-rating-counts");
        if (el) el.textContent = `👍 ${counts.up} · 👎 ${counts.down}`;
    }

    function renderSong(song) {
        const tagsHtml = song.tags.map((tag) => `<li>${tag}</li>`).join("");

        card.innerHTML = `
            <div class="song-art" id="song-art"></div>
            <h2 class="song-title">${song.title}</h2>
            <p class="song-artist">${song.artist}</p>
            <ul class="song-tags">${tagsHtml}</ul>
            ${song.note ? `<p class="song-note">${song.note}</p>` : ""}
            ${song.review ? `<div class="song-review"><p class="song-review-label">My take</p><p>${song.review}</p></div>` : ""}
            <div class="song-rating">
                <button type="button" id="rate-up" title="I like this one">👍</button>
                <button type="button" id="rate-down" title="Not for me">👎</button>
                <span id="song-rating-counts" class="song-rating-counts"></span>
            </div>
            <div class="song-actions">
                <a href="https://open.spotify.com/search/${encodeURIComponent(song.title + " " + song.artist)}" target="_blank" rel="noopener"><img src="../images/spotify-icon.png" alt="" class="spotify-icon">Listen →</a>
                <button type="button" id="another-song">Another one</button>
            </div>
            <div class="suggestion-comments">
                <button type="button" class="comments-toggle" id="song-comments-toggle">💬 comments</button>
                <div class="suggestion-comments-body" id="song-comments-body" hidden>
                    <div class="suggestion-comments-list" id="song-comments-list"></div>
                    <form class="suggestion-comment-form" id="song-comment-form">
                        <input type="text" class="sc-name" id="song-comment-name" placeholder="name (optional)">
                        <input type="text" class="sc-msg" id="song-comment-msg" placeholder="say something about this song...">
                        <button type="submit">Post</button>
                    </form>
                </div>
            </div>
        `;

        document.getElementById("another-song").addEventListener("click", () => {
            renderSong(pickSong());
        });

        // Fill in artwork once it arrives, without blocking the rest of the card.
        fetchArtwork(song.title, song.artist).then((url) => {
            const artEl = document.getElementById("song-art");
            if (url && artEl) {
                artEl.innerHTML = `<img src="${url}" alt="${song.title} album art">`;
            }
        });

        // Load current tally and wire up voting.
        fetchRating(song.title, song.artist).then(renderRatingCounts);

        const upBtn = document.getElementById("rate-up");
        const downBtn = document.getElementById("rate-down");
        let voted = false;

        function castVote(rating) {
            if (voted) return;
            voted = true;
            upBtn.disabled = true;
            downBtn.disabled = true;
            submitRating(song.title, song.artist, rating).then((counts) => {
                if (counts) renderRatingCounts(counts);
            });
        }

        upBtn.addEventListener("click", () => castVote("up"));
        downBtn.addEventListener("click", () => castVote("down"));

        // Comments, scoped per song (title + artist) rather than per suggestion.
        const commentsKey = songCommentsKey(song.title, song.artist);
        const commentsToggle = document.getElementById("song-comments-toggle");
        const commentsBody = document.getElementById("song-comments-body");
        const commentsList = document.getElementById("song-comments-list");
        const commentForm = document.getElementById("song-comment-form");

        commentsToggle.addEventListener("click", () => {
            if (commentsBody.hasAttribute("hidden")) {
                commentsBody.removeAttribute("hidden");
                commentsToggle.textContent = "💬 hide comments";
                if (!commentsList.dataset.loaded) {
                    commentsList.dataset.loaded = "1";
                    loadSongComments(commentsKey, commentsList);
                }
            } else {
                commentsBody.setAttribute("hidden", "");
                commentsToggle.textContent = "💬 comments";
            }
        });

        commentForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const commentNameInput = document.getElementById("song-comment-name");
            const commentMsgInput = document.getElementById("song-comment-msg");
            const message = commentMsgInput.value.trim();
            if (!message) return;

            const submitBtn = commentForm.querySelector("button");
            submitBtn.disabled = true;
            try {
                const res = await fetch(`${RATING_API_BASE}/comment`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ page: commentsKey, name: commentNameInput.value, message }),
                });
                const data = await res.json();
                if (data.success) {
                    appendSongComment(commentsList, {
                        name: (commentNameInput.value && commentNameInput.value.trim()) || "Anonymous",
                        message,
                        posted_at: new Date().toISOString(),
                    });
                    commentNameInput.value = "";
                    commentMsgInput.value = "";
                }
            } catch {
                // silently ignore — the form stays filled so the visitor can retry
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    renderPrompt();
});
