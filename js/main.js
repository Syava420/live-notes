// =============================================================================
// ГЛАВНЫЙ МОДУЛЬ (js/main.js)
// =============================================================================

// Элементы
const searchInput = document.getElementById("search-input");
const counterSummary = document.getElementById("counter-summary");
const notesGrid = document.getElementById("notes-grid");
const emptyState = document.getElementById("empty-state");
const filterChips = document.querySelectorAll(".filter-chip");

// Форма создания
const noteCreator = document.getElementById("note-creator");
const creatorTitle = document.getElementById("creator-title");
const creatorText = document.getElementById("creator-text");
const creatorFolderSelect = document.getElementById("creator-folder-select");
const creatorActions = document.getElementById("creator-actions");
const btnCloseCreator = document.getElementById("btn-close-creator");
const btnSaveNote = document.getElementById("btn-save-note");

// Вложения
const inputImage = document.getElementById("input-image");
const inputAudio = document.getElementById("input-audio");
const inputFile = document.getElementById("input-file");
const attachmentPreviewBox = document.getElementById("attachment-preview-box");
const previewImageWrap = document.getElementById("preview-image-wrap");
const previewImage = document.getElementById("preview-image");
const previewAudioWrap = document.getElementById("preview-audio-wrap");
const previewAudio = document.getElementById("preview-audio");
const previewFileWrap = document.getElementById("preview-file-wrap");
const previewFileName = document.getElementById("preview-file-name");
const previewFileSize = document.getElementById("preview-file-size");
const btnRemoveAttachment = document.getElementById("btn-remove-attachment");
const btnRemoveAudio = document.getElementById("btn-remove-audio");
const btnRemoveFile = document.getElementById("btn-remove-file");

// Мобильная кнопка FAB (+)
const mobileFab = document.getElementById("mobile-fab");

let activeTabFilter = "all"; // "all" | "active" | "media"
let selectedFile = null;
let selectedFileType = null;

// Старт приложения
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

// Подписка на коллекцию notes в Firestore
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
    (err) => {
      console.warn("Ошибка получения заметок:", err);
    }
  );
}

// =============================================================================
// ОБРАБОТКА ВЛОЖЕНИЙ ПЕРЕД ОТПРАВКОЙ
// =============================================================================
function handleFileSelect(file, type) {
  if (!file) return;

  selectedFile = file;
  selectedFileType = type;

  expandCreator();
  attachmentPreviewBox.classList.remove("hidden");
  previewImageWrap.classList.add("hidden");
  previewAudioWrap.classList.add("hidden");
  previewFileWrap.classList.add("hidden");

  if (type === "image") {
    previewImage.src = URL.createObjectURL(file);
    previewImageWrap.classList.remove("hidden");
  } else if (type === "audio") {
    previewAudio.src = URL.createObjectURL(file);
    previewAudioWrap.classList.remove("hidden");
  } else {
    previewFileName.textContent = file.name;
    previewFileSize.textContent = formatBytes(file.size);
    previewFileWrap.classList.remove("hidden");
  }
}

function clearAttachment() {
  selectedFile = null;
  selectedFileType = null;
  previewImage.src = "";
  previewAudio.src = "";
  inputImage.value = "";
  inputAudio.value = "";
  inputFile.value = "";
  attachmentPreviewBox.classList.add("hidden");
  previewImageWrap.classList.add("hidden");
  previewAudioWrap.classList.add("hidden");
  previewFileWrap.classList.add("hidden");
}

// Сохранение новой заметки
async function handleCreateNote(e) {
  e?.preventDefault();

  const title = creatorTitle.value.trim();
  const text = creatorText.value.trim();
  const folderId = creatorFolderSelect?.value || "";

  if (!title && !text && !selectedFile) {
    collapseCreator();
    return;
  }

  btnSaveNote.disabled = true;
  btnSaveNote.textContent = "Сохранение...";

  let attachmentData = null;

  if (selectedFile) {
    try {
      const dataUrl = await fileToDataUrl(selectedFile);
      attachmentData = {
        type: selectedFileType,
        name: selectedFile.name,
        size: formatBytes(selectedFile.size),
        url: dataUrl
      };
    } catch (err) {
      console.warn("Файл отменён:", err);
      btnSaveNote.disabled = false;
      btnSaveNote.textContent = "Сохранить";
      return;
    }
  }

  const payload = {
    title: title,
    text: text,
    folderId: folderId,
    completed: false,
    inTrash: false,
    attachment: attachmentData,
    createdAt: window.AppState.isFirebaseMode
      ? firebase.firestore.FieldValue.serverTimestamp()
      : Date.now()
  };

  if (window.AppState.isFirebaseMode) {
    try {
      await window.AppState.db.collection("notes").add(payload);
    } catch (err) {
      alert("Ошибка сохранения: " + err.message);
    }
  } else {
    payload.id = "local-" + Date.now();
    window.AppState.notes.unshift(payload);
    localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    renderFeed();
  }

  // Очистка формы
  creatorTitle.value = "";
  creatorText.value = "";
  creatorText.style.height = "auto";
  if (creatorFolderSelect) creatorFolderSelect.value = "";
  clearAttachment();
  btnSaveNote.disabled = false;
  btnSaveNote.textContent = "Сохранить";
  collapseCreator();
}

