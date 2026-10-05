"use client";

import { useEffect, useState } from "react";
import { WbSandboxLab } from "@/components/wb-sandbox-lab";
import {
  CheckCircle2,
  CircleAlert,
  Link2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type IntegrationStatus = {
  supabase: boolean;
  openrouter: boolean;
  imagerouter: boolean;
  telegram: boolean;
  wildberries: boolean;
};

type WbResult = {
  category: string;
  host: string;
  ok: boolean;
  status: number;
  wbStatus?: string | null;
  timestamp?: string | null;
  error?: string | null;
};

type WbCheck = {
  ok: boolean;
  mode: string;
  checkedAt?: string;
  error?: string;
  retryAfterMs?: number;
  results: WbResult[];
};

export function IntegrationsPanel() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [wbCheck, setWbCheck] = useState<WbCheck | null>(null);
  const [checkingWb, setCheckingWb] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setStatus(payload))
      .catch(() => setStatus(null));
  }, []);

  async function checkWildberries() {
    setCheckingWb(true);
    try {
      const response = await fetch("/api/integrations/wb/test", {
        cache: "no-store",
      });
      const payload = (await response.json()) as WbCheck;
      setWbCheck(payload);
    } finally {
      setCheckingWb(false);
    }
  }

  const integrations = [
    {
      name: "Wildberries · песочница",
      subtitle: "Реальный тестовый API-контур: карточки, цены, статистика, реклама и отзывы",
      status: status?.wildberries ? "Токен задан" : "Токен не задан",
      connected: Boolean(status?.wildberries),
      icon: "WB",
      tone: "purple",
    },
    {
      name: "Ozon",
      subtitle: "Вторая площадка: продажи, остатки и прибыль пока на демо-данных",
      status: "Демо-канал",
      connected: true,
      icon: "OZ",
      tone: "blue",
    },
    {
      name: "Supabase",
      subtitle: "Основная демо-база, журнал действий и слой данных по каналам",
      status: status?.supabase ? "Подключено" : "Резервный режим",
      connected: Boolean(status?.supabase),
      icon: "DB",
      tone: "green",
    },
    {
      name: "OpenRouter",
      subtitle: "Тексты карточек, отзывы, объяснения и ИИ-рекомендации",
      status: status?.openrouter ? "Подключено" : "Ключ не задан",
      connected: Boolean(status?.openrouter),
      icon: "AI",
      tone: "cyan",
    },
    {
      name: "ImageRouter",
      subtitle: "Изображения и медиа для карточек товаров",
      status: status?.imagerouter ? "Подключено" : "Ключ не задан",
      connected: Boolean(status?.imagerouter),
      icon: "IMG",
      tone: "pink",
    },
    {
      name: "Telegram",
      subtitle: "Финальный слой: согласования, уведомления и быстрые команды",
      status: status?.telegram ? "Подключено" : "Запланировано",
      connected: Boolean(status?.telegram),
      icon: "TG",
      tone: "yellow",
    },
  ];

  return (
    <div className="integration-page">
      <div className="integration-grid">
        {integrations.map((item) => (
          <article className="card integration-card" key={item.name}>
            <div className={`integration-icon ${item.tone}`}>{item.icon}</div>
            <div className="integration-copy">
              <strong>{item.name}</strong>
              <span>{item.subtitle}</span>
            </div>
            <span
              className={
                item.connected
                  ? "integration-status connected"
                  : "integration-status"
              }
            >
              {item.connected ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />}
              {item.status}
            </span>
          </article>
        ))}
      </div>

      <article className="card wb-diagnostics">
        <div className="card-header">
          <div>
            <span className="eyebrow">
              <ShieldCheck size={14} /> Проверка соединения
            </span>
            <h2>Wildberries · песочница</h2>
            <p>
              Проверка доступности без записи. Тест не создаёт карточки, кампании,
              отзывы или поставки.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={checkWildberries}
            disabled={checkingWb || !status?.wildberries}
          >
            <RefreshCw size={16} />
            {checkingWb ? "Проверяем..." : "Проверить соединение"}
          </button>
        </div>

        {!wbCheck ? (
          <div className="wb-empty-state">
            <Link2 size={24} />
            <div>
              <strong>Токен ещё не проверялся из интерфейса</strong>
              <span>
                Нажмите кнопку — система проверит пять тестовых сервисов и сохранит
                безопасный результат в Supabase.
              </span>
            </div>
          </div>
        ) : wbCheck.results.length === 0 ? (
          <div className="wb-empty-state error">
            <CircleAlert size={24} />
            <div>
              <strong>Проверка не выполнена</strong>
              <span>{wbCheck.error ?? "Неизвестная ошибка"}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="wb-check-summary">
              <div>
                <span>Результат</span>
                <strong className={wbCheck.ok ? "ok-text" : "bad-metric"}>
                  {wbCheck.ok ? "Все сервисы доступны" : "Есть проблемы"}
                </strong>
              </div>
              <div>
                <span>Режим</span>
                <strong>{wbCheck.mode === "sandbox" ? "Песочница" : wbCheck.mode}</strong>
              </div>
              <div>
                <span>Проверено</span>
                <strong>
                  {wbCheck.checkedAt
                    ? new Date(wbCheck.checkedAt).toLocaleString("ru-RU")
                    : "—"}
                </strong>
              </div>
            </div>

            <div className="wb-service-grid">
              {wbCheck.results.map((item) => (
                <div
                  className={item.ok ? "wb-service ok" : "wb-service fail"}
                  key={item.category}
                >
                  <div className="wb-service-top">
                    <strong>{item.category}</strong>
                    <span>{item.ok ? "200 / доступно" : `HTTP ${item.status}`}</span>
                  </div>
                  <small>{item.host}</small>
                  {!item.ok && <p>{item.error ?? "Ошибка соединения"}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </article>

      <WbSandboxLab />
    </div>
  );
}
