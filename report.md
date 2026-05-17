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

---

### Search-docs MCP — Часть 3

[`.mcp.json`](./.mcp.json) — добавлен блок `search-docs` рядом с `feature-flags`.

[`CLAUDE.md`](./CLAUDE.md) → секция «MCP servers wired in this repo» — `search_project_docs` FIRST для любых вопросов про продукт, fallback на `Grep`/`Read` только если vector miss или нужен полный файл.

#### Запрос 1 — «Какая БД используется в proshop_mern и почему именно она?»

```
search_project_docs(query="Какая БД используется в proshop_mern и почему именно она?", top_k=5)
```

| # | score | kind | file_path | parent_headings |
|---|---|---|---|---|
| 1 | 0.6599 | best-practice | `best-practices.md` | 1. Introduction: Why proshop_mern Is Deprecated |
| 2 | 0.6579 | architecture | `architecture.md` | 1. System Overview |
| 3 | 0.6508 | history | `dev-history.md` | 1. Project Timeline → Phase 0 — Prototype |
| 4 | 0.6307 | history | `dev-history.md` | 3. Major Decisions → **Decision 1: MongoDB over PostgreSQL** |
| 5 | 0.6217 | architecture | `architecture.md` | 10. Architectural Decisions → Known Technical Debt |

