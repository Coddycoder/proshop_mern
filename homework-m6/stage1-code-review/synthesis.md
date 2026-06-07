# Code Review Synthesis — proshop_mern (homework M6 Stage 1)

**Date:** 2026-06-07
**Reviewer:** 3-agent team — `security-mate` + `performance-mate` + `architecture-mate` (sequential spawn, synthesis by main agent)
**Scope:** весь репозиторий форка — `backend/` (Express/Mongoose), `frontend/src/` (React + classic Redux), `mcp-servers/feature-flags/server.py`, `mcp-servers/search-docs/server.py`, `rag/ingest.py`+`rag/query.py`, слой `backend/features.json`.
**Inputs:** `security-review.md` (19 findings), `performance-review.md` (9), `architecture-review.md` (10 + 2 ADR-драфта).

> Этот файл — контрольный артефакт. Он же вход для **Stage 2** (секция «Top-3») и для **Stage 3** (findings-вход аудита, переиспользуем, не пересчитываем).

---

## HIGH severity (11 findings после дедупа)

### Access control / data exposure (backend)

1. **`backend/controllers/orderController.js:94-105`** — `updateOrderToPaid` помечает заказ оплаченным из **полностью клиентских данных**, без верификации платежа у PayPal, без проверки владельца заказа, и падает 500 при отсутствии `req.body.payer`.
   - Source: security-mate (SEC-01 A04/A08 + SEC-03 A01 IDOR), architecture-mate (C3 — unvalidated `payer` deref)
   - Impact: любой залогиненный пользователь может пометить **любой** заказ оплаченным бесплатно (`POST /api/orders/:id/pay` с `{id,status,payer:{email_address}}`).
   - Fix approach: ownership/admin guard + валидация payload (no-crash) + проверка `status` + идемпотентность. Полная server-side верификация capture у PayPal — residual follow-up (нужны серверные креды, вне Stage 2).
   - ⭐ **Top-3 #3** · Effort: ~1.5h

2. **`backend/controllers/orderController.js:77-89`** — `getOrderById` отдаёт **любой** заказ по id без проверки владельца/админа (IDOR).
   - Source: security-mate (SEC-02 A01), architecture-mate (C2 — contradicts "view their own orders" contract)
   - Impact: любой залогиненный пользователь читает чужие заказы (адреса доставки, email, состав).
   - Fix approach: после `findById` сравнить `order.user._id` с `req.user._id`, пропускать админа, иначе 403.
   - ⭐ **Top-3 #1** · Effort: ~30m

3. **`backend/controllers/userController.js:110-112`** — `getUsers` (`User.find({})`) возвращает **bcrypt-хэши паролей** и полные документы (нет `.select('-password')`); вдобавок без пагинации.
   - Source: security-mate (SEC-04 A02/A01), performance-mate (P9 — unbounded)
   - Impact: админ-эндпоинт `GET /api/users` отдаёт хэши паролей всех пользователей в ответе → офлайн-перебор.
   - Fix approach: `.select('-password')` (1 строка). `getUserById:134` уже так делает — фикс выравнивает контракт.
   - ⭐ **Top-3 #2** · Effort: ~15m

4. **`backend/routes/uploadRoutes.js:37`** — `POST /api/upload` смонтирован **без `protect, admin`**; единственный мутирующий эндпоинт с нулевой аутентификацией.
   - Source: architecture-mate (C2 — contradicts architecture.md §5.2/§5.6), security-mate (SEC-08 A05/A01 — upload validation + no `limits.fileSize`)
   - Impact: аноним может писать файлы на диск сервера; нет лимита размера → DoS-поверхность.
   - Fix approach: добавить `protect, admin` в роут + `limits: { fileSize }` в multer.
   - Effort: ~30m

