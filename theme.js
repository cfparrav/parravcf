// Light/dark toggle. Preference is remembered in localStorage so it
// persists across pages. The initial theme is applied by an inline
// script in <head> (before CSS loads) to avoid a flash of the wrong
// theme; this file just wires up the toggle button.

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;

    const STORAGE_KEY = "site-theme";
    const root = document.documentElement;

    function updateButton() {
        const isDark = root.getAttribute("data-theme") === "dark";
        btn.textContent = isDark ? "☀️" : "🌙";
        btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    }

    updateButton();

    btn.addEventListener("click", () => {
        const isDark = root.getAttribute("data-theme") === "dark";
        const next = isDark ? "light" : "dark";
        root.setAttribute("data-theme", next);
        localStorage.setItem(STORAGE_KEY, next);
        updateButton();
    });
});
