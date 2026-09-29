// =============================================================================
// МОДУЛЬ ПАПОК И БОКОВОЙ ПАНЕЛИ (js/folders.js)
// =============================================================================

const sidebar = document.getElementById("app-sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const foldersListEl = document.getElementById("folders-list");
const btnNewFolder = document.getElementById("btn-new-folder");
const newFolderInputWrap = document.getElementById("new-folder-input-wrap");
const inputFolderName = document.getElementById("input-folder-name");
const btnSaveNewFolder = document.getElementById("btn-save-new-folder");
const btnCancelNewFolder = document.getElementById("btn-cancel-new-folder");

// Инициализация модуля папок
function initFoldersModule() {
  setupFolderEvents();

  if (window.AppState.isFirebaseMode) {
    listenToFolders();
  } else {
    const saved = localStorage.getItem("keep_folders_local");
    window.AppState.folders = saved ? JSON.parse(saved) : [
      { id: "default-work", name: "Работа" },
      { id: "default-ideas", name: "Идеи" }
    ];
    renderFoldersSidebar();
    updateFolderSelectOptions();
  }
}

// Подписка на коллекцию folders в Firestore
function listenToFolders() {
  window.AppState.db.collection("folders").orderBy("createdAt", "asc").onSnapshot(
    (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      window.AppState.folders = list;
      renderFoldersSidebar();
      updateFolderSelectOptions();
    },
    (err) => {
      console.warn("Ошибка загрузки папок:", err);
    }
  );
}

// Создание новой папки
async function createFolder(name) {
  const cleanName = name.trim();
  if (!cleanName) return;

  if (window.AppState.isFirebaseMode) {
    try {
      await window.AppState.db.collection("folders").add({
        name: cleanName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      alert("Ошибка создания папки: " + e.message);
    }
  } else {
    window.AppState.folders.push({
      id: "folder-" + Date.now(),
      name: cleanName
    });
    localStorage.setItem("keep_folders_local", JSON.stringify(window.AppState.folders));
    renderFoldersSidebar();
    updateFolderSelectOptions();
  }
}

// Удаление папки
async function deleteFolder(folderId) {
  if (!confirm("Удалить эту папку? Заметки останутся в общем списке.")) return;

  if (window.AppState.isFirebaseMode) {
    try {
      await window.AppState.db.collection("folders").doc(folderId).delete();
    } catch (e) {
      alert("Не удалось удалить папку: " + e.message);
    }
  } else {
    window.AppState.folders = window.AppState.folders.filter((f) => f.id !== folderId);
    localStorage.setItem("keep_folders_local", JSON.stringify(window.AppState.folders));
    renderFoldersSidebar();
    updateFolderSelectOptions();
  }

  if (window.AppState.activeFolderId === folderId) {
    setActiveFolder("all");
  }
}

// Переключение активной папки
function setActiveFolder(folderId) {
  window.AppState.activeFolderId = folderId;
  renderFoldersSidebar();
  window.renderFeed?.();

  // На мобильных устройствах закрываем шторку
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

// Отрисовка списка папок в сайдбаре
function renderFoldersSidebar() {
  if (!foldersListEl) return;
  foldersListEl.innerHTML = "";

  // 1. Все заметки
  const allLi = createSidebarItem({
    id: "all",
    name: "Все заметки",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
    isActive: window.AppState.activeFolderId === "all",
    isPermanent: true
  });
  foldersListEl.appendChild(allLi);

  // 2. Пользовательские папки
  window.AppState.folders.forEach((folder) => {
    const li = createSidebarItem({
      id: folder.id,
      name: folder.name,
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
      isActive: window.AppState.activeFolderId === folder.id,
      isPermanent: false
    });
    foldersListEl.appendChild(li);
  });

  // 3. Корзина
  const trashLi = createSidebarItem({
    id: "trash",
    name: "Корзина",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    isActive: window.AppState.activeFolderId === "trash",
    isPermanent: true
  });
  foldersListEl.appendChild(trashLi);
}

function createSidebarItem({ id, name, icon, isActive, isPermanent }) {
  const li = document.createElement("li");
  li.className = `sidebar-item ${isActive ? "active" : ""}`;

  const button = document.createElement("button");
  button.className = "sidebar-btn";
  button.type = "button";
  button.innerHTML = `
    <span class="sidebar-icon">${icon}</span>
    <span class="sidebar-label">${name}</span>
  `;
  button.onclick = () => setActiveFolder(id);
  li.appendChild(button);

  // Кнопка удаления для пользовательских папок
  if (!isPermanent) {
    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete-folder";
    delBtn.type = "button";
    delBtn.title = "Удалить папку";
    delBtn.innerHTML = `&times;`;
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteFolder(id);
    };
    li.appendChild(delBtn);
  }

  return li;
}

// Обновление опций <select> в формах создания и редактирования заметки
function updateFolderSelectOptions() {
  const selects = [
    document.getElementById("creator-folder-select"),
    document.getElementById("editor-folder-select")
  ];

  selects.forEach((sel) => {
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = `<option value="">📁 Без папки</option>`;
    window.AppState.folders.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = `📁 ${f.name}`;
      sel.appendChild(opt);
    });
    if (currentVal) sel.value = currentVal;
  });
}

// Управление шторкой боковой панели
function toggleSidebar() {
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("active");
  } else {
    sidebar.classList.toggle("collapsed");
    document.body.classList.toggle("sidebar-collapsed");
  }
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");
}

function setupFolderEvents() {
  btnToggleSidebar?.addEventListener("click", toggleSidebar);
  sidebarOverlay?.addEventListener("click", closeSidebar);

  // Форма добавления папки
  btnNewFolder?.addEventListener("click", () => {
    newFolderInputWrap.classList.remove("hidden");
    inputFolderName.focus();
  });

  btnCancelNewFolder?.addEventListener("click", () => {
    newFolderInputWrap.classList.add("hidden");
    inputFolderName.value = "";
  });

  btnSaveNewFolder?.addEventListener("click", async () => {
    const val = inputFolderName.value;
    if (val.trim()) {
      await createFolder(val);
      inputFolderName.value = "";
      newFolderInputWrap.classList.add("hidden");
    }
  });

  inputFolderName?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnSaveNewFolder.click();
    } else if (e.key === "Escape") {
      btnCancelNewFolder.click();
    }
  });
}
