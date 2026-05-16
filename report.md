# Отчёт о работе

## Окружение

- Основная IDE: VS Code + Claude

## CLAUDE.md

- Добавил `CLAUDE.md` в корень репозитория
- Добавил правило работы в репозитории через Git
- Добавил правило по диагностике проблем по логам

## README

- Добавил описание получения `PAYPAL_CLIENT_ID`
- Добавил раздел о локальном запуске MongoDB
- Внёс правки в README по запуску сервиса — на основе проблем, с которыми столкнулся сам

## FINDINGS.md

- Проанализировал проблемы и добавил в файл 
- Исправил проблему №1

## Mermaid

- Добавил диаграмму С4

---

## M3

- **MCP framework:** Python, FastMCP
- **Сервер:** `mcp-servers/feature-flags/server.py` — 4 tools (`list_features`, `get_feature_info`, `set_feature_state`, `adjust_traffic_rollout`).
- **Источник для фичей:** `backend/features.json` (скопирован из `aidev-course-materials/M3/project-data/features.json`). MCP-сервер мутирует файл атомарно (`tempfile` + `os.replace`).
- **REST:** `GET /api/feature-flags` и `GET /api/feature-flags/:name` (`backend/routes/featureFlagsRoutes.js`, `backend/controllers/featureFlagsController.js`) — читают файл с диска на каждый запрос, без кеширования. Изменения через MCP видны фронту без рестарта backend.
- **Frontend:** новая страница `frontend/src/screens/FeatureFlagListScreen.js`, маршрут `/admin/feature-flags`, ссылка в дропдауне `Admin → Dashboard Features`, Redux-слайс `featureFlagList` (constants / action / reducer / store).

### Feature flags MCP — тестовый сценарий

**Setup:** перед сценарием сбросил `search_v2` в `Disabled`, чтобы лог покрыл все 3 обязательных tool calls (текущий дефолт в `features.json` — `Testing/15%`).

```
set_feature_state(feature_id="search_v2", state="Disabled")
-> status="Disabled", traffic_percentage=0, last_modified="2026-05-11", warnings=[]
```

**Сценарий (`search_v2`: Disabled → Testing → 25% → подтверждение):**

#### 1. `list_features` *(рекомендуемый discovery-tool)*

```
args: {}
result:
{
  "count": 25,
  "features[search_v2]": {
    "feature_id": "search_v2",
    "name": "New Search Algorithm",
    "status": "Disabled",
    "traffic_percentage": 0,
    "dependencies": []
  }
}
```

#### 2. `get_feature_info` — стартовое состояние

```
args: {"feature_id": "search_v2"}
result:
{
  "feature_id": "search_v2",
  "name": "New Search Algorithm",
  "status": "Disabled",
  "traffic_percentage": 0,
  "last_modified": "2026-05-11",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary",
  "dependencies_state": []
}
```

#### 3. `set_feature_state` → Testing

```
args: {"feature_id": "search_v2", "state": "Testing"}
result:
{
  "feature_id": "search_v2",
  "status": "Testing",
  "traffic_percentage": 10,   // canary-default при переходе из Disabled
  "last_modified": "2026-05-11",
  "dependencies_state": [],
  "warnings": []
}
```

#### 4. `adjust_traffic_rollout` → 25

```
args: {"feature_id": "search_v2", "percentage": 25}
result:
{
  "feature_id": "search_v2",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-11",
  "hint": null
}
```

#### 5. `get_feature_info` — подтверждение финального состояния

```
args: {"feature_id": "search_v2"}
result:
{
  "feature_id": "search_v2",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-11",
  "dependencies_state": []
}
```

**Итог:** `search_v2` переведён из `Disabled` в `Testing` с трафиком `25%`, `last_modified` обновился на сегодняшнюю дату, файл `backend/features.json` мутирован атомарно. REST-endpoint `GET /api/feature-flags/search_v2` параллельно отдаёт ровно то же состояние без рестарта backend (проверено отдельным curl-вызовом во время разработки).

---

