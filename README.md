

# 🌍 Website Analytics API  
> A scalable backend for collecting and aggregating website & app analytics events  
> **Built with NestJS · Prisma · PostgreSQL · Redis · Docker · Deployed on Railway**

---

## 🚀 Live Demo
**Base URL:**  
🔗 [https://analytics-backend-production-894f.up.railway.app](https://analytics-backend-production-894f.up.railway.app)

**Swagger Docs:**  
📘 [https://analytics-backend-production-894f.up.railway.app/docs](https://analytics-backend-production-894f.up.railway.app/docs)

---

## 📖 Overview
This API allows websites or mobile apps to send structured analytics events — such as clicks, visits, and device data — and then query aggregated reports for insights.  
It includes:
- 🔐 API Key Management  
- 📊 Event Collection & Aggregation  
- ⚡ Redis Caching  
- 🧠 Rate Limiting  
- 🧰 Dockerized deployment  
- ✅ Tested & documented endpoints

---

## 🧩 Features

| Category | Highlights |
|-----------|-------------|
| **API Key Management** | Register apps, issue/revoke/regenerate keys, handle expiry |
| **Event Collection** | `/api/analytics/collect` accepts events with `x-api-key` |
| **Analytics Reports** | `/api/analytics/event-summary` and `/api/analytics/user-stats` |
| **Caching** | Redis caching for frequent queries |
| **Security** | Helmet, CORS, bcrypt hashing for API keys |
| **Performance** | Rate limiting for ingestion & analytics |
| **Docs** | Swagger UI for all endpoints |

---

## 🧠 Tech Stack
- **NestJS** (framework)  
- **Prisma ORM** (PostgreSQL)  
- **Redis** (caching & rate limiting)  
- **Docker + Docker Compose**  
- **Railway** (cloud hosting)  
- **Jest + Supertest** (testing)  

---

## ⚙️ Local Setup

### 1️⃣ Clone & configure
```bash
git clone https://github.com/<your-username>/analytics-api.git
cd analytics-api
cp .env.example .env
````

### 2️⃣ Start the stack

```bash
docker compose up -d --build
```

### 3️⃣ Verify

```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/healthz/db
```

Swagger Docs → [http://localhost:3000/docs](http://localhost:3000/docs)

---


# API Endpoint Reference

Base URL (Prod): `https://analytics-backend-production-894f.up.railway.app`

Auth model:
* **Developer (dev-only)**: `x-dev-user: <email>` (for app registration & key listing)
* **App**: `x-api-key: <issued API key>` (for ingestion & analytics)

Rate limits (defaults):

* **Ingestion**: 100 req/s per API key
* **Reads (analytics)**: 20 req/s per API key

## Health

### GET `/healthz`

Returns service status.

```json
{ "status": "ok", "time": "2025-11-14T10:20:30.000Z" }
```

### GET `/healthz/db`

Checks DB connectivity.

```json
{ "db": "ok", "time": "2025-11-14T10:20:30.000Z" }
```

---

## API Key Management (dev-only)

> Use **`x-dev-user: you@example.com`** header.

### POST `/api/auth/register`

Registers a new app and returns **one** plaintext API key (shown only once).

**Headers**

```
Content-Type: application/json
x-dev-user: you@example.com
```

**Body**

```json
{ "name": "My Demo App" }
```

**200 Response**

```json
{
  "app": { "id": "app_cuid", "name": "My Demo App", "ownerId": "user_cuid", "createdAt": "..." },
  "apiKey": "ak_ab12_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "apiKeyId": "key_cuid",
  "prefix": "ak_ab12",
  "expiresAt": null
}
```

### GET `/api/auth/api-key`

Lists API key **metadata** (never returns plaintext keys).

**Headers**

```
x-dev-user: you@example.com
```

**Query (optional)**

* `appId`: if provided, list keys for that app; else list for all your apps.
  **200 Response**

```json
[
  {
    "app": { "id": "app_cuid", "name": "My Demo App", "ownerId": "user_cuid", "createdAt": "..." },
    "keys": [
      { "id": "key_cuid", "keyPrefix": "ak_ab12", "status": "active", "createdAt": "...", "expiresAt": null }
    ]
  }
]
```

### POST `/api/auth/revoke`

Revokes an API key (cannot be used afterwards).

**Headers**

```
Content-Type: application/json
x-dev-user: you@example.com
```

**Body**

```json
{ "apiKeyId": "key_cuid" }
```

**200 Response**

```json
{ "id": "key_cuid", "status": "revoked" }
```

### POST `/api/auth/regenerate`

Revokes old key and issues a new plaintext key.

**Headers**

```
Content-Type: application/json
x-dev-user: you@example.com
```

**Body**

```json
{ "apiKeyId": "key_cuid", "expiresAt": "2026-01-01T00:00:00Z" }
```

**200 Response**

```json
{
  "apiKeyId": "new_key_cuid",
  "apiKey": "ak_cd34_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "prefix": "ak_cd34",
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

---

## Event Ingestion

### POST `/api/analytics/collect`

Submits an analytics event.

**Headers**

```
Content-Type: application/json
x-api-key: <YOUR_API_KEY>
```

**Body**

```json
{
  "event": "login_form_cta_click",
  "url": "https://example.com/page",
  "referrer": "https://google.com",
  "device": "mobile",
  "userId": "user789",
  "timestamp": "2024-02-20T12:34:56Z",
  "metadata": { "browser": "Chrome", "os": "Android", "screenSize": "1080x1920" }
}
```

**202 Response**

```json
{ "status": "accepted" }
```

Notes:

* `timestamp` optional (server time used if omitted)
* `metadata` is arbitrary JSON (keep small, e.g., <8KB)

---

## Analytics Queries

### GET `/api/analytics/event-summary`

Returns counts and device breakdown for an event.

**Headers**

```
x-api-key: <YOUR_API_KEY>
```

**Query**

* `event` (string, required)
* `startDate` (ISO date/datetime, optional)
* `endDate` (ISO date/datetime, optional)
* `app_id` (string, optional; defaults to current app)
  **200 Response**

```json
{
  "event": "login_form_cta_click",
  "count": 3400,
  "uniqueUsers": 1200,
  "deviceData": { "mobile": 2200, "desktop": 1200, "unknown": 0 },
  "range": { "start":"2024-02-15T00:00:00.000Z", "end":"2024-02-20T00:00:00.000Z" }
}
```

### GET `/api/analytics/user-stats`

Returns per-user totals and recent events.

**Headers**

```
x-api-key: <YOUR_API_KEY>
```

**Query**

* `userId` (string, required)
* `app_id` (string, optional; defaults to current app)
  **200 Response**

```json
{
  "userId": "user789",
  "totalEvents": 150,
  "recentEvents": [
    { "ts":"2025-11-14T08:00:00Z", "device":"mobile", "ipAddress":null, "metadata":{"browser":"Chrome","os":"Android"}, "event":"login_form_cta_click", "url":"...", "referrer":"..." }
  ],
  "deviceDetails": { "browser":"Chrome", "os":"Android" },
  "ipAddress": "192.168.1.1"
}
```

---

## Errors & Status Codes

| Code                        | When                                                                         |
| --------------------------- | ---------------------------------------------------------------------------- |
| `400 Bad Request`           | Invalid DTO / missing required fields                                        |
| `401 Unauthorized`          | Missing `x-api-key` (ingest/analytics) or missing `x-dev-user` (auth routes) |
| `403 Forbidden`             | Invalid or revoked/expired API key                                           |
| `404 Not Found`             | Wrong method/URL (e.g., `GET` on a `POST` route)                             |
| `429 Too Many Requests`     | Rate limit exceeded (ingest/read)                                            |
| `500 Internal Server Error` | Unexpected server error                                                      |

---

## 🧰 Development Scripts

| Command                  | Description                 |
| ------------------------ | --------------------------- |
| `npm run start:dev`      | Start Nest in watch mode    |
| `npm run build`          | Compile to `dist`           |
| `npm run start:prod:db`  | Run DB migrations & start   |
| `npm run test`           | Run Jest tests              |
| `npx prisma studio`      | Visual DB explorer          |
| `docker compose down -v` | Stop & clean all containers |

---

## 🧪 Quick Live Tests

| Endpoint                       | Method | Description                                    |
| ------------------------------ | ------ | ---------------------------------------------- |
| `/healthz`                     | GET    | Server heartbeat                               |
| `/healthz/db`                  | GET    | Database connection status                     |
| `/api/auth/register`           | POST   | Register a new app and issue a new API key     |
| `/api/auth/api-key`            | GET    | Retrieve API key metadata for your apps        |
| `/api/auth/revoke`             | POST   | Revoke an existing API key                     |
| `/api/auth/regenerate`         | POST   | Regenerate a new API key (revokes old one)     |
| `/api/analytics/collect`       | POST   | Submit analytics event data                    |
| `/api/analytics/event-summary` | GET    | Retrieve aggregated analytics summary by event |
| `/api/analytics/user-stats`    | GET    | View detailed stats for a specific user        |

---

## 🧠 Future Enhancements

* OAuth onboarding for apps
* Asynchronous ingestion queue (Kafka/RabbitMQ)
* Frontend dashboard with charts
* API key usage analytics
* Alerting & monitoring hooks

---

## 🧑‍💻 Author

**Sanah Saleem**
Full-stack Developer
📧 [sanahsaleem2000@gmail.com](mailto:sanahsaleem200@gmail.com)
🔗 [LinkedIn](https://www.linkedin.com/in/sanah-saleem-b81598203)

---

