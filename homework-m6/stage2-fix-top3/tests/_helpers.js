// Test doubles for Stage 2 characterization tests.
//
// We exercise the real Express controllers directly (no HTTP server, no Mongo,
// no new deps) by:
//   1. monkey-patching the Mongoose model statics the controller calls
//      (`Order.findById`, `User.find`, ...). The model default export is a
//      shared object reference, so reassigning a static is visible to the
//      controller at call time.
//   2. passing fake `req` / `res` / `next`.
//
// `express-async-handler@1.1.4` returns the wrapped promise
// (`Promise.resolve(fn(...)).catch(next)`), so `await handler(req,res,next)`
// resolves only after the handler finishes — thrown errors land on `next`.

// Fake Express response: records statusCode / json body / send payload.
export const makeRes = () => {
  const res = { statusCode: 200, body: undefined, sent: undefined }
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (payload) => {
    res.body = payload
    return res
  }
  res.send = (payload) => {
    res.sent = payload
    return res
  }
  return res
}

// Fake `next`: captures the error the error-handler middleware would receive.
export const makeNext = () => {
  const fn = (err) => {
    fn.called = true
    fn.error = err
  }
  fn.called = false
  fn.error = null
  return fn
}

// Chainable + awaitable Mongoose query double.
//   - `.populate()` / `.sort()` return self (so `findById(id).populate(...)` works).
//   - `.select(proj)` records the projection and, if `onSelect` is given,
//     resolves to the transformed result (used to model `.select('-password')`).
//   - it's a thenable, so `await query` resolves to `result`.
export const makeQuery = (result, { onSelect } = {}) => {
  const q = {
    populate() {
      return this
    },
    sort() {
      return this
    },
    select(proj) {
      q.selectArg = proj
      if (onSelect) return Promise.resolve(onSelect(result, proj))
      return this
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  q.selectArg = undefined
  return q
}

// Strip a field from each plain object (models `.select('-password')`).
export const without = (field) => (arr) =>
  arr.map(({ [field]: _omit, ...rest }) => rest)
