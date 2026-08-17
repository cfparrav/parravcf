// Comments widget for journal/photo pages.
// Talks to the same Cloudflare Worker as the song suggestions (see /cloudflare-worker).

const COMMENTS_API_BASE = "https://cfparrav-song-suggestions.carlitosfer6.workers.dev";

document.addEventListener("DOMContentLoaded", () => {
    const section = document.querySelector(".comments[data-page-id]");
    if (!section) return;

    const pageId = section.dataset.pageId;
    const nameInput = document.getElementById("name");
    const msgInput = document.getElementById("msg");
    const postBtn = document.getElementById("post-comment");
    const statusEl = document.getElementById("comment-status");
    const listEl = document.getElementById("comments-list");

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function formatWhen(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    function renderComments(comments) {
        if (!listEl) return;
        if (!comments.length) {
            listEl.innerHTML = "";
            return;
        }
        listEl.innerHTML = comments
            .map(
                (c) => `
                <div class="comment">
                    <span class="who">${escapeHtml(c.name)}</span>
                    <span class="when">${formatWhen(c.posted_at)}</span>
                    <p>${escapeHtml(c.message)}</p>
                </div>`
            )
            .join("");
    }

    async function loadComments() {
        if (!listEl) return;
        try {
            const res = await fetch(`${COMMENTS_API_BASE}/comments?page=${encodeURIComponent(pageId)}`);
            const data = await res.json();
            renderComments(data.comments || []);
        } catch {
            listEl.innerHTML = "";
        }
    }

    if (postBtn) {
        postBtn.addEventListener("click", async () => {
            const message = msgInput.value.trim();
            if (!message) {
                if (statusEl) statusEl.textContent = "Write something first.";
                return;
            }
            if (statusEl) statusEl.textContent = "Posting...";
            postBtn.disabled = true;
            try {
                const res = await fetch(`${COMMENTS_API_BASE}/comment`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        page: pageId,
                        name: nameInput.value,
                        message,
                    }),
                });
                const data = await res.json();
                if (data.success) {
                    if (statusEl) statusEl.textContent = "Posted. Thanks!";
                    nameInput.value = "";
                    msgInput.value = "";
                    loadComments();
                } else if (statusEl) {
                    statusEl.textContent = "Something went wrong — try again?";
                }
            } catch {
                if (statusEl) statusEl.textContent = "Something went wrong — try again?";
            } finally {
                postBtn.disabled = false;
            }
        });
    }

    loadComments();
});
