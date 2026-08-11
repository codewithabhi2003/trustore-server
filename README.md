# Trustore — Backend API 🛒

> **AI-powered hyperlocal grocery marketplace backend built with Node.js, Express, MongoDB, Groq AI, Razorpay, Cloudinary, and OpenStreetMap.**

Trustore connects customers with **admin-verified local grocery stores** and intelligently helps them complete grocery lists through AI-powered product extraction and **Dynamic Store Clustering**.

The backend provides the complete API layer for authentication, store management, products, AI shopping assistance, geospatial discovery, intelligent store clustering, orders, payments, reviews, addresses, and administrative verification.

---

## ✨ Core Features

* 🔐 **JWT Authentication & Role-Based Access**

  * Customer
  * Store Owner
  * Admin

* 🏪 **Verified Local Store Marketplace**

  * Store registration
  * Document verification
  * Admin approval/rejection
  * Verified-store-only discovery

* 🤖 **Groq AI Shopping Assistant**

  * Converts natural-language grocery lists into structured products
  * Extracts quantity, unit, and search keywords

* 🗺️ **Dynamic Store Clustering**

  * Finds verified stores near the customer
  * Groups stores geographically
  * Matches requested products across stores
  * Scores clusters based on availability, distance, efficiency, and ratings

* 📍 **100-Meter Border Store Exception**

  * Finds nearby stores outside the selected cluster
  * Fills missing products when an eligible store is within 100 meters

* 📦 **Multi-Store Order Processing**

  * Cluster carts can contain products from multiple stores
  * Creates one order per store
  * Supports a single payment across the resulting orders

* 💳 **Razorpay Payments**

  * Razorpay order creation
  * HMAC-SHA256 payment signature verification
  * Payment status synchronization

* ☁️ **Cloudinary Uploads**

  * Store documents
  * Product images
  * User avatars

* ⭐ **Reviews & Ratings**

  * One review per completed order
  * Duplicate-review prevention
  * Store rating aggregation

* 📍 **Geospatial Search**

  * MongoDB `2dsphere` indexes
  * Nearby-store discovery
  * Address/store geocoding through OpenStreetMap Nominatim

* 🛡️ **Admin Verification Workflow**

  * Pending store review
  * Private document access
  * Approve/reject workflow
  * Customer management
  * Platform analytics

---

# 🧰 Tech Stack

| Technology              | Purpose                   |
| ----------------------- | ------------------------- |
| Node.js                 | Runtime                   |
| Express.js              | REST API                  |
| MongoDB Atlas           | Database                  |
| Mongoose                | ODM                       |
| JWT                     | Authentication            |
| bcryptjs                | Password hashing          |
| Groq                    | AI product extraction     |
| Razorpay                | Payments                  |
| Cloudinary              | Media/document storage    |
| Multer                  | Multipart file uploads    |
| OpenStreetMap Nominatim | Geocoding                 |
| Leaflet                 | Frontend map integration  |
| CORS                    | Cross-origin requests     |
| dotenv                  | Environment configuration |

---

# 🏗️ Backend Architecture

```text
server/
│
├── config/
│   ├── db.js
│   ├── cloudinary.js
│   └── groq.js
│
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── storeController.js
│   ├── productController.js
│   ├── orderController.js
│   ├── reviewController.js
│   ├── paymentController.js
│   ├── aiController.js
│   ├── clusterController.js
│   ├── addressController.js
│   └── adminController.js
│
├── middleware/
│   ├── authMiddleware.js
│   ├── roleMiddleware.js
│   ├── uploadMiddleware.js
│   └── errorHandler.js
│
├── models/
│   ├── User.js
│   ├── Store.js
│   ├── Product.js
│   ├── Category.js
│   ├── Order.js
│   ├── Address.js
│   ├── Review.js
│   └── Payment.js
│
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── storeRoutes.js
│   ├── productRoutes.js
│   ├── orderRoutes.js
│   ├── reviewRoutes.js
│   ├── paymentRoutes.js
│   ├── aiRoutes.js
│   ├── clusterRoutes.js
│   ├── addressRoutes.js
│   └── adminRoutes.js
│
├── services/
│   ├── groqService.js
│   ├── clusterService.js
│   ├── cloudinaryService.js
│   └── notificationService.js
│
├── utils/
│   ├── geoUtils.js
│   ├── generateToken.js
│   └── apiResponse.js
│
├── seeds/
│   ├── adminSeed.js
│   └── categorySeed.js
│
├── .env
├── .env.example
├── package.json
└── server.js
```