### RAG над документацией — Часть 2

#### Stack

- **Vector DB:** Qdrant 1.18, локально в Docker на `http://localhost:6333`. Коллекция `proshop_docs`: 1024 dim, COSINE distance, payload indexes по `kind` / `source_file` / `file_path` / `language` (всё типа `keyword` под equality-фильтры).
- **Embedding:** `BAAI/bge-m3` через `sentence-transformers` 5.5.0, dense-only (1024-dim). Multilingual, MIT, бесплатно, локально. Запущена на MPS (Apple Silicon GPU).
- **Chunking:** уже нарезано в [`docs/chunks.jsonl`](./docs/chunks.jsonl) (471 чанк, ~739 KB; полный отчёт о chunking pipeline — в [`docs/report.md`](./docs/report.md)). 11 типов: runbook, feature, api, best-practice, architecture, spec, incident, glossary, adr, history, page. Языки: 445 EN + 26 RU.
- **Scripts:** [`rag/ingest.py`](./rag/ingest.py) (BGE-M3 + Qdrant upsert, флаг `--reset` для full reindex) и [`rag/query.py`](./rag/query.py) (CLI поиска с опциональным `--kind` фильтром).
- **Управление зависимостями:** `uv` (тот же tool, что для MCP сервера в Части 1).

#### Метаданные в payload (на каждый вектор)

Все поля чанка из `docs/chunks.jsonl` сохраняются в Qdrant payload без потерь — плюс сам `text`. Покрывают и требования задания (`source_file`, `type`), и больше:

| Поле | Тип | Назначение |
|---|---|---|
| `text` | string | Содержимое чанка (для возврата в snippet и для LLM в Части 3) |
| `chunk_id` | string | Стабильный ID вида `<kind>_<filename>__<index>` (используется для UUID5 point.id — upsert идемпотентен) |
| `source_file` | string | Имя файла, e.g. `adr-001-mongodb-vs-postgres.md` ← **обязательно по заданию** |
| `file_path` | string | Полный относительный путь от `docs/project-data/`, e.g. `adrs/adr-001-mongodb-vs-postgres.md` |
| `kind` | string | Тип документа: `adr` / `api` / `feature` / `incident` / `runbook` / `page` / `spec` / `architecture` / `history` / `glossary` / `best-practice`. **Это и есть `type` из задания** — в нашем chunking spec поле названо `kind` (терминология автора), семантика идентична. Используется в payload index для фильтрации |
| `title` | string | H1 файла, e.g. `"ADR-001: Use MongoDB..."` |
| `parent_headings` | string[] | Breadcrumbs H2/H3 цепочки, e.g. `["3. Major Decisions", "Decision 1: MongoDB over PostgreSQL"]` |
| `keywords` | string[] | 3-7 ключевых слов из чанка |
| `summary` | string | 1-предложение summary |
| `language` | string | `en` / `ru` (определено per-chunk) |
| `chunk_index` | int | Порядковый номер чанка в файле |
| `total_chunks_in_file` | int | Сколько всего чанков в этом файле |

#### Воспроизводимость

```bash
# 1. Qdrant — один контейнер
docker run -d -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant:1.18.0

# 2. Установить deps RAG-проекта
cd rag && uv sync

# 3. Ingest (qdrant должен быть запущен; BGE-M3 ~2.3 GB при первом запуске)
uv run python ingest.py --reset

# 4. Прогнать запрос
uv run python query.py "Какая БД используется в proshop_mern?" --top-k 5
uv run python query.py "checkout incident" --kind incident   # с фильтром по типу
```

Полный ingest 471 чанка занял 6 минут на M-чипе через MPS (первый батч ~5 мин — прогрев Metal shaders, дальше ~4 it/s). Точек в коллекции: **471/471** (`status=green`).

#### 3 тестовых запроса

##### Запрос 1: «Какая БД используется в proshop_mern и почему именно она?»

