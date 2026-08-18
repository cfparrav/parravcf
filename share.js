// Share button: opens the native share sheet where supported (mobile Safari/Chrome),
// falls back to copying the link on desktop browsers that don't support it.

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("share-button");
    if (!btn) return;

    const originalLabel = btn.textContent;

    btn.addEventListener("click", async () => {
        const shareData = {
            title: document.title,
            text: document.querySelector('meta[property="og:description"]')?.content || "",
            url: window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch {
                // Cancelled or failed silently — no error needed, the user just backed out.
            }
            return;
        }

        try {
            await navigator.clipboard.writeText(shareData.url);
            btn.textContent = "Link copied!";
            setTimeout(() => {
                btn.textContent = originalLabel;
            }, 2000);
        } catch {
            btn.textContent = "Couldn't copy — copy from the address bar";
            setTimeout(() => {
                btn.textContent = originalLabel;
            }, 3000);
        }
    });
});
