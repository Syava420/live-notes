// =============================================================================
// НАСТРОЙКИ FIREBASE (Вставьте ваши ключи из Firebase Console сюда)
// Краткая инструкция по получению ключей за 1 минуту описана в файле README.md
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
const noteForm = document.getElementById("note-form");
const noteInput = document.getElementById("note-input");
const notesList = document.getElementById("notes-list");
const emptyState = document.getElementById("empty-state");
const remainingCountEl = document.getElementById("remaining-count");
const totalCountEl = document.getElementById("total-count");
const statusPill = document.getElementById("status-pill");
const statusText = document.getElementById("status-text");
const bannerNotice = document.getElementById("banner-notice");

// Модальное окно с инструкцией
const guideModal = document.getElementById("guide-modal");
const btnOpenGuide = document.getElementById("btn-open-guide");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnModalOk = document.getElementById("btn-modal-ok");

// =============================================================================
// СОСТОЯНИЕ И РЕЖИМ РАБОТЫ (Firebase vs Demo/LocalStorage)
// =============================================================================
let db = null;
let isFirebaseMode = false;
let localNotes = []; // Резервное хранилище для демо-режима

// Проверка: заменил ли пользователь заглушки на реальные ключи
function checkIsConfigured(config) {
  return (
    config &&
    config.apiKey &&
    config.apiKey !== "ВАШ_API_KEY" &&
    !config.apiKey.includes("ВАШ_")
  );
}

// Управление индикатором статуса
function setStatus(type, message) {
  statusPill.className = `status-pill status-${type}`;
  statusText.textContent = message;
}

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ
// =============================================================================
function initApp() {
  setupEventListeners();

  if (checkIsConfigured(firebaseConfig) && typeof firebase !== "undefined") {
    // 1. Полноценный режим Firebase с облачной синхронизацией
    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      isFirebaseMode = true;
      bannerNotice.classList.add("hidden");
      setStatus("connecting", "Подключение к облаку...");
      listenToFirebaseNotes();
    } catch (err) {
      console.error("Ошибка инициализации Firebase:", err);
      fallbackToDemoMode("Ошибка конфигурации Firebase");
    }
  } else {
    // 2. Демо-режим (локально в браузере), пока ключи не добавлены
    fallbackToDemoMode();
  }
}

function fallbackToDemoMode(customMsg) {
  isFirebaseMode = false;
  bannerNotice.classList.remove("hidden");
  setStatus("demo", customMsg || "Демо-режим (локально)");

  // Загружаем сохраненные демо-заметки из localStorage
  const saved = localStorage.getItem("live_notepad_demo");
  if (saved) {
    try {
      localNotes = JSON.parse(saved);
    } catch (e) {
      localNotes = [];
    }
  } else {
    // Добавим приветственную заметку для наглядности
    localNotes = [
      {
        id: "demo-welcome",
        text: "👋 Добро пожаловать! Нажмите на кружок слева, чтобы вычеркнуть задачу",
        completed: false,
        createdAt: Date.now()
      }
    ];
    saveLocalNotes();
  }

  renderNotes(localNotes);
}

// =============================================================================
// СИНХРОНИЗАЦИЯ С FIREBASE (onSnapshot в реальном времени)
// =============================================================================
function listenToFirebaseNotes() {
  // Подписка на коллекцию "notes". При любом изменении на ЛЮБОМ устройстве
  // Firestore моментально присылает свежие данные сюда!
  db.collection("notes").onSnapshot(
    (snapshot) => {
      const notes = [];
      snapshot.forEach((doc) => {
        notes.push({ id: doc.id, ...doc.data() });
      });

      // Сортировка: новые заметки всегда вверху
      notes.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
        return timeB - timeA;
      });

      renderNotes(notes);
      setStatus("connected", "В сети • Онлайн");
    },
    (error) => {
      console.error("Ошибка подписки Firestore:", error);
      if (error.code === "permission-denied") {
        setStatus("error", "Доступ закрыт в правилах Firestore");
        alert(
          "⚠️ Ошибка доступа к Firestore!\n\n" +
          "В Firebase Console откройте: Firestore Database -> вкладка Правила (Rules).\n" +
          "Установите: allow read, write: if true; (Тестовый режим)."
        );
      } else {
        setStatus("error", "Сбой соединения");
      }
    }
  );
}

