// src/util/confirm.js
//
// Единое подтверждение удаления компонентов. Раньше удаление срабатывало
// мгновенно из трёх мест (кнопка в топбаре, корзина в панели слоёв и
// клавиша Delete на холсте) — случайное нажатие Delete при выделенном
// компоненте молча стирало работу.

function confirmRemoveComponents(store, ids) {
  const list = (ids || [])
    .map((id) => store.state.components.find((c) => c.id === id))
    .filter(Boolean);
  if (!list.length) return false;

  const shown = list.slice(0, 6).map((c) => `• ${c.name} (${c.id})`).join('\n');
  const rest = list.length > 6 ? `\n…и ещё ${list.length - 6}` : '';
  const head = list.length === 1
    ? 'Удалить компонент?'
    : `Удалить компоненты (${list.length} шт.)?`;

  if (!confirm(`${head}\n\n${shown}${rest}\n\nДействие можно отменить через Ctrl+Z.`)) return false;
  store.removeComponents(ids);
  return true;
}
