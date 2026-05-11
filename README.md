# ProShop eCommerce Platform

> eCommerce platform built with the MERN stack & Redux.

### THIS PROJECT IS DEPRECATED
This project is no longer supported. The new project/course has been released. The code has been cleaned up and now uses Redux Toolkit. You can find the new version [HERE](https://github.com/bradtraversy/proshop-v2)

![screenshot](https://github.com/bradtraversy/proshop_mern/blob/master/uploads/Screen%20Shot%202020-09-29%20at%205.50.52%20PM.png)

## Features

- Full featured shopping cart
- Product reviews and ratings
- Top products carousel
- Product pagination
- Product search feature
- User profile with orders
- Admin product management
- Admin user management
- Admin Order details page
- Mark orders as delivered option
- Checkout process (shipping, payment method, etc)
- PayPal / credit card integration
- Database seeder (products & users)

## Note on Issues
Please do not post issues here that are related to your own code when taking the course. Add those in the Udemy Q/A. If you clone THIS repo and there are issues, then you can submit

## Usage

### Prerequisites

- **Node.js**: 18.x or newer (tested on Node 20). The frontend depends on `react-scripts@3.4.3` (released 2020), whose webpack 4 chain conflicts with OpenSSL 3 on Node 17+ (`ERR_OSSL_EVP_UNSUPPORTED`). The `start` and `build` scripts in `frontend/package.json` already prepend `NODE_OPTIONS=--openssl-legacy-provider` so the dev/build flow works out of the box on modern Node. If `npm install` fails with peer-dependency errors, retry with `--legacy-peer-deps`. Note: this baked-in flag does **not** exist on Node ≤16, so use a recent Node version.
- **MongoDB**: a local instance or a hosted connection string (e.g. MongoDB Atlas).
- **npm**: ships with Node.

The backend uses native ES Modules (`"type": "module"` in `package.json`). When importing **local files** (not packages), include the `.js` extension or you'll get a "module not found" error at runtime.

### Env Variables

Create a `.env` file at the **repo root** (not under `backend/` or `frontend/`) — `backend/server.js` loads it from CWD. The file is gitignored.

```
NODE_ENV = development
PORT = 5001
MONGO_URI = your mongodb uri
JWT_SECRET = 'abc123'
PAYPAL_CLIENT_ID = your paypal client id
```

> **Why port 5001?** On macOS, port 5000 is occupied by the AirPlay Receiver (`ControlCenter`) by default, which causes `EADDRINUSE` on backend startup. We use 5001 to avoid that. If you change `PORT`, also update `"proxy"` in `frontend/package.json` to match — otherwise the dev frontend won't reach the API.

### How to get a PAYPAL_CLIENT_ID

1. Go to the [PayPal Developer Dashboard](https://developer.paypal.com/) and sign in with your PayPal account.
2. Open **Apps & Credentials**.
3. Switch to **Sandbox** (for development) or **Live** (for production).
4. Click **Create App**, give it a name, choose the *Merchant* type, and save.
5. Copy the **Client ID** from the app page and put it into the `PAYPAL_CLIENT_ID` variable in `.env`.

For checkout testing, use sandbox buyer/seller accounts from **Testing Tools → Sandbox Accounts**. The backend exposes the value to the frontend via `GET /api/config/paypal`, which the order screens use to load the PayPal SDK.

### Run MongoDB locally via Docker (OrbStack example)

If you don't have a hosted MongoDB URI, the simplest local option is to run Mongo in a container. On macOS [OrbStack](https://orbstack.dev/) is a lightweight Docker Desktop alternative — install it, launch it once, and the standard `docker` CLI is available. On Linux/Windows the same `docker run` works with Docker Desktop, Docker Engine, or Podman.

```bash
# Pull and start MongoDB with auth, persisting data in a named volume
docker run -d \
  --name proshop-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=secret \
  -v proshop-mongo-data:/data/db \
  mongo:6
```

Set the matching connection string in your root `.env`:

```
MONGO_URI = mongodb://admin:secret@localhost:27017/proshop?authSource=admin
```

`authSource=admin` is required because the credentials are created in the `admin` database (the default for `MONGO_INITDB_ROOT_*`); the `proshop` database itself is created on first write by the seeder or the app.

Common follow-ups:

```bash
docker logs -f proshop-mongo            # tail logs
docker stop proshop-mongo               # stop container (data is kept in the volume)
docker start proshop-mongo              # resume
docker rm -f proshop-mongo              # remove container (volume survives)
docker volume rm proshop-mongo-data     # wipe the data volume
```

OrbStack note: containers are reachable on `localhost` from the host without extra setup, so the URI above works as-is. If you map the port to something other than 27017, update the URI accordingly.

### Install Dependencies (frontend & backend)

```
npm install
cd frontend
npm install
```

### Run

Make sure both `npm install`s above have completed and `.env` is in place before running.

```
# Run frontend (:3000) & backend (:5001) concurrently
npm run dev

# Run backend only (with nodemon)
npm run server

# Run frontend only
npm run client

# Run backend with plain node (no nodemon) — used in production / Procfile
npm start
```

In development the React dev server (`:3000`) proxies API calls to the backend (`:5001`) via the `"proxy"` field in `frontend/package.json`, so the frontend can call `/api/...` directly with no CORS configuration.

### Uploads

Product images posted to `POST /api/upload` are written to the `uploads/` directory at the repo root by `backend/routes/uploadRoutes.js` and served back at `/uploads/...`. Only `jpg`, `jpeg`, and `png` files are accepted. The directory is committed so a fresh clone works out of the box. Note: on hosts with ephemeral filesystems (e.g. Heroku) uploaded files do not persist across dyno restarts — use object storage in production if uploads matter.

### Feature Flags (Module 3 — MCP)

`backend/features.json` is the source of truth for 25 product feature flags. Backend exposes them at:

- `GET /api/feature-flags` — full map of all flags.
- `GET /api/feature-flags/:name` — one flag (404 on missing).

Both endpoints re-read the file on every request, so writes from the MCP server are visible without a backend restart.

Admins see the live state at `/admin/feature-flags` (`Admin → Dashboard Features` in the navbar). The screen fetches the REST endpoint above; there is **no direct file read from the frontend**.

The MCP server that mutates `backend/features.json` lives at `mcp-servers/feature-flags/` (Python FastMCP, managed by `uv`). Project-level config is at `.mcp.json` in the repo root.

```bash
# One-off dependency install
cd mcp-servers/feature-flags && uv sync

# Smoke-test scenario (the same one logged in report.md / ## M3)
uv run python run_search_v2_scenario.py

# Direct stdio launch (Claude Code does this automatically via .mcp.json)
uv run python server.py
```

Tools exposed by the server: `list_features`, `get_feature_info`, `set_feature_state`, `adjust_traffic_rollout`. Contract and validation rules are documented in `aidev-course-materials/M3/project-data/feature-flags-spec.md` and in each tool's docstring inside `server.py`.

## Build & Deploy

### Heroku

```
# Create frontend prod build (only needed for non-Heroku deploys)
cd frontend
npm run build
```

A `heroku-postbuild` script in the root `package.json` installs frontend deps and builds the production bundle automatically when you push to Heroku, so no manual build step is needed there. The `Procfile` boots `node backend/server.js`.

### Self-hosted / generic Node

1. Build the frontend: `cd frontend && npm run build`.
2. Set environment variables on the host (same list as above, with `NODE_ENV=production`).
3. From the repo root, run `npm start`. In production mode `backend/server.js` serves `frontend/build` and falls back to `index.html` for non-API routes, so a single Node process serves both the API and the SPA.

### Seed Database

You can use the following commands to seed the database with some sample users and products as well as destroy all data

```
# Import data
npm run data:import

# Destroy data
npm run data:destroy
```

```
Sample User Logins

admin@example.com (Admin)
123456

john@example.com (Customer)
123456

jane@example.com (Customer)
123456
```


## License

The MIT License

Copyright (c) 2020 Traversy Media https://traversymedia.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
