// =============================================================================
// МОДУЛЬ ЭКРАНА РЕДАКТОРА (js/editor.js)
// =============================================================================

const btnEditorBack = document.getElementById("btn-editor-back");
const editorSyncStatus = document.getElementById("editor-sync-status");
const btnEditorTrash = document.getElementById("btn-editor-trash");
const editorFolderSelect = document.getElementById("editor-folder-select");
const editorTitleInput = document.getElementById("editor-title-input");
const editorTextInput = document.getElementById("editor-text-input");
const editorMediaPreview = document.getElementById("editor-media-preview");

// Кнопки тулбара редактора
const inputEditorPhoto = document.getElementById("input-editor-photo");
const inputEditorAudio = document.getElementById("input-editor-audio");
const inputEditorFile = document.getElementById("input-editor-file");
const btnEditorUndo = document.getElementById("btn-editor-undo");
const btnEditorRedo = document.getElementById("btn-editor-redo");

let autoSaveTimeout = null;
let currentAttachment = null;

function initEditorModule() {
  setupEditorEvents();
}

// Загрузка заметки в редактор
function loadNoteIntoEditor(noteId) {
  clearTimeout(autoSaveTimeout);

  if (!noteId) {
    // Новая заметка
    editorTitleInput.value = "";
    editorTextInput.value = "";
    currentAttachment = null;
    editorSyncStatus.textContent = "Новая";

    if (window.AppState.activeFolderId && window.AppState.activeFolderId !== "all" && window.AppState.activeFolderId !== "trash" && window.AppState.activeFolderId !== "archive") {
      editorFolderSelect.value = window.AppState.activeFolderId;
    } else {
      editorFolderSelect.value = "";
    }

    window.ChecklistManager?.clear();
    renderEditorAttachmentView(null);
    btnEditorTrash.classList.add("hidden");
    setTimeout(() => editorTextInput.focus(), 120);
    return;
  }

  // Редактирование
  btnEditorTrash.classList.remove("hidden");
  const note = window.AppState.notes.find((n) => n.id === noteId);
  if (!note) return;

  editorTitleInput.value = note.title || "";
  editorTextInput.value = note.text || "";
  editorFolderSelect.value = note.folderId || "";
  currentAttachment = note.attachment || null;
  editorSyncStatus.textContent = "Сохранено";

  // Загрузка интерактивного чек-листа
  window.ChecklistManager?.load(note.checklist || []);

  renderEditorAttachmentView(currentAttachment);
}

