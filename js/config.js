// =============================================================================
// МОДУЛЬ КОНФИГУРАЦИИ, ОФЛАЙН-КЭША И НАСТРОЕК (js/config.js)
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

// Настройки приложения (сохраняются локально на телефоне/ПК)
window.AppSettings = {
  columns: localStorage.getItem("app_cols") || "2", // "2" (Samsung плитка) или "1" (список)
  showFolderChips: localStorage.getItem("app_show_chips") !== "false", // Показывать ли чипы папок

  save() {
    localStorage.setItem("app_cols", this.columns);
    localStorage.setItem("app_show_chips", this.showFolderChips);
    window.applySettingsUI?.();
  }
};

// Единое состояние
window.AppState = {
  db: null,
  isFirebaseMode: false,
  notes: [],
  folders: [],
  activeFolderId: "all", // "all" | folderId | "archive" | "trash"
  searchQuery: "",
  editingNoteId: null
};

// Инициализация Firebase с автоматическим офлайн-кэшем
function initFirebase() {
  if (firebaseConfig.apiKey && typeof firebase !== "undefined") {
    try {
      firebase.initializeApp(firebaseConfig);
      window.AppState.db = firebase.firestore();
      window.AppState.isFirebaseMode = true;
      setSyncStatus("connected", "В сети");

      // Включение встроенного офлайн-кэша Firestore
      window.AppState.db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        console.info("Офлайн кэш уже активен или режим нескольких вкладок:", err.code);
      });
    } catch (e) {
      console.warn("Ошибка подключения к облаку:", e);
      window.AppState.isFirebaseMode = false;
      setSyncStatus("demo", "Офлайн");
    }
  } else {
    window.AppState.isFirebaseMode = false;
    setSyncStatus("demo", "Офлайн");
  }
}

// Статус соединения
function setSyncStatus(type, label) {
  const pill = document.getElementById("status-pill");
  if (!pill) return;
  pill.className = `status-indicator status-${type}`;
  pill.title = label;
}

// Форматирование байтов
function formatBytes(bytes) {
  if (!bytes) return "0 Б";
  const k = 1024;
  const sizes = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Сжатие фото на устройстве
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
          const maxDim = 1200;
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
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } else {
      if (file.size > 850 * 1024) {
        alert("Файл больше 850 КБ. Для тяжелых архивов используйте ссылку на облако.");
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
