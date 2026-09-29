// =============================================================================
// МОДУЛЬ ПАПОК И ВЫДВИЖНОЙ ШТОРКИ (js/folders.js)
// =============================================================================

const appDrawer = document.getElementById("app-drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const btnOpenSidebar = document.getElementById("btn-open-sidebar");
const drawerFoldersList = document.getElementById("drawer-folders-list");
const btnDrawerAddFolder = document.getElementById("btn-drawer-add-folder");
const drawerNewFolderWrap = document.getElementById("drawer-new-folder-wrap");
const inputNewFolderName = document.getElementById("input-new-folder-name");
const btnSaveFolderName = document.getElementById("btn-save-folder-name");
const btnCancelFolderName = document.getElementById("btn-cancel-folder-name");
const foldersChipList = document.getElementById("folders-chip-list");

function initFoldersModule() {
  setupFolderEvents();

  if (window.AppState.isFirebaseMode) {
    listenToFolders();
  } else {
    const saved = localStorage.getItem("app_folders_v2");
    window.AppState.folders = saved ? JSON.parse(saved) : [
      { id: "work", name: "Работа" },
      { id: "personal", name: "Личное" }
    ];
    renderAllFolderViews();
  }
}

// Слушатель Firestore
function listenToFolders() {
  window.AppState.db.collection("folders").orderBy("createdAt", "asc").onSnapshot(
    (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      window.AppState.folders = list;
      renderAllFolderViews();
    },
    (err) => console.warn("Ошибка загрузки папок:", err)
  );
}

// Создание папки
async function createFolder(name) {
  const clean = name.trim();
  if (!clean) return;

  if (window.AppState.isFirebaseMode) {
    try {
      await window.AppState.db.collection("folders").add({
        name: clean,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      alert("Не удалось создать папку: " + e.message);
    }
  } else {
    window.AppState.folders.push({ id: "folder-" + Date.now(), name: clean });
    localStorage.setItem("app_folders_v2", JSON.stringify(window.AppState.folders));
    renderAllFolderViews();
  }
}

// Удаление папки
async function deleteFolder(folderId) {
  if (!confirm("Удалить эту папку? Заметки останутся в общем списке.")) return;

  if (window.AppState.isFirebaseMode) {
    await window.AppState.db.collection("folders").doc(folderId).delete();
  } else {
    window.AppState.folders = window.AppState.folders.filter((f) => f.id !== folderId);
    localStorage.setItem("app_folders_v2", JSON.stringify(window.AppState.folders));
    renderAllFolderViews();
  }

  if (window.AppState.activeFolderId === folderId) {
    setActiveFolder("all");
  }
}

function setActiveFolder(folderId) {
  window.AppState.activeFolderId = folderId;
  renderAllFolderViews();
  window.renderFeed?.();
  closeDrawer();
}

// Отрисовка папок (и в выдвижной шторке, и в горизонтальных чипах над заметками)
function renderAllFolderViews() {
  renderDrawer();
  renderHorizontalChips();
  updateEditorFolderSelect();
}

// 1. Выдвижная шторка
function renderDrawer() {
  if (!drawerFoldersList) return;
  drawerFoldersList.innerHTML = "";

  // Все заметки
  const allItem = createDrawerItem("all", "Все заметки", "📝", true);
  drawerFoldersList.appendChild(allItem);

  // Пользовательские папки
  window.AppState.folders.forEach((f) => {
    const item = createDrawerItem(f.id, f.name, "📁", false);
    drawerFoldersList.appendChild(item);
  });

  // Корзина
  const trashItem = createDrawerItem("trash", "Корзина", "🗑️", true);
  drawerFoldersList.appendChild(trashItem);
}

function createDrawerItem(id, name, emoji, isPermanent) {
  const li = document.createElement("li");
  const isActive = window.AppState.activeFolderId === id;
  li.className = `drawer-item ${isActive ? "active" : ""}`;

  const titleDiv = document.createElement("div");
  titleDiv.className = "drawer-item-title";
  titleDiv.innerHTML = `<span>${emoji}</span> <span>${name}</span>`;
  li.appendChild(titleDiv);

  if (!isPermanent) {
    const delBtn = document.createElement("button");
    delBtn.className = "btn-del-folder";
    delBtn.innerHTML = `&times;`;
    delBtn.title = "Удалить папку";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteFolder(id);
    };
    li.appendChild(delBtn);
  }

  li.onclick = () => setActiveFolder(id);
  return li;
}

// 2. Горизонтальные чипы над списком (для быстрого свайпа пальцем)
function renderHorizontalChips() {
  if (!foldersChipList) return;
  foldersChipList.innerHTML = "";

  const allChip = createChip("all", "Все");
  foldersChipList.appendChild(allChip);

  window.AppState.folders.forEach((f) => {
    const chip = createChip(f.id, f.name);
    foldersChipList.appendChild(chip);
  });

  const trashChip = createChip("trash", "Корзина");
  foldersChipList.appendChild(trashChip);
}

function createChip(id, name) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `folder-chip ${window.AppState.activeFolderId === id ? "active" : ""}`;
  btn.textContent = name;
  btn.onclick = () => setActiveFolder(id);
  return btn;
}

// 3. Выпадающий список папок в Редакторе
function updateEditorFolderSelect() {
  const sel = document.getElementById("editor-folder-select");
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
}

// Шторка
function openDrawer() {
  appDrawer.classList.add("open");
  drawerOverlay.classList.add("active");
}

function closeDrawer() {
  appDrawer.classList.remove("open");
  drawerOverlay.classList.remove("active");
}

function setupFolderEvents() {
  btnOpenSidebar?.addEventListener("click", openDrawer);
  drawerOverlay?.addEventListener("click", closeDrawer);

  btnDrawerAddFolder?.addEventListener("click", () => {
    drawerNewFolderWrap.classList.remove("hidden");
    inputNewFolderName.focus();
  });

  btnCancelFolderName?.addEventListener("click", () => {
    drawerNewFolderWrap.classList.add("hidden");
    inputNewFolderName.value = "";
  });

  btnSaveFolderName?.addEventListener("click", async () => {
    const val = inputNewFolderName.value;
    if (val.trim()) {
      await createFolder(val);
      inputNewFolderName.value = "";
      drawerNewFolderWrap.classList.add("hidden");
    }
  });

  inputNewFolderName?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSaveFolderName.click();
    if (e.key === "Escape") btnCancelFolderName.click();
  });
}