// Быстрое переключение галочки (выполнено)
async function handleToggleComplete(id, currentCompleted, e) {
  e.stopPropagation();

  if (window.AppState.isFirebaseMode) {
    await window.AppState.db.collection("notes").doc(id).update({ completed: !currentCompleted });
  } else {
    window.AppState.notes = window.AppState.notes.map((n) =>
      n.id === id ? { ...n, completed: !currentCompleted } : n
    );
    localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    renderFeed();
  }
}

// Быстрое удаление (в корзину или окончательно)
async function handleDeleteNote(id, inTrash, e) {
  e.stopPropagation();

  if (inTrash) {
    if (!confirm("Удалить заметку навсегда?")) return;
    if (window.AppState.isFirebaseMode) {
      await window.AppState.db.collection("notes").doc(id).delete();
    } else {
      window.AppState.notes = window.AppState.notes.filter((n) => n.id !== id);
      localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
      renderFeed();
    }
  } else {
    // Мягкое перемещение в корзину
    if (window.AppState.isFirebaseMode) {
      await window.AppState.db.collection("notes").doc(id).update({ inTrash: true });
    } else {
      window.AppState.notes = window.AppState.notes.map((n) =>
        n.id === id ? { ...n, inTrash: true } : n
      );
      localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
      renderFeed();
    }
  }
}

// =============================================================================
// РЕНДЕРИНГ КАРТОЧЕК В СЕТКЕ
// =============================================================================
function renderFeed() {
  const isTrashView = window.AppState.activeFolderId === "trash";

  // 1. Фильтрация по папке / корзине
  let filtered = window.AppState.notes.filter((n) => {
    if (isTrashView) {
      return !!n.inTrash;
    }
    if (n.inTrash) return false;

    if (window.AppState.activeFolderId === "all") return true;
    return n.folderId === window.AppState.activeFolderId;
  });

  // 2. Вкладки (Все, Активные, С файлами)
  if (!isTrashView) {
    if (activeTabFilter === "active") filtered = filtered.filter((n) => !n.completed);
    if (activeTabFilter === "media") filtered = filtered.filter((n) => !!n.attachment);
  }

  // 3. Поиск
  if (window.AppState.searchQuery) {
    const q = window.AppState.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.text && n.text.toLowerCase().includes(q)) ||
        (n.attachment?.name && n.attachment.name.toLowerCase().includes(q))
    );
  }

  // Обновление счетчика
  const activeCount = filtered.filter((n) => !n.completed).length;
  if (isTrashView) {
    counterSummary.textContent = `Корзина: ${filtered.length} заметок`;
  } else {
    counterSummary.textContent = `Заметок: ${filtered.length} (активных: ${activeCount})`;
  }

  notesGrid.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  // Отрисовка карточек
  filtered.forEach((note) => {
    const card = document.createElement("div");
    card.className = `note-card ${note.completed ? "is-completed" : ""}`;
    card.onclick = () => openEditModal(note.id); // Клик по карточке открывает редактирование!

    // Картинка (если есть)
    if (note.attachment?.type === "image" && note.attachment.url) {
      const img = document.createElement("img");
      img.className = "card-media-image";
      img.src = note.attachment.url;
      img.loading = "lazy";
      img.alt = note.attachment.name || "Картинка";
      img.onclick = (e) => {
        e.stopPropagation();
        openLightbox(note.attachment.url, note.attachment.name);
      };
      card.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "card-body";

    // Бейдж папки
    if (note.folderId) {
      const folderObj = window.AppState.folders.find((f) => f.id === note.folderId);
      if (folderObj) {
        const badge = document.createElement("span");
        badge.className = "card-folder-badge";
        badge.textContent = `📁 ${folderObj.name}`;
        body.appendChild(badge);
      }
    }

    // Заголовок
    if (note.title) {
      const h3 = document.createElement("h3");
      h3.className = "card-title";
      h3.textContent = note.title;
      body.appendChild(h3);
    }

    // Текст заметки
    if (note.text) {
      const p = document.createElement("p");
      p.className = "card-text";
      p.textContent = note.text;
      body.appendChild(p);
    }

    // Аудиоплеер
    if (note.attachment?.type === "audio" && note.attachment.url) {
      const audio = document.createElement("audio");
      audio.className = "card-audio";
      audio.controls = true;
      audio.src = note.attachment.url;
      audio.onclick = (e) => e.stopPropagation();
      body.appendChild(audio);
    }

    // Файл / Архив
    if (note.attachment?.type === "file" && note.attachment.url) {
      const fileBox = document.createElement("div");
      fileBox.className = "card-file-box";
      fileBox.onclick = (e) => e.stopPropagation();
      fileBox.innerHTML = `
        <div class="file-info-group">
          <svg class="file-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <div class="file-details">
            <span class="card-file-name" title="${note.attachment.name}">${note.attachment.name}</span>
            <span class="card-file-size">${note.attachment.size || "Файл"}</span>
          </div>
        </div>
        <a href="${note.attachment.url}" download="${note.attachment.name}" target="_blank" class="btn-file-download" title="Скачать файл">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </a>
      `;
      body.appendChild(fileBox);
    }

    card.appendChild(body);

    // Подвал карточки
    const footer = document.createElement("div");
    footer.className = "card-footer";

    const leftActions = document.createElement("div");
    leftActions.className = "card-left-actions";

    if (!isTrashView) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "card-checkbox";
      checkbox.checked = !!note.completed;
      checkbox.title = "Отметить выполненным";
      checkbox.onclick = (e) => handleToggleComplete(note.id, !!note.completed, e);
      leftActions.appendChild(checkbox);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-card-delete";
    deleteBtn.type = "button";
    deleteBtn.title = isTrashView ? "Удалить навсегда" : "В корзину";
    deleteBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    deleteBtn.onclick = (e) => handleDeleteNote(note.id, !!note.inTrash, e);

    footer.appendChild(leftActions);
    footer.appendChild(deleteBtn);
    card.appendChild(footer);

    notesGrid.appendChild(card);
  });
}

