// Share button: opens the native share sheet where supported (mobile Safari/Chrome),
// falls back to copying the link on desktop browsers that don't support it.
//
// Instead of sharing the bare og:image, this draws a branded card on canvas
// (photo + title + domain) and shares that. Reason: targets like Instagram
// Stories can't be handed a clickable link from the Web Share API -- that's
// an Instagram-app-only feature -- so baking the title/domain into the image
// itself is the only way the branding survives no matter which app it lands in.

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("share-button");
    if (!btn) return;

    const originalLabel = btn.textContent;
    const SITE_DOMAIN = "parravcf.com";
    const CARD_W = 1080;
    const CARD_H = 1350;
    const PHOTO_H = 900;

    function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        const words = text.split(" ");
        const lines = [];
        let line = "";
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);

        const shown = lines.slice(0, maxLines);
        if (lines.length > maxLines) {
            let last = shown[maxLines - 1];
            while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) {
                last = last.slice(0, -1);
            }
            shown[maxLines - 1] = `${last}…`;
        }
        shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
        return shown.length * lineHeight;
    }

    async function buildShareCard() {
        const imageUrl = document.querySelector('meta[property="og:image"]')?.content;
        const title = document.querySelector("h1")?.textContent.trim() || document.title;
        if (!imageUrl) return null;

        try {
            await Promise.all([
                document.fonts.load('700 58px Bitter'),
                document.fonts.load('italic 400 36px Bitter'),
            ]);

            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = imageUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const canvas = document.createElement("canvas");
            canvas.width = CARD_W;
            canvas.height = CARD_H;
            const ctx = canvas.getContext("2d");

            const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#fbf9f4";
            const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#262420";
            const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#8a8478";

            ctx.fillStyle = paper;
            ctx.fillRect(0, 0, CARD_W, CARD_H);

            const scale = Math.max(CARD_W / img.width, PHOTO_H / img.height);
            const sw = CARD_W / scale;
            const sh = PHOTO_H / scale;
            const sx = (img.width - sw) / 2;
            const sy = (img.height - sh) / 2;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CARD_W, PHOTO_H);

            ctx.fillStyle = ink;
            ctx.textBaseline = "top";
            ctx.font = "700 58px Bitter, Georgia, serif";
            const titleHeight = wrapText(ctx, title, 60, PHOTO_H + 55, CARD_W - 120, 68, 3);

            ctx.fillStyle = muted;
            ctx.font = "italic 400 36px Bitter, Georgia, serif";
            ctx.fillText(SITE_DOMAIN, 60, PHOTO_H + 55 + titleHeight + 20);

            return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        } catch {
            return null;
        }
    }

    async function getShareFile() {
        const cardBlob = await buildShareCard();
        if (cardBlob) {
            const file = new File([cardBlob], "share-card.png", { type: "image/png" });
            if (!navigator.canShare || navigator.canShare({ files: [file] })) return file;
        }

        // Fall back to the raw og:image if the canvas card couldn't be built.
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
            const imageFile = await getShareFile();
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
