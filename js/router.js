// =============================================================================
// МОДУЛЬ МАРШРУТИЗАЦИИ И ПЕРЕКЛЮЧЕНИЯ ЭКРАНОВ (js/router.js)
// =============================================================================

const screenList = document.getElementById("screen-list");
const screenEditor = document.getElementById("screen-editor");

window.AppRouter = {
  currentScreen: "list",

  // Открыть экран списка заметок (Экран 1)
  goToList(skipAutoSave = false) {
    if (!skipAutoSave && this.currentScreen === "editor") {
      window.saveEditorNow?.();
    }

    this.currentScreen = "list";
    screenEditor.classList.remove("screen-active");
    screenList.classList.add("screen-active");

    window.AppState.editingNoteId = null;
    window.renderFeed?.();
  },

  // Открыть экран редактора (Экран 2)
  goToEditor(noteId = null) {
    this.currentScreen = "editor";
    window.AppState.editingNoteId = noteId;

    // Инициализируем поля редактора перед показом
    window.loadNoteIntoEditor?.(noteId);

    screenList.classList.remove("screen-active");
    screenEditor.classList.add("screen-active");

    // Поддержка системной кнопки "Назад" на телефонах Android / свайпа iOS
    history.pushState({ screen: "editor", noteId: noteId }, "");
  }
};

// Перехват системной кнопки "Назад" на смартфоне
window.addEventListener("popstate", (e) => {
  if (window.AppRouter.currentScreen === "editor") {
    window.AppRouter.goToList();
  }
});