The backend follows a conventional layered architecture:

```text
HTTP Request
     │
     ▼
   Route
     │
     ▼
 Middleware
     │
     ▼
 Controller
     │
     ├──────────────► Service
     │                  │
     │                  ▼
     │              External API
     │
     ▼
   Model
     │
     ▼
 MongoDB
```

---

# 🚀 Getting Started

## 1. Clone the repository

```bash
git clone <repository-url>
cd trustore/server
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Create a `.env` file:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

MONGO_URI=your_mongodb_atlas_connection_string

JWT_SECRET=your_jwt_secret_min_32_chars
JWT_EXPIRE=7d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

GROQ_API_KEY=your_groq_api_key

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

## 4. Start the development server

```bash
npm run dev
```

The API will be available at:

```text
http://localhost:5000
```

Health check:

```text
GET http://localhost:5000/api/health
```

---

# 🌱 Database Seeding

After configuring MongoDB, seed the initial admin account and categories.

### Seed admin

```bash
npm run seed:admin
```

The seed script uses:

```env
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=your_secure_password
```

### Seed categories

```bash
npm run seed:categories
```

---

# 🔐 Authentication & Authorization

Trustore uses JWT-based authentication.

### Roles

| Role         | Access                                      |
| ------------ | ------------------------------------------- |
| `customer`   | Shopping, addresses, orders, reviews        |
| `storeOwner` | Store management, products, incoming orders |
| `admin`      | Platform management and store verification  |

Protected requests use:

```http
Authorization: Bearer <JWT_TOKEN>
```

Role-specific routes use authorization middleware.

Example:

```js
protect
authorize('admin')
```

---

# 🏪 Store Verification

A store is **not visible to customers immediately after registration**.

The lifecycle is:

```text
Store Owner Registration
        │
        ▼
     Pending
        │
        ├───────────────┐
        ▼               ▼
    Approved         Rejected
        │               │
        ▼               ▼
 Visible to         Owner sees
 customers          admin note
```

Only stores satisfying:

```js
verificationStatus: 'approved'
isActive: true
```

are eligible for customer-facing discovery and clustering.

---

# 🔒 Document Privacy

Store verification documents such as:

* Aadhaar
* Shop License

are treated as private data.

The only API endpoint that exposes these document URLs is:

```http
GET /api/admin/store/:id/documents
```

This endpoint requires:

```text
Authenticated user
        +
Admin role
```

Store documents are never returned through normal public store APIs.

---

# 📍 Geospatial Architecture

Trustore uses MongoDB's geospatial capabilities for store and address coordinates.

Coordinates are stored using GeoJSON:

```json
{
  "type": "Point",
  "coordinates": [longitude, latitude]
}
```

A mandatory `2dsphere` index is created on stores:

```js
storeSchema.index({ location: '2dsphere' });
```

The same geospatial indexing strategy is used for addresses.

This enables queries such as:

```text
Customer Location
      │
      ▼
MongoDB $near
      │
      ▼
