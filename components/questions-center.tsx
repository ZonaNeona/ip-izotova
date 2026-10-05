"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  ChevronRight,
  CircleHelp,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { MarketplaceLinks } from "@/components/marketplace-links";
import { ModalPortal } from "@/components/modal-portal";
import { reviewStatusRu } from "@/lib/ui-ru";

type Question = {
  id: string;
  externalId: string;
  product: {
    id: string;
    sku: string;
    name: string;
    thumbnailUrl: string | null;
    specs: Record<string, string | number | boolean>;
  };
  channel: {
    code: string;
    name: string;
    externalProductId: string | null;
  };
  author: string | null;
  body: string;
  type: string;
  fallbackAnswer: string;
  draft: string | null;
  answer: string | null;
  policy: string;
  status: string;
  createdAt: string;
  answeredAt: string | null;
};

type ChannelFilter = "all" | "wb" | "ozon";
type StatusFilter = "all" | "waiting" | "answered";

function formatHours(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value < 1) return Math.max(1, Math.round(value * 60)) + " мин.";
  if (value < 24) return value.toFixed(value < 10 ? 1 : 0) + " ч.";
  return (value / 24).toFixed(1) + " дн.";
}

export function QuestionsCenter({
  onQueueChange,
}: {
  onQueueChange?: (count: number) => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [groundedFacts, setGroundedFacts] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/questions", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setQuestions(payload.questions ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return questions.filter((question) => {
      if (
        query &&
        !question.product.name.toLowerCase().includes(query) &&
        !question.product.sku.toLowerCase().includes(query) &&
        !question.body.toLowerCase().includes(query) &&
        !(question.author ?? "").toLowerCase().includes(query)
      ) {
        return false;
      }

      if (channel !== "all" && question.channel.code !== channel) return false;
      if (status === "waiting" && question.status === "answered") return false;
      if (status === "answered" && question.status !== "answered") return false;
      return true;
    });
  }, [questions, search, channel, status]);

  useEffect(() => {
    setPage(1);
  }, [search, channel, status, pageSize]);

  useEffect(() => {
    onQueueChange?.(
      questions.filter((question) => question.status !== "answered").length,
    );
  }, [questions, onQueueChange]);

  const totals = useMemo(() => {
    const total = questions.length;
    const answered = questions.filter(
      (question) => question.status === "answered",
    );
    const waiting = total - answered.length;
    const withDraft = questions.filter(
      (question) => Boolean(question.draft || question.answer),
    ).length;
    const wb = questions.filter((question) => question.channel.code === "wb").length;
    const ozon = questions.filter(
      (question) => question.channel.code === "ozon",
    ).length;

    const responseHours = answered
      .filter((question) => question.answeredAt)
      .map(
        (question) =>
          (new Date(question.answeredAt!).getTime() -
            new Date(question.createdAt).getTime()) /
          3_600_000,
      )
      .filter((value) => value >= 0);

    return {
      total,
      waiting,
      answered: answered.length,
      withDraft,
      wb,
      ozon,
      avgResponse:
        responseHours.length > 0
          ? responseHours.reduce((sum, value) => sum + value, 0) /
            responseHours.length
          : 0,
    };
  }, [questions]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginated = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const selected =
    questions.find((question) => question.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedId]);

  function openQuestion(question: Question) {
    setSelectedId(question.id);
    setAnswer(question.answer ?? question.draft ?? "");
    setGroundedFacts([]);
    setConfidence(null);
    setMessage(null);
  }

  async function generateAnswer() {
    if (!selected || aiBusy) return;

    setAiBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/ai/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: selected.id }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.data) {
        setMessage(payload.error ?? "Не удалось сформировать ответ ИИ.");
        return;
      }

      setAnswer(payload.data.draft ?? "");
      setGroundedFacts(payload.data.groundedFacts ?? []);
      setConfidence(payload.data.confidence ?? null);
      setQuestions((current) =>
        current.map((question) =>
          question.id === selected.id
            ? { ...question, draft: payload.data.draft ?? question.draft }
            : question,
        ),
      );
      setMessage(
        payload.mode === "live"
          ? "Черновик сформирован ИИ по характеристикам товара."
          : "Черновик сформирован резервной логикой по характеристикам товара.",
      );
    } catch {
      setMessage("Не удалось сформировать ответ ИИ.");
    } finally {
      setAiBusy(false);
    }
  }

  async function sendAnswer() {
    if (!selected || busy || !answer.trim()) return;

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/actions/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: selected.id,
          product: selected.product.name,
          answerText: answer.trim(),
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "Не удалось отправить ответ.");
        return;
      }

      const answeredAt = payload.answeredAt ?? new Date().toISOString();
      setQuestions((current) =>
        current.map((question) =>
          question.id === selected.id
            ? {
                ...question,
                status: "answered",
                answer: answer.trim(),
                answeredAt,
              }
            : question,
        ),
      );
      setMessage("Ответ отправлен и сохранён в истории.");
    } catch {
      setMessage("Не удалось отправить ответ.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="questions-loading card">
        <RefreshCw size={24} />
        <strong>Загружаем вопросы…</strong>
        <span>Товары, характеристики и очередь ответов</span>
      </div>
    );
  }

  return (
    <div className="questions-page">
      <section className="questions-kpis">
        <article className="card questions-kpi">
          <span>Всего вопросов</span>
          <strong>{totals.total}</strong>
          <small>небольшой демонстрационный пул</small>
        </article>
        <article className="card questions-kpi attention">
          <span>Требуют ответа</span>
          <strong>{totals.waiting}</strong>
          <small>новые + в обработке</small>
        </article>
        <article className="card questions-kpi">
          <span>Обработано</span>
          <strong>{totals.answered}</strong>
          <small>среднее время {formatHours(totals.avgResponse)}</small>
        </article>
        <article className="card questions-kpi">
          <span>Черновик готов</span>
          <strong>{totals.withDraft}</strong>
          <small>ИИ или резервная логика</small>
        </article>
        <article className="card questions-kpi">
          <span>Каналы</span>
          <strong>{totals.wb} / {totals.ozon}</strong>
          <small>WB / Ozon</small>
        </article>
      </section>

      <section className="card questions-grounding-note">
        <div className="questions-grounding-icon">
          <ShieldCheck size={21} />
        </div>
        <div>
          <span className="eyebrow">Ответы по фактам</span>
          <h2>ИИ получает характеристики конкретного товара</h2>
          <p>
            В запрос к модели передаются название, SKU, вопрос покупателя и
            структурированные характеристики из каталога. Если нужного факта в
            характеристиках нет, модель не должна его придумывать.
          </p>
        </div>
      </section>

      <section className="card questions-list-card">
        <div className="questions-toolbar">
          <div className="search-box questions-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Товар, SKU, покупатель или текст вопроса"
            />
          </div>

          <div className="questions-channel-switch">
            {(["all", "wb", "ozon"] as ChannelFilter[]).map((value) => (
              <button
                key={value}
                className={channel === value ? "active" : ""}
                onClick={() => setChannel(value)}
              >
                {value === "all" ? "Все" : value === "wb" ? "WB" : "Ozon"}
              </button>
            ))}
          </div>

          <div className="questions-status-switch">
            {([
              ["all", "Все"],
              ["waiting", "Требуют ответа"],
              ["answered", "Обработаны"],
            ] as Array<[StatusFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                className={status === value ? "active" : ""}
                onClick={() => setStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="questions-subtoolbar">
          <span>{filtered.length} вопросов</span>
          <span>Все вопросы подобраны так, чтобы ответ был в характеристиках товара.</span>
        </div>

        <div className="questions-table-wrap">
          <div className="questions-table">
            <div className="questions-row questions-head">
              <span>Товар</span>
              <span>Канал</span>
              <span>Вопрос</span>
              <span>Тип</span>
              <span>Черновик ИИ</span>
              <span>Статус</span>
              <span>Дата</span>
              <span />
            </div>

            {paginated.map((question) => (
              <div
                className="questions-row questions-data-row"
                key={question.id}
                role="button"
                tabIndex={0}
                onClick={() => openQuestion(question)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openQuestion(question);
                  }
                }}
              >
                <div className="questions-product-cell">
                  <span className="questions-product-thumb">
                    {question.product.thumbnailUrl ? (
                      <img
                        src={question.product.thumbnailUrl}
                        alt={question.product.name}
                      />
                    ) : (
                      <CircleHelp size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{question.product.name}</strong>
                    <small>{question.product.sku}</small>
                    <MarketplaceLinks
                      sku={question.product.sku}
                      wbId={
                        question.channel.code === "wb"
                          ? question.channel.externalProductId
                          : null
                      }
                      ozonId={
                        question.channel.code === "ozon"
                          ? question.channel.externalProductId
                          : null
                      }
                      only={question.channel.code === "wb" ? "wb" : "ozon"}
                      compact
                    />
                  </span>
                </div>

                <span>
                  <i className={`questions-channel ${question.channel.code}`}>
                    {question.channel.code === "wb" ? "WB" : "Ozon"}
                  </i>
                </span>

                <span className="questions-body-cell">
                  <strong>{question.author ?? "Покупатель"}</strong>
                  <small>{question.body}</small>
                </span>

                <span className="questions-type">{question.type}</span>

                <span>
                  <i
                    className={
                      question.draft || question.answer
                        ? "questions-ai ready"
                        : "questions-ai empty"
                    }
                  >
                    {question.draft || question.answer ? "Готов" : "Не создан"}
                  </i>
                </span>

                <span>
                  <i
                    className={
                      question.status === "answered"
                        ? "questions-status answered"
                        : question.status === "new"
                          ? "questions-status new"
                          : "questions-status pending"
                    }
                  >
                    {reviewStatusRu(question.status)}
                  </i>
                </span>

                <span className="questions-date">
                  {new Date(question.createdAt).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </span>

                <span className="questions-chevron">
                  <ChevronRight size={16} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="questions-pagination">
          <div className="questions-page-size">
            <span>Показывать</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>
              {filtered.length === 0
                ? "0 вопросов"
                : `${(safePage - 1) * pageSize + 1}–${Math.min(
                    safePage * pageSize,
                    filtered.length,
                  )} из ${filtered.length}`}
            </span>
          </div>

          <div className="questions-page-controls">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
            >
              Назад
            </button>
            <span>
              {safePage} / {pageCount}
            </span>
            <button
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
              disabled={safePage >= pageCount}
            >
              Далее
            </button>
          </div>
        </div>
      </section>

      {selected && (
        <ModalPortal>
          <div
            className="questions-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
          >
            <section
              className="questions-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="questions-modal-title"
            >
              <div className="questions-modal-head">
                <div>
                  <span className="eyebrow">
                    <CircleHelp size={14} /> Вопрос покупателя
                  </span>
                  <h3 id="questions-modal-title">{selected.product.name}</h3>
                  <p>
                    {selected.channel.code === "wb" ? "Wildberries" : "Ozon"} ·{" "}
                    {reviewStatusRu(selected.status)}
                  </p>
                </div>
                <button onClick={() => setSelectedId(null)} aria-label="Закрыть">
                  <X size={19} />
                </button>
              </div>

              <div className="questions-modal-body">
                <div className="questions-modal-product">
                  <div>
                    <strong>{selected.product.name}</strong>
                    <span>{selected.product.sku}</span>
                  </div>
                  <MarketplaceLinks
                    sku={selected.product.sku}
                    wbId={
                      selected.channel.code === "wb"
                        ? selected.channel.externalProductId
                        : null
                    }
                    ozonId={
                      selected.channel.code === "ozon"
                        ? selected.channel.externalProductId
                        : null
                    }
                    only={selected.channel.code === "wb" ? "wb" : "ozon"}
                  />
                </div>

                <div className="questions-modal-question">
                  <div>
                    <strong>{selected.author ?? "Покупатель"}</strong>
                    <small>{new Date(selected.createdAt).toLocaleString("ru-RU")}</small>
                  </div>
                  <p>{selected.body}</p>
                </div>

                <div className="questions-specs">
                  <div className="questions-specs-head">
                    <div>
                      <span className="eyebrow">Источник ответа</span>
                      <h4>Характеристики товара</h4>
                    </div>
                    <span className="questions-grounded-chip">
                      <ShieldCheck size={13} /> Передаются в ИИ
                    </span>
                  </div>
                  <div className="questions-specs-grid">
                    {Object.entries(selected.product.specs).map(
                      ([key, value]) => (
                        <div key={key}>
                          <span>{key}</span>
                          <strong>{String(value)}</strong>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <label className="questions-answer-editor">
                  <div>
                    <span>
                      {selected.status === "answered"
                        ? "Отправленный ответ"
                        : "Ответ покупателю"}
                    </span>
                    {selected.status !== "answered" && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={generateAnswer}
                        disabled={aiBusy}
                      >
                        <Bot size={13} />
                        {aiBusy
                          ? "Формируем…"
                          : selected.draft
                            ? "Обновить черновик ИИ"
                            : "Сформировать черновик ИИ"}
                      </button>
                    )}
                  </div>

                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    readOnly={selected.status === "answered"}
                    placeholder="Сформируйте ответ ИИ или напишите его вручную…"
                  />
                </label>

                {(groundedFacts.length > 0 || confidence) && (
                  <div className="questions-ai-evidence">
                    <div>
                      <span>Уверенность</span>
                      <strong>{confidence ?? "—"}</strong>
                    </div>
                    {groundedFacts.length > 0 && (
                      <div>
                        <span>Факты, использованные в ответе</span>
                        <ul>
                          {groundedFacts.map((fact) => (
                            <li key={fact}>{fact}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {message && <div className="questions-message">{message}</div>}
              </div>

              <div className="questions-modal-footer">
                <div>
                  Ответ проверяется оператором перед отправкой и сохраняется в журнале.
                </div>
                <div className="questions-modal-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setSelectedId(null)}
                  >
                    Закрыть
                  </button>
                  {selected.status !== "answered" && (
                    <button
                      className="primary-button"
                      onClick={sendAnswer}
                      disabled={busy || !answer.trim()}
                    >
                      {busy ? (
                        <>
                          <RefreshCw size={15} /> Отправляем…
                        </>
                      ) : (
                        <>
                          <Send size={15} /> Отправить ответ
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
