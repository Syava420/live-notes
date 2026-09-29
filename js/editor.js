// =============================================================================
// МОДУЛЬ РЕДАКТИРОВАНИЯ И ПРОСМОТРА МЕДИА (js/editor.js)
// =============================================================================

// Модальное окно редактирования заметки
const editModal = document.getElementById("edit-modal");
const editorTitle = document.getElementById("editor-title");
const editorText = document.getElementById("editor-text");
const editorFolderSelect = document.getElementById("editor-folder-select");
const editorAttachmentBox = document.getElementById("editor-attachment-box");
const btnCloseEditor = document.getElementById("btn-close-editor");
const btnEditorTrash = document.getElementById("btn-editor-trash");
const editorSaveStatus = document.getElementById("editor-save-status");

// Лайтбокс просмотра картинки
const lightboxModal = document.getElementById("lightbox-modal");
const lightboxImage = document.getElementById("lightbox-image");
const btnDownloadImage = document.getElementById("btn-download-image");
const btnCloseLightbox = document.getElementById("btn-close-lightbox");

let autoSaveTimer = null;
let currentLightboxUrl = "";
let currentLightboxName = "image.jpg";

function initEditorModule() {
  setupEditorEvents();
}

// Открытие заметки на редактирование
function openEditModal(noteId) {
  const note = window.AppState.notes.find((n) => n.id === noteId);
  if (!note) return;

  window.AppState.editingNoteId = noteId;
  editorTitle.value = note.title || "";
  editorText.value = note.text || "";
  if (editorFolderSelect) {
    editorFolderSelect.value = note.folderId || "";
  }
  editorSaveStatus.textContent = "Сохранено";

  // Автоподгонка высоты поля текста
  setTimeout(() => {
    editorText.style.height = "auto";
    editorText.style.height = editorText.scrollHeight + "px";
  }, 10);

  // Отрисовка вложения внутри модалки
  renderEditorAttachment(note);

  // Если заметка в корзине — меняем текст кнопки
  if (note.inTrash) {
    btnEditorTrash.innerHTML = `<span>Восстановить</span>`;
    btnEditorTrash.title = "Восстановить из корзины";
  } else {
    btnEditorTrash.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    btnEditorTrash.title = "В корзину";
  }

  editModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEditModal() {
  saveCurrentEditNow();
  editModal.classList.add("hidden");
  document.body.style.overflow = "";
  window.AppState.editingNoteId = null;
}

// Автосохранение при вводе текста с дебаунсом 400мс
function triggerAutoSave() {
  editorSaveStatus.textContent = "Сохранение...";
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveCurrentEditNow();
  }, 400);
}

async function saveCurrentEditNow() {
  const noteId = window.AppState.editingNoteId;
  if (!noteId) return;

  const title = editorTitle.value.trim();
  const text = editorText.value.trim();
  const folderId = editorFolderSelect?.value || "";

  const updates = {
    title: title,
    text: text,
    folderId: folderId,
    updatedAt: window.AppState.isFirebaseMode
      ? firebase.firestore.FieldValue.serverTimestamp()
      : Date.now()
  };

  if (window.AppState.isFirebaseMode) {
    try {
      await window.AppState.db.collection("notes").doc(noteId).update(updates);
      editorSaveStatus.textContent = "Сохранено в облако";
    } catch (e) {
      console.error("Ошибка автосохранения:", e);
      editorSaveStatus.textContent = "Ошибка сохранения";
    }
  } else {
    window.AppState.notes = window.AppState.notes.map((n) =>
      n.id === noteId ? { ...n, ...updates } : n
    );
    localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    editorSaveStatus.textContent = "Сохранено локально";
    window.renderFeed?.();
  }
}

