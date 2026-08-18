// Tic-tac-toe against an unbeatable minimax bot playing as "me" (O).
// Player is always X and always moves first.

document.addEventListener("DOMContentLoaded", () => {
    const boardEl = document.getElementById("ttt-board");
    const statusEl = document.getElementById("ttt-status");
    const restartBtn = document.getElementById("ttt-restart");
    if (!boardEl) return;

    const WINS = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6],
    ];

    let board = Array(9).fill(null);
    let active = true;

    function checkWinner(b) {
        for (const [a, c, d] of WINS) {
            if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
        }
        return b.every((cell) => cell) ? "draw" : null;
    }

    function minimax(b, depth, isMaximizing) {
        const winner = checkWinner(b);
        if (winner === "O") return 10 - depth;
        if (winner === "X") return depth - 10;
        if (winner === "draw") return 0;

        if (isMaximizing) {
            let best = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (b[i]) continue;
                b[i] = "O";
                best = Math.max(best, minimax(b, depth + 1, false));
                b[i] = null;
            }
            return best;
        }
        let best = Infinity;
        for (let i = 0; i < 9; i++) {
            if (b[i]) continue;
            b[i] = "X";
            best = Math.min(best, minimax(b, depth + 1, true));
            b[i] = null;
        }
        return best;
    }

    function bestMove(b) {
        let bestScore = -Infinity;
        let move = null;
        for (let i = 0; i < 9; i++) {
            if (b[i]) continue;
            b[i] = "O";
            const score = minimax(b, 0, false);
            b[i] = null;
            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
        return move;
    }

    function render() {
        boardEl.querySelectorAll(".ttt-cell").forEach((cell, i) => {
            cell.textContent = board[i] || "";
            cell.disabled = !active || !!board[i];
        });
    }

    function endGame(winner) {
        active = false;
        render();
        if (winner === "O") {
            statusEl.textContent = "Called it. I don't lose 😏";
        } else if (winner === "X") {
            statusEl.textContent = "Wait... how?! Well played.";
        } else {
            statusEl.textContent = "A draw. Respectable.";
        }
    }

    function botMove() {
        statusEl.textContent = "Thinking...";
        setTimeout(() => {
            const move = bestMove(board);
            if (move === null) return;
            board[move] = "O";
            const winner = checkWinner(board);
            if (winner) {
                endGame(winner);
            } else {
                statusEl.textContent = "Your move.";
                render();
            }
        }, 400);
    }

    function handleCellClick(e) {
        const i = Number(e.currentTarget.dataset.index);
        if (!active || board[i]) return;

        board[i] = "X";
        const winner = checkWinner(board);
        render();
        if (winner) {
            endGame(winner);
            return;
        }
        botMove();
    }

    function restart() {
        board = Array(9).fill(null);
        active = true;
        statusEl.textContent = "Your move.";
        render();
    }

    boardEl.querySelectorAll(".ttt-cell").forEach((cell) => {
        cell.addEventListener("click", handleCellClick);
    });
    if (restartBtn) restartBtn.addEventListener("click", restart);

    render();
});
