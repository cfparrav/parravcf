// Fade + slide up elements marked with .reveal as they scroll into view.
// Respects prefers-reduced-motion and falls back gracefully if
// IntersectionObserver isn't supported.

document.addEventListener("DOMContentLoaded", () => {
    const revealEls = document.querySelectorAll(".reveal");
    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
        revealEls.forEach((el) => el.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0 }
    );

    revealEls.forEach((el) => observer.observe(el));
});

// "Take me somewhere random" button: injected into .header-actions on every
// page (rather than hand-added to every page's markup) since script.js is
// already loaded everywhere. Picks from journal/travel posts, excluding
// whichever one you're currently on.
document.addEventListener("DOMContentLoaded", () => {
    const actions = document.querySelector(".header-actions");
    if (!actions) return;

    const destinations = [
        "life-lately.html",
        "why-did-i-make-this.html",
        "spain-march-2026.html",
        "mexico-city-trip-2026.html",
    ];

    const inPagesDir = window.location.pathname.includes("/pages/");
    const prefix = inPagesDir ? "" : "pages/";
    const currentFile = window.location.pathname.split("/").pop();

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "random-button";
    btn.className = "theme-toggle random-button";
    btn.setAttribute("aria-label", "Take me somewhere random");
    btn.title = "Take me somewhere random";
    btn.textContent = "🎲";

    btn.addEventListener("click", () => {
        const options = destinations.filter((d) => d !== currentFile);
        const pick = options[Math.floor(Math.random() * options.length)];
        window.location.href = prefix + pick;
    });

    const langToggle = document.getElementById("lang-toggle");
    if (langToggle) {
        actions.insertBefore(btn, langToggle);
    } else {
        actions.appendChild(btn);
    }
});