// Отрисовка превью медиа
function renderEditorAttachmentView(att) {
  editorMediaPreview.innerHTML = "";
  if (!att || !att.url) {
    editorMediaPreview.classList.add("hidden");
    return;
  }

  editorMediaPreview.classList.remove("hidden");

  if (att.type === "image") {
    const box = document.createElement("div");
    box.className = "editor-img-box";
    box.innerHTML = `
      <img src="${att.url}" alt="${att.name || 'Фото'}" title="Нажмите для увеличения">
      <div class="editor-media-toolbar">
        <button type="button" class="btn-inline-action" id="btn-view-large">🔍 Просмотр / Скачать</button>
        <button type="button" class="btn-inline-action danger" id="btn-del-img">Удалить</button>
      </div>
    `;
    box.querySelector("img").onclick = () => window.openLightbox?.(att.url, att.name);
    box.querySelector("#btn-view-large").onclick = () => window.openLightbox?.(att.url, att.name);
    box.querySelector("#btn-del-img").onclick = () => {
      currentAttachment = null;
      renderEditorAttachmentView(null);
      saveEditorNow();
    };
    editorMediaPreview.appendChild(box);
  } else if (att.type === "audio") {
    const box = document.createElement("div");
    box.innerHTML = `
      <audio controls src="${att.url}" style="width: 100%; margin-top: 6px;"></audio>
      <div class="editor-media-toolbar">
        <button type="button" class="btn-inline-action danger" id="btn-del-audio">Удалить аудио</button>
      </div>
    `;
    box.querySelector("#btn-del-audio").onclick = () => {
      currentAttachment = null;
      renderEditorAttachmentView(null);
      saveEditorNow();
    };
    editorMediaPreview.appendChild(box);
  } else {
    const box = document.createElement("div");
    box.className = "card-file-tag";
    box.style.display = "flex";
    box.style.justifyContent = "space-between";
    box.style.padding = "8px 12px";
    box.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>📦</span>
        <div>
          <div style="font-weight: 600;">${att.name}</div>
          <div style="font-size: 0.75rem; color: #888;">${att.size}</div>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <a href="${att.url}" download="${att.name}" target="_blank" class="btn-inline-action">Скачать</a>
        <button type="button" class="btn-inline-action danger" id="btn-del-file">&times;</button>
      </div>
    `;
    box.querySelector("#btn-del-file").onclick = () => {
      currentAttachment = null;
      renderEditorAttachmentView(null);
      saveEditorNow();
    };
    editorMediaPreview.appendChild(box);
  }
}

// Прикрепление файла
async function handleAttachFile(file, type) {
  if (!file) return;
  editorSyncStatus.textContent = "Обработка...";

  try {
    const dataUrl = await fileToDataUrl(file);
    currentAttachment = {
      type: type,
      name: file.name,
      size: formatBytes(file.size),
      url: dataUrl
    };
    renderEditorAttachmentView(currentAttachment);
    saveEditorNow();
  } catch (err) {
    console.warn("Файл отменен:", err);
    editorSyncStatus.textContent = "Ошибка файла";
  }
}

// Автосохранение
function onEditorInput() {
  editorSyncStatus.textContent = "Печатает...";
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    saveEditorNow();
  }, 450);
}

// Мгновенное сохранение
async function saveEditorNow() {
  const title = editorTitleInput.value.trim();
  const text = editorTextInput.value.trim();
  const folderId = editorFolderSelect.value || "";
  const checklistData = window.ChecklistManager?.getData() || [];

  // Если всё пусто — ничего не сохраняем
  if (!title && !text && !currentAttachment && checklistData.length === 0) {
    return;
  }

  const payload = {
    title: title,
    text: text,
    folderId: folderId,
    checklist: checklistData,
    attachment: currentAttachment,
    updatedAt: window.AppState.isFirebaseMode ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
  };

  const currentId = window.AppState.editingNoteId;

  if (window.AppState.isFirebaseMode) {
    try {
      if (currentId) {
        await window.AppState.db.collection("notes").doc(currentId).update(payload);
      } else {
        payload.completed = false;
        payload.inTrash = false;
        payload.isArchived = false;
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const docRef = await window.AppState.db.collection("notes").add(payload);
        window.AppState.editingNoteId = docRef.id;
        btnEditorTrash.classList.remove("hidden");
      }
      editorSyncStatus.textContent = "Сохранено";
    } catch (e) {
      console.error("Ошибка сохранения:", e);
      editorSyncStatus.textContent = "Ошибка";
    }
  } else {
    if (currentId) {
      window.AppState.notes = window.AppState.notes.map((n) =>
        n.id === currentId ? { ...n, ...payload } : n
      );
    } else {
      payload.id = "local-" + Date.now();
      payload.completed = false;
      payload.inTrash = false;
      payload.isArchived = false;
      payload.createdAt = Date.now();
      window.AppState.notes.unshift(payload);
      window.AppState.editingNoteId = payload.id;
      btnEditorTrash.classList.remove("hidden");
    }
    localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    editorSyncStatus.textContent = "Сохранено";
  }
}

// Удаление заметки
async function handleDeleteFromEditor() {
  const noteId = window.AppState.editingNoteId;
  if (!noteId) {
    window.AppRouter.goToList(true);
    return;
  }

  const note = window.AppState.notes.find((n) => n.id === noteId);
  if (!note) return;

  if (note.inTrash) {
    if (!confirm("Удалить заметку навсегда?")) return;
    if (window.AppState.isFirebaseMode) {
      await window.AppState.db.collection("notes").doc(noteId).delete();
    } else {
      window.AppState.notes = window.AppState.notes.filter((n) => n.id !== noteId);
      localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    }
  } else {
    if (window.AppState.isFirebaseMode) {
      await window.AppState.db.collection("notes").doc(noteId).update({ inTrash: true });
    } else {
      window.AppState.notes = window.AppState.notes.map((n) =>
        n.id === noteId ? { ...n, inTrash: true } : n
      );
      localStorage.setItem("keep_notes_local", JSON.stringify(window.AppState.notes));
    }
  }

  window.AppRouter.goToList(true);
}

function setupEditorEvents() {
  btnEditorBack?.addEventListener("click", () => window.AppRouter.goToList());
  btnEditorTrash?.addEventListener("click", handleDeleteFromEditor);

  editorTitleInput?.addEventListener("input", onEditorInput);
  editorTextInput?.addEventListener("input", onEditorInput);
  editorFolderSelect?.addEventListener("change", onEditorInput);

  inputEditorPhoto?.addEventListener("change", (e) => handleAttachFile(e.target.files[0], "image"));
  inputEditorAudio?.addEventListener("change", (e) => handleAttachFile(e.target.files[0], "audio"));
  inputEditorFile?.addEventListener("change", (e) => handleAttachFile(e.target.files[0], "file"));

  btnEditorUndo?.addEventListener("click", () => document.execCommand("undo"));
  btnEditorRedo?.addEventListener("click", () => document.execCommand("redo"));

  window.addEventListener("paste", (e) => {
    if (window.AppRouter.currentScreen !== "editor") return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        handleAttachFile(file, "image");
        break;
      }
    }
  });
}

window.loadNoteIntoEditor = loadNoteIntoEditor;
window.saveEditorNow = saveEditorNow;
