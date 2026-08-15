// Click a gallery thumbnail to view it enlarged in an overlay.
// Click the overlay, hit Escape, or press the close button to dismiss.

document.addEventListener("DOMContentLoaded", () => {
    const thumbs = document.querySelectorAll(".meme-gallery img, .gallery-item img");
    if (!thumbs.length) return;

    const overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";

    const fullImg = document.createElement("img");
    overlay.appendChild(fullImg);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "lightbox-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "✕";
    overlay.appendChild(closeBtn);

    document.body.appendChild(overlay);

    function open(thumb) {
        fullImg.src = thumb.src;
        fullImg.alt = thumb.alt;
        overlay.classList.add("is-open");
    }

    function close() {
        overlay.classList.remove("is-open");
        fullImg.src = "";
    }

    thumbs.forEach((thumb) => {
        thumb.addEventListener("click", () => open(thumb));
    });

    overlay.addEventListener("click", close);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
    });
});
