// =============================================================================
// МОДУЛЬ ЖЕСТОВ: СВАЙП В АРХИВ И ДОЛГОЕ НАЖАТИЕ (js/gestures.js)
// =============================================================================

window.CardGestures = {
  attach(cardElement, noteId) {
    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let isHorizontalSwipe = false;
    let longPressTimer = null;
    let isLongPressed = false;

    cardElement.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      deltaX = 0;
      isHorizontalSwipe = false;
      isLongPressed = false;

      // Долгое нажатие (500мс)
      longPressTimer = setTimeout(() => {
        isLongPressed = true;
        navigator.vibrate?.(40);
        showQuickActionSheet(noteId);
      }, 550);
    }, { passive: true });

    cardElement.addEventListener("touchmove", (e) => {
      if (isLongPressed) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - startX;
      const diffY = currentY - startY;

      // Если палец двигается — отменяем долгое нажатие
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        clearTimeout(longPressTimer);
      }

      if (!isHorizontalSwipe && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 15) {
        isHorizontalSwipe = true;
      }

      if (isHorizontalSwipe) {
        deltaX = diffX;
        // Ограничиваем сдвиг
        cardElement.style.transform = `translateX(${deltaX}px)`;
        cardElement.style.opacity = `${Math.max(0.3, 1 - Math.abs(deltaX) / 250)}`;
      }
    }, { passive: true });

    cardElement.addEventListener("touchend", () => {
      clearTimeout(longPressTimer);
      if (isLongPressed) return;

      if (isHorizontalSwipe) {
        if (Math.abs(deltaX) > 85) {
          // Успешный свайп -> отправляем в Архив!
          cardElement.style.transition = "transform 0.2s ease, opacity 0.2s ease";
          cardElement.style.transform = `translateX(${deltaX > 0 ? 300 : -300}px)`;
          cardElement.style.opacity = "0";
          setTimeout(() => {
            window.toggleArchiveNote?.(noteId);
          }, 200);
        } else {
          // Возврат назад
          cardElement.style.transition = "transform 0.15s ease, opacity 0.15s ease";
          cardElement.style.transform = "translateX(0)";
          cardElement.style.opacity = "1";
        }
      }
    });

    cardElement.addEventListener("touchcancel", () => {
      clearTimeout(longPressTimer);
      cardElement.style.transform = "translateX(0)";
      cardElement.style.opacity = "1";
    });
  }
};

// Быстрое меню действий по долгому нажатию
function showQuickActionSheet(noteId) {
  const note = window.AppState.notes.find((n) => n.id === noteId);
  if (!note) return;

  const action = confirm(
    `Заметка: "${note.title || 'Без названия'}"\n\n` +
    `Переместить в корзину? (Нажмите ОК для удаления, Отмена — оставить)`
  );
  if (action) {
    window.deleteNoteDirectly?.(noteId);
  }
}
