// =============================================================================
// ГЛАВНЫЙ МОДУЛЬ (js/main.js)
// =============================================================================

const notesContainer = document.getElementById("notes-container");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const btnClearSearch = document.getElementById("btn-clear-search");
const btnFabNew = document.getElementById("btn-fab-new");

// Кнопка переключения сетки (1 или 2 колонки)
const btnToggleGrid = document.getElementById("btn-toggle-grid");

// Модалка настроек
const settingsModal = document.getElementById("settings-modal");
const btnOpenSettings = document.getElementById("btn-open-settings");
const btnCloseSettings = document.getElementById("btn-close-settings");
const settingToggleChips = document.getElementById("setting-toggle-chips");
const settingGridCols = document.getElementById("setting-grid-cols");
const btnClearTrashAll = document.getElementById("btn-clear-trash-all");

// Лайтбокс
const lightboxModal = document.getElementById("lightbox-modal");
const lightboxImg = document.getElementById("lightbox-img");
const btnLightboxDownload = document.getElementById("btn-lightbox-download");
const btnLightboxClose = document.getElementById("btn-lightbox-close");

let activeLightboxUrl = "";
let activeLightboxName = "photo.jpg";

function initApp() {
  initFirebase();
  initFoldersModule();
  initEditorModule();
  applySettingsUI();
  setupMainEvents();
  registerPWA();

  if (window.AppState.isFirebaseMode) {
    listenToNotes();
  } else {
    const saved = localStorage.getItem("keep_notes_local");
    window.AppState.notes = saved ? JSON.parse(saved) : [];
    renderFeed();
  }
}

// Применение настроек UI
function applySettingsUI() {
  if (notesContainer) {
    if (window.AppSettings.columns === "1") {
      notesContainer.classList.add("single-column");
    } else {
      notesContainer.classList.remove("single-column");
    }
  }

  const track = document.getElementById("folders-chip-track");
  if (track) {
    track.classList.toggle("hidden", !window.AppSettings.showFolderChips);
  }

  if (settingToggleChips) settingToggleChips.checked = window.AppSettings.showFolderChips;
  if (settingGridCols) settingGridCols.value = window.AppSettings.columns;
}
window.applySettingsUI = applySettingsUI;

// Слушатель заметок в Firestore
function listenToNotes() {
  window.AppState.db.collection("notes").orderBy("createdAt", "desc").onSnapshot(
    (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      window.AppState.notes = list;
      // Сохраняем в локальный офлайн-кэш на телефоне
      localStorage.setItem("keep_notes_local", JSON.stringify(list));
      renderFeed();
    },
    (err) => console.warn("Ошибка получения заметок:", err)
  );
}