**Ответ агента (на основе чанков):** Используется **MongoDB** в составе MERN-стека (chunks #1, #2, #3 — все говорят про MongoDB + Express + React + Node). «Почему» — chunk #4 (`dev-history.md` → Decision 1: MongoDB over PostgreSQL, январь 2023): выбор сделан в фазе прототипа из-за гибкой схемы Mongoose, отсутствия требования к ACID-транзакциям на старте и того, что Brad Traversy и большинство туториалов в 2022–2023 использовали именно MongoDB. Chunk #5 фиксирует технический долг: JWT в localStorage и тонкие места Mongoose-схемы — это уже про последствия выбора.

#### Запрос 2 — «Какие фичи зависят от search_v2?»

```
search_project_docs(query="Какие фичи зависят от search_v2?", top_k=5)
```

| # | score | kind | file_path | parent_headings |
|---|---|---|---|---|
| 1 | 0.6988 | spec | `feature-flags-spec.md` | 4. Feature Flag Catalog → Search & Discovery |
| 2 | 0.5788 | spec | `feature-flags-spec.md` | 2. The `features.json` Format → Example Feature Object |
| 3 | 0.5746 | spec | `feature-flags-spec.md` | 4. Feature Flag Catalog → Search & Discovery (continuation) |
| 4 | 0.5740 | feature | `features-analysis-ru.md` | 3. Полная таблица 25 фичей |
| 5 | 0.5637 | feature | `features/catalog.md` | Feature 2: Product Search |

**Ответ агента:** Прямого «обратного индекса зависимостей» в spec нет. Зато chunk #4 (`features-analysis-ru.md`, «Полная таблица 25 фичей») — это сводная таблица всех 25 фичей с колонкой `dependencies`. По ней (а также по cross-check с runtime через `feature-flags` MCP `list_features`) на `search_v2` завязана **одна** фича: **`semantic_search`** (Semantic Vector Search) — её поле `dependencies = ["search_v2"]`, новый алгоритм добавляет векторное сходство поверх legacy regex-поиска и не имеет смысла без `search_v2`. Chunk #1 описывает сам `search_v2`, не зависящих от него — vector search «магнитит» на терм `search_v2`, а не на «зависят от».

#### Запрос 3 — «Что случилось во время последнего incident с checkout?»

```
search_project_docs(query="Что случилось во время последнего incident с checkout?", top_k=5, kind="incident")
```

Фильтр `kind="incident"` — категория ответа известна сразу, payload index по `kind` отрабатывает на стороне Qdrant.

| # | score | kind | file_path | parent_headings |
|---|---|---|---|---|
| 1 | 0.5765 | incident | `incidents/i-001-paypal-double-charge.md` | Timeline |
| 2 | 0.5500 | incident | `incidents/i-001-paypal-double-charge.md` | Root Cause Analysis |
| 3 | 0.5467 | incident | `incidents/i-002-mongo-connection-pool-exhaustion.md` | Summary |
| 4 | 0.5439 | incident | `incidents/i-001-paypal-double-charge.md` | Resolution |
| 5 | 0.5322 | incident | `incidents/i-001-paypal-double-charge.md` | Summary |

**Ответ агента:** Последний инцидент в checkout — **i-001 PayPal Sandbox Webhook Double-Charge** (4 чанка из 5 — этот файл). По чанкам:
- *Summary* (#5): часть PayPal-заказов помечалась как paid дважды → дублирование `paymentResult`-документов, в трёх случаях — двойное списание со склада.
- *Timeline* (#1): 2023-11-03 21:14 — PayPal sandbox подтверждает оплату, через 2 секунды backend получает второй вебхук с тем же payment_id.
- *Root Cause* (#2): SDK `@paypal/react-paypal-js` дёргает `onApprove` дважды при определённых retry-сценариях; handler `payOrder` не делал проверку идемпотентности.
- *Resolution* (#4): добавили guard в backend handler — если `order.isPaid` уже `true`, второй вызов возвращает существующий результат без повторной записи.

Параллельно поднялся `i-002 MongoDB Connection Pool Exhaustion` (Black Friday 2023) — он чек-аут затрагивал только косвенно (полный outage), поэтому остался в одной позиции.

---

### End-to-end (search-docs + feature-flags) — Часть 3

Сценарий из задания: найти описание `semantic_search` и её зависимости через **search-docs MCP**, проверить runtime через **feature-flags MCP**, при условии «Disabled + зависимости не-Disabled» перевести в Testing + 25%, процитировать «зачем фича нужна».

#### 1. `search_project_docs` — найти описание + зависимости

```
search_project_docs(query="semantic_search feature dependencies vector embeddings", top_k=4, kind="spec")
```

| # | score | chunk_id | file_path |
|---|---|---|---|
| 1 | 0.6132 | feature-flags-spec__015 | `feature-flags-spec.md` → Search & Discovery |
| 2 | 0.5569 | feature-flags-spec__008 | `feature-flags-spec.md` → Example Feature Object |
| 3 | 0.4843 | feature-flags-spec__016 | `feature-flags-spec.md` → Search & Discovery (continuation) |
| 4 | 0.4748 | feature-flags-spec__020 | `feature-flags-spec.md` → Catalog & Discovery (product_recommendations) |

Из чанка #1 и описания в `features.json` (синхронизировано со spec) видно: `semantic_search` — Semantic Vector Search, добавляет embedding-based similarity поверх keyword-поиска, требует `search_v2` Enabled, целевая аудитория `internal` (canary), стратегия rollout — `canary`. **Зависимости: `["search_v2"]`.**

#### 2. `get_feature_info("semantic_search")` — runtime state

```
{
  "feature_id": "semantic_search",
  "name": "Semantic Vector Search",
  "status": "Disabled",
  "traffic_percentage": 0,
  "last_modified": "2026-02-14",
  "targeted_segments": ["internal"],
  "rollout_strategy": "canary",
  "dependencies": ["search_v2"],
  "dependencies_state": [{"feature_id": "search_v2", "status": "Testing"}]
}
```


#### 3. `set_feature_state("semantic_search", "Testing")`

```
{
  "feature_id": "semantic_search",
  "status": "Testing",
  "traffic_percentage": 10,                 // canary-default (1..99 не было — поставлен 10)
  "last_modified": "2026-05-17",
  "dependencies_state": [{"feature_id": "search_v2", "status": "Testing"}],
  "warnings": [
    "Dependency 'search_v2' is in status 'Testing', not 'Enabled'. semantic_search may not function correctly."
  ]
}
```

Warning ожидаемый — контракт `set_feature_state` из spec: при переходе в Testing/Enabled, если зависимость не Enabled, возвращаем warnings, но переход разрешаем (блокируется только Enabled при Disabled-зависимости).

#### 4. `adjust_traffic_rollout("semantic_search", 25)`

```
{
  "feature_id": "semantic_search",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-17",
  "hint": null
}
```

#### 5. `get_feature_info("semantic_search")` — подтверждение

```
{
  "feature_id": "semantic_search",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-17",
  "dependencies_state": [{"feature_id": "search_v2", "status": "Testing"}]
}
```

#### Цитата «зачем фича нужна» (из spec, синхронизированной с `features.json`)

> **Semantic Vector Search** — *Augments keyword search with embedding-based semantic similarity. Products are encoded at index time; queries are embedded at runtime and matched via cosine similarity. Requires `search_v2` to be Enabled first. Significantly improves discovery for natural-language queries like 'good headphones for running'.*

Цепочка tool calls (оба MCP, один диалог):

```
search_project_docs (spec/semantic_search)  →  search-docs MCP
get_feature_info("semantic_search")         →  feature-flags MCP
set_feature_state("semantic_search","Testing")
adjust_traffic_rollout("semantic_search", 25)
get_feature_info("semantic_search")         →  подтверждение
```

**Итог:** `semantic_search` переведён `Disabled → Testing @ 25%`, `last_modified=2026-05-17`. `backend/features.json` мутирован атомарно, `GET /api/feature-flags/semantic_search` отдаёт ровно это состояние без рестарта backend (Dashboard Features в админке после reload показывает новые значения).
