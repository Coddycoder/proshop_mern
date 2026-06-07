# Fix #2 — `getUsers` leaks bcrypt password hashes

## 1. Original finding (from synthesis.md — Top-3 #2)

> **`backend/controllers/userController.js:110-112`** — `getUsers` (`User.find({})`) возвращает **bcrypt-хэши паролей** и полные документы (нет `.select('-password')`); вдобавок без пагинации.
> - Source: security-mate (SEC-04 A02/A01), performance-mate (P9 — unbounded)
> - Impact: админ-эндпоинт `GET /api/users` отдаёт хэши паролей всех пользователей в ответе → офлайн-перебор.
> - Fix approach: `.select('-password')` (1 строка). `getUserById:134` уже так делает.

OWASP: **A02 Cryptographic Failures / A01**. Severity: **HIGH**.

## 2. What I changed (diff)

```diff
 const getUsers = asyncHandler(async (req, res) => {
-  const users = await User.find({})
+  // Strip password hashes from the response (fix M6-#2, SEC-04/A02).
+  // Mirrors getUserById, which already projects with .select('-password').
+  const users = await User.find({}).select('-password')
   res.json(users)
 })
```

One file touched: `backend/controllers/userController.js` (+1 effective line). No new deps.

## 3. Why this approach (trade-offs)

- **`.select('-password')`** is the exact pattern `getUserById` already uses (`userController.js:134`) — the fix makes the list endpoint consistent with the by-id endpoint rather than inventing a new convention.
- Considered a response DTO/serializer, but that's over-engineering for a legacy fork with no DTO layer (would touch architecture, violate "minimal change"). A projection is the idiomatic Mongoose answer and keeps the public response shape identical minus the secret field.
- **Pagination (the perf half of P9) intentionally left out of this fix** — it would change the response shape (`{users, page, pages}`) and break the frontend `UserListScreen`. That's a separate, larger change tracked in synthesis.md's fix-order list, not bundled into a security one-liner.

## 4. Test status

`node --test homework-m6/stage2-fix-top3/tests/user-getUsers.password.test.js`

```
ok 1 - returns 200 with all users in an array
ok 2 - returns 200 with [] when there are no users
ok 3 - [FIXED] response no longer includes password hashes (.select("-password"))
# tests 3 # pass 3 # fail 0
```

Control tests (#1 shape/count, #2 empty edge) stayed green → the projection didn't disturb the response otherwise.

## 5. Behavior change

**Yes — intentional.** Before: each user object in the response carried its `password` bcrypt hash. After: the hash is absent.

Updated test: `[TARGET/insecure] response currently includes bcrypt password hashes` → rewritten to `[FIXED] response no longer includes password hashes`, asserting `password === undefined` for every user **and** that the controller passed `-password` to Mongoose's projection. Response contract narrows (a field is removed) — but that field should never have been there, so no real consumer depended on it.

## 6. Lessons learned

The same model object is queried two ways in this file — `getUserById` already projected the hash away, `getUsers` didn't. The leak was a consistency gap, not a missing concept. A quick audit (`grep -n "User.find" backend/controllers`) surfaces every projection-less query; worth doing repo-wide rather than fixing only the one the reviewer happened to cite.