// Рендеринг карточек на главном экране
function renderFeed() {
  if (!notesContainer) return;

  const currentFolder = window.AppState.activeFolderId;

  // 1. Фильтрация
  let list = window.AppState.notes.filter((n) => {
    if (currentFolder === "trash") return !!n.inTrash;
    if (n.inTrash) return false;

    if (currentFolder === "archive") return !!n.isArchived;
    if (n.isArchived) return false;

    if (currentFolder === "all") return true;
    return n.folderId === currentFolder;
  });

  // 2. Поиск
  if (window.AppState.searchQuery) {
    const q = window.AppState.searchQuery.toLowerCase();
    list = list.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.text && n.text.toLowerCase().includes(q)) ||
        (n.attachment?.name && n.attachment.name.toLowerCase().includes(q))
    );
  }

  notesContainer.innerHTML = "";

  if (list.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  // Отрисовка карточек
  list.forEach((note) => {
    const card = document.createElement("div");
    card.className = `note-card ${note.completed ? "is-completed" : ""}`;

    // Подключение жестов (свайп в архив + долгое нажатие для удаления)
    window.CardGestures?.attach(card, note.id);

    // Тап по карточке открывает Экран 2 (Редактор)
    card.onclick = () => window.AppRouter.goToEditor(note.id);

    // Превью фото
    if (note.attachment?.type === "image" && note.attachment.url) {
      const img = document.createElement("img");
      img.className = "card-thumb-image";
      img.src = note.attachment.url;
      img.loading = "lazy";
      img.alt = note.attachment.name || "Фото";
      img.onclick = (e) => {
        e.stopPropagation();
        openLightbox(note.attachment.url, note.attachment.name);
      };
      card.appendChild(img);
    }

    const content = document.createElement("div");
    content.className = "card-content";

    // Бейдж папки
    if (note.folderId) {
      const folder = window.AppState.folders.find((f) => f.id === note.folderId);
      if (folder) {
        const badge = document.createElement("span");
        badge.className = "card-badge";
        badge.textContent = `📁 ${folder.name}`;
        content.appendChild(badge);
      }
    }

    // Заголовок
    if (note.title) {
      const h3 = document.createElement("h3");
      h3.className = "card-title";
      h3.textContent = note.title;
      content.appendChild(h3);
    }

    // Текст заметки
    if (note.text) {
      const p = document.createElement("p");
      p.className = "card-snippet";
      p.textContent = note.text;
      content.appendChild(p);
    }

    // Интерактивный список дел (Чекбокс-строки на карточке)
    if (Array.isArray(note.checklist) && note.checklist.length > 0) {
      const checkWrap = document.createElement("div");
      checkWrap.className = "card-checklist-preview";

      note.checklist.slice(0, 4).forEach((item) => {
        const row = document.createElement("div");
        row.className = `card-check-row ${item.completed ? "is-done" : ""}`;

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "card-row-cb";
        cb.checked = !!item.completed;
        cb.onclick = (e) => {
          e.stopPropagation();
          toggleChecklistItem(note.id, item.id);
        };

        const label = document.createElement("span");
        label.className = "card-row-text";
        label.textContent = item.text || "Пункт";

        row.appendChild(cb);
        row.appendChild(label);
        checkWrap.appendChild(row);
      });

      if (note.checklist.length > 4) {
        const more = document.createElement("span");
        more.className = "card-more-items";
        more.textContent = `+ ещё ${note.checklist.length - 4}`;
        checkWrap.appendChild(more);
      }
      content.appendChild(checkWrap);
    }

    // Аудио бейдж
    if (note.attachment?.type === "audio") {
      const tag = document.createElement("div");
      tag.className = "card-file-tag";
      tag.innerHTML = `<span>🎵</span> <span>Голосовая заметка</span>`;
      content.appendChild(tag);
    }

    // Файл бейдж
    if (note.attachment?.type === "file") {
      const tag = document.createElement("div");
      tag.className = "card-file-tag";
      tag.innerHTML = `<span>📦</span> <span>${note.attachment.name}</span>`;
      content.appendChild(tag);
    }

    // Нижняя строка карточки
    const bottomRow = document.createElement("div");
    bottomRow.className = "card-bottom-row";

    const dateSpan = document.createElement("span");
    dateSpan.className = "card-date";
    dateSpan.textContent = formatNoteDate(note.createdAt);
    bottomRow.appendChild(dateSpan);

    if (currentFolder !== "trash") {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "card-checkbox";
      cb.checked = !!note.completed;
      cb.title = "Выполнено";
      cb.onclick = (e) => {
        e.stopPropagation();
        toggleComplete(note.id, !note.completed);
      };
      bottomRow.appendChild(cb);
    }

    content.appendChild(bottomRow);
    card.appendChild(content);
    notesContainer.appendChild(card);
  });
}

function formatNoteDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// Быстрое переключение пункта чек-листа прямо на карточке
async function toggleChecklistItem(noteId, itemId) {
  const note = window.AppState.notes.find((n) => n.id === noteId);
  if (!note || !Array.isArray(note.checklist)) return;

  const updatedChecklist = note.checklist.map((i) =>
    i.id === itemId ? { ...i, completed: !i.completed } : i
  );

  if (window.AppState.isFirebaseMode) {
    await window.AppState.db.collection("notes").doc(noteId).update({ checklist: updatedChecklist });
  } else {
    note.checklist = updatedChecklist;
    localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    renderFeed();
  }
}

