"use client";

import Image from "next/image";
import { MarketplaceLinks } from "@/components/marketplace-links";
import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ImagePlus,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from "lucide-react";

type CardPreview = {
  title: string;
  description: string;
  bullets: string[];
  category: string;
  searchPhrases: string[];
  mode: "live" | "demo";
};

type ImagePreview = {
  image: string | null;
  mode: "live" | "demo";
  cost?: number | null;
  latency?: number | null;
};

export function ProductCardStudio({
  onGenerate,
}: {
  onGenerate: () => void;
}) {
  const [productName, setProductName] = useState(
    "Электрический чайник HeatPro X500",
  );
  const [brand, setBrand] = useState("HeatPro");
  const [volume, setVolume] = useState("1,7 л");
  const [power, setPower] = useState("2200 Вт");
  const [features, setFeatures] = useState(
    "Нержавеющая сталь, автоотключение, защита от включения без воды, поворотная база 360°",
  );
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CardPreview | null>(null);
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  function onFile(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFileError("Нужен файл изображения.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setFileError("Для демо загрузите изображение до 3 МБ.");
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setSourceImage(typeof reader.result === "string" ? reader.result : null);
      setSourceName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function generateCard() {
    setLoading(true);
    setFileError(null);

    const imagePrompt = [
      "Create a premium marketplace primary product image.",
      `Product: ${productName} by ${brand}.`,
      `Known facts: volume ${volume}; power ${power}; features: ${features}.`,
      sourceImage
        ? "Use the supplied product photo as the source of truth. Preserve the exact product geometry, proportions, color, controls, logo and visible details. Do not redesign the product."
        : "Create a believable neutral product visualization without adding unprovided functions or labels.",
      "Clean commercial studio lighting, centered product, subtle realistic shadow, light neutral background, no text, no badges, no people, no extra accessories.",
      "Square composition suitable for a marketplace product card.",
    ].join(" ");

    try {
      const [cardResponse, imageResponse] = await Promise.all([
        fetch("/api/ai/product-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName,
            brand,
            volume,
            power,
            features,
          }),
        }),
        fetch("/api/ai/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: imagePrompt,
            image: sourceImage,
          }),
        }),
      ]);

      const [cardPayload, imagePayload] = await Promise.all([
        cardResponse.json(),
        imageResponse.json(),
      ]);

      if (cardResponse.ok && cardPayload.data) {
        setPreview({ ...cardPayload.data, mode: cardPayload.mode });
      }

      if (imageResponse.ok) {
        setImagePreview({
          image: imagePayload.image ?? sourceImage,
          mode: imagePayload.mode === "live" ? "live" : "demo",
          cost: imagePayload.cost ?? null,
          latency: imagePayload.latency ?? null,
        });
      }

      onGenerate();
    } finally {
      setLoading(false);
    }
  }

  const imageToShow = imagePreview?.image ?? sourceImage;

  return (
    <div className="cards-workspace">
      <article className="card form-card">
        <div className="card-header">
          <div>
            <span className="eyebrow">Новая карточка</span>
            <h2>Исходные данные товара</h2>
          </div>
          <span className="demo-chip">ИИ + проверка</span>
        </div>

        <div className="form-grid">
          <label>
            Название товара
            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
            />
          </label>
          <label>
            Бренд
            <input
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
            />
          </label>
          <label>
            Объём
            <input
              value={volume}
              onChange={(event) => setVolume(event.target.value)}
            />
          </label>
          <label>
            Мощность
            <input
              value={power}
              onChange={(event) => setPower(event.target.value)}
            />
          </label>
          <label className="wide">
            Особенности
            <textarea
              value={features}
              onChange={(event) => setFeatures(event.target.value)}
            />
          </label>
        </div>

        <label className="upload-zone upload-label">
          <ImagePlus size={26} />
          <div>
            <strong>
              {sourceName ? "Исходное фото загружено" : "Исходное фото товара"}
            </strong>
            <span>
              {sourceName ??
                "Загрузите реальное фото — ImageRouter сохранит внешний вид товара"}
            </span>
          </div>
          <span className="secondary-button">Выбрать файл</span>
          <input
            className="hidden-file"
            type="file"
            accept="image/*"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </label>

        {fileError && <div className="form-error">{fileError}</div>}

        {sourceImage && (
          <div className="source-image-row">
            <div className="source-thumb">
              <Image
                src={sourceImage}
                alt="Исходное фото товара"
                fill
                unoptimized
                sizes="72px"
              />
            </div>
            <div>
              <strong>Источник для генерации по исходному изображению</strong>
              <span>
                Геометрия и внешний вид товара должны остаться неизменными.
              </span>
            </div>
          </div>
        )}

        <button
          className="primary-button generate-button"
          onClick={generateCard}
          disabled={loading}
        >
          {loading ? <RefreshCw size={17} /> : <Sparkles size={17} />}
          {loading ? "Генерация контента и изображения..." : "Сгенерировать карточку"}
        </button>
      </article>

      <article className="card preview-card">
        {!preview && !imagePreview ? (
          <div className="empty-preview">
            <WandSparkles size={34} />
            <strong>Здесь появится готовый ИИ-черновик</strong>
            <span>
              OpenRouter готовит структуру карточки, ImageRouter — товарное
              изображение. Финальная публикация всегда требует проверки.
            </span>
          </div>
        ) : (
          <>
            <div className="card-header">
              <div>
                <span className="eyebrow">
                  Черновик · {preview?.mode === "live" ? "OpenRouter подключён" : "Демо-текст"}
                </span>
                <h2>{brand} · карточка товара</h2>
                <MarketplaceLinks sku="HP-X500-BLK" compact />
              </div>
              <span className="success-chip">
                <CheckCircle2 size={14} /> Проверено
              </span>
            </div>

            <div className="product-preview">
              <div className="generated-product-image">
                {imageToShow ? (
                  <Image
                    src={imageToShow}
                    alt="ИИ-изображение товара"
                    fill
                    unoptimized
                    sizes="220px"
                  />
                ) : (
                  <div className="image-placeholder">
                    <ImagePlus size={42} />
                    <span>ДЕМО-ИЗОБРАЖЕНИЕ</span>
                  </div>
                )}
                <div className="image-mode-badge">
                  {imagePreview?.mode === "live"
                    ? "ImageRouter подключён"
                    : sourceImage
                      ? "Исходное изображение · демо"
                      : "Демо-изображение"}
                </div>
              </div>

              <div>
                <span className="category-line">
                  {preview?.category ?? "Бытовая техника · Электрические чайники"}
                </span>
                <h3>
                  {preview?.title ??
                    "Электрический чайник HeatPro X500, 1,7 л, 2200 Вт"}
                </h3>
                <p>
                  {preview?.description ??
                    "Практичный электрический чайник для ежедневного использования."}
                </p>
                <ul>
                  {(preview?.bullets ?? [
                    `Объём: ${volume}`,
                    `Мощность: ${power}`,
                    "Автоматическое отключение",
                  ]).map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            </div>

            {imagePreview?.mode === "live" && (
              <div className="generation-meta">
                <span>Генерация ImageRouter</span>
                {typeof imagePreview.latency === "number" && (
                  <span>{(imagePreview.latency / 1000).toFixed(1)} сек.</span>
                )}
                {typeof imagePreview.cost === "number" && (
                  <span>${imagePreview.cost.toFixed(4)}</span>
                )}
              </div>
            )}

            <div className="validation-row">
              <span>
                <CheckCircle2 size={15} /> Обязательные поля заполнены
              </span>
              <span>
                <CheckCircle2 size={15} /> Неподтверждённые свойства не добавляем
              </span>
              <span>
                <CheckCircle2 size={15} /> Требуется human approval
              </span>
            </div>

            <button className="primary-button">
              Отправить на согласование
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </article>
    </div>
  );
}
