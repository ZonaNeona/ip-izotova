# WB AI Control Center

Демонстрационный внутренний control center для seller-команды Wildberries/Ozon.

Проект показывает не «зоопарк агентов», а рабочий контур автоматизации:

**данные → детерминированный расчёт → рекомендация → согласование → действие → audit log → сверка результата**

## Что уже реализовано

- Overview / центр управления с KPI и операционными сигналами
- Реклама и ставки с рекомендациями и подтверждением действия
- Отзывы и вопросы с AI-черновиком и approval-политикой
- Мастер создания карточки товара в demo AI режиме
- Остатки, прогноз stockout и создание заявки на поставку
- Юнит-экономика без LLM
- Сверка WB ↔ учётная система
- Журнал действий
- Экран интеграций
- Demo Mode без кабинета продавца WB
- Docker/standalone конфигурация для self-hosting

## Архитектура

```text
Next.js Admin UI
      │
      ├── deterministic business logic
      ├── approvals / audit
      ├── AI tools
      │     ├── OpenRouter
      │     └── ImageRouter
      │
      ├── WB adapter
      │     ├── Demo Mode now
      │     └── WB API later
      │
      └── data layer
            ├── demo seed now
            └── Supabase next
```

## Локальный запуск

Требуется Node.js 22.

```bash
npm install
npm run dev
```

Открыть: http://localhost:3000

## Production build

```bash
npm run typecheck
npm run build
npm run start
```

## Docker

```bash
docker build -t wb-ai-control-center .
docker run -p 3000:3000 wb-ai-control-center
```

Next.js настроен с `output: "standalone"`, поэтому приложение можно разместить на обычном Node.js/Docker сервере, включая VPS.

## Переменные окружения

Скопировать `.env.example` в `.env.local`.

Секретные ключи никогда не коммитить в GitHub.

```env
OPENROUTER_API_KEY=
IMAGEROUTER_API_KEY=
WB_API_TOKEN=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
TELEGRAM_BOT_TOKEN=
```

## Следующие итерации

1. Supabase: постоянная БД, auth, audit log, approvals
2. OpenRouter: ответы на отзывы, объяснения и генерация контента
3. ImageRouter: генерация/обработка изображений карточек
4. Telegram: уведомления и подтверждение критичных действий
5. WB adapter: реальный Sandbox/production API при появлении seller-токена
6. Deployment на Beget VPS + HTTPS/domain