// =============================================================================
// ОПЕРАЦИИ С ЗАМЕТКАМИ (CRUD)
// =============================================================================

// Добавление новой заметки
async function handleAddNote(event) {
  event.preventDefault();
  const text = noteInput.value.trim();
  if (!text) return;

  noteInput.value = "";
  noteInput.focus();

  if (isFirebaseMode) {
    try {
      await db.collection("notes").add({
        text: text,
        completed: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error("Не удалось добавить заметку в Firestore:", err);
      alert("Ошибка при сохранении заметки в облако: " + err.message);
    }
  } else {
    // В демо-режиме
    const newNote = {
      id: "local-" + Date.now(),
      text: text,
      completed: false,
      createdAt: Date.now()
    };
    localNotes.unshift(newNote);
    saveLocalNotes();
    renderNotes(localNotes);
  }
}

// Переключение статуса выполнения (готово / не готово)
async function handleToggleNote(id, currentCompleted) {
  if (isFirebaseMode) {
    try {
      await db.collection("notes").doc(id).update({
        completed: !currentCompleted
      });
    } catch (err) {
      console.error("Не удалось обновить заметку:", err);
    }
  } else {
    localNotes = localNotes.map((n) =>
      n.id === id ? { ...n, completed: !currentCompleted } : n
    );
    saveLocalNotes();
    renderNotes(localNotes);
  }
}

// Удаление заметки
async function handleDeleteNote(id) {
  if (isFirebaseMode) {
    try {
      await db.collection("notes").doc(id).delete();
    } catch (err) {
      console.error("Не удалось удалить заметку:", err);
    }
  } else {
    localNotes = localNotes.filter((n) => n.id !== id);
    saveLocalNotes();
    renderNotes(localNotes);
  }
}

function saveLocalNotes() {
  localStorage.setItem("live_notepad_demo", JSON.stringify(localNotes));
}

// =============================================================================
// РЕНДЕРИНГ ИНТЕРФЕЙСА
// =============================================================================
function renderNotes(notes) {
  // Обновление счетчиков
  const remaining = notes.filter((n) => !n.completed).length;
  remainingCountEl.textContent = remaining;
  totalCountEl.textContent = notes.length;

  // Очистка списка
  notesList.innerHTML = "";

  if (notes.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  // Отрисовка элементов
  notes.forEach((note) => {
    const li = document.createElement("li");
    li.className = `note-item ${note.completed ? "is-completed" : ""}`;

    const contentWrap = document.createElement("div");
    contentWrap.className = "note-content-wrap";

    // Чекбокс
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "custom-checkbox";
    checkbox.checked = !!note.completed;
    checkbox.setAttribute("aria-label", "Отметить выполненным");
    checkbox.addEventListener("change", () => handleToggleNote(note.id, !!note.completed));

    // Текст заметки (с защитой от XSS)
    const textSpan = document.createElement("span");
    textSpan.className = "note-text";
    textSpan.textContent = note.text;

    contentWrap.appendChild(checkbox);
    contentWrap.appendChild(textSpan);

    // Кнопка удаления с иконкой корзины
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.type = "button";
    deleteBtn.title = "Удалить заметку";
    deleteBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    deleteBtn.addEventListener("click", () => handleDeleteNote(note.id));

    li.appendChild(contentWrap);
    li.appendChild(deleteBtn);
    notesList.appendChild(li);
  });
}

// =============================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// =============================================================================
function setupEventListeners() {
  noteForm.addEventListener("submit", handleAddNote);

  // Модальное окно инструкции
  btnOpenGuide?.addEventListener("click", () => guideModal.classList.remove("hidden"));
  btnCloseModal?.addEventListener("click", () => guideModal.classList.add("hidden"));
  btnModalOk?.addEventListener("click", () => guideModal.classList.add("hidden"));

  // Закрытие модального окна по клику вне карточки
  guideModal?.addEventListener("click", (e) => {
    if (e.target === guideModal) {
      guideModal.classList.add("hidden");
    }
  });

  // Закрытие по клавише Esc
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !guideModal.classList.contains("hidden")) {
      guideModal.classList.add("hidden");
    }
  });
}

// Старт приложения при загрузке документа
document.addEventListener("DOMContentLoaded", initApp);
