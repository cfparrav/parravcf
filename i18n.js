// Lightweight EN/ES toggle.
// Elements marked with data-i18n="key" get their text swapped based on
// data/translations.json. Language choice is remembered in localStorage
// so it persists across pages (pages must each load this script with the
// correct relative path to data/translations.json via data-i18n-src).
// On a visitor's very first page load (no stored preference yet), a modal
// asks them to pick English or Spanish before anything renders in a
// specific language.

document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("lang-toggle");
    const root = document.documentElement;
    const jsonPath = root.getAttribute("data-i18n-src") || "data/translations.json";

    const STORAGE_KEY = "site-lang";
    const hasStoredPref = localStorage.getItem(STORAGE_KEY) !== null;
    let lang = localStorage.getItem(STORAGE_KEY) || "en";

    function applyTranslations(dict) {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.getAttribute("data-i18n");
            if (dict[key]) {
                el.textContent = dict[key];
            }
        });
        if (toggleBtn) {
            toggleBtn.textContent = lang === "en" ? "ES" : "EN";
        }
        root.setAttribute("lang", lang === "en" ? "en" : "es");
    }

    function showLangModal(onChoose) {
        const overlay = document.createElement("div");
        overlay.className = "lang-modal-overlay";
        overlay.innerHTML = `
            <div class="lang-modal">
                <p class="lang-modal-text">Read this site in English, or leer en español?</p>
                <div class="lang-modal-buttons">
                    <button type="button" data-lang="en">English</button>
                    <button type="button" data-lang="es">Español</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelectorAll("button[data-lang]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const chosen = btn.getAttribute("data-lang");
                localStorage.setItem(STORAGE_KEY, chosen);
                overlay.remove();
                onChoose(chosen);
            });
        });
    }

    fetch(jsonPath)
        .then((res) => res.json())
        .then((data) => {
            applyTranslations(data[lang] || data.en);

            if (toggleBtn) {
                toggleBtn.addEventListener("click", () => {
                    lang = lang === "en" ? "es" : "en";
                    localStorage.setItem(STORAGE_KEY, lang);
                    applyTranslations(data[lang] || data.en);
                });
            }

            if (!hasStoredPref) {
                showLangModal((chosen) => {
                    lang = chosen;
                    applyTranslations(data[lang] || data.en);
                });
            }
        })
        .catch((err) => {
            console.error("Translation load failed:", err);
        });
});
