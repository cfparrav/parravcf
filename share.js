// Share button: opens the native share sheet where supported (mobile Safari/Chrome),
// falls back to copying the link on desktop browsers that don't support it.
//
// Includes the page's og:image as a shareable file when possible -- targets like
// Instagram Stories need an actual image to put in the background, a plain
// link/text share just leaves them blank.

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("share-button");
    if (!btn) return;

    const originalLabel = btn.textContent;

    async function getShareImageFile() {
        const imageUrl = document.querySelector('meta[property="og:image"]')?.content;
        if (!imageUrl) return null;
        try {
            const res = await fetch(imageUrl);
            if (!res.ok) return null;
            const blob = await res.blob();
            const ext = imageUrl.split(".").pop().split("?")[0];
            const file = new File([blob], `share.${ext}`, { type: blob.type });
            if (navigator.canShare && !navigator.canShare({ files: [file] })) return null;
            return file;
        } catch {
            return null;
        }
    }

    btn.addEventListener("click", async () => {
        const shareData = {
            title: document.title,
            text: document.querySelector('meta[property="og:description"]')?.content || "",
            url: window.location.href,
        };

        if (navigator.share) {
            const imageFile = await getShareImageFile();
            if (imageFile) shareData.files = [imageFile];

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