Verified Stores
within requested radius
```

---

# 🤖 AI Product Extraction

Trustore accepts natural-language grocery lists such as:

```text
I need 2kg rice, 1 litre milk, bread and cooking oil.
```

The AI endpoint:

```http
POST /api/ai/extract-products
```

accepts:

```json
{
  "text": "I need 2kg rice, 1 litre milk, bread and cooking oil"
}
```

and returns structured products:

```json
{
  "success": true,
  "products": [
    {
      "name": "rice",
      "quantity": 2,
      "unit": "kg",
      "keywords": [
        "rice",
        "chawal",
        "basmati"
      ]
    },
    {
      "name": "milk",
      "quantity": 1,
      "unit": "litre",
      "keywords": [
        "milk",
        "doodh"
      ]
    }
  ]
}
```

The extraction layer uses Groq to convert unstructured user input into predictable JSON that can then be consumed by the clustering engine.

---

# 🧠 Dynamic Store Clustering

Dynamic Store Clustering is one of Trustore's core backend features.

The process is:

```text
Customer Location
       │
       ▼
Find verified stores within 5 km
       │
       ▼
Group nearby stores
       │
       ▼
Match requested products
       │
       ▼
Calculate cluster scores
       │
       ▼
Rank clusters
       │
       ▼
Select best cluster
       │
       ▼
Check 100m border stores
       │
       ▼
Return recommendation
```

## Cluster radius

Stores within:

```text
500 meters
```

are grouped into the same cluster.

## Cluster scoring

The score is calculated using:

| Factor               | Weight |
| -------------------- | -----: |
| Product Availability |    50% |
| Distance             |    25% |
| Delivery Efficiency  |    15% |
| Store Rating         |    10% |

Formula:

```text
Total Score =
    Availability × 0.50
  + Distance      × 0.25
  + Efficiency   × 0.15
  + Rating       × 0.10
```

The highest-scoring cluster becomes the recommended cluster.

---

# 📦 100-Meter Border Store Exception

Sometimes the best cluster does not contain every requested product.

Instead of forcing the customer to abandon the cluster, Trustore checks nearby stores outside the cluster.

```text
Best Cluster
     │
     │ Missing product
     ▼
Search surrounding stores
     │
     ▼
Within 100 meters?
     │
   ┌─┴─┐
  Yes  No
   │
   ▼
Check product availability
   │
   ▼
Use border store
```

This allows Trustore to improve product coverage while keeping the additional store geographically close to the selected cluster.

---

# 🛒 Multi-Store Orders

A cluster may contain products from multiple stores.

The `Order` model intentionally represents **one store per order**.

Therefore:

```text
Customer Cart
     │
     ├── Store A products
     │
     ├── Store B products
     │
     └── Store C products
            │
            ▼
     POST /api/orders
            │
            ▼
     ┌──────┼──────┐
     ▼      ▼      ▼
 Order A  Order B  Order C
     │      │      │
     └──────┼──────┘
            ▼
     Single Razorpay flow
```

The API returns:

```json
{
  "_id": "first-order-id",
  "orderIds": [
    "order-a",
    "order-b",
    "order-c"
  ]
}
```

This allows one payment to be associated with every order created from the customer's clustered cart.

---

# 💳 Razorpay Payment Flow

Payment processing follows:

```text
Create Trustore Order(s)
        │
        ▼
Create Razorpay Order
        │
        ▼
Open Razorpay Checkout
        │
        ▼
Customer completes payment
        │
        ▼
Razorpay returns:
Order ID
Payment ID
Signature
        │
        ▼
POST /api/payment/verify
        │
        ▼
HMAC-SHA256 verification
        │
   ┌────┴────┐
 Valid      Invalid
   │           │
   ▼           ▼
Mark paid    Reject
```

The signature is verified using:

```text
HMAC-SHA256(
    razorpayOrderId + "|" + razorpayPaymentId,
    RAZORPAY_KEY_SECRET
)
```

The server never trusts the client-side payment response without signature verification.

---

# 📦 Order Status State Machine

Orders progress through controlled states:

```text
Order Placed
      │
      ▼
  Accepted
      │
      ▼
  Preparing
      │
      ▼
Ready for Pickup
      │
      ▼
  Completed
