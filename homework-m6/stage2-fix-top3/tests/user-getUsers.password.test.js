// Characterization tests for finding #2 — getUsers leaks bcrypt password hashes
// (synthesis.md Top-3 #2, backend/controllers/userController.js:111).
//
// Written BEFORE the fix; pins CURRENT behavior (password hashes ARE returned).
//
// run: node --test homework-m6/stage2-fix-top3/tests/user-getUsers.password.test.js

import test from 'node:test'
import assert from 'node:assert/strict'

import { getUsers } from '../../../backend/controllers/userController.js'
import User from '../../../backend/models/userModel.js'
import { makeRes, makeNext, makeQuery, without } from './_helpers.js'

// Realistic-looking user docs, including the bcrypt hash field the API leaks.
const usersFull = () => [
  {
    _id: '6500000000000000000000a1',
    name: 'Admin User',
    email: 'admin@example.com',
    isAdmin: true,
    password: '$2a$10$N9qo8uLOickgx2ZMRZoMy.MQDqg5Q4u3o5l3l3l3l3l3l3l3l3l3',
  },
  {
    _id: '6500000000000000000000b2',
    name: 'Jane Buyer',
    email: 'jane@example.com',
    isAdmin: false,
    password: '$2a$10$abcdefghijklmnopqrstuv0123456789ABCDEFGHIJKLMNOPQRSTUV',
  },
]

test.afterEach(() => {
  delete User.find
})

// CONTROL — shape & count: must stay green after the fix.
test('returns 200 with all users in an array', async () => {
  const data = usersFull()
  // onSelect lets the SAME stub serve both the current (`find()`) and the
  // fixed (`find().select('-password')`) call shapes.
  User.find = () => makeQuery(data, { onSelect: without('password') })

  const req = {}
  const res = makeRes()
  const next = makeNext()

  await getUsers(req, res, next)

  assert.equal(next.called, false)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.length, 2)
  assert.equal(res.body[0].email, 'admin@example.com')
})

// CONTROL — empty collection edge case: must stay green after the fix.
test('returns 200 with [] when there are no users', async () => {
  User.find = () => makeQuery([], { onSelect: without('password') })

  const res = makeRes()
  const next = makeNext()

  await getUsers({}, res, next)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, [])
})

// INTENTIONAL BEHAVIOR CHANGE (fix-2-getusers-password-leak.md): this test used
// to pin the leak (password hash present). The fix adds `.select('-password')`,
// so the hash must be absent and the projection must be requested.
test('[FIXED] response no longer includes password hashes (.select("-password"))', async () => {
  const q = makeQuery(usersFull(), { onSelect: without('password') })
  User.find = () => q

  const res = makeRes()
  const next = makeNext()

  await getUsers({}, res, next)

  assert.equal(next.called, false)
  assert.equal(res.body.length, 2)
  assert.equal(res.body[0].password, undefined)
  assert.equal(res.body[1].password, undefined)
  // other fields survive the projection
  assert.equal(res.body[0].email, 'admin@example.com')
  // the controller asked Mongoose to drop the password column
  assert.equal(q.selectArg, '-password')
})
