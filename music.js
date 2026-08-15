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
                <a href="https://open.spotify.com/search/${encodeURIComponent(song.title + " " + song.artist)}" target="_blank" rel="noopener">Listen →</a>
                <button type="button" id="another-song">Another one</button>
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
    }

    renderPrompt();
});