// Отрисовка вложения в модалке редактирования
function renderEditorAttachment(note) {
  editorAttachmentBox.innerHTML = "";
  if (!note.attachment || !note.attachment.url) {
    editorAttachmentBox.classList.add("hidden");
    return;
  }

  editorAttachmentBox.classList.remove("hidden");
  const att = note.attachment;

  if (att.type === "image") {
    const wrap = document.createElement("div");
    wrap.className = "editor-media-image-wrap";
    wrap.innerHTML = `
      <img src="${att.url}" alt="Вложение" class="editor-img-preview" />
      <div class="editor-media-actions">
        <button type="button" class="btn-tool-action" id="btn-zoom-from-editor">🔍 На весь экран / Скачать</button>
        <button type="button" class="btn-tool-action btn-danger-action" id="btn-delete-attachment">Удалить фото</button>
      </div>
    `;
    wrap.querySelector("#btn-zoom-from-editor").onclick = () => openLightbox(att.url, att.name);
    wrap.querySelector("#btn-delete-attachment").onclick = () => removeNoteAttachment(note.id);
    editorAttachmentBox.appendChild(wrap);
  } else if (att.type === "audio") {
    const wrap = document.createElement("div");
    wrap.className = "editor-audio-wrap";
    wrap.innerHTML = `
      <audio controls src="${att.url}" style="width: 100%;"></audio>
      <div class="editor-media-actions" style="margin-top: 8px;">
        <button type="button" class="btn-tool-action btn-danger-action" id="btn-delete-attachment">Удалить аудио</button>
      </div>
    `;
    wrap.querySelector("#btn-delete-attachment").onclick = () => removeNoteAttachment(note.id);
    editorAttachmentBox.appendChild(wrap);
  } else {
    const wrap = document.createElement("div");
    wrap.className = "card-file-box";
    wrap.innerHTML = `
      <div class="file-info-group">
        <svg class="file-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <div class="file-details">
          <span class="card-file-name">${att.name}</span>
          <span class="card-file-size">${att.size}</span>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <a href="${att.url}" download="${att.name}" target="_blank" class="btn-file-download" title="Скачать">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </a>
        <button type="button" class="btn-card-delete" id="btn-delete-attachment" title="Удалить файл">&times;</button>
      </div>
    `;
    wrap.querySelector("#btn-delete-attachment").onclick = () => removeNoteAttachment(note.id);
    editorAttachmentBox.appendChild(wrap);
  }
}

// Удаление вложения из заметки
async function removeNoteAttachment(noteId) {
  if (!confirm("Удалить это вложение из заметки?")) return;

  if (window.AppState.isFirebaseMode) {
    await window.AppState.db.collection("notes").doc(noteId).update({ attachment: null });
  } else {
    window.AppState.notes = window.AppState.notes.map((n) =>
      n.id === noteId ? { ...n, attachment: null } : n
    );
    localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    window.renderFeed?.();
  }
  editorAttachmentBox.innerHTML = "";
  editorAttachmentBox.classList.add("hidden");
}

// Отправка в корзину / восстановление
async function handleTrashAction() {
  const noteId = window.AppState.editingNoteId;
  if (!noteId) return;

  const note = window.AppState.notes.find((n) => n.id === noteId);
  if (!note) return;

  if (note.inTrash) {
    // Восстановление
    if (window.AppState.isFirebaseMode) {
      await window.AppState.db.collection("notes").doc(noteId).update({ inTrash: false });
    } else {
      window.AppState.notes = window.AppState.notes.map((n) =>
        n.id === noteId ? { ...n, inTrash: false } : n
      );
      localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
      window.renderFeed?.();
    }
  } else {
    // В корзину
    if (window.AppState.isFirebaseMode) {
      await window.AppState.db.collection("notes").doc(noteId).update({ inTrash: true });
    } else {
      window.AppState.notes = window.AppState.notes.map((n) =>
        n.id === noteId ? { ...n, inTrash: true } : n
      );
      localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
      window.renderFeed?.();
    }
  }
  closeEditModal();
}

// =============================================================================
// ПРОСМОТР И СКАЧИВАНИЕ КАРТИНКИ (LIGHTBOX)
// =============================================================================
function openLightbox(url, filename = "image.jpg") {
  currentLightboxUrl = url;
  currentLightboxName = filename || "image.jpg";
  lightboxImage.src = url;
  lightboxModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightboxModal.classList.add("hidden");
  if (!window.AppState.editingNoteId) {
    document.body.style.overflow = "";
  }
  lightboxImage.src = "";
}

// Скачивание картинки
function downloadCurrentImage() {
  if (!currentLightboxUrl) return;
  const a = document.createElement("a");
  a.href = currentLightboxUrl;
  a.download = currentLightboxName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function setupEditorEvents() {
  btnCloseEditor?.addEventListener("click", closeEditModal);
  btnEditorTrash?.addEventListener("click", handleTrashAction);

  editorTitle?.addEventListener("input", triggerAutoSave);
  editorText?.addEventListener("input", () => {
    editorText.style.height = "auto";
    editorText.style.height = editorText.scrollHeight + "px";
    triggerAutoSave();
  });
  editorFolderSelect?.addEventListener("change", triggerAutoSave);

  // Клик вне карточки модалки закрывает её
  editModal?.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
  });

  // Лайтбокс
  btnCloseLightbox?.addEventListener("click", closeLightbox);
  btnDownloadImage?.addEventListener("click", downloadCurrentImage);
  lightboxModal?.addEventListener("click", (e) => {
    if (e.target === lightboxModal) closeLightbox();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!lightboxModal.classList.contains("hidden")) {
        closeLightbox();
      } else if (!editModal.classList.contains("hidden")) {
        closeEditModal();
      }
    }
  });
}