// Экспорт для других модулей
window.renderFeed = renderFeed;

// =============================================================================
// УПРАВЛЕНИЕ РАСКРЫТИЕМ ПОЛЯ СОЗДАНИЯ
// =============================================================================
function expandCreator() {
  creatorTitle.classList.remove("hidden");
  creatorActions.classList.remove("hidden");
  creatorText.rows = 3;
}

function collapseCreator() {
  if (!creatorTitle.value && !creatorText.value && !selectedFile) {
    creatorTitle.classList.add("hidden");
    creatorActions.classList.add("hidden");
    creatorText.rows = 1;
    creatorText.style.height = "auto";
  }
}

// =============================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// =============================================================================
function setupMainEvents() {
  creatorText.addEventListener("focus", expandCreator);
  creatorTitle.addEventListener("focus", expandCreator);

  creatorText.addEventListener("input", () => {
    creatorText.style.height = "auto";
    creatorText.style.height = creatorText.scrollHeight + "px";
  });

  btnCloseCreator.addEventListener("click", () => {
    creatorTitle.value = "";
    creatorText.value = "";
    clearAttachment();
    collapseCreator();
  });

  document.addEventListener("click", (e) => {
    if (!noteCreator.contains(e.target)) {
      collapseCreator();
    }
  });

  noteCreator.addEventListener("submit", handleCreateNote);

  // Вставка картинки через Ctrl + V
  window.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        handleFileSelect(file, "image");
        break;
      }
    }
  });

  // Выбор файлов через скрытые инпуты
  inputImage?.addEventListener("change", (e) => handleFileSelect(e.target.files[0], "image"));
  inputAudio?.addEventListener("change", (e) => handleFileSelect(e.target.files[0], "audio"));
  inputFile?.addEventListener("change", (e) => handleFileSelect(e.target.files[0], "file"));

  btnRemoveAttachment?.addEventListener("click", clearAttachment);
  btnRemoveAudio?.addEventListener("click", clearAttachment);
  btnRemoveFile?.addEventListener("click", clearAttachment);

  // Поиск
  searchInput?.addEventListener("input", (e) => {
    window.AppState.searchQuery = e.target.value.trim();
    renderFeed();
  });

  // Фильтры
  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeTabFilter = chip.dataset.filter;
      renderFeed();
    });
  });

  // Мобильная кнопка FAB (+)
  mobileFab?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    expandCreator();
    creatorText.focus();
  });
}

document.addEventListener("DOMContentLoaded", initApp);
