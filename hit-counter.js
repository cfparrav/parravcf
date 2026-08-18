// Purely decorative retro hit counter. Not real analytics — just a
// per-browser count stored in localStorage, for the 2013-era aesthetic.

document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("hit-counter-digits");
    if (!el) return;

    const STORAGE_KEY = "hit-counter-count";
    const SEED = 1042;

    let count = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    if (isNaN(count)) count = SEED;
    count += 1;
    localStorage.setItem(STORAGE_KEY, count);

    el.textContent = String(count).padStart(6, "0");
});
