// Year pill buttons filter which trip-month timelines are shown.

document.addEventListener("DOMContentLoaded", () => {
    const buttons = document.querySelectorAll(".year-btn");
    const months = document.querySelectorAll(".trip-month");
    if (!buttons.length) return;

    function showYear(year) {
        months.forEach((section) => {
            section.hidden = section.dataset.year !== year;
        });
        buttons.forEach((btn) => {
            btn.classList.toggle("is-active", btn.dataset.year === year);
        });
    }

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => showYear(btn.dataset.year));
    });

    showYear(buttons[0].dataset.year);
});
