"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Database,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

тип Subject = {
  ID предмета: number;
  parentID: number;
  subjectName: string;
  parentName: string;
};

тип Characteristic = {
  charcID: number;
  subjectName: string;
  ID предмета: number;
  name: string;
  обязательно: boolean;
  isRequiredForCreate?: boolean;
  hasFilter?: boolean;
  existNamedField?: boolean;
  unitName?: string;
  maxCount?: number;
  popular?: boolean;
  charcType?: number;
};

тип ApiPayload<T> = {
  data?: T;
  error?: boolean | string;
  errorText?: string;
  additionalErrors?: unknown;
};

тип CreatedCard = {
  nmID: number;
  vendorCode: string;
  ID предмета: number;
  subjectName?: string | null;
  title?: string;
  brand?: string;
  ID варианта?: number | null;
  штрихкод?: string | null;
};

function buildVendorCode() {
  return `HPX500-SBX-${Date.now().toString().slice(-8)}`;
}

export function WbSandboxLab() {
  const [query, setQuery] = useState("чайник");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<Subject | null>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingCharacteristics, setLoadingCharacteristics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [internalSku, setInternalSku] = useState("HP-X500-BLK");
  const [vendorCode, setVendorCode] = useState(buildVendorCode);
  const [title, setTitle] = useState("Электрический чайник HeatPro X500");
  const [brand, setBrand] = useState("HeatPro");
  const [description, setDescription] = useState(
    "Электрический чайник для ежедневного использования. Корпус из нержавеющей стали, автоматическое отключение и защита от включения без воды.",
  );
  const [length, setLength] = useState("22");
  const [width, setWidth] = useState("18");
  const [height, setHeight] = useState("25");
  const [weight, setWeight] = useState("1.4");
  const [charValues, setCharValues] = useState<Record<number, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCard, setCreatedCard] = useState<CreatedCard | null>(null);
  const [creationVerified, setCreationVerified] = useState(false);

  const обязательно = useMemo(
    () =>
      characteristics.фильтр(
        (item) => item.обязательно || item.isRequiredForCreate,
      ),
    [characteristics],
  );

  const keyRequired = useMemo(
    () =>
      characteristics.фильтр(
        (item) => item.обязательно && item.hasFilter,
      ),
    [characteristics],
  );

  const formCharacteristics = useMemo(
    () =>
      characteristics.фильтр(
        (item) =>
          !item.existNamedField &&
          item.charcType !== 0 &&
          (item.обязательно || item.isRequiredForCreate),
      ),
    [characteristics],
  );

  async function searchSubjects() {
    setLoadingSubjects(true);
    setError(null);
    setSelected(null);
    setCharacteristics([]);
    setCreatedCard(null);
    setCreationVerified(false);

    try {
      const response = await fetch(
        `/api/integrations/wb/catalog?type=subjects&name=${encodeURIComponent(query)}&limit=100`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as ApiPayload<Subject[]>;

      if (!response.ok) {
        setError(
          typeof payload.error === "string"
            ? payload.error
            : payload.errorText ?? "Не удалось получить предметы WB",
        );
        return;
      }

      setSubjects(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setError("Ошибка запроса к WB Sandbox.");
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function loadCharacteristics(subject: Subject) {
    setSelected(subject);
    setLoadingCharacteristics(true);
    setError(null);
    setCreateError(null);
    setCreatedCard(null);
    setCreationVerified(false);
    setCharValues({});
    setVendorCode(buildVendorCode());

    try {
      const response = await fetch(
        `/api/integrations/wb/catalog?type=characteristics&subjectId=${subject.ID предмета}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as ApiPayload<Characteristic[]>;

      if (!response.ok) {
        setError(
          typeof payload.error === "string"
            ? payload.error
            : payload.errorText ?? "Не удалось получить характеристики WB",
        );
        return;
      }

      setCharacteristics(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setError("Ошибка запроса к WB Sandbox.");
    } finally {
      setLoadingCharacteristics(false);
    }
  }

  async function createCard() {
    if (!selected) return;

    setCreateError(null);
    setCreatedCard(null);
    setCreationVerified(false);

    const missing = formCharacteristics.фильтр(
      (item) => !charValues[item.charcID]?.trim(),
    );

    if (missing.length > 0) {
      setCreateError(
        `Заполните обязательные характеристики: ${missing
          .slice(0, 5)
          .map((item) => item.name)
          .join(", ")}${missing.length > 5 ? "…" : ""}`,
      );
      return;
    }

    const parsedDimensions = {
      length: Number(length),
      width: Number(width),
      height: Number(height),
      weightBrutto: Number(weight),
    };

    if (
      Object.values(parsedDimensions).some(
        (value) => !Number.isFinite(value) || value <= 0,
      )
    ) {
      setCreateError("Габариты и вес должны быть положительными числами.");
      return;
    }

    const payloadCharacteristics = formCharacteristics.map((item) => {
      const raw = charValues[item.charcID].trim();

      if (item.charcType === 4) {
        return {
          id: item.charcID,
          value: Number(raw.replace(",", ".")),
        };
      }

      return {
        id: item.charcID,
        value: raw
          .split(",")
          .map((value) => value.trim())
          .фильтр(Boolean),
      };
    });

    if (
      payloadCharacteristics.some(
        (item) =>
          typeof item.value === "number" &&
          !Number.isFinite(item.value),
      )
    ) {
      setCreateError(
        "В числовых характеристиках WB должны быть указаны числа.",
      );
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/integrations/wb/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internalSku,
          subjectId: selected.ID предмета,
          vendorCode,
          title,
          description,
          brand,
          dimensions: parsedDimensions,
          characteristics: payloadCharacteristics,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        const missingNames = Array.isArray(payload.missing)
          ? payload.missing
              .map((item: { name?: string }) => item.name)
              .фильтр(Boolean)
              .join(", ")
          : "";

        setCreateError(
          [
            payload.error ?? "Песочница WB отклонила создание карточки.",
            payload.errorText,
            missingNames ? `Не заполнено: ${missingNames}` : null,
          ]
            .фильтр(Boolean)
            .join(" · "),
        );
        return;
      }

      setCreationVerified(Boolean(payload.verified));
      if (payload.card) {
        setCreatedCard(payload.card as CreatedCard);
      } else {
        setCreatedCard({
          nmID: 0,
          vendorCode: payload.vendorCode ?? vendorCode,
          ID предмета: selected.ID предмета,
          subjectName: selected.subjectName,
          title,
          brand,
          штрихкод: payload.штрихкод ?? null,
          ID варианта: null,
        });
      }
    } catch {
      setCreateError("Не удалось выполнить тестовую запись в песочницу WB.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <article className="card wb-lab">
      <div className="card-header">
        <div>
          <span className="eyebrow">
            <Database size={14} /> Лаборатория WB
          </span>
          <h2>Реальный справочник и создание карточек Wildberries</h2>
          <p>
            Предметы и характеристики загружаются напрямую из API контента
            в песочнице WB. Создание выполняется только в изолированном тестовом
            контуре Wildberries.
          </p>
        </div>
        <span className="success-chip">
          <ShieldCheck size={14} /> Только песочница
        </span>
      </div>

      <div className="wb-lab-search">
        <div className="search-box wb-lab-searchbox">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") searchSubjects();
            }}
            placeholder="Например: чайник, пылесос, увлажнитель"
          />
        </div>
        <button
          className="primary-button"
          onClick={searchSubjects}
          disabled={loadingSubjects || !query.trim()}
        >
          {loadingSubjects ? <RefreshCw size={16} /> : <Search size={16} />}
          {loadingSubjects ? "Ищем..." : "Найти предмет"}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="wb-lab-layout">
        <div className="wb-subject-panel">
          <div className="panel-title">
            <span>Предметы WB</span>
            <strong>{subjects.length}</strong>
          </div>

          {subjects.length === 0 ? (
            <div className="wb-lab-placeholder">
              Выполните поиск — здесь появятся реальные предметы WB.
            </div>
          ) : (
            <div className="wb-subject-list">
              {subjects.map((subject) => (
                <button
                  key={subject.ID предмета}
                  className={
                    selected?.ID предмета === subject.ID предмета
                      ? "wb-subject-row active"
                      : "wb-subject-row"
                  }
                  onClick={() => loadCharacteristics(subject)}
                >
                  <span>
                    <strong>{subject.subjectName}</strong>
                    <small>{subject.parentName}</small>
                  </span>
                  <span className="subject-id">
                    #{subject.ID предмета}
                    <ChevronRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="wb-char-panel">
          <div className="panel-title">
            <span>Схема характеристик</span>
            <strong>{characteristics.length}</strong>
          </div>

          {!selected ? (
            <div className="wb-lab-placeholder">
              Выберите предмет, чтобы увидеть его схему создания карточки.
            </div>
          ) : loadingCharacteristics ? (
            <div className="wb-lab-placeholder">
              Загружаем характеристики предмета #{selected.ID предмета}...
            </div>
          ) : (
            <>
              <div className="wb-schema-summary">
                <div>
                  <span>Предмет</span>
                  <strong>{selected.subjectName}</strong>
                </div>
                <div>
                  <span>ID предмета</span>
                  <strong>{selected.ID предмета}</strong>
                </div>
                <div>
                  <span>Обязательных</span>
                  <strong>{обязательно.length}</strong>
                </div>
                <div>
                  <span>Ключевых обязательных ключевых</span>
                  <strong>{keyRequired.length}</strong>
                </div>
              </div>

              <div className="wb-char-list">
                {characteristics.map((char) => (
                  <div
                    className={
                      char.обязательно || char.isRequiredForCreate
                        ? "wb-char-row обязательно"
                        : "wb-char-row"
                    }
                    key={char.charcID}
                  >
                    <div>
                      <strong>{char.name}</strong>
                      <small>
                        ID {char.charcID}
                        {char.unitName ? ` · ${char.unitName}` : ""}
                      </small>
                    </div>
                    <div className="wb-char-tags">
                      {(char.обязательно || char.isRequiredForCreate) && (
                        <span className="обязательно-chip">
                          <CheckCircle2 size={11} /> обязательно
                        </span>
                      )}
                      {char.hasFilter && <span>фильтр</span>}
                      {char.existNamedField && <span>именованное поле</span>}
                      <span>тип {char.charcType ?? "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {selected && !loadingCharacteristics && (
        <section className="wb-create-card">
          <div className="wb-create-heading">
            <div>
              <span className="eyebrow">
                <Sparkles size={14} /> Контролируемая запись
              </span>
              <h3>Создать тестовую карточку в WB Sandbox</h3>
              <p>
                Карточка будет связана с нашим SKU {internalSku}. Перед записью
                сервер повторно проверит текущую схему WB.
              </p>
            </div>
            <span className="sandbox-write-chip">ЗАПИСЬ · ПЕСОЧНИЦА</span>
          </div>

          <div className="wb-create-grid">
            <label>
              Внутренний SKU
              <input
                value={internalSku}
                onChange={(event) => setInternalSku(event.target.value)}
              />
            </label>
            <label>
              Артикул продавца WB
              <input
                value={vendorCode}
                onChange={(event) => setVendorCode(event.target.value)}
              />
            </label>
            <label>
              Бренд
              <input
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
              />
            </label>
            <label className="wide">
              Название
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="wide">
              Описание
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>

          <div className="wb-dimensions-grid">
            <label>
              Длина, см
              <input
                inputMode="decimal"
                value={length}
                onChange={(event) => setLength(event.target.value)}
              />
            </label>
            <label>
              Ширина, см
              <input
                inputMode="decimal"
                value={width}
                onChange={(event) => setWidth(event.target.value)}
              />
            </label>
            <label>
              Высота, см
              <input
                inputMode="decimal"
                value={height}
                onChange={(event) => setHeight(event.target.value)}
              />
            </label>
            <label>
              Вес с упаковкой, кг
              <input
                inputMode="decimal"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </label>
          </div>

          <div className="wb-обязательно-fields">
            <div className="panel-title">
              <span>Обязательные характеристики WB</span>
              <strong>{formCharacteristics.length}</strong>
            </div>

            {formCharacteristics.length === 0 ? (
              <div className="wb-lab-placeholder compact">
                У этого предмета нет дополнительных обязательных характеристик
                в массиве characteristics.
              </div>
            ) : (
              <div className="wb-обязательно-grid">
                {formCharacteristics.map((char) => (
                  <label key={char.charcID}>
                    <span className="wb-field-label">
                      {char.name}
                      {char.unitName ? ` · ${char.unitName}` : ""}
                    </span>
                    <input
                      inputMode={char.charcType === 4 ? "decimal" : "text"}
                      value={charValues[char.charcID] ?? ""}
                      onChange={(event) =>
                        setCharValues((current) => ({
                          ...current,
                          [char.charcID]: event.target.value,
                        }))
                      }
                      placeholder={
                        char.charcType === 4
                          ? "Число"
                          : char.maxCount && char.maxCount > 1
                            ? "Значения через запятую"
                            : "Значение"
                      }
                    />
                    <small>
                      ID характеристики {char.charcID} · тип {char.charcType}
                      {char.hasFilter ? " · ключевой фильтр" : ""}
                    </small>
                  </label>
                ))}
              </div>
            )}
          </div>

          {createError && <div className="form-error">{createError}</div>}

          <div className="wb-create-actions">
            <div className="wb-create-note">
              Песочница WB: сервер сам сгенерирует штрихкод, затем перечитает
              карточку и сохранит идентификаторы маркетплейса в Supabase.
            </div>
            <button
              className="primary-button"
              onClick={createCard}
              disabled={creating}
            >
              {creating ? <RefreshCw size={16} /> : <PackageCheck size={16} />}
              {creating
                ? "Создаём и проверяем..."
                : "Создать карточку в Sandbox"}
            </button>
          </div>

          {createdCard && (
            <div
              className={
                creationVerified
                  ? "wb-create-result verified"
                  : "wb-create-result pending"
              }
            >
              <div className="wb-create-result-icon">
                {creationVerified ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <RefreshCw size={22} />
                )}
              </div>
              <div className="wb-create-result-copy">
                <strong>
                  {creationVerified
                    ? "Карточка создана и перечитана из WB"
                    : "WB принял создание, ожидаем повторное чтение"}
                </strong>
                <span>
                  {createdCard.vendorCode} · {selected.subjectName}
                </span>
              </div>
              <div className="wb-create-result-data">
                <div>
                  <span>nmID</span>
                  <strong>{createdCard.nmID || "—"}</strong>
                </div>
                <div>
                  <span>ID варианта</span>
                  <strong>{createdCard.ID варианта ?? "—"}</strong>
                </div>
                <div>
                  <span>штрихкод</span>
                  <strong>{createdCard.штрихкод ?? "—"}</strong>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </article>
  );
}
