# Fix #3 — `updateOrderToPaid` trusts the client (free orders + IDOR + crash)

## 1. Original finding (from synthesis.md — Top-3 #3)

> **`backend/controllers/orderController.js:94-105`** — `updateOrderToPaid` помечает заказ оплаченным из **полностью клиентских данных**, без верификации платежа у PayPal, без проверки владельца заказа, и падает 500 при отсутствии `req.body.payer`.
> - Source: security-mate (SEC-01 A04/A08 + SEC-03 A01 IDOR), architecture-mate (C3 — unvalidated `payer` deref)
> - Impact: любой залогиненный пользователь может пометить **любой** заказ оплаченным бесплатно.
> - Fix approach: ownership/admin guard + валидация payload (no-crash) + проверка `status` + идемпотентность.

OWASP: **A04 Insecure Design / A08 Data Integrity / A01 Broken Access Control**. Severity: **HIGH**.

## 2. What I changed (diff)

`backend/controllers/orderController.js` only (+42 / −14). Three guards added before the order is mutated:

```diff
-  if (order) {
-    order.isPaid = true
-    order.paidAt = Date.now()
-    order.paymentResult = {
-      id: req.body.id,
-      status: req.body.status,
-      update_time: req.body.update_time,
-      email_address: req.body.payer.email_address,
-    }
-    const updatedOrder = await order.save()
-    res.json(updatedOrder)
-  } else {
+  if (!order) {
     res.status(404)
     throw new Error('Order not found')
   }
+  // Ownership guard (SEC-03/A01 IDOR): only the buyer or an admin may settle.
+  if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
+    res.status(403)
+    throw new Error('Not authorized to update this order')
+  }
+  // Validate the PayPal payload before trusting it (SEC-01/A08): no blind
+  // deref of req.body.payer, and only a COMPLETED capture flips isPaid.
+  const { id, status, update_time } = req.body || {}
+  const emailAddress = req.body && req.body.payer && req.body.payer.email_address
+  if (!id || status !== 'COMPLETED' || !emailAddress) {
+    res.status(400)
+    throw new Error('Invalid or incomplete payment result')
+  }
+  // Idempotency: don't re-stamp an already-paid order.
+  if (order.isPaid) { res.json(order); return }
+  order.isPaid = true
+  order.paidAt = Date.now()
+  order.paymentResult = { id, status, update_time, email_address: emailAddress }
+  const updatedOrder = await order.save()
+  res.json(updatedOrder)
```

Inverted the `if (order)` block to guard-clauses (the 404 path is unchanged) so three checks read top-to-bottom without deep nesting.

## 3. Why this approach (trade-offs)

- **Ownership guard** mirrors fix #1 but `order.user` is the **raw ObjectId** here (this handler does not `populate`), so the comparison is `order.user.toString()`, not `order.user._id`. Verified against the actual payload, not copy-pasted.
- **Payload validation** turns the blind `req.body.payer.email_address` deref (a guaranteed 500 on any malformed body) into a deterministic 400, and requires `status === 'COMPLETED'` so a `PENDING`/`DECLINED`/spoofed-empty capture can't flip `isPaid`.
- **Idempotency** prevents an already-paid order from being re-stamped with a fresh `paidAt`/`paymentResult`.
- **Verified non-breaking:** the real frontend (`OrderScreen.js:277` → `payOrder` → `PUT /api/orders/:id/pay` with a Bearer token) sends the raw `react-paypal-button-v2` capture object, which has `id` / `status:'COMPLETED'` / `payer.email_address` — exactly what the validation accepts.

### Residual risk (honest scope note)

This is **shape + status validation of a client-supplied payload**, not a server-side verification of the capture against PayPal's API. A determined attacker who owns the order can still POST a fabricated `{status:'COMPLETED'}`. Closing that fully requires the server to re-fetch the capture from PayPal using a server-held secret + the order's capture id — which needs PayPal server credentials wired in and would add the `@paypal/checkout-server-sdk` dependency. That is out of scope for a no-new-deps Stage-2 fix and is logged as a follow-up (synthesis.md fix-order). The ownership guard + no-crash + status check are the bounded, high-value slice.

## 4. Test status

`node --test homework-m6/stage2-fix-top3/tests/order-updateToPaid.test.js`

```
ok 1 - owner paying own order with a valid payload gets 200 + isPaid true
ok 2 - missing order yields 404 + Error("Order not found")
ok 3 - [FIXED] a different user is rejected with 403 and the order is not paid
ok 4 - [FIXED] a malformed payload (no payer) is rejected with 400, no crash
ok 5 - [FIXED] a non-COMPLETED status is rejected with 400
# tests 5 # pass 5 # fail 0
```

Full Stage 2 suite: **12 tests, 12 pass, 0 fail.** Control tests (#1 owner happy path, #2 not-found) stayed green.

## 5. Behavior change

**Yes — two intentional changes + one hardening:**
- TARGET-IDOR: non-owner `200 + isPaid` → `403`, order not settled. Test `[TARGET/insecure] a different user can currently mark another user order paid` → rewritten to `[FIXED] … rejected with 403 …`.
- TARGET-crash: malformed payload `TypeError → 500` → graceful `400`. Test `[TARGET/insecure] missing payer currently crashes …` → rewritten to `[FIXED] … rejected with 400, no crash`.
- New `[FIXED] a non-COMPLETED status is rejected with 400` locks the added status validation.

The happy-path response contract for a valid owner payment is **unchanged** (`200` + the updated order).

## 6. Lessons learned

The AI synthesis lumped this as one finding, but it's really three failure modes stacked on one handler (authz, input validation, idempotency) — and the "obvious" full fix (verify with PayPal) is exactly the part that *can't* be done safely under the no-new-deps constraint. Naming the residual risk explicitly is more honest than pretending a `status === 'COMPLETED'` check on a client-controlled field is real payment verification.