// Отправка в архив / из архива
async function toggleArchiveNote(noteId) {
  const note = window.AppState.notes.find((n) => n.id === noteId);
  if (!note) return;
  const newArchived = !note.isArchived;

  if (window.AppState.isFirebaseMode) {
    await window.AppState.db.collection("notes").doc(noteId).update({ isArchived: newArchived });
  } else {
    note.isArchived = newArchived;
    localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    renderFeed();
  }
}
window.toggleArchiveNote = toggleArchiveNote;

// Быстрое удаление
async function deleteNoteDirectly(noteId) {
  if (window.AppState.isFirebaseMode) {
    await window.AppState.db.collection("notes").doc(noteId).update({ inTrash: true });
  } else {
    window.AppState.notes = window.AppState.notes.map((n) =>
      n.id === noteId ? { ...n, inTrash: true } : n
    );
    localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    renderFeed();
  }
}
window.deleteNoteDirectly = deleteNoteDirectly;

// Переключение выполненности
async function toggleComplete(noteId, newCompleted) {
  if (window.AppState.isFirebaseMode) {
    await window.AppState.db.collection("notes").doc(noteId).update({ completed: newCompleted });
  } else {
    window.AppState.notes = window.AppState.notes.map((n) =>
      n.id === noteId ? { ...n, completed: newCompleted } : n
    );
    localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    renderFeed();
  }
}

// Лайтбокс
function openLightbox(url, name = "photo.jpg") {
  activeLightboxUrl = url;
  activeLightboxName = name || "photo.jpg";
  lightboxImg.src = url;
  lightboxModal.classList.remove("hidden");
}

function closeLightbox() {
  lightboxModal.classList.add("hidden");
  lightboxImg.src = "";
  activeLightboxUrl = "";
}

function downloadPhoto() {
  if (!activeLightboxUrl) return;
  const a = document.createElement("a");
  a.href = activeLightboxUrl;
  a.download = activeLightboxName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// PWA регистрация
function registerPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function setupMainEvents() {
  // Нажатие на FAB (+) открывает чистый Экран 2 под большой палец
  btnFabNew?.addEventListener("click", () => {
    window.AppRouter.goToEditor(null);
  });

  // Переключение сетки 1 или 2 колонки
  btnToggleGrid?.addEventListener("click", () => {
    window.AppSettings.columns = window.AppSettings.columns === "2" ? "1" : "2";
    window.AppSettings.save();
  });

  // Поиск
  searchInput?.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    window.AppState.searchQuery = val;
    btnClearSearch.classList.toggle("hidden", !val);
    renderFeed();
  });

  btnClearSearch?.addEventListener("click", () => {
    searchInput.value = "";
    window.AppState.searchQuery = "";
    btnClearSearch.classList.add("hidden");
    renderFeed();
  });

  // Настройки
  btnOpenSettings?.addEventListener("click", () => settingsModal?.classList.remove("hidden"));
  btnCloseSettings?.addEventListener("click", () => settingsModal?.classList.add("hidden"));
  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.classList.add("hidden");
  });

  settingToggleChips?.addEventListener("change", (e) => {
    window.AppSettings.showFolderChips = e.target.checked;
    window.AppSettings.save();
  });

  settingGridCols?.addEventListener("change", (e) => {
    window.AppSettings.columns = e.target.value;
    window.AppSettings.save();
  });

  btnClearTrashAll?.addEventListener("click", async () => {
    if (!confirm("Очистить корзину полностью? Заметки будут удалены навсегда.")) return;
    const trashNotes = window.AppState.notes.filter((n) => n.inTrash);
    for (let t of trashNotes) {
      if (window.AppState.isFirebaseMode) {
        await window.AppState.db.collection("notes").doc(t.id).delete();
      }
    }
    if (!window.AppState.isFirebaseMode) {
      window.AppState.notes = window.AppState.notes.filter((n) => !n.inTrash);
      localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
      renderFeed();
    }
    alert("Корзина очищена!");
  });

  // Лайтбокс
  btnLightboxClose?.addEventListener("click", closeLightbox);
  btnLightboxDownload?.addEventListener("click", downloadPhoto);
  lightboxModal?.addEventListener("click", (e) => {
    if (e.target === lightboxModal) closeLightbox();
  });
}

window.renderFeed = renderFeed;
window.openLightbox = openLightbox;

document.addEventListener("DOMContentLoaded", initApp);
