"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

type Subject = {
  subjectID: number;
  parentID: number;
  subjectName: string;
  parentName: string;
};

type Characteristic = {
  charcID: number;
  subjectName: string;
  subjectID: number;
  name: string;
  required: boolean;
  hasFilter?: boolean;
  unitName?: string;
  maxCount?: number;
  popular?: boolean;
  charcType?: number;
};

type ApiPayload<T> = {
  data?: T;
  error?: boolean;
  errorText?: string;
  additionalErrors?: unknown;
  error?: string;
};

export function WbSandboxLab() {
  const [query, setQuery] = useState("чайник");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<Subject | null>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingCharacteristics, setLoadingCharacteristics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const required = useMemo(
    () => characteristics.filter((item) => item.required),
    [characteristics],
  );

  const keyRequired = useMemo(
    () =>
      characteristics.filter(
        (item) => item.required && item.hasFilter,
      ),
    [characteristics],
  );

  async function searchSubjects() {
    setLoadingSubjects(true);
    setError(null);
    setSelected(null);
    setCharacteristics([]);

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

    try {
      const response = await fetch(
        `/api/integrations/wb/catalog?type=characteristics&subjectId=${subject.subjectID}`,
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

  return (
    <article className="card wb-lab">
      <div className="card-header">
        <div>
          <span className="eyebrow">
            <Database size={14} /> WB Sandbox Lab
          </span>
          <h2>Реальный справочник карточек Wildberries</h2>
          <p>
            Предметы и характеристики загружаются напрямую из Content API
            Sandbox. Ничего не создаём, пока не соберём валидную схему.
          </p>
        </div>
        <span className="success-chip">
          <ShieldCheck size={14} /> Read-only
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
                  key={subject.subjectID}
                  className={
                    selected?.subjectID === subject.subjectID
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
                    #{subject.subjectID}
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
              Загружаем характеристики предмета #{selected.subjectID}...
            </div>
          ) : (
            <>
              <div className="wb-schema-summary">
                <div>
                  <span>Предмет</span>
                  <strong>{selected.subjectName}</strong>
                </div>
                <div>
                  <span>subjectID</span>
                  <strong>{selected.subjectID}</strong>
                </div>
                <div>
                  <span>Обязательных</span>
                  <strong>{required.length}</strong>
                </div>
                <div>
                  <span>Ключевых required+filter</span>
                  <strong>{keyRequired.length}</strong>
                </div>
              </div>

              <div className="wb-char-list">
                {characteristics.map((char) => (
                  <div
                    className={
                      char.required
                        ? "wb-char-row required"
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
                      {char.required && (
                        <span className="required-chip">
                          <CheckCircle2 size={11} /> required
                        </span>
                      )}
                      {char.hasFilter && <span>filter</span>}
                      <span>type {char.charcType ?? "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
