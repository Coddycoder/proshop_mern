# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The README marks this project as **deprecated**; an updated Redux-Toolkit version lives at `bradtraversy/proshop-v2`. Treat this repo as legacy: prefer minimal, in-style changes over modernization unless explicitly asked. Stack pins are old (React 16, Mongoose 5, redux + redux-thunk, react-router-dom v5, react-scripts 3.4.3) — do not casually upgrade.

## Common commands

Run from the repo root unless noted.

```bash
# Install (root + frontend are separate package.json trees)
npm install
cd frontend && npm install

# Dev: runs backend (nodemon, :5000) and frontend (CRA, :3000) concurrently
npm run dev

# Backend only
npm run server

# Frontend only
npm run client

# Production server entry (no nodemon)
npm start

# Seed / wipe MongoDB
npm run data:import
npm run data:destroy   # same as `node backend/seeder -d`

# Frontend build
cd frontend && npm run build

# Frontend tests (CRA / Jest); no backend test suite is configured
cd frontend && npm test
cd frontend && npm test -- --watchAll=false MyComponent   # single test/file
```

Required `.env` at repo root: `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `PAYPAL_CLIENT_ID`.

## Backend uses ES Modules in Node

`backend/package.json` (root) sets `"type": "module"`. Two consequences when editing:

1. Use `import`/`export`, not `require`.
2. **Local file imports must include the `.js` extension** (e.g. `import connectDB from './config/db.js'`). Omitting it produces "module not found" at runtime, not at lint time. Package imports do not need the extension.

Requires Node v14.6+ (or `--experimental-modules`).

## Architecture

### Two-tree monorepo, single dev process

The root `package.json` is the **backend** project (Express + Mongoose). `frontend/` is a **separate CRA app** with its own `package.json` and lockfile. `npm run dev` uses `concurrently` to run both. The frontend's `package.json` declares `"proxy": "http://127.0.0.1:5000"`, so frontend code calls `/api/...` directly without CORS config.

### Backend layout (`backend/`)

Conventional Express layering:

- `server.js` — bootstraps dotenv, calls `connectDB()`, mounts route modules under `/api/products`, `/api/users`, `/api/orders`, `/api/upload`, plus a `/api/config/paypal` endpoint that returns the PayPal client ID. In production it also serves `frontend/build` and falls back to `index.html`. Static `uploads/` directory is served at `/uploads`.
- `routes/` — thin Express routers; auth is enforced by composing `protect` and `admin` middleware from `middleware/authMiddleware.js`.
- `controllers/` — business logic. All async handlers are wrapped with `express-async-handler` so thrown errors flow into `errorMiddleware.js` (`notFound` + `errorHandler`).
- `models/` — Mongoose schemas (`User`, `Product`, `Order`). `userModel` has password hashing and a `matchPassword` instance method; orders embed `orderItems`, `shippingAddress`, and `paymentResult` subdocs.
- `middleware/authMiddleware.js` — JWT bearer-token check (`protect`) and admin gate (`admin`). Tokens are issued by `utils/generateToken.js`.
- `routes/uploadRoutes.js` — multer disk storage that writes into the repo-root `uploads/` directory; only `jpg|jpeg|png` are accepted. Uploaded files are referenced by the path returned in the response and served back via the static mount in `server.js`.
- `seeder.js` — destroys then re-imports `data/users.js` + `data/products.js`; the first seeded user becomes the admin and is set as the `user` reference on every product.

### Frontend layout (`frontend/src/`)

Classic Redux (no Redux Toolkit) with `redux-thunk`:

- `store.js` wires every reducer into a single root, then **rehydrates `cart.cartItems`, `cart.shippingAddress`, and `userLogin.userInfo` from `localStorage`** as `initialState`. Persistence back to `localStorage` happens inside the relevant action creators (`cartActions`, `userActions`), not via middleware.
- `constants/` — string action-type constants per domain (product/cart/user/order).
- `actions/` — thunks that call the API with `axios`, attaching `Authorization: Bearer <token>` from `getState().userLogin.userInfo` for protected routes.
- `reducers/` — switch-style reducers grouped per concern (e.g. `productListReducer`, `productDetailsReducer`, `productCreateReducer` all live in `productReducers.js`). Each async flow has its own slice (`*_REQUEST` / `*_SUCCESS` / `*_FAIL` / `*_RESET`).
- `screens/` — route-level components (one per page). `App.js` declares all routes with `react-router-dom` v5 (`<Route component={...} />`, not v6 `element`). Admin screens live under `/admin/...`.
- `components/` — shared UI built on `react-bootstrap` (custom Bootstrap CSS lives at `src/bootstrap.min.css`). Notable: `FormContainer`, `CheckoutSteps`, `Paginate`, `ProductCarousel`, `Meta` (react-helmet), `Rating`.

### Adding a feature: typical paths

- **New API endpoint**: add a controller in `backend/controllers/`, register it in the matching `backend/routes/*Routes.js`, gate with `protect` / `admin` as needed. The error-handler middleware will surface thrown errors automatically — just `throw new Error(...)` after setting `res.status(...)`.
- **New Redux-driven UI flow**: add constants → action creator (thunk) → reducer slice → register the reducer in `frontend/src/store.js` → consume via `useSelector` / `useDispatch` in a screen or component. Action creators that need auth should pull `userLogin.userInfo.token` out of `getState()` and set the `Authorization` header on the axios call.
- **New screen**: create `frontend/src/screens/XxxScreen.js` and add a `<Route>` to `App.js`.

## Git workflow

Single feature-branch model:

- All development, experiments and WIP commits happen on **one** feature branch (not on `master`).
- When the feature is complete, integrate it into `master` with a **squash commit** (so `master` keeps a clean, one-commit-per-feature history) and then **push `master` to `origin`**.
- Do not push the feature branch itself to `origin` — only the squashed result on `master`.

Typical sequence once the feature is done:

```bash
git checkout master
git merge --squash <feature-branch>
git commit -m "<feature summary>"
git push origin master
```

## Diagnosing from logs

When the user pastes logs and the cause is something checkable with a quick command (port in use, process holding a file, missing env var, network reachability, disk full, Node version, etc.), **run a read-only verification first** (`lsof`, `ps`, `ls`, `cat`, `node -v`, `which …`) and base the verdict on the actual output, not on guesses.

Do **not** auto-fix problems outside the project itself: do not kill processes, toggle macOS services, edit shell config, or change global Node/npm settings. Diagnose, then hand the user concrete steps to run on their machine.

It is fine — and expected — to fix issues inside the repo (`.env`, `package.json`, source code, ports referenced in config). The line is "user's machine vs. project's repo": project-side fixes are mine to apply when asked; system-side fixes are theirs.

## Deployment

`Procfile` (`web: node backend/server.js`) and the `heroku-postbuild` script in the root `package.json` build the frontend on Heroku, after which `server.js`'s production branch serves it. No manual `npm run build` is needed before pushing to Heroku.
