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

// "Sports" nav link: injected into .top-nav on every inner page (same
// approach as the random button above) instead of hand-added to every
// page's markup. Points to the sports hub (fantasy leagues, survivor, picks).
document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector(".top-nav");
    if (!nav) return;

    const inPagesDir = window.location.pathname.includes("/pages/");
    const href = (inPagesDir ? "" : "pages/") + "deportes.html";

    const link = document.createElement("a");
    link.href = href;
    link.innerHTML =
        '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="6"></ellipse><path d="M6 12h12M9.5 9.5l1 1M9.5 14.5l1-1M14.5 9.5l-1 1M14.5 14.5l-1-1"></path></svg><span>Sports</span>';

    const contactLink = nav.querySelector('a[href$="contact.html"]');
    if (contactLink) {
        nav.insertBefore(link, contactLink);
    } else {
        nav.appendChild(link);
    }
});

// Estimated reading time on article pages: counts the words currently visible
// in the article (so it follows the EN/ES toggle) at ~200 wpm and appends it to
// the post-meta line. Spanish-only posts set data-label-lang="es" on .post-meta.
document.addEventListener("DOMContentLoaded", () => {
    const meta = document.querySelector(".post-meta");
    const article = document.querySelector("main article");
    if (!meta || !article) return;

    const WORDS_PER_MINUTE = 200;
    const LABELS = { en: "min read", es: "min de lectura" };

    const tag = meta.querySelector(".post-tag");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.textContent = "·";
    const time = document.createElement("span");
    time.className = "read-time";
    meta.insertBefore(document.createTextNode(" "), tag);
    meta.insertBefore(dot, tag);
    meta.insertBefore(document.createTextNode(" "), tag);
    meta.insertBefore(time, tag);
    if (tag) meta.insertBefore(document.createTextNode(" "), tag);

    function update(lang) {
        let words = 0;
        article.querySelectorAll("p, h2, h3, li").forEach((el) => {
            if (el.closest("[hidden], .now-playing, figure")) return;
            if (el.matches("li") && el.querySelector("p, h2, h3")) return;
            words += (el.textContent.match(/\S+/g) || []).length;
        });
        const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
        const label = LABELS[meta.dataset.labelLang || lang] || LABELS.en;
        time.textContent = `${minutes} ${label}`;
    }

    update(localStorage.getItem("site-lang") || "en");
    document.addEventListener("i18n:change", (e) => update(e.detail.lang));
});