5. **`backend/controllers/featureFlagsController.js:15` + `routes/featureFlagsRoutes.js:9`** — `GET /api/feature-flags` публичный, хотя комментарий и best-practices трактуют конфиг флагов как admin-данные.
   - Source: security-mate (SEC-09 A01), architecture-mate (C2)
   - Impact: весь конфиг флагов (Testing-фичи, traffic %, зависимости) утекает анонимам.
   - Fix approach: `protect, admin` на роуты **+** прокинуть токен в `frontend/src/actions/featureFlagActions.js` (сейчас запрос идёт без `Authorization` → голый gate сломает дашборд).
   - Effort: ~45m

6. **`backend/routes/userRoutes.js:16`** — нет rate-limit на `/login` и регистрации → неограниченный брутфорс. `express-rate-limit` отсутствует в зависимостях.
   - Source: security-mate (SEC-06 A07)
   - Fix approach: `express-rate-limit` (5/15min) — **добавляет зависимость**, поэтому вне Top-3 (Stage 2 запрещает новые deps).
   - Effort: ~30m

7. **`package.json`** — `npm audit`: 2 critical + 10 high CVE (`jsonwebtoken@8`, `mongoose@5.10.6`, `multer@1.4.2`, `minimist`, `express@4.17.1`).
   - Source: security-mate (SEC-12 A06)
   - Fix approach: контролируемый bump авторитет-критичных пакетов. Вне Top-3 — CLAUDE.md явно запрещает casual upgrade (legacy pin'ы), нужен отдельный регрессионный прогон.

### Performance (RAG / hot paths)

8. **`rag/query.py:52`** — `QdrantClient(url=...)` создаётся **внутри каждого** `search()`; клиент не кэшируется (модель — да).
   - Source: performance-mate (HIGH)
   - Impact: +10–30ms p50 на каждый `search_project_docs` MCP-вызов + connection churn.
   - Fix approach: module-level lazy `_CLIENT` singleton по аналогии с `_MODEL`.

9. **`rag/query.py:28`** — BGE-M3 грузится лениво на первом запросе; первый `search` после старта замораживает однопоточный Python-сервер на ~2–8s (CPU).
   - Source: performance-mate (HIGH)
   - Fix approach: прогрев `get_model()` в `search-docs/server.py` `__main__` до `mcp.run()`.

10. **`backend/controllers/orderController.js:147`** — `getOrders` грузит **всю** коллекцию заказов без пагинации и синхронно `JSON.stringify`-ит на event loop (~20MB при 10k заказов, растёт неограниченно).
    - Source: performance-mate (HIGH)
    - Fix approach: пагинация как в `getProducts`.

### Architecture (C1)

11. **`backend/controllers/featureFlagsController.js:5`** — `features.json` стал общим source of truth для трёх рантаймов (Express read-path, Python MCP write-path, n8n Auto-Pilot) **без ADR**, без БД, без блокировок, без schema/version-контракта. Правило «mutate only via MCP» живёт только в CLAUDE.md.
    - Source: architecture-mate (C1, ADR-006 draft)
    - Fix approach: формализовать в **ADR-006** (Stage 3) + добавить `schema_version`. Не код-фикс уровня Stage 2.

---

## MEDIUM severity (10 findings)

- **`backend/controllers/productController.js:12`** — незаякоренный case-insensitive `$regex` из `req.query.keyword`: NoSQL-injection/ReDoS **(security SEC-05 A03)** + не может использовать индекс, двойной full scan **(perf P5, ~150–500ms при 50k)**. *Cross-mate: security + performance.*
- **`backend/models/orderModel.js:5`** — нет индекса на `Order.user`; `getMyOrders` делает full scan (+200–800ms при 100k). (perf P4)
- **`backend/controllers/featureFlagsController.js:7`** — `features.json` (14KB) перечитывается+парсится на **каждом** `GET /api/feature-flags` (дашборд поллит). (perf P6)
- **`backend/controllers/userController.js:30`** — нет server-side валидации силы пароля/входных данных при register/profile-update. (security SEC-07 A07)
- **`mcp-servers/feature-flags/server.py:433`** — write-tools (`set_feature_state`, `adjust_traffic_rollout`) могут быть выставлены по HTTP/SSE на `0.0.0.0` без auth (доки так инструктируют для n8n). (security SEC-10 A05/A01)
- **`frontend/src/components/AutoPilotControls.js:7,41`** — n8n API-key уходит в публичный CRA-бандл (`REACT_APP_N8N_API_KEY`) + браузер ходит на webhook напрямую мимо Express. (security SEC-11 A02 + architecture C2 ADR-007) *Cross-mate: security + architecture.*
- **`.env`** — `JWT_SECRET` ~10 символов (слабый HMAC, офлайн-перебор → подделка admin-токена). Сам `.env` корректно gitignored. (security SEC-13 A02)
- **`backend/controllers/userController.js:147,153`** — admin `updateUser` присваивает `isAdmin` прямо из `req.body` без валидации/аудита. (security SEC-18 A04)

---

## LOW severity (12 findings)

- **`backend/models/userModel.js:34`** — pre-save hook без `return next()`: при обновлении только имени/email пароль **перехэшируется заново** (double-hash bug). Противоречит architecture.md §6.1. *Cross-mate: architecture C3 + security note + perf note.*
- **`backend/middleware/authMiddleware.js:33`** — JWT 30-дневный TTL, нет server-side revocation. **Принято в ADR-003** → LOW. (security SEC-14)
- **`frontend/src/store.js:62`** — JWT в `localStorage` (XSS-exfiltratable). **Принято в ADR-003** → LOW. (security SEC-15)
- **`backend/middleware/authMiddleware.js:21`** — сырой stack логируется на каждом auth-fail; нет аудита security-событий. (security SEC-16 A09)
- **`backend/server.js:25`** — нет `helmet`, CORS-политики, лимита размера JSON-тела. (security SEC-17 A05)
- **`backend/controllers/featureFlagsController.js:23`** — user-controlled feature name отражается в error-сообщении (JSON-контекст, низкий риск). (security SEC-19 A03)
- **`mcp-servers/feature-flags/server.py:48`** — синхронный `_read/_write_features`; ок по stdio, сериализуется под HTTP/SSE. (perf P7)
- **`frontend/src/screens/FeatureDashboardScreen.js:322`** — `useMemo` со stale-dep под `eslint-disable` (потенциальный будущий баг, не текущий). (perf P8)
- **`backend/controllers/orderController.js:11`** — server-side `calcPrices` (хорошее усиление) недокументирован; правила tax/shipping дублируются backend ↔ `PlaceOrderScreen.js:59-60`. (architecture C3)
- **`backend/controllers/orderController.js:5` / `productController.js:8`** — hardcoded business-rule magic numbers, дублируются frontend↔backend. (architecture C3)
- **`mcp-servers/search-docs/server.py:20`** — импорт RAG через `sys.path`-инъекцию `../../rag` вместо объявленной зависимости (path-fragile coupling). (architecture C3)

---

## Рекомендуемый порядок фиксов (топ-5 чинить первыми)

| # | Finding | Почему первым | Effort |
|---|---|---|---|
| 1 | `getUsers` утечка password-хэшей (`userController.js:111`) | Тривиально (1 строка), но HIGH-утечка данных | 15m |
| 2 | IDOR `getOrderById` (`orderController.js:77`) | HIGH, изолированный фикс, нулевой риск регрессии | 30m |
| 3 | `updateOrderToPaid` trust+IDOR (`orderController.js:94`) | Наивысший бизнес-impact (бесплатные заказы) | 1.5h |
| 4 | Неаутентифицированный `POST /api/upload` (`uploadRoutes.js:37`) | Любой пишет файлы на диск; +лимит размера | 30m |
| 5 | Публичный `/api/feature-flags` (`featureFlagsController.js:15`) | Утечка конфига; нужна координация с фронтом (токен) | 45m |

> Дальше: rate-limit на login (SEC-06, +dep), контролируемый bump CVE-зависимостей (SEC-12), ADR-006 для `features.json` (Stage 3).

---

## ⭐ Top-3 для Stage 2

Выбор: 3 самых критичных (HIGH) finding'а, которые чинятся **безопасно** — каждый < 200 строк, **без новых зависимостей**, без слома публичного API и без поломки работающего фронта (поэтому SEC-06/rate-limit и SEC-09/feature-flags-gate, требующие dep/правки фронта, вынесены за пределы Top-3).

| # | File:line | Issue | Recommended fix | Effort |
|---|---|---|---|---|
| 1 | `backend/controllers/orderController.js:77` | IDOR — `getOrderById` отдаёт любой заказ без проверки владельца | После `findById` сверять `order.user._id` с `req.user._id`; админа пропускать; иначе `403`. Целевой характеризационный тест: «чужой заказ → 200» (старое) → «→ 403» (новое). | 30m |
| 2 | `backend/controllers/userController.js:111` | `getUsers` отдаёт bcrypt-хэши паролей всех юзеров | Добавить `.select('-password')` (как в `getUserById:134`). Целевой тест: «ответ содержит `password`» (старое) → «не содержит» (новое). | 15m |
| 3 | `backend/controllers/orderController.js:94-105` | `updateOrderToPaid` доверяет клиентским данным платежа, нет проверки владельца, 500 при отсутствии `payer` | Ownership/admin guard + валидация payload (no-crash на missing `payer`) + проверка `status === 'COMPLETED'` + идемпотентность. Полная PayPal-capture верификация — задокументировать как residual follow-up. | 1.5h |

**Характеризационная стратегия для всех трёх:** happy-path и смежная логика (контрольные тесты) остаются зелёными после фикса; «целевой» тест пинит СТАРОЕ (неправильное) поведение и после фикса намеренно переписывается под НОВОЕ корректное (помечается `intentional behavior change → fix-N.md`).

---

## Cross-mate observations (флагнули ≥ 2 mate'а)

| Finding | Mates | Консолидация |
|---|---|---|
| `getOrderById` IDOR (`orderController.js:77`) | security (SEC-02) + architecture (C2) | HIGH — security владеет severity |
| `getUsers` (`userController.js:110/111`) | security (SEC-04, хэши) + performance (P9, unbounded) | HIGH |
| Product `$regex` (`productController.js:12`) | security (SEC-05 ReDoS) + performance (P5 full scan) | MEDIUM |
| Публичный `/api/feature-flags` (`:15`) | security (SEC-09) + architecture (C2) | HIGH |
| Неаутентиф. upload (`uploadRoutes.js:37`) | architecture (C2) + security (SEC-08) | HIGH (elevated) |
| n8n key в бандле (`AutoPilotControls.js`) | security (SEC-11) + architecture (C2/ADR-007) | MEDIUM |
| `updateOrderToPaid` (`orderController.js:94`) | security (SEC-01/03) + architecture (C3) | HIGH |
| `userModel.js:34` double-hash | architecture (C3) + security note + perf note | LOW |
| `features.json` shared store | architecture (C1) + security (SEC-10 unauth MCP) | HIGH (архитектурный, → ADR-006) |

**Предложенные новые ADR (architecture-mate):** `ADR-006` — `features.json` как единый shared store с MCP-only write-path; `ADR-007` — Auto-Pilot через browser → n8n → MCP pipeline. (Драфты в `proposed-adrs/`; будут разобраны в Stage 3.)

---

## Token usage estimate (cost awareness)

| Mate | subagent output tokens | tool calls | wall time |
|---|---|---|---|
| security-mate | ~76.4k | 39 | ~9.5 min |
| performance-mate | ~88.7k | 34 | ~2.7 min |
| architecture-mate | ~119.1k | 42 | ~11.4 min |
| **Σ sub-agents** | **~284k output tokens** | 115 | — |

Запуск параллельный (Опция A-подобный sequential-spawn, но 3 ревьюера в одном fan-out). Синтез — главным агентом без доп. спавна. Для маленького репо один проход на ревьюера хватает (контекст не переполнен).
