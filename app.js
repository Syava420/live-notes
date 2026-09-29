// =============================================================================
// КОНФИГУРАЦИЯ FIREBASE (Синхронизация Firestore + Хранилище Storage)
// =============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCkiCByb29Ra9mucjlVb08kg6190qQjpfQ",
  authDomain: "live-notes-f5886.firebaseapp.com",
  projectId: "live-notes-f5886",
  storageBucket: "live-notes-f5886.firebasestorage.app",
  messagingSenderId: "596191192262",
  appId: "1:596191192262:web:c2a5e4b0db7808626ae3c7",
  measurementId: "G-9DMLP7JMSX"
};

// =============================================================================
// DOM ЭЛЕМЕНТЫ
// =============================================================================
const statusPill = document.getElementById("status-pill");
const statusText = document.getElementById("status-text");
const searchInput = document.getElementById("search-input");
const counterSummary = document.getElementById("counter-summary");
const notesGrid = document.getElementById("notes-grid");
const emptyState = document.getElementById("empty-state");

// Форма создания заметки
const noteCreator = document.getElementById("note-creator");
const creatorTitle = document.getElementById("creator-title");
const creatorText = document.getElementById("creator-text");
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

// Индикатор загрузки файлов
const uploadProgressBar = document.getElementById("upload-progress-bar");
const uploadProgressFill = document.getElementById("upload-progress-fill");

// Фильтры
const filterChips = document.querySelectorAll(".filter-chip");

// =============================================================================
// СОСТОЯНИЕ
// =============================================================================
let db = null;
let storage = null;
let isFirebaseMode = false;
let allNotes = [];
let activeFilter = "all";
let currentSearchQuery = "";
let selectedFile = null; // Прикреплённый файл перед отправкой
let selectedFileType = null; // 'image' | 'audio' | 'file'

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ
// =============================================================================
function init() {
  setupEventListeners();

  if (firebaseConfig.apiKey && typeof firebase !== "undefined") {
    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      storage = firebase.storage();
      isFirebaseMode = true;
      setStatus("connecting", "Подключение к Google...");
      listenToNotes();
    } catch (err) {
      console.error("Firebase init error:", err);
      fallbackToDemo();
    }
  } else {
    fallbackToDemo();
  }
}

function setStatus(type, msg) {
  statusPill.className = `status-pill status-${type}`;
  statusText.textContent = msg;
}

function fallbackToDemo() {
  isFirebaseMode = false;
  setStatus("demo", "Локальный режим");
  const saved = localStorage.getItem("keep_notes_local");
  allNotes = saved ? JSON.parse(saved) : [];
  renderFeed();
}

// =============================================================================
// ПОДПИСКА НА FIRESTORE (onSnapshot в реальном времени)
// =============================================================================
function listenToNotes() {
  db.collection("notes").onSnapshot(
    (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });

      // Сортировка: новые вверху
      list.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return tB - tA;
      });

      allNotes = list;
      setStatus("connected", "В сети");
      renderFeed();
    },
    (err) => {
      console.error("Firestore error:", err);
      setStatus("error", "Сбой базы данных");
    }
  );
}

// =============================================================================
// РАБОТА С ФАЙЛАМИ И ВЛОЖЕНИЯМИ
// =============================================================================
function handleFileSelect(file, type) {
  if (!file) return;

  // Ограничение размера файла: предупреждение если файл > 50 МБ
  if (file.size > 100 * 1024 * 1024) {
    alert("Файл слишком большой! Максимальный размер загрузки — 100 МБ.");
    return;
  }

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

function formatBytes(bytes, decimals = 1) {
  if (!bytes) return "0 Б";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Загрузка файла в Firebase Storage
async function uploadToStorage(file) {
  uploadProgressBar.classList.remove("hidden");
  uploadProgressFill.style.width = "0%";

  try {
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageRef = storage.ref(`attachments/${Date.now()}_${cleanName}`);
    const uploadTask = storageRef.put(file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          uploadProgressFill.style.width = `${progress}%`;
        },
        (error) => {
          console.error("Storage upload error:", error);
          uploadProgressBar.classList.add("hidden");
          // Если в Firebase не включили Cloud Storage
          if (error.code === "storage/unauthorized" || error.code === "storage/bucket-not-found") {
            alert(
              "⚠️ Внимание: Для загрузки файлов в облако включите Cloud Storage в консоли Firebase!\n" +
              "Зайдите на console.firebase.google.com -> проект -> раздел Storage -> Get Started."
            );
          }
          reject(error);
        },
        async () => {
          uploadProgressBar.classList.add("hidden");
          const downloadUrl = await uploadTask.snapshot.ref.getDownloadURL();
          resolve(downloadUrl);
        }
      );
    });
  } catch (e) {
    uploadProgressBar.classList.add("hidden");
    throw e;
  }
}

