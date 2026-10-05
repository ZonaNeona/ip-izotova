"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Eye,
  MessageCircle,
  RefreshCw,
  Send,
  Settings2,
  X,
} from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";

type ReportCode =
  | "overview"
  | "advertising"
  | "feedback"
  | "inventory"
  | "economics"
  | "alerts";

type Route = {
  id: string;
  code: ReportCode;
  name: string;
  enabled: boolean;
  topicId: number | null;
  scheduleHint: string | null;
  lastSentAt: string | null;
};

type StatusPayload = {
  connected: boolean;
  botConfigured: boolean;
  chatConfigured: boolean;
  readyRoutes: number;
  routes: Route[];
};

export function TelegramReporting() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    code: ReportCode;
    text: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testInfo, setTestInfo] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/telegram/report", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (response.ok) setStatus(payload);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!preview) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreview(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [preview]);

  async function previewReport(route: Route) {
    setBusy(`preview:${route.code}`);
    setMessage(null);
    try {
      const response = await fetch("/api/telegram/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", code: route.code }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Не удалось сформировать отчёт.");
        return;
      }
      setPreview({
        title: route.name,
        code: route.code,
        text: payload.preview ?? "",
      });
    } finally {
      setBusy(null);
    }
  }

  async function sendReport(route: Route) {
    setBusy(`send:${route.code}`);
    setMessage(null);
    try {
      const response = await fetch("/api/telegram/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", code: route.code }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Не удалось отправить отчёт.");
        return;
      }

      setMessage(
        payload.sent
          ? `Отчёт «${route.name}» отправлен.`
          : payload.warning ?? "Показан режим предпросмотра.",
      );
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function testTelegram() {
    setBusy("test");
    setMessage(null);
    setTestInfo(null);
    try {
      const response = await fetch("/api/telegram/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Не удалось проверить Telegram.");
        return;
      }

      if (payload.mode === "preview") {
        setTestInfo(payload.message);
        return;
      }

      setTestInfo(
        `${payload.botName ?? "Бот"} · ${payload.chatTitle ?? "супергруппа"} · ${payload.isForum ? "темы включены" : "темы не включены"}`,
      );
    } finally {
      setBusy(null);
    }
  }

  async function setupTopics() {
    setBusy("topics");
    setMessage(null);
    try {
      const response = await fetch("/api/telegram/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup_topics" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Не удалось создать темы.");
        return;
      }

      const created = (payload.results ?? []).filter(
        (item: { ok?: boolean }) => item.ok,
      ).length;
      const failed = (payload.results ?? []).length - created;
      setMessage(
        failed
          ? `Темы настроены частично: ${created} успешно, ${failed} с ошибкой.`
          : "Все темы Telegram созданы и привязаны.",
      );
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function toggleRoute(route: Route) {
    setBusy(`toggle:${route.code}`);
    try {
      await fetch("/api/telegram/report", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: route.code,
          enabled: !route.enabled,
        }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function sendAll() {
    setBusy("all");
    setMessage(null);
    try {
      const response = await fetch("/api/telegram/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_all" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Не удалось отправить отчёты.");
        return;
      }

      const sent = (payload.results ?? []).filter(
        (item: { sent?: boolean }) => item.sent,
      ).length;
      setMessage(
        sent
          ? `Отправлено отчётов: ${sent}.`
          : "Живые отчёты не отправлены: проверьте подключение и темы.",
      );
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card telegram-reporting">
      <div className="telegram-reporting-head">
        <div>
          <span className="eyebrow">
            <MessageCircle size={14} /> Telegram
          </span>
          <h2>Супергруппа с тематическими отчётами</h2>
          <p>
            Каждый тип отчёта маршрутизируется в отдельную тему. Бот может
            создать темы автоматически после подключения.
          </p>
        </div>

        <div className="telegram-head-actions">
          <button
            className="secondary-button"
            onClick={testTelegram}
            disabled={busy === "test"}
          >
            <RefreshCw size={14} />
            {busy === "test" ? "Проверяем…" : "Проверить"}
          </button>
          <button
            className="primary-button"
            onClick={setupTopics}
            disabled={!status?.connected || busy === "topics"}
          >
            <Settings2 size={14} />
            {busy === "topics" ? "Создаём темы…" : "Создать темы"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="telegram-loading">
          <RefreshCw size={18} />
          Загружаем маршруты…
        </div>
      ) : (
        <>
          <div className="telegram-connection-summary">
            <div>
              <span>Бот</span>
              <strong className={status?.botConfigured ? "ok-text" : ""}>
                {status?.botConfigured ? "Токен задан" : "Не подключён"}
              </strong>
            </div>
            <div>
              <span>Супергруппа</span>
              <strong className={status?.chatConfigured ? "ok-text" : ""}>
                {status?.chatConfigured ? "ID задан" : "Не подключена"}
              </strong>
            </div>
            <div>
              <span>Темы</span>
              <strong>
                {status?.readyRoutes ?? 0} / {status?.routes.length ?? 0}
              </strong>
            </div>
            <div>
              <span>Режим</span>
              <strong>{status?.connected ? "Готов к отправке" : "Предпросмотр"}</strong>
            </div>
          </div>

          {!status?.connected && (
            <div className="telegram-connect-note">
              <CircleAlert size={17} />
              <div>
                <strong>Подключение ещё не завершено</strong>
                <span>
                  Позже достаточно задать на сервере TELEGRAM_BOT_TOKEN и
                  TELEGRAM_CHAT_ID. Секреты в интерфейс не вводятся и клиенту не
                  передаются.
                </span>
              </div>
            </div>
          )}

          {testInfo && (
            <div className="telegram-test-result">
              <CheckCircle2 size={15} />
              {testInfo}
            </div>
          )}

          <div className="telegram-route-list">
            {(status?.routes ?? []).map((route) => (
              <div className="telegram-route-row" key={route.code}>
                <span
                  className={
                    route.topicId
                      ? "telegram-route-indicator ready"
                      : "telegram-route-indicator"
                  }
                />
                <div className="telegram-route-copy">
                  <strong>{route.name}</strong>
                  <span>{route.scheduleHint ?? "Отчёт по запросу"}</span>
                </div>
                <div className="telegram-route-topic">
                  <span>Тема</span>
                  <strong>
                    {route.topicId ? `#${route.topicId}` : "Не создана"}
                  </strong>
                </div>
                <div className="telegram-route-last">
                  <span>Последняя отправка</span>
                  <strong>
                    {route.lastSentAt
                      ? new Date(route.lastSentAt).toLocaleString("ru-RU")
                      : "—"}
                  </strong>
                </div>
                <button
                  className={
                    route.enabled
                      ? "telegram-route-toggle active"
                      : "telegram-route-toggle"
                  }
                  onClick={() => toggleRoute(route)}
                  disabled={busy === `toggle:${route.code}`}
                >
                  {route.enabled ? "Включён" : "Выключен"}
                </button>
                <button
                  className="telegram-icon-button"
                  onClick={() => previewReport(route)}
                  disabled={busy === `preview:${route.code}`}
                  aria-label="Предпросмотр"
                >
                  <Eye size={15} />
                </button>
                <button
                  className="telegram-icon-button send"
                  onClick={() => sendReport(route)}
                  disabled={
                    !route.enabled ||
                    busy === `send:${route.code}`
                  }
                  aria-label="Отправить"
                >
                  <Send size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="telegram-reporting-footer">
            <span>
              Отчёты формируются из текущих данных Supabase. Рекламные, складские
              и финансовые показатели считаются детерминированно.
            </span>
            <button
              className="primary-button"
              onClick={sendAll}
              disabled={!status?.connected || busy === "all"}
            >
              <Send size={15} />
              {busy === "all" ? "Отправляем…" : "Отправить все отчёты"}
            </button>
          </div>

          {message && <div className="telegram-message">{message}</div>}
        </>
      )}

      {preview && (
        <ModalPortal>
          <div
            className="telegram-preview-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPreview(null);
            }}
          >
            <section
              className="telegram-preview-modal"
              role="dialog"
              aria-modal="true"
            >
              <div className="telegram-preview-head">
                <div>
                  <span className="eyebrow">Предпросмотр Telegram</span>
                  <h3>{preview.title}</h3>
                </div>
                <button onClick={() => setPreview(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="telegram-message-preview">
                <pre>{preview.text}</pre>
              </div>
              <div className="telegram-preview-footer">
                <span>Так будет выглядеть содержимое отчёта без HTML-разметки.</span>
                <button
                  className="primary-button"
                  onClick={() => {
                    const route = status?.routes.find(
                      (item) => item.code === preview.code,
                    );
                    setPreview(null);
                    if (route) sendReport(route);
                  }}
                  disabled={!status?.connected}
                >
                  <Send size={15} /> Отправить
                </button>
              </div>
            </section>
          </div>
        </ModalPortal>
      )}
    </article>
  );
}
