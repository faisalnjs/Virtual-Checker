// TODO: fix modals

document.addEventListener("keydown", e => {
    const anyDialogOpen = Array.from(document.querySelectorAll("dialog")).some(dialog => dialog.open);
    if (e.ctrlKey) {
        if (e.key == "Enter" && !anyDialogOpen) {
            document.getElementById("submit-button").click();
        }
        if (e.key == "," && !anyDialogOpen) {
            modals["settings"]();
        }
        if (e.key == "." && !anyDialogOpen) {
            modals["history"]();
        }
        if (e.key == "/" && !anyDialogOpen) {
            modals["keybinds"]();
        }
    }
    else if (e.altKey) {
        if (/[1-9]/.test(e.key)) {
            e.preventDefault();
            insertSymbol(uniqueSymbols[parseInt(e.key) - 1]);
        }
    }
});