// =============================================================================
// ГЛАВНЫЙ МОДУЛЬ (js/main.js)
// =============================================================================

const notesContainer = document.getElementById("notes-container");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const btnClearSearch = document.getElementById("btn-clear-search");
const btnFabNew = document.getElementById("btn-fab-new");

// Лайтбокс просмотра картинок
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
  setupMainEvents();

  if (window.AppState.isFirebaseMode) {
    listenToNotes();
  } else {
    const saved = localStorage.getItem("keep_notes_local");
    window.AppState.notes = saved ? JSON.parse(saved) : [];
    renderFeed();
  }
}

// Слушатель Firestore
function listenToNotes() {
  window.AppState.db.collection("notes").orderBy("createdAt", "desc").onSnapshot(
    (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      window.AppState.notes = list;
      renderFeed();
    },
    (err) => console.warn("Ошибка получения заметок:", err)
  );
}

// Рендеринг карточек на Экране 1
function renderFeed() {
  if (!notesContainer) return;

  const isTrashView = window.AppState.activeFolderId === "trash";

  // 1. Фильтрация по папке
  let list = window.AppState.notes.filter((n) => {
    if (isTrashView) return !!n.inTrash;
    if (n.inTrash) return false;
    if (window.AppState.activeFolderId === "all") return true;
    return n.folderId === window.AppState.activeFolderId;
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

  // Отрисовка
  list.forEach((note) => {
    const card = document.createElement("div");
    card.className = `note-card ${note.completed ? "is-completed" : ""}`;

    // Тап по карточке открывает экран редактирования (Экран 2)
    card.onclick = () => window.AppRouter.goToEditor(note.id);

    // Картинка-превью
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

    // Текст заметки (первые 3 строчки)
    if (note.text) {
      const p = document.createElement("p");
      p.className = "card-snippet";
      p.textContent = note.text;
      content.appendChild(p);
    }

    // Аудио
    if (note.attachment?.type === "audio" && note.attachment.url) {
      const audioTag = document.createElement("div");
      audioTag.className = "card-file-tag";
      audioTag.innerHTML = `<span>🎵</span> <span>Голосовая заметка</span>`;
      content.appendChild(audioTag);
    }

    // Файл
    if (note.attachment?.type === "file" && note.attachment.url) {
      const fileTag = document.createElement("div");
      fileTag.className = "card-file-tag";
      fileTag.innerHTML = `<span>📦</span> <span>${note.attachment.name}</span>`;
      content.appendChild(fileTag);
    }

    // Нижняя строка карточки
    const bottomRow = document.createElement("div");
    bottomRow.className = "card-bottom-row";

    // Дата
    const dateSpan = document.createElement("span");
    dateSpan.className = "card-date";
    dateSpan.textContent = formatNoteDate(note.createdAt);
    bottomRow.appendChild(dateSpan);

    // Чекбокс выполнения
    if (!isTrashView) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "card-checkbox";
      cb.checked = !!note.completed;
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

function formatNoteDate(timestamp) {
  if (!timestamp) return "";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// Быстрое переключение выполненности
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

// =============================================================================
// ЛАЙТБОКС (ПРОСМОТР ФОТО И СКАЧИВАНИЕ)
// =============================================================================
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

function setupMainEvents() {
  // Нажатие на FAB (+) открывает чистый Экран 2 под большой палец
  btnFabNew?.addEventListener("click", () => {
    window.AppRouter.goToEditor(null);
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

  // Лайтбокс
  btnLightboxClose?.addEventListener("click", closeLightbox);
  btnLightboxDownload?.addEventListener("click", downloadPhoto);
  lightboxModal?.addEventListener("click", (e) => {
    if (e.target === lightboxModal) closeLightbox();
  });
}

// Экспорт
window.renderFeed = renderFeed;
window.openLightbox = openLightbox;

document.addEventListener("DOMContentLoaded", initApp);