| # | score | kind | file_path / heading | observation |
|---|---|---|---|---|
| 1 | 0.6599 | best-practice | `best-practices.md` → `1. Introduction: Why proshop_mern Is Deprecated` | общее введение про MERN-стек |
| 2 | 0.6579 | architecture | `architecture.md` → `1. System Overview` | «MongoDB, Express, React, Node» в первом абзаце |
| 3 | 0.6508 | history | `dev-history.md` → `Phase 0 — Prototype` | январь 2023, выбор стека |
| 4 | 0.6307 | history | `dev-history.md` → `3. Major Decisions > Decision 1: MongoDB over PostgreSQL` | **прямой ответ «почему» — в топ-4, не в топ-1** |
| 5 | 0.6217 | architecture | `architecture.md` → `Known Technical Debt` | JWT / Mongoose замечания |

ADR-001 (формальный архитектурный аргумент за MongoDB) и dev-history Decision 1 — это прямые ответы на «почему», но обе всплыли ниже общих обзорных чанков. Запрос на русском, корпус преимущественно EN — модель BGE-M3 справилась, но **общий вопрос на смешанном языке магнитит на общие чанки**. Hybrid search + reranker поднимет точные ответы выше.

##### Запрос 2: «Какие фичи зависят от search_v2?»

| # | score | kind | file_path / heading | observation |
|---|---|---|---|---|
| 1 | 0.6988 | spec | `feature-flags-spec.md` → `Search & Discovery → search_v2` | описание самого `search_v2`, не зависимых |
| 2 | 0.5788 | spec | `feature-flags-spec.md` → `Example Feature Object` | JSON-пример с полем `dependencies` |
| 3 | 0.5746 | spec | `feature-flags-spec.md` → `Search & Discovery` (продолжение) | rollout-стратегия search_v2 |
| 4 | 0.5740 | feature | `features-analysis-ru.md` → `3. Полная таблица 25 фичей` | **сводная таблица с колонкой dependencies — найдёт всё** |
| 5 | 0.5637 | feature | `features/catalog.md` → `Feature 2: Product Search` | legacy regex search (предшественник) |

Ожидаемый «золотой» chunk — описание `semantic_search` (с полем `dependencies: ["search_v2"]`) — не попал в топ-5. Модель магнитит на «search_v2» само по себе, а не на «зависит от». 

##### Запрос 3: «Что случилось во время последнего incident с checkout?»

| # | score | kind | file_path / heading | observation |
|---|---|---|---|---|
| 1 | 0.6426 | runbook | `runbooks/incident-response.md` → `Phase 6: Customer Communication` | общий шаблон, не конкретный incident |
| 2 | 0.5998 | runbook | `runbooks/incident-response.md` → `Phase 7: Postmortem` | пример постмортема включает PayPal outage |
| 3 | 0.5765 | incident | `incidents/i-001-paypal-double-charge.md` → `Timeline` | **прямой ответ — в топ-3** |
| 4 | 0.5714 | runbook | `runbooks/incident-response.md` → `Phase 1: Discovery` | общая фаза incident response |
| 5 | 0.5623 | spec | `feature-flags-spec.md` → `Checkout → express_checkout` | про feature flag, не про incident |

Правильный incident (`i-001-paypal-double-charge.md`, влияет на checkout flow через дублирование заказа) — топ-3. Runbook про incident response забивает топ-2 чисто за счёт лексического совпадения «incident». 


Стек выбран по двум требованиям: (1) корпус смешанный RU+EN, OpenAI 3-small отпадает (MIRACL 44 vs BGE-M3 67.8 на русском); (2) хотелось обойтись без managed API и ключей — BGE-M3 через `sentence-transformers` это даёт «из коробки». Qdrant локально через Docker — наиболее быстрая инфраструктура: один контейнер, dashboard в браузере

**Что было сложно.** Первый запуск ingest упал из-за памяти при batch_size=16 — компьютер перезагрузился. Уменьшил до 8, повторно запустил — упёрся в долгий прогрев MPS (первый батч ~5 минут), потом всё разогналось до 4 it/s. Полный ingest 471 чанка занял 6 минут.
