// Characterization tests for finding #3 — updateOrderToPaid trusts the client
// (synthesis.md Top-3 #3, backend/controllers/orderController.js:94-105).
//
// Written BEFORE the fix; pins CURRENT behavior, including the insecure
// behaviors (no ownership check; 500 crash on a malformed payload).
//
// run: node --test homework-m6/stage2-fix-top3/tests/order-updateToPaid.test.js

import test from 'node:test'
import assert from 'node:assert/strict'

import { updateOrderToPaid } from '../../../backend/controllers/orderController.js'
import Order from '../../../backend/models/orderModel.js'
import { makeRes, makeNext, makeQuery } from './_helpers.js'

const OWNER_ID = '6500000000000000000000a1'
const OTHER_ID = '6500000000000000000000b2'

// updateOrderToPaid does NOT populate → order.user is the raw ref (ObjectId).
// A string models it fine (string.toString() === itself).
const fakeOrder = (ownerId = OWNER_ID) => ({
  _id: '6500000000000000000000ff',
  user: ownerId,
  totalPrice: 89.99,
  isPaid: false,
  paidAt: undefined,
  paymentResult: undefined,
  async save() {
    return this
  },
})

const validBody = () => ({
  id: 'PAYID-5TY...',
  status: 'COMPLETED',
  update_time: '2026-06-07T10:00:00Z',
  payer: { email_address: 'alice@example.com' },
})

test.afterEach(() => {
  delete Order.findById
})

// CONTROL — owner pays own order with a valid payload: must stay green after fix.
test('owner paying own order with a valid payload gets 200 + isPaid true', async () => {
  const order = fakeOrder(OWNER_ID)
  Order.findById = () => makeQuery(order)

  const req = { params: { id: order._id }, user: { _id: OWNER_ID, isAdmin: false }, body: validBody() }
  const res = makeRes()
  const next = makeNext()

  await updateOrderToPaid(req, res, next)

  assert.equal(next.called, false)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.isPaid, true)
  assert.equal(res.body.paymentResult.email_address, 'alice@example.com')
})

// CONTROL — order not found: must stay green after the fix.
test('missing order yields 404 + Error("Order not found")', async () => {
  Order.findById = () => makeQuery(null)

  const req = { params: { id: 'nope' }, user: { _id: OWNER_ID, isAdmin: false }, body: validBody() }
  const res = makeRes()
  const next = makeNext()

  await updateOrderToPaid(req, res, next)

  assert.equal(res.statusCode, 404)
  assert.ok(next.called)
  assert.equal(next.error.message, 'Order not found')
})

// INTENTIONAL BEHAVIOR CHANGE (fix-3-updateorderpaid-trust.md): used to pin the
// IDOR (a different user got 200 + isPaid). The fix adds an ownership guard, so
// a non-owner non-admin is now rejected with 403 and the order is NOT settled.
test('[FIXED] a different user is rejected with 403 and the order is not paid', async () => {
  const order = fakeOrder(OWNER_ID)
  Order.findById = () => makeQuery(order)

  const req = { params: { id: order._id }, user: { _id: OTHER_ID, isAdmin: false }, body: validBody() }
  const res = makeRes()
  const next = makeNext()

  await updateOrderToPaid(req, res, next)

  assert.equal(res.statusCode, 403)
  assert.ok(next.called)
  assert.equal(next.error.message, 'Not authorized to update this order')
  assert.equal(order.isPaid, false) // never settled
})

// INTENTIONAL BEHAVIOR CHANGE (fix-3-updateorderpaid-trust.md): used to pin the
// 500 crash on a malformed payload (no `payer`). The fix validates the payload,
// so it's now a graceful 400 and the order is NOT settled.
test('[FIXED] a malformed payload (no payer) is rejected with 400, no crash', async () => {
  const order = fakeOrder(OWNER_ID)
  Order.findById = () => makeQuery(order)

  const req = {
    params: { id: order._id },
    user: { _id: OWNER_ID, isAdmin: false },
    body: { id: 'PAYID', status: 'COMPLETED' }, // no `payer`
  }
  const res = makeRes()
  const next = makeNext()

  await updateOrderToPaid(req, res, next)

  assert.equal(res.statusCode, 400)
  assert.ok(next.called)
  assert.ok(!(next.error instanceof TypeError)) // graceful, not a crash
  assert.equal(next.error.message, 'Invalid or incomplete payment result')
  assert.equal(order.isPaid, false)
})

// FIXED — new validation: a non-COMPLETED capture status must not settle the order.
test('[FIXED] a non-COMPLETED status is rejected with 400', async () => {
  const order = fakeOrder(OWNER_ID)
  Order.findById = () => makeQuery(order)

  const req = {
    params: { id: order._id },
    user: { _id: OWNER_ID, isAdmin: false },
    body: { ...validBody(), status: 'PENDING' },
  }
  const res = makeRes()
  const next = makeNext()

  await updateOrderToPaid(req, res, next)

  assert.equal(res.statusCode, 400)
  assert.equal(next.error.message, 'Invalid or incomplete payment result')
  assert.equal(order.isPaid, false)
})