```

A customer can cancel an order only while it is:

```text
Order Placed
```

Status changes are stored in `statusHistory` for tracking and auditing.

---

# ⭐ Reviews & Ratings

Reviews are tied to completed orders.

Rules include:

* Review only after order completion
* One review per order
* Rating between 1 and 5
* Duplicate reviews prevented
* Store rating aggregated after review submission

Example:

```json
{
  "rating": 5,
  "comment": "Fast delivery and good quality products."
}
```

---

# 📍 Geocoding

Trustore supports converting typed addresses into coordinates through OpenStreetMap Nominatim.

Endpoints:

```http
GET /api/addresses/geocode?q=
GET /api/stores/geocode?q=
```

The integration includes:

* Query validation
* Minimum query length validation
* Descriptive `User-Agent`
* Upstream error handling
* Response parsing
* Request throttling to respect Nominatim's 1 request/second policy

No paid geocoding API key is required.

---

# 🌐 API Reference

## Authentication

Base path:

```text
/api/auth
```

| Method | Endpoint    | Description       |
| ------ | ----------- | ----------------- |
| POST   | `/register` | Register user     |
| POST   | `/login`    | Authenticate user |
| GET    | `/me`       | Get current user  |
| POST   | `/logout`   | Logout            |

---

## Users

Base path:

```text
/api/users
```

| Method | Endpoint   | Description    |
| ------ | ---------- | -------------- |
| GET    | `/profile` | Get profile    |
| PUT    | `/profile` | Update profile |
| POST   | `/avatar`  | Upload avatar  |

---

## Addresses

Base path:

```text
/api/addresses
```

| Method | Endpoint           | Description         |
| ------ | ------------------ | ------------------- |
| GET    | `/`                | Get addresses       |
| POST   | `/`                | Create address      |
| PUT    | `/:id`             | Update address      |
| DELETE | `/:id`             | Delete address      |
| PUT    | `/:id/set-default` | Set default address |
| GET    | `/geocode?q=`      | Geocode address     |

---

## Stores

Base path:

```text
/api/stores
```

| Method | Endpoint        | Access      | Description                 |
| ------ | --------------- | ----------- | --------------------------- |
| POST   | `/register`     | Store Owner | Register store              |
| GET    | `/nearby`       | Public      | Find nearby verified stores |
| GET    | `/my-store`     | Store Owner | Get owner's store           |
| PUT    | `/my-store`     | Store Owner | Update store                |
| GET    | `/:id`          | Public      | Get store                   |
| GET    | `/:id/products` | Public      | Get store products          |
| GET    | `/geocode?q=`   | Public      | Geocode store address       |

---

## Products

Base path:

```text
/api/products
```

| Method | Endpoint     | Description     |
| ------ | ------------ | --------------- |
| GET    | `/`          | Browse products |
| GET    | `/search?q=` | Search products |
| GET    | `/:id`       | Get product     |
| POST   | `/`          | Create product  |
| PUT    | `/:id`       | Update product  |
| DELETE | `/:id`       | Delete product  |
| PATCH  | `/:id/stock` | Update stock    |

Product creation and modification are restricted to authorized store owners.

---

## AI

Base path:

```text
/api/ai
```

| Method | Endpoint            | Description                 |
| ------ | ------------------- | --------------------------- |
| POST   | `/extract-products` | Extract products using Groq |

This endpoint is intentionally public because the AI shopping experience supports guest users.

---

## Clusters

Base path:

```text
/api/clusters
```

| Method | Endpoint | Description                  |
| ------ | -------- | ---------------------------- |
| POST   | `/find`  | Find and rank store clusters |

Request:

```json
{
  "lat": 19.076,
  "lng": 72.8777,
  "products": [
    {
      "name": "rice",
      "quantity": 2,
      "unit": "kg",
      "keywords": ["rice", "chawal"]
    }
  ]
}
```

Response contains:

```text
bestCluster
allClusters
nearbyStores
borderStores
```

---

## Orders

Base path:

```text
/api/orders
```

| Method | Endpoint        | Description            |
| ------ | --------------- | ---------------------- |
| POST   | `/`             | Create order(s)        |
| GET    | `/my-orders`    | Customer order history |
| GET    | `/store-orders` | Store owner's orders   |
| GET    | `/:id`          | Order details          |
| PATCH  | `/:id/status`   | Update order status    |
| PATCH  | `/:id/cancel`   | Cancel eligible order  |

---

## Payments

Base path:

```text
/api/payment
```

| Method | Endpoint        | Description             |
| ------ | --------------- | ----------------------- |
| POST   | `/create-order` | Create Razorpay order   |
| POST   | `/verify`       | Verify Razorpay payment |

---

## Reviews

Base path:

```text
/api/reviews
```

| Method | Endpoint              | Description         |
| ------ | --------------------- | ------------------- |
| POST   | `/`                   | Submit review       |
| GET    | `/store/:storeId`     | Get store reviews   |
| GET    | `/product/:productId` | Get product reviews |

---

# 🛡️ Admin API

Base path:

```text
/api/admin
```

All admin endpoints require:

```text
JWT authentication
+
admin role
```

| Method | Endpoint               | Description                   |
| ------ | ---------------------- | ----------------------------- |
| GET    | `/dashboard-stats`     | Platform statistics           |
| GET    | `/pending-stores`      | Pending verification requests |
| GET    | `/stores`              | Manage stores                 |
| GET    | `/store/:id/documents` | Access private documents      |
| PATCH  | `/store/:id/approve`   | Approve store                 |
| PATCH  | `/store/:id/reject`    | Reject store                  |
| GET    | `/customers`           | Manage customers              |
| PATCH  | `/customer/:id/block`  | Block/unblock customer        |
| GET    | `/orders`              | Platform orders               |
| GET    | `/analytics`           | Platform analytics            |

---

# 🗃️ Data Models

The backend uses the following MongoDB collections:

```text
User
Store
Product
Category
Order
Address
Review
Payment
```

### Relationships

```text
User
 ├── Addresses
 ├── Orders
 ├── Reviews
 └── Store (if storeOwner)

Store
 ├── Products
 ├── Orders
 └── Reviews

Order
 ├── Customer
 ├── Store
 ├── Products
 ├── Payment
 └── Review
```

---

# 🔑 Environment Variables

| Variable                | Required | Purpose                |
| ----------------------- | -------- | ---------------------- |
| `PORT`                  | Yes      | Express server port    |
| `CLIENT_URL`            | Yes      | Frontend origin        |
| `MONGO_URI`             | Yes      | MongoDB connection     |
| `JWT_SECRET`            | Yes      | JWT signing secret     |
| `JWT_EXPIRE`            | Yes      | Token expiration       |
| `CLOUDINARY_CLOUD_NAME` | Yes      | Cloudinary account     |
| `CLOUDINARY_API_KEY`    | Yes      | Cloudinary API         |
| `CLOUDINARY_API_SECRET` | Yes      | Cloudinary API         |
| `GROQ_API_KEY`          | Yes      | Groq AI                |
| `RAZORPAY_KEY_ID`       | Yes      | Razorpay public key    |
| `RAZORPAY_KEY_SECRET`   | Yes      | Razorpay server secret |

---

# 🧪 Verification & Testing

The backend has been verified through two levels of testing.

## Static Verification

The following checks were performed:

* Syntax validation across all backend files
* Relative `require()` path validation
* Package dependency validation
* Controller export validation
* Frontend API calls cross-referenced against backend routes
* HTTP method and route parameter matching

The frontend/backend contract was checked across **44 real frontend API calls**, with all calls resolving to registered backend routes.

---

# 🔬 Runtime Integration Verification

A temporary in-memory integration harness was used to exercise the actual server and backend logic through HTTP requests.

The test journey covered:

```text
Registration
    ↓
Role Security
    ↓
Admin Bootstrap
    ↓
Addresses
    ↓
Multipart Store Registration
    ↓
Document Upload
    ↓
Admin Approval / Rejection
    ↓
Product CRUD
    ↓
AI Extraction
    ↓
Dynamic Store Clustering
    ↓
Order Creation
    ↓
Razorpay Payment Verification
    ↓
Forgery Rejection
    ↓
Order Status State Machine
    ↓
Reviews
    ↓
Duplicate Review Prevention
    ↓
Rating Aggregation
    ↓
Customer Blocking
    ↓
404 Handling
```

### Result

```text
62 / 62 checks passed ✅
```

The temporary harness and its MongoDB-like shims were removed after testing and are **not included in the project deliverable**.

---

# 🐛 Bugs Found During Integration Testing

The integration tests uncovered three MongoDB update issues that were fixed in the actual source code.

### 1. Address default update

Incorrect:

```js
Address.updateMany(
  filter,
  { isDefault: false }
);
```

Fixed:

```js
Address.updateMany(
  filter,
  { $set: { isDefault: false } }
);
```

---

### 2. Order payment update

Plain fields were being mixed with MongoDB operators.

Fixed by placing the fields inside `$set` while keeping `$push` for status history.

---

### 3. Payment document update

A plain object passed to `findOneAndUpdate()` could perform document replacement and unintentionally remove existing fields.

The update was changed to:

```js
{
  $set: {
    razorpayPaymentId,
    status
  }
}
```

This preserves existing payment metadata such as:

```text
orderId
customerId
amount
currency
createdAt
```

---

# 🌍 Geocoding Verification

The geocoding implementation was separately tested with a mocked upstream response.

Verified:

* Request URL construction
* `User-Agent` header
* Response parsing
* 1 request/second throttling
* Missing-query validation
* Short-query validation
* Upstream failure handling

The actual Nominatim service was not contacted during the sandbox verification.

---

# ⚠️ Verification Scope

The current verification demonstrates that the backend's **routing, controllers, database logic, authentication, payment verification, AI wiring, clustering logic, and API contract are internally consistent**.

It does **not** prove:

* Production MongoDB performance
* Real MongoDB index performance under load
* Production Cloudinary credentials
* Production Groq credentials
* Production Razorpay credentials
* Real Nominatim availability
* Network latency behavior
* Production-scale clustering performance

Therefore, the correct interpretation is:

> **Backend wiring and application logic have been comprehensively tested, but production credentials and external services still require a real environment test.**

---

# 📈 Performance Considerations

The current clustering implementation is designed for an MVP-scale dataset.

The current flow:

```text
Find nearby stores
      ↓
Build geographic clusters
      ↓
Query products per requested item
      ↓
Calculate scores
      ↓
Rank clusters
```

For a small dataset of fewer than approximately 100 nearby stores, this approach is suitable for the MVP.

For larger production datasets, the clustering and product matching workload should eventually be optimized using:

* More selective MongoDB queries
* Better product indexes
* Aggregation pipelines
* Cached product availability
* Background processing
* Queue-based jobs such as Bull/BullMQ

---

# 🔒 Security Considerations

The backend applies several important security boundaries:

### Authentication

JWT authentication protects private resources.

### Authorization

Role-based middleware separates:

```text
Customer
Store Owner
Admin
```

### Password Security

Passwords are hashed using `bcryptjs`.

### Payment Security

Razorpay signatures are verified server-side using HMAC-SHA256.

### Document Privacy

Sensitive store documents are accessible only through the admin document endpoint.

### Store Visibility

Only approved stores can enter customer-facing discovery and clustering.

### Customer Protection

Blocked customers cannot continue using protected customer functionality.

---

# 🩺 Health Check

Use:

```http
GET /api/health
```

Expected response indicates that the API server is running.

This endpoint is useful for:

* Local development
* Deployment health checks
* Render/Vercel monitoring
* Basic uptime verification

---

# 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Seed admin
npm run seed:admin

# Seed categories
npm run seed:categories

# Start production server
npm start
```

> Exact command availability depends on the scripts defined in `package.json`.

---

# 🚢 Deployment

Recommended architecture:

