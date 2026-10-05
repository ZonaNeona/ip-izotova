"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FileSearch,
  Film,
  ImagePlus,
  Images,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";

type CatalogItem = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  thumbnailUrl: string | null;
};

type Attribute = {
  name: string;
  value: string;
  source: "Каталог" | "Интернет";
};

type ResearchSource = {
  title: string;
  url: string;
  verifiedFact: string;
};

type StudioContent = {
  title: string;
  description: string;
  bullets: string[];
  category: string;
  searchPhrases: string[];
  attributes: Attribute[];
  researchSummary: string;
  researchSources: ResearchSource[];
  visualStyle: {
    background: string;
    lighting: string;
    palette: string;
    mood: string;
  };
};

type MediaKind = "main" | "secondary" | "technical";

type MediaItem = {
  mediaId: string | null;
  kind: MediaKind;
  title: string;
  aspectRatio: string;
  image: string | null;
  mode: "live" | "demo";
  cost?: number | null;
  latency?: number | null;
  warning?: string | null;
};

type StudioTab = "content" | "media" | "attributes" | "research";
type ChannelTarget = "both" | "wb" | "ozon";
type VideoFormat = "vertical" | "horizontal" | "square";

const mediaRoles: Array<{
  kind: MediaKind;
  title: string;
  subtitle: string;
  ratio: string;
}> = [
  {
    kind: "main",
    title: "Главная",
    subtitle: "Чистый hero-кадр товара",
    ratio: "1:1",
  },
  {
    kind: "secondary",
    title: "Вспомогательная",
    subtitle: "Товар в среде использования",
    ratio: "2:3",
  },
  {
    kind: "technical",
    title: "Техническая",
    subtitle: "Ракурс + детали без выдуманных подписей",
    ratio: "1:1",
  },
];

function channelTitle(value: ChannelTarget) {
  if (value === "wb") return "Wildberries";
  if (value === "ozon") return "Ozon";
  return "WB + Ozon";
}

