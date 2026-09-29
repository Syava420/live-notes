// =============================================================================
// МОДУЛЬ КОНФИГУРАЦИИ И ГЛОБАЛЬНОГО СОСТОЯНИЯ (js/config.js)
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

// Единое состояние приложения
window.AppState = {
  db: null,
  isFirebaseMode: false,
  notes: [],
  folders: [],
  activeFolderId: "all", // "all" | folderId | "trash"
  searchQuery: "",
  editingNoteId: null
};

// Инициализация базы данных
function initFirebase() {
  if (firebaseConfig.apiKey && typeof firebase !== "undefined") {
    try {
      firebase.initializeApp(firebaseConfig);
      window.AppState.db = firebase.firestore();
      window.AppState.isFirebaseMode = true;
      setSyncStatus("connected", "В сети");
    } catch (e) {
      console.warn("Ошибка инициализации Firebase:", e);
      window.AppState.isFirebaseMode = false;
      setSyncStatus("demo", "Локально");
    }
  } else {
    window.AppState.isFirebaseMode = false;
    setSyncStatus("demo", "Локально");
  }
}

// Управление бейджем синхронизации
function setSyncStatus(type, label) {
  const pill = document.getElementById("status-pill");
  const text = document.getElementById("status-text");
  if (!pill || !text) return;
  pill.className = `status-pill status-${type}`;
  text.textContent = label;
}

// Форматирование размера файлов
function formatBytes(bytes, decimals = 1) {
  if (!bytes) return "0 Б";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Умная конвертация файла в Base64 с автосжатием фото для бесплатной базы
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 1280;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } else {
      if (file.size > 850 * 1024) {
        alert("Файл больше 850 КБ! Для больших архивов вставляйте ссылку на диск/облако.");
        reject(new Error("File too large"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
}
