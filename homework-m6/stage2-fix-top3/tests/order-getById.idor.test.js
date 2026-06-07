// Characterization tests for finding #1 — IDOR in getOrderById
// (synthesis.md Top-3 #1, backend/controllers/orderController.js:77).
//
// Written BEFORE the fix. They pin CURRENT behavior — including the insecure
// behavior — so the fix can't silently break adjacent logic.
//
// run: node --test homework-m6/stage2-fix-top3/tests/order-getById.idor.test.js

import test from 'node:test'
import assert from 'node:assert/strict'

import { getOrderById } from '../../../backend/controllers/orderController.js'
import Order from '../../../backend/models/orderModel.js'
import { makeRes, makeNext, makeQuery } from './_helpers.js'

const OWNER_ID = '6500000000000000000000a1'
const OTHER_ID = '6500000000000000000000b2'

// getOrderById populates `user` → order.user is an object with _id/name/email.
const fakeOrder = (ownerId = OWNER_ID) => ({
  _id: '6500000000000000000000ff',
  user: { _id: ownerId, name: 'Alice', email: 'alice@example.com' },
  orderItems: [{ name: 'Airpods', qty: 1, price: 89.99 }],
  totalPrice: 89.99,
  isPaid: false,
})

test.afterEach(() => {
  delete Order.findById
})

// CONTROL — owner reads own order: must stay green after the fix.
test('owner fetching their own order gets 200 + the order', async () => {
  const order = fakeOrder(OWNER_ID)
  Order.findById = () => makeQuery(order)

  const req = { params: { id: order._id }, user: { _id: OWNER_ID, isAdmin: false } }
  const res = makeRes()
  const next = makeNext()

  await getOrderById(req, res, next)

  assert.equal(next.called, false)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.email ?? res.body.user.email, 'alice@example.com')
})

// CONTROL — not found: must stay green after the fix.
test('missing order yields 404 + Error("Order not found")', async () => {
  Order.findById = () => makeQuery(null)

  const req = { params: { id: 'deadbeef' }, user: { _id: OWNER_ID, isAdmin: false } }
  const res = makeRes()
  const next = makeNext()

  await getOrderById(req, res, next)

  assert.equal(res.statusCode, 404)
  assert.ok(next.called)
  assert.equal(next.error.message, 'Order not found')
})

// INTENTIONAL BEHAVIOR CHANGE (fix-1-idor-getorderbyid.md): this test used to
// pin the insecure behavior (a different user got 200 + the order). The fix adds
// an ownership guard, so a non-owner non-admin must now be rejected with 403 and
// must NOT see the order body.
test('[FIXED] a different user is rejected with 403 and cannot read the order', async () => {
  Order.findById = () => makeQuery(fakeOrder(OWNER_ID))

  const req = { params: { id: 'x' }, user: { _id: OTHER_ID, isAdmin: false } }
  const res = makeRes()
  const next = makeNext()

  await getOrderById(req, res, next)

  assert.equal(res.statusCode, 403)
  assert.ok(next.called)
  assert.equal(next.error.message, 'Not authorized to view this order')
  assert.equal(res.body, undefined) // order never serialized to the non-owner
})

// FIXED — admins must still be able to read any order (control for the new guard).
test('[FIXED] an admin can read any order', async () => {
  Order.findById = () => makeQuery(fakeOrder(OWNER_ID))

  const req = { params: { id: 'x' }, user: { _id: OTHER_ID, isAdmin: true } }
  const res = makeRes()
  const next = makeNext()

  await getOrderById(req, res, next)

  assert.equal(next.called, false)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.user.email, 'alice@example.com')
})