// =============================================================================
// ДОБАВЛЕНИЕ / СОХРАНЕНИЕ ЗАМЕТКИ
// =============================================================================
async function handleSaveNote(event) {
  event?.preventDefault();

  const title = creatorTitle.value.trim();
  const text = creatorText.value.trim();

  // Если нет ни текста, ни заголовка, ни файла
  if (!text && !title && !selectedFile) {
    collapseCreator();
    return;
  }

  btnSaveNote.disabled = true;
  btnSaveNote.textContent = "Сохранение...";

  let attachmentData = null;

  if (selectedFile) {
    if (isFirebaseMode) {
      try {
        const fileUrl = await uploadToStorage(selectedFile);
        attachmentData = {
          type: selectedFileType,
          name: selectedFile.name,
          size: formatBytes(selectedFile.size),
          url: fileUrl
        };
      } catch (err) {
        console.warn("Не удалось сохранить в Cloud Storage:", err);
      }
    } else {
      // Демо режим (локальное превью)
      attachmentData = {
        type: selectedFileType,
        name: selectedFile.name,
        size: formatBytes(selectedFile.size),
        url: URL.createObjectURL(selectedFile)
      };
    }
  }

  const notePayload = {
    title: title,
    text: text,
    completed: false,
    attachment: attachmentData,
    createdAt: isFirebaseMode
      ? firebase.firestore.FieldValue.serverTimestamp()
      : Date.now()
  };

  if (isFirebaseMode) {
    try {
      await db.collection("notes").add(notePayload);
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    }
  } else {
    notePayload.id = "local-" + Date.now();
    allNotes.unshift(notePayload);
    localStorage.setItem("keep_notes_local", JSON.stringify(allNotes));
    renderFeed();
  }

  // Очистка формы
  creatorTitle.value = "";
  creatorText.value = "";
  creatorText.style.height = "auto";
  clearAttachment();
  btnSaveNote.disabled = false;
  btnSaveNote.textContent = "Сохранить";
  collapseCreator();
}

// Переключение выполнения
async function handleToggle(id, currentCompleted) {
  if (isFirebaseMode) {
    await db.collection("notes").doc(id).update({ completed: !currentCompleted });
  } else {
    allNotes = allNotes.map((n) => (n.id === id ? { ...n, completed: !currentCompleted } : n));
    localStorage.setItem("keep_notes_local", JSON.stringify(allNotes));
    renderFeed();
  }
}

// Удаление заметки
async function handleDelete(id) {
  if (isFirebaseMode) {
    await db.collection("notes").doc(id).delete();
  } else {
    allNotes = allNotes.filter((n) => n.id !== id);
    localStorage.setItem("keep_notes_local", JSON.stringify(allNotes));
    renderFeed();
  }
}

