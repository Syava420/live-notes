// =============================================================================
// МОДУЛЬ СПИСКОВ И ЧЕКБОКСОВ (js/checklist.js)
// Google Keep / Apple Notes интерактивные пункты списка дел
// =============================================================================

const checklistBox = document.getElementById("editor-checklist-box");
const btnToggleChecklist = document.getElementById("btn-insert-checkbox");

window.ChecklistManager = {
  items: [], // [{ id, text, completed }]

  // Инициализация чек-листа в редакторе
  load(items = []) {
    this.items = Array.isArray(items) ? [...items] : [];
    this.render();
  },

  // Очистка
  clear() {
    this.items = [];
    this.render();
  },

  // Добавление нового пункта
  addItem(text = "", completed = false, focus = true) {
    const newItem = {
      id: "chk-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      text: text,
      completed: completed
    };
    this.items.push(newItem);
    this.render();

    if (focus) {
      setTimeout(() => {
        const inputs = checklistBox.querySelectorAll(".checklist-item-input");
        const lastInput = inputs[inputs.length - 1];
        lastInput?.focus();
      }, 30);
    }
    window.saveEditorNow?.();
  },

  // Переключение выполнения пункта
  toggle(id) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.completed = !item.completed;
    this.render();
    window.saveEditorNow?.();
  },

  // Удаление пункта
  remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
    this.render();
    window.saveEditorNow?.();
  },

  // Отрисовка пунктов в редакторе
  render() {
    if (!checklistBox) return;
    checklistBox.innerHTML = "";

    if (this.items.length === 0) {
      checklistBox.classList.add("hidden");
      return;
    }

    checklistBox.classList.remove("hidden");

    this.items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = `checklist-row ${item.completed ? "is-done" : ""}`;

      // Чекбокс
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "checklist-cb";
      cb.checked = !!item.completed;
      cb.onclick = () => this.toggle(item.id);

      // Поле ввода текста пункта
      const input = document.createElement("input");
      input.type = "text";
      input.className = "checklist-item-input";
      input.value = item.text || "";
      input.placeholder = "Пункт списка...";

      input.oninput = (e) => {
        item.text = e.target.value;
        window.saveEditorNow?.();
      };

      // Нажатие Enter создаёт СЛЕДУЮЩИЙ пункт автоматически!
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.addItem("", false, true);
        } else if (e.key === "Backspace" && input.value === "" && this.items.length > 1) {
          e.preventDefault();
          this.remove(item.id);
          const inputs = checklistBox.querySelectorAll(".checklist-item-input");
          const prev = inputs[Math.max(0, index - 1)];
          prev?.focus();
        }
      };

      // Кнопка удаления пункта
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-del-checklist-item";
      delBtn.innerHTML = `&times;`;
      delBtn.onclick = () => this.remove(item.id);

      row.appendChild(cb);
      row.appendChild(input);
      row.appendChild(delBtn);
      checklistBox.appendChild(row);
    });

    // Кнопка "+ Добавить пункт"
    const addRowBtn = document.createElement("button");
    addRowBtn.type = "button";
    addRowBtn.className = "btn-add-checklist-row";
    addRowBtn.innerHTML = `<span>+</span> <span>Пункт списка</span>`;
    addRowBtn.onclick = () => this.addItem("", false, true);
    checklistBox.appendChild(addRowBtn);
  },

  // Получить данные для сохранения в Firestore
  getData() {
    return this.items.filter((i) => i.text.trim().length > 0 || i.completed);
  }
};

btnToggleChecklist?.addEventListener("click", () => {
  // Нажатие на кнопку тулбара ☑️ добавляет первый чекбокс или открывает список
  window.ChecklistManager.addItem("", false, true);
});
