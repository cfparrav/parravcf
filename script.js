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

// "Fantasy" nav link: injected into .top-nav on every inner page (same
// approach as the random button above) instead of hand-added to every
// page's markup. Points to the interactive fantasy football recap.
document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".top-nav");
    if (!nav) return;

    const inPagesDir = window.location.pathname.includes("/pages/");
    const href = (inPagesDir ? "" : "pages/") + "rayos-x-liga-cfparra.html";

    const link = document.createElement("a");
    link.href = href;
    link.innerHTML =
        '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="6"></ellipse><path d="M6 12h12M9.5 9.5l1 1M9.5 14.5l1-1M14.5 9.5l-1 1M14.5 14.5l-1-1"></path></svg><span>Fantasy</span>';

    const contactLink = nav.querySelector('a[href$="contact.html"]');
    if (contactLink) {
        nav.insertBefore(link, contactLink);
    } else {
        nav.appendChild(link);
    }
});