// =============================================================================
// РЕНДЕРИНГ КАРТОЧЕК (Google Keep Masonry)
// =============================================================================
function renderFeed() {
  // Фильтрация
  let filtered = allNotes.filter((n) => {
    if (activeFilter === "active") return !n.completed;
    if (activeFilter === "media") return !!n.attachment;
    return true;
  });

  // Поиск
  if (currentSearchQuery) {
    const q = currentSearchQuery.toLowerCase();
    filtered = filtered.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.text && n.text.toLowerCase().includes(q)) ||
        (n.attachment?.name && n.attachment.name.toLowerCase().includes(q))
    );
  }

  // Обновление счетчика
  const activeCount = allNotes.filter((n) => !n.completed).length;
  counterSummary.textContent = `Заметок: ${allNotes.length} (активных: ${activeCount})`;

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

    // Картинка (если есть)
    if (note.attachment?.type === "image" && note.attachment.url) {
      const img = document.createElement("img");
      img.className = "card-media-image";
      img.src = note.attachment.url;
      img.loading = "lazy";
      img.alt = note.attachment.name || "Изображение";
      img.onclick = () => window.open(note.attachment.url, "_blank");
      card.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "card-body";

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

    // Аудиоплеер (если есть аудио)
    if (note.attachment?.type === "audio" && note.attachment.url) {
      const audio = document.createElement("audio");
      audio.className = "card-audio";
      audio.controls = true;
      audio.src = note.attachment.url;
      body.appendChild(audio);
    }

    // Блок файла / архива (если есть архив/документ)
    if (note.attachment?.type === "file" && note.attachment.url) {
      const fileBox = document.createElement("div");
      fileBox.className = "card-file-box";
      fileBox.innerHTML = `
        <div class="file-info-group">
          <svg class="file-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <div class="file-details">
            <span class="card-file-name" title="${note.attachment.name}">${note.attachment.name}</span>
            <span class="card-file-size">${note.attachment.size || "Файл"}</span>
          </div>
        </div>
        <a href="${note.attachment.url}" download="${note.attachment.name}" target="_blank" class="btn-file-download" title="Скачать файл">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </a>
      `;
      body.appendChild(fileBox);
    }

    card.appendChild(body);

    // Подвал карточки с действиями
    const footer = document.createElement("div");
    footer.className = "card-footer";

    const leftActions = document.createElement("div");
    leftActions.className = "card-left-actions";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "card-checkbox";
    checkbox.checked = !!note.completed;
    checkbox.title = "Отметить выполненным";
    checkbox.addEventListener("change", () => handleToggle(note.id, !!note.completed));
    leftActions.appendChild(checkbox);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-card-delete";
    deleteBtn.type = "button";
    deleteBtn.title = "Удалить";
    deleteBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    deleteBtn.addEventListener("click", () => handleDelete(note.id));

    footer.appendChild(leftActions);
    footer.appendChild(deleteBtn);
    card.appendChild(footer);

    notesGrid.appendChild(card);
  });
}

// =============================================================================
// UI УПРАВЛЕНИЕ РАСКРЫТИЕМ ФОРМЫ
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
function setupEventListeners() {
  creatorText.addEventListener("focus", expandCreator);
  creatorTitle.addEventListener("focus", expandCreator);

  // Автоматическое расширение высоты textarea
  creatorText.addEventListener("input", () => {
    creatorText.style.height = "auto";
    creatorText.style.height = creatorText.scrollHeight + "px";
  });

  // Закрытие по кнопке
  btnCloseCreator.addEventListener("click", () => {
    creatorTitle.value = "";
    creatorText.value = "";
    clearAttachment();
    collapseCreator();
  });

  // Клик вне формы сворачивает её
  document.addEventListener("click", (e) => {
    if (!noteCreator.contains(e.target)) {
      collapseCreator();
    }
  });

  // Отправка формы
  noteCreator.addEventListener("submit", handleSaveNote);

  // Вставка картинок и файлов из буфера обмена (Ctrl + V)
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

  // Выбор файлов через кнопки
  inputImage.addEventListener("change", (e) => handleFileSelect(e.target.files[0], "image"));
  inputAudio.addEventListener("change", (e) => handleFileSelect(e.target.files[0], "audio"));
  inputFile.addEventListener("change", (e) => handleFileSelect(e.target.files[0], "file"));

  // Удаление вложений в превью
  btnRemoveAttachment.addEventListener("click", clearAttachment);
  btnRemoveAudio.addEventListener("click", clearAttachment);
  btnRemoveFile.addEventListener("click", clearAttachment);

  // Поиск
  searchInput.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.trim();
    renderFeed();
  });

  // Фильтры
  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      renderFeed();
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
