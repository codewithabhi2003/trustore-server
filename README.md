# Trustore — Backend (Server)

Express + MongoDB API implementing the full contract the client expects: auth, stores,
products, the Groq-powered AI extraction endpoint, the Dynamic Store Clustering engine,
orders, Razorpay payments, reviews, and the admin verification workflow.

## Run it

```bash
cd server
npm install
cp .env.example .env   # fill in Mongo URI, JWT secret, Cloudinary, Groq, Razorpay keys
npm run dev
```

Starts on http://localhost:5000 (health check at `/api/health`).

Then seed an admin account and the default categories:
```bash
npm run seed:admin        # uses ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD from .env
npm run seed:categories
```

## Architecture notes

- **2dsphere index is mandatory** — `Store.js` and `Address.js` both create one in the
  schema itself, so it's set up automatically the first time the app connects.
- **Document privacy** — `GET /api/admin/store/:id/documents` is the only route that ever
  returns Aadhaar/shop-license URLs, and it's behind `protect` + `authorize('admin')`.
- **One Order per store** — a cluster order can span multiple verified stores, but the
  `Order` schema (matching the spec) has a single `storeId`. `POST /api/orders` accepts
  cart items grouped by store and creates one `Order` document per store, returning both
  a top-level `_id` (first order) and `orderIds` (all of them) so a single Razorpay charge
  can mark every one of them paid via `POST /api/payment/verify`.
- **AI/cluster routes are public** — `/api/ai/extract-products` and `/api/clusters/find`
  don't require login, matching the client's `/shop-ai` page which works for guests.
- **Groq rate limits** — the free tier is 30 req/min on `llama3-8b-8192`; the client already
  debounces submissions by 1s.

- **Geocoding** — `GET /api/addresses/geocode?q=` and `GET /api/stores/geocode?q=` wrap
  OpenStreetMap's free Nominatim API (per the original spec's note on turning typed
  address text into coordinates), rate-limited to Nominatim's 1 req/sec policy and
  sending a descriptive User-Agent as required. Both the customer address form and the
  store registration wizard offer this as an alternative to click-on-map.

## Verification performed in this environment

Since this sandbox has no network access (`npm install` returns 403 from the registry),
a real `npm install` + live MongoDB/Groq/Razorpay/Cloudinary run wasn't possible here.
Instead, two layers of verification were done:

**Static checks**, covering every file:
- `node --check` (syntax-only parse) on all 48 backend files
- Every relative `require()` path verified to resolve to a real file
- Every package name in a `require()` verified to exist in `package.json`
- Every function a route file destructures from a controller verified to actually be exported
- Every frontend `api.*()` call cross-referenced against the actual registered backend
  routes (method + path, including `:param` matching) — all 44 real calls resolve; the
  9 backend endpoints with no caller yet (product detail, avatar upload, edit-address,
  cancel-order, etc.) are just UI not built yet, not broken wiring

**A real runtime integration test** — a temporary in-memory harness (real Express-style
routing over Node's `http`, a real Mongo-like query/update engine supporting the exact
operators this codebase uses, real JWT/HMAC via Node's `crypto`, real bcrypt-style salted
hashing, and a real minimal multipart/form-data parser) booted the actual, unmodified
`server.js` and fired real HTTP requests through the full journey: registration → role
security → admin bootstrap → addresses → multipart store registration with document
upload → admin approve/reject → product CRUD → AI extraction → Dynamic Store Clustering
(real geo queries + scoring) → order creation → Razorpay payment (real HMAC signature
generated and verified, plus a rejected-forgery case) → order status state machine →
reviews with duplicate prevention and rating aggregation → admin customer blocking → 404
fallthrough. **62/62 checks passed.** The harness (and its shim `node_modules`) is not
part of this deliverable — it was deleted after the run so nothing fake ships.

That process caught three real bugs, fixed in the source (not the shims):
1. `addressController.js` — `Address.updateMany(filter, { isDefault: false })` mixed a
   plain field with no operator; real MongoDB rejects `updateMany` with anything other
   than update operators. Fixed to `{ $set: { isDefault: false } }`.
2. `paymentController.js` — `Order.updateMany` mixed plain dotted-path fields
   (`'payment.status': 'paid'`, etc.) with a `$push` operator in the same update object;
   real MongoDB rejects mixing operators and plain fields. Fixed by wrapping the plain
   fields in `$set`.
3. `paymentController.js` — `Payment.findOneAndUpdate(filter, { razorpayPaymentId, status })`
   passed a plain object, which `findOneAndUpdate` *does* accept — but as a **full
   document replacement**, silently wiping `orderId`, `customerId`, `amount`, `currency`,
   and `createdAt`. Fixed by wrapping in `$set` to update only the intended fields.

What the harness does **not** prove: real MongoDB index behavior/performance, real
Cloudinary/Groq/Razorpay credential handling, or anything network-timing related. Treat
this as "the wiring and logic are sound," not "this has run in production."

The geocoding feature (added after the main harness run) was verified separately with a
mocked `fetch`: request shaping (URL, User-Agent header), response parsing, the 1 req/sec
throttle timing, and the controller's validation/error-handling paths (missing query,
too-short query, upstream failure) all confirmed correct. It hasn't hit the real Nominatim
API — that first live call is, again, the genuine next test.
