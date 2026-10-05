export function severityRu(value?: string | null) {
  const map: Record<string, string> = {
    critical: "Критический",
    high: "Высокий",
    medium: "Средний",
    low: "Низкий",
    warning: "Предупреждение",
    info: "Информация",
  };
  return value ? map[value] ?? value : "—";
}

export function priorityRu(value?: string | null) {
  const map: Record<string, string> = {
    urgent: "Срочно",
    high: "Высокий",
    normal: "Обычный",
    medium: "Средний",
    low: "Низкий",
  };
  return value ? map[value] ?? value : "—";
}

export function listingStatusRu(value?: string | null) {
  const map: Record<string, string> = {
    active: "Активен",
    demo: "Демо-данные",
    sandbox_live: "Песочница WB",
    connected: "Подключено",
    error: "Ошибка",
    not_checked: "Не проверено",
  };
  return value ? map[value] ?? value : "—";
}

export function reviewStatusRu(value?: string | null) {
  const map: Record<string, string> = {
    answered: "Обработан",
    pending: "Ждёт ответа",
    new: "Новый",
  };
  return value ? map[value] ?? value : "—";
}

export function recommendationStatusRu(value?: string | null) {
  const map: Record<string, string> = {
    suggested: "Предложено",
    accepted: "Принято",
    rejected: "Отклонено",
  };
  return value ? map[value] ?? value : "—";
}

export function integrationModeRu(value?: string | null) {
  const map: Record<string, string> = {
    sandbox: "Песочница",
    live: "Рабочий режим",
    demo: "Демо-режим",
  };
  return value ? map[value] ?? value : "—";
}