export function ProductCardStudio({
  onGenerate,
}: {
  onGenerate: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [selectedSku, setSelectedSku] = useState("");
  const [targetChannel, setTargetChannel] =
    useState<ChannelTarget>("both");
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [content, setContent] = useState<StudioContent | null>(null);
  const [media, setMedia] = useState<Partial<Record<MediaKind, MediaItem>>>({});
  const [activeTab, setActiveTab] = useState<StudioTab>("media");
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedMediaKind, setSelectedMediaKind] =
    useState<MediaKind>("main");

  const [generating, setGenerating] = useState(false);
  const [imageBusy, setImageBusy] = useState<Partial<Record<MediaKind, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [videoFormat, setVideoFormat] =
    useState<VideoFormat>("vertical");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catalog", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const items = (payload.items ?? []) as CatalogItem[];
        setCatalog(items);
        if (items[0]) setSelectedSku(items[0].sku);
      })
      .finally(() => setCatalogLoading(false));
  }, []);

  const selectedProduct = useMemo(
    () => catalog.find((item) => item.sku === selectedSku) ?? null,
    [catalog, selectedSku],
  );

  useEffect(() => {
    if (!selectedProduct) return;
    setSourceImage(selectedProduct.thumbnailUrl);
    setSourceName(selectedProduct.thumbnailUrl ? "Фото из каталога" : null);
    setDraftId(null);
    setContent(null);
    setMedia({});
    setSelectedMediaId(null);
    setVideoUrl(null);
    setError(null);
    setSavedMessage(null);
  }, [selectedProduct?.sku]);

  const filteredCatalog = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return catalog;
    return catalog.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.brand.toLowerCase().includes(query),
    );
  }, [catalog, productSearch]);

  function onFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Нужен файл изображения.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Загрузите изображение до 5 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSourceImage(typeof reader.result === "string" ? reader.result : null);
      setSourceName(file.name);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function generateImage(currentDraftId: string, kind: MediaKind) {
    setImageBusy((state) => ({ ...state, [kind]: true }));

    try {
      const response = await fetch("/api/product-studio/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: currentDraftId, kind }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Не удалось создать изображение.");
      }

      const item: MediaItem = {
        mediaId: payload.mediaId ?? null,
        kind,
        title: payload.title,
        aspectRatio: payload.aspectRatio,
        image: payload.image ?? null,
        mode: payload.mode === "live" ? "live" : "demo",
        cost: payload.cost ?? null,
        latency: payload.latency ?? null,
        warning: payload.warning ?? null,
      };

      setMedia((state) => ({ ...state, [kind]: item }));

      if (kind === "main" && item.mediaId) {
        setSelectedMediaId(item.mediaId);
        setSelectedMediaKind("main");
      }

      return item;
    } finally {
      setImageBusy((state) => ({ ...state, [kind]: false }));
    }
  }

  async function generatePackage() {
    if (!selectedProduct || generating) return;

    setGenerating(true);
    setError(null);
    setSavedMessage(null);
    setMedia({});
    setVideoUrl(null);
    setVideoMessage(null);

    try {
      const response = await fetch("/api/product-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: selectedProduct.sku,
          targetChannel,
          researchEnabled,
          sourceImage,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Не удалось создать карточку.");
      }

      setDraftId(payload.draftId);
      setContent(payload.content);
      setSourceImage(payload.product.sourceImageUrl ?? sourceImage);
      setActiveTab("media");

      const results = await Promise.allSettled(
        mediaRoles.map((role) => generateImage(payload.draftId, role.kind)),
      );

      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length) {
        setError(
          `Карточка создана, но ${failed.length} изображ. не удалось сгенерировать. Их можно перегенерировать отдельно.`,
        );
      }

      onGenerate();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось создать пакет карточки.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft(status: "draft" | "review" = "draft") {
    if (!draftId || !content || saving) return;

    setSaving(true);
    setSavedMessage(null);

    try {
      const response = await fetch("/api/product-studio/draft", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId,
          title: content.title,
          description: content.description,
          bullets: content.bullets,
          attributes: content.attributes,
          searchPhrases: content.searchPhrases,
          status,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Не удалось сохранить карточку.");
      }

      setSavedMessage(
        status === "review"
          ? "Пакет отправлен на согласование."
          : "Черновик сохранён.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось сохранить карточку.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function generateVideo() {
    if (!selectedMediaId || videoBusy) return;

    setVideoBusy(true);
    setVideoMessage(null);

    try {
      const response = await fetch("/api/product-studio/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: selectedMediaId,
          format: videoFormat,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Не удалось создать видео.");
      }

      setVideoUrl(payload.video ?? null);
      setVideoMessage(
        payload.video
          ? "Видео создано и сохранено."
          : payload.warning ?? "Видео пока недоступно.",
      );
    } catch (cause) {
      setVideoMessage(
        cause instanceof Error ? cause.message : "Не удалось создать видео.",
      );
    } finally {
      setVideoBusy(false);
    }
  }

  function updateAttribute(index: number, field: "name" | "value", value: string) {
    if (!content) return;
    setContent({
      ...content,
      attributes: content.attributes.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    });
  }

  return (
    <div className="studio-v2">
      <aside className="card studio-source-panel">
        <div className="studio-panel-head">
          <div>
            <span className="eyebrow">Шаг 1</span>
            <h2>Товар и источники</h2>
          </div>
          <span className="studio-draft-chip">
            {draftId ? "Черновик создан" : "Новый пакет"}
          </span>
        </div>

        <label className="studio-label">Товар из каталога</label>
        <div className="studio-product-search search-box">
          <Search size={16} />
          <input
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Название, SKU или бренд"
          />
        </div>

        <div className="studio-product-list">
          {catalogLoading ? (
            <div className="studio-small-loading">
              <LoaderCircle size={16} /> Загружаем каталог…
            </div>
          ) : (
            filteredCatalog.slice(0, 12).map((item) => (
              <button
                key={item.id}
                className={
                  selectedSku === item.sku
                    ? "studio-product-option active"
                    : "studio-product-option"
                }
                onClick={() => {
                  setSelectedSku(item.sku);
                  setProductSearch("");
                }}
              >
                <span className="studio-product-mini-thumb">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" />
                  ) : (
                    <ImagePlus size={16} />
                  )}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.sku} · {item.category}</small>
                </span>
                {selectedSku === item.sku && <Check size={15} />}
              </button>
            ))
          )}
        </div>

        {selectedProduct && (
          <div className="studio-selected-product">
            <span className="studio-product-preview">
              {sourceImage ? (
                <img src={sourceImage} alt={selectedProduct.name} />
              ) : (
                <ImagePlus size={28} />
              )}
            </span>
            <div>
              <strong>{selectedProduct.name}</strong>
              <span>{selectedProduct.sku} · {selectedProduct.brand}</span>
            </div>
          </div>
        )}

        <label className="studio-upload">
          <Upload size={18} />
          <span>
            <strong>Исходное фото</strong>
            <small>{sourceName ?? "Можно использовать фото из каталога"}</small>
          </span>
          <em>Заменить</em>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </label>

        <div className="studio-field-block">
          <label className="studio-label">Куда готовим карточку</label>
          <div className="studio-segment">
            {([
              ["both", "WB + Ozon"],
              ["wb", "WB"],
              ["ozon", "Ozon"],
            ] as Array<[ChannelTarget, string]>).map(([value, label]) => (
              <button
                key={value}
                className={targetChannel === value ? "active" : ""}
                onClick={() => setTargetChannel(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="studio-research-toggle">
          <input
            type="checkbox"
            checked={researchEnabled}
            onChange={(event) => setResearchEnabled(event.target.checked)}
          />
          <span>
            <FileSearch size={17} />
            <span>
              <strong>Дополнить из интернета</strong>
              <small>
                Только подтверждённые факты конкретной модели. Каталог всегда
                имеет приоритет.
              </small>
            </span>
          </span>
        </label>

        <button
          className="primary-button studio-generate-all"
          onClick={generatePackage}
          disabled={!selectedProduct || generating}
        >
          {generating ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Sparkles size={17} />
          )}
          {generating
            ? "Создаём пакет карточки…"
            : "Создать текст + 3 изображения"}
        </button>

        {error && <div className="studio-error">{error}</div>}
      </aside>

      <main className="card studio-workspace">
        {!content ? (
          <div className="studio-empty">
            <div className="studio-empty-icon">
              <WandSparkles size={34} />
            </div>
            <strong>Профессиональная студия карточки</strong>
            <p>
              Выберите товар слева. За один запуск система подготовит текст,
              характеристики и три связанных изображения в едином стиле.
            </p>
            <div className="studio-empty-steps">
              <span><Bot size={14} /> Описание и SEO</span>
              <span><Images size={14} /> 3 медиароли</span>
              <span><Film size={14} /> Видео из кадра</span>
              <span><ShieldCheck size={14} /> Проверка фактов</span>
            </div>
          </div>
        ) : (
          <>
            <header className="studio-workspace-head">
              <div>
                <span className="eyebrow">
                  {channelTitle(targetChannel)} · пакет карточки
                </span>
                <h2>{selectedProduct?.name}</h2>
                <p>
                  {draftId ? `Черновик ${draftId.slice(0, 8)}` : "Черновик"} ·{" "}
                  {researchEnabled ? "с web‑проверкой" : "по данным каталога"}
                </p>
              </div>
              <div className="studio-head-actions">
                <button
                  className="secondary-button"
                  onClick={() => saveDraft("draft")}
                  disabled={saving}
                >
                  <Save size={15} />
                  Сохранить
                </button>
                <button
                  className="primary-button"
                  onClick={() => saveDraft("review")}
                  disabled={saving}
                >
                  <Send size={15} />
                  На согласование
                </button>
              </div>
            </header>

            {savedMessage && (
              <div className="studio-success">
                <CheckCircle2 size={15} /> {savedMessage}
              </div>
            )}

            <nav className="studio-tabs">
              {([
                ["media", "Медиа", Images],
                ["content", "Описание", Bot],
                ["attributes", "Характеристики", ShieldCheck],
                ["research", "Источники", FileSearch],
              ] as Array<[StudioTab, string, typeof Images]>).map(
                ([value, label, Icon]) => (
                  <button
                    key={value}
                    className={activeTab === value ? "active" : ""}
                    onClick={() => setActiveTab(value)}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ),
              )}
            </nav>

            <div className="studio-tab-body">
              {activeTab === "media" && (
                <div className="studio-media-tab">
                  <div className="studio-section-title">
                    <div>
                      <span className="eyebrow">Шаг 2</span>
                      <h3>Три изображения в одном стиле</h3>
                    </div>
                    <span>
                      Нажмите на кадр, чтобы использовать его для видео
                    </span>
                  </div>

                  <div className="studio-media-grid">
                    {mediaRoles.map((role) => {
                      const item = media[role.kind];
                      const busy = Boolean(imageBusy[role.kind]);
                      const selected = selectedMediaKind === role.kind;

                      return (
                        <article
                          className={
                            selected
                              ? "studio-media-card selected"
                              : "studio-media-card"
                          }
                          key={role.kind}
                          onClick={() => {
                            setSelectedMediaKind(role.kind);
                            if (item?.mediaId) setSelectedMediaId(item.mediaId);
                          }}
                        >
                          <div className="studio-media-card-head">
                            <div>
                              <strong>{role.title}</strong>
                              <span>{role.subtitle}</span>
                            </div>
                            <i>{role.ratio}</i>
                          </div>

                          <div className="studio-media-frame">
                            {busy ? (
                              <div className="studio-media-loading">
                                <LoaderCircle size={24} className="spin" />
                                <span>Генерируем…</span>
                              </div>
                            ) : item?.image ? (
                              <img src={item.image} alt={role.title} />
                            ) : (
                              <div className="studio-media-placeholder">
                                <ImagePlus size={28} />
                                <span>Нет изображения</span>
                              </div>
                            )}
                            {selected && item?.image && (
                              <span className="studio-selected-badge">
                                <Check size={12} /> Для видео
                              </span>
                            )}
                          </div>

                          <div className="studio-media-card-foot">
                            <span>
                              {item?.mode === "live"
                                ? "Сгенерировано"
                                : item?.image
                                  ? "Резервный кадр"
                                  : "Ожидает генерации"}
                            </span>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                if (draftId) generateImage(draftId, role.kind);
                              }}
                              disabled={busy || !draftId}
                            >
                              <RefreshCw size={13} />
                              {item?.image ? "Перегенерировать" : "Создать"}
                            </button>
                          </div>

                          {item?.warning && (
                            <div className="studio-media-warning">
                              {item.warning}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>

                  <section className="studio-video-card">
                    <div className="studio-video-head">
                      <div className="studio-video-icon">
                        <Film size={20} />
                      </div>
                      <div>
                        <span className="eyebrow">Шаг 3</span>
                        <h3>Видео из выбранного кадра</h3>
                        <p>
                          Источник:{" "}
                          {mediaRoles.find(
                            (item) => item.kind === selectedMediaKind,
                          )?.title ?? "Главная"}
                        </p>
                      </div>
                    </div>

                    <div className="studio-video-controls">
                      <div className="studio-segment video">
                        {([
                          ["vertical", "9:16"],
                          ["square", "1:1"],
                          ["horizontal", "16:9"],
                        ] as Array<[VideoFormat, string]>).map(
                          ([value, label]) => (
                            <button
                              key={value}
                              className={videoFormat === value ? "active" : ""}
                              onClick={() => setVideoFormat(value)}
                            >
                              {label}
                            </button>
                          ),
                        )}
                      </div>
                      <button
                        className="primary-button"
                        onClick={generateVideo}
                        disabled={!selectedMediaId || videoBusy}
                      >
                        {videoBusy ? (
                          <LoaderCircle size={15} className="spin" />
                        ) : (
                          <Film size={15} />
                        )}
                        {videoBusy ? "Создаём видео…" : "Создать видео"}
                      </button>
                    </div>

                    {videoUrl && (
                      <div className="studio-video-preview">
                        <video src={videoUrl} controls playsInline />
                      </div>
                    )}
                    {videoMessage && (
                      <div className="studio-video-message">{videoMessage}</div>
                    )}
                  </section>
                </div>
              )}

              {activeTab === "content" && (
                <div className="studio-content-tab">
                  <label>
                    <span>Заголовок</span>
                    <input
                      value={content.title}
                      onChange={(event) =>
                        setContent({ ...content, title: event.target.value })
                      }
                    />
                  </label>

                  <label>
                    <span>Описание</span>
                    <textarea
                      value={content.description}
                      onChange={(event) =>
                        setContent({
                          ...content,
                          description: event.target.value,
                        })
                      }
                    />
                  </label>

                  <div className="studio-editor-block">
                    <div className="studio-editor-head">
                      <strong>Преимущества</strong>
                      <button
                        onClick={() =>
                          setContent({
                            ...content,
                            bullets: [...content.bullets, "Новый пункт"],
                          })
                        }
                      >
                        + Добавить
                      </button>
                    </div>
                    <div className="studio-bullet-list">
                      {content.bullets.map((bullet, index) => (
                        <div key={index}>
                          <span>{index + 1}</span>
                          <input
                            value={bullet}
                            onChange={(event) =>
                              setContent({
                                ...content,
                                bullets: content.bullets.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? event.target.value
                                    : item,
                                ),
                              })
                            }
                          />
                          <button
                            onClick={() =>
                              setContent({
                                ...content,
                                bullets: content.bullets.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              })
                            }
                            aria-label="Удалить"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="studio-editor-block">
                    <div className="studio-editor-head">
                      <strong>Поисковые фразы</strong>
                    </div>
                    <div className="studio-search-tags">
                      {content.searchPhrases.map((phrase) => (
                        <span key={phrase}>{phrase}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "attributes" && (
                <div className="studio-attributes-tab">
                  <div className="studio-section-title">
                    <div>
                      <span className="eyebrow">Факты товара</span>
                      <h3>Характеристики</h3>
                    </div>
                    <span>
                      Источник каждого значения хранится отдельно
                    </span>
                  </div>

                  <div className="studio-attribute-table">
                    <div className="studio-attribute-row head">
                      <span>Характеристика</span>
                      <span>Значение</span>
                      <span>Источник</span>
                    </div>
                    {content.attributes.map((attribute, index) => (
                      <div className="studio-attribute-row" key={index}>
                        <input
                          value={attribute.name}
                          onChange={(event) =>
                            updateAttribute(index, "name", event.target.value)
                          }
                        />
                        <input
                          value={attribute.value}
                          onChange={(event) =>
                            updateAttribute(index, "value", event.target.value)
                          }
                        />
                        <span
                          className={
                            attribute.source === "Интернет"
                              ? "studio-source-tag web"
                              : "studio-source-tag catalog"
                          }
                        >
                          {attribute.source}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "research" && (
                <div className="studio-research-tab">
                  <div className="studio-research-summary">
                    <FileSearch size={20} />
                    <div>
                      <span className="eyebrow">Проверка источников</span>
                      <h3>
                        {researchEnabled
                          ? "Web‑research включён"
                          : "Только внутренний каталог"}
                      </h3>
                      <p>{content.researchSummary}</p>
                    </div>
                  </div>

                  {content.researchSources.length > 0 ? (
                    <div className="studio-research-sources">
                      {content.researchSources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <FileSearch size={15} />
                          <span>
                            <strong>{source.title}</strong>
                            <small>{source.verifiedFact}</small>
                          </span>
                          <ChevronRight size={15} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="studio-no-sources">
                      <CircleHelp size={21} />
                      <strong>Внешние источники не использованы</strong>
                      <span>
                        Это нормально: для demo‑товаров система не добавляет
                        характеристики, которые не удалось подтвердить.
                      </span>
                    </div>
                  )}

                  <div className="studio-visual-dna">
                    <span className="eyebrow">Единый стиль медиа</span>
                    <div>
                      <span>
                        <strong>Фон</strong>
                        {content.visualStyle.background}
                      </span>
                      <span>
                        <strong>Свет</strong>
                        {content.visualStyle.lighting}
                      </span>
                      <span>
                        <strong>Палитра</strong>
                        {content.visualStyle.palette}
                      </span>
                      <span>
                        <strong>Характер</strong>
                        {content.visualStyle.mood}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