```text
                    ┌──────────────────┐
                    │   React Client   │
                    │     Vercel       │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Express Backend  │
                    │     Render       │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ MongoDB  │   │ Cloudinary│   │  Groq    │
        │  Atlas   │   │          │   │   API    │
        └──────────┘   └──────────┘   └──────────┘
                             │
                             ▼
                       ┌──────────┐
                       │ Razorpay │
                       └──────────┘
```

Recommended production services:

* Frontend → Vercel
* Backend → Render
* Database → MongoDB Atlas
* Media → Cloudinary
* AI → Groq
* Payments → Razorpay
* Maps → Leaflet + OpenStreetMap
* Geocoding → Nominatim

---

# 📌 Important Backend Rules

### 1. Always maintain the `2dsphere` index

```js
storeSchema.index({ location: '2dsphere' });
```

Without it, MongoDB geospatial `$near` queries cannot operate correctly.

### 2. Never expose verification documents publicly

Aadhaar and shop-license URLs must remain behind admin authorization.

### 3. Never trust Razorpay responses directly

Always verify the server-side signature.

### 4. Only approved stores are customer-visible

```js
verificationStatus === 'approved'
```

### 5. Preserve GeoJSON coordinate order

MongoDB expects:

```text
[longitude, latitude]
```

not:

```text
[latitude, longitude]
```

### 6. Use MongoDB update operators

For partial updates, use:

```js
$set
$push
$inc
$unset
```

rather than unintentionally replacing documents.

---

# 🔗 API Base URL

Development:

```text
http://localhost:5000/api
```

Production:

```text
https://your-backend-domain.com/api
```

---

# 🗺️ Trustore Request Lifecycle

The complete customer journey looks like:

```text
                  Customer
                     │
                     ▼
             Natural Language List
                     │
                     ▼
               Groq AI Parser
                     │
                     ▼
            Structured Products
                     │
                     ▼
              Customer Location
                     │
                     ▼
          Nearby Verified Stores
                     │
                     ▼
          Dynamic Store Clustering
                     │
                     ▼
             Cluster Scoring
                     │
                     ▼
              Best Cluster
                     │
                     ▼
          100m Border Exception
                     │
                     ▼
               Product Cart
                     │
                     ▼
             Orders by Store
                     │
                     ▼
             Razorpay Payment
                     │
                     ▼
             Signature Verify
                     │
                     ▼
              Order Placed
                     │
                     ▼
       Accepted → Preparing → Ready
                     │
                     ▼
                Completed
                     │
                     ▼
                  Review
```

---

# 🎯 Project Status

| Area                             | Status           |
| -------------------------------- | ---------------- |
| Express API                      | ✅                |
| MongoDB/Mongoose                 | ✅                |
| JWT Authentication               | ✅                |
| Role Authorization               | ✅                |
| Store Registration               | ✅                |
| Admin Verification               | ✅                |
| Private Documents                | ✅                |
| Product CRUD                     | ✅                |
| Geospatial Search                | ✅                |
| Groq AI Extraction               | ✅                |
| Dynamic Store Clustering         | ✅                |
| 100m Border Exception            | ✅                |
| Multi-Store Orders               | ✅                |
| Razorpay Verification            | ✅                |
| Order State Machine              | ✅                |
| Reviews                          | ✅                |
| Rating Aggregation               | ✅                |
| Customer Blocking                | ✅                |
| Nominatim Geocoding              | ✅                |
| Static Contract Verification     | ✅                |
| Runtime Integration Verification | **62/62 passed** |

---

# 🧑‍💻 Development Philosophy

Trustore's backend is built around three principles:

### Trust

Only admin-verified stores are exposed to customers.

### Intelligence

Groq understands what customers want, while the clustering engine determines where those products can be sourced most efficiently.

### Local Commerce

The platform prioritizes nearby independent stores instead of treating the marketplace as a single centralized inventory.

---

## 🛒 Trustore

**Shop smarter. Shop locally. Shop from trusted stores.**

> *"Shop only from trusted local stores."*
