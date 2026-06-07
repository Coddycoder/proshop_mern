# Fix #1 — IDOR in `getOrderById`

## 1. Original finding (from synthesis.md — Top-3 #1)

> **`backend/controllers/orderController.js:77-89`** — `getOrderById` отдаёт **любой** заказ по id без проверки владельца/админа (IDOR).
> - Source: security-mate (SEC-02 A01), architecture-mate (C2 — contradicts "view their own orders" contract)
> - Impact: любой залогиненный пользователь читает чужие заказы (адреса доставки, email, состав).
> - Fix approach: после `findById` сравнить `order.user._id` с `req.user._id`, пропускать админа, иначе 403.

OWASP: **A01 Broken Access Control**. Severity: **HIGH**.

## 2. What I changed (diff)

```diff
   if (order) {
+    // Ownership guard (fix M6-#1, SEC-02/A01 IDOR): a user may read only their
+    // own order; admins may read any. Without this any authenticated user could
+    // fetch any order by id.
+    if (
+      order.user._id.toString() !== req.user._id.toString() &&
+      !req.user.isAdmin
+    ) {
+      res.status(403)
+      throw new Error('Not authorized to view this order')
+    }
     res.json(order)
   } else {
     res.status(404)
     throw new Error('Order not found')
   }
```

One file touched: `backend/controllers/orderController.js` (+10 lines). No route, model, or frontend change.

## 3. Why this approach (trade-offs)

- **Guard inside the existing `if (order)` block**, not a refactor of the handler — honors the repo's "minimal, in-style changes for legacy" rule and the Do-NOT ("don't restructure error handling"). The 404 path is byte-for-byte unchanged.
- **`order.user._id`** (not `order.user`) because this handler `populate`s `user`, so the field is the populated sub-doc. Admins keep full access (admin order-management screens rely on it).
- **403 vs 404:** chose `403 Forbidden` — `protect` already proved the caller is authenticated; 403 is the semantically correct "authenticated but not authorized". (404-to-hide-existence is a valid alternative; 403 is clearer for an admin-tooling codebase and the order id is already an opaque ObjectId.)

## 4. Test status

`node --test homework-m6/stage2-fix-top3/tests/order-getById.idor.test.js`

```
ok 1 - owner fetching their own order gets 200 + the order
ok 2 - missing order yields 404 + Error("Order not found")
ok 3 - [FIXED] a different user is rejected with 403 and cannot read the order
ok 4 - [FIXED] an admin can read any order
# tests 4 # pass 4 # fail 0
```

Control tests (#1 owner, #2 not-found) stayed green across the fix → adjacent logic intact.

## 5. Behavior change

**Yes — intentional.** Before: a non-owner got `200 + full order` (the IDOR). After: `403 + Error('Not authorized to view this order')`, body never serialized.

Updated test: `[TARGET/insecure] a different user can currently read another user order` → rewritten to `[FIXED] a different user is rejected with 403 …` (asserts 403 + no body). Added a new control `[FIXED] an admin can read any order` to lock the admin carve-out. This is a spec change (the endpoint's contract is now "own orders + admin"), not test-fudging.

## 6. Lessons learned

The AI review flagged this as a one-liner, but the populate vs non-populate distinction matters: the sibling `updateOrderToPaid` (fix #3) has the **same** IDOR yet `order.user` there is a raw ObjectId, so the guard expression differs (`order.user` vs `order.user._id`). A copy-pasted guard would have silently passed for everyone on the pay route. Per-handler verification beats a blanket find-and-replace.
