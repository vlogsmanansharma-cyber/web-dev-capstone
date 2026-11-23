# E-Commerce and Inventory Management System (Backend)

Capstone Project 4 – Backend Development. A REST + real-time backend for customers, sellers and administrators.

**Stack:** Node.js · Express.js · MongoDB · Mongoose · JWT · bcrypt · Joi · Socket.IO · EventEmitter

## 1. Features

| Area | What is implemented |
|---|---|
| Auth | Register/login, bcrypt hashing, JWT **access (15 m) + refresh (7 d)** tokens, refresh-token **rotation + reuse detection**, logout, RBAC (`customer`, `seller`, `admin`) |
| Catalogue | Product + category CRUD, ownership rules, search (text index), filter, sort, pagination |
| Cart | Add / update / remove / clear; **prices always computed on the server**; stock validated |
| Orders | Checkout from cart, one order per seller, price snapshots, delivery details, status state-machine, cancellation |
| Inventory | **Atomic stock decrement** (no overselling), stock restored on cancellation, low-stock alerts |
| Reports | 4 aggregation pipelines: sales summary, best-sellers, inventory summary, order-status breakdown |
| Real-time | **EventEmitter** domain events → **Socket.IO** notifications (`order:placed`, `order:statusChanged`, `stock:low`) |
| Quality | Centralized error handler, Joi validation, morgan logging, helmet, CORS, rate-limited auth routes |
| Payment | **Simulated only** – every order carries `payment.simulated = true`; no card data is handled |

## 2. Prerequisites
* Node.js 18+ and npm
* MongoDB 6+ running locally (or a MongoDB Atlas URI)

## 3. Installation
```bash
npm install
cp .env.example .env        # then edit the secrets
npm run seed                # loads demo users, categories, products and orders
npm run dev                 # or: npm start       -> http://localhost:5000
```

### Environment variables (`.env` – never commit it)
| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | 5000 |
| `NODE_ENV` | `development` shows stack traces | development |
| `MONGO_URI` | MongoDB connection string | – (required) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Two different long random strings | – (required) |
| `JWT_ACCESS_EXPIRES` | Access-token lifetime | 15m |
| `JWT_REFRESH_EXPIRES_DAYS` | Refresh-token lifetime | 7 |
| `CLIENT_ORIGIN` | CORS / Socket.IO origin | * |
| `SHIPPING_FLAT_FEE`, `FREE_SHIPPING_ABOVE` | Shipping rules | 40, 500 |

### Seed accounts
| Role | Email | Password |
|---|---|---|
| Admin | admin@shop.com | Admin@123 |
| Seller 1 | seller1@shop.com | Seller@123 |
| Seller 2 | seller2@shop.com | Seller@123 |
| Customer 1 | customer1@shop.com | Customer@123 |
| Customer 2 | customer2@shop.com | Customer@123 |

## 4. Project structure (MVC + layered)
```
server.js                  entry: DB -> HTTP server -> Socket.IO -> listeners
src/
  app.js                   Express app, global middleware, route mounting
  config/                  env.js (dotenv), db.js (Mongoose connection)
  models/                  User, Category, Product, Cart, Order   (Model)
  controllers/             business logic per resource            (Controller)
  routes/                  URL -> middleware chain -> controller  (Routing)
  middleware/              auth (protect/restrictTo), validate, errorHandler
  validators/              Joi schemas
  utils/                   AppError, catchAsync, tokens, events (EventEmitter), paginate
  sockets/                 Socket.IO server + JWT handshake auth
  listeners/               EventEmitter listeners -> Socket.IO emits
  seed/seed.js             sample data
public/demo.html           tiny Socket.IO demo client
docs/Postman_Collection.json
```
**Request flow:** `Route → Middleware (protect → restrictTo → validate) → Controller → Model → MongoDB → JSON response`; errors go to the centralized `errorHandler`.

## 5. Database design

| Collection | Key fields | Relationships | Indexes |
|---|---|---|---|
| `users` | name, email, password (hash), role, isActive, refreshTokens[hashed] | – | `email` (unique), `role` |
| `categories` | name, slug, description | – | `name` (unique), `slug` (unique) |
| `products` | name, description, price, stock, lowStockThreshold, isActive | `category → categories`, `seller → users` | **text(name, description)**, `{category, price}`, `{seller, createdAt}`, `{stock}` |
| `carts` | items[{product, quantity}] | `user → users` (1 per user), `items.product → products` | `user` (unique) |
| `orders` | orderNumber, checkoutId, items[snapshot: name, price, qty, subtotal], shippingAddress, paymentMethod, payment{simulated,status}, subtotal, shippingFee, total, status, statusHistory[] | `customer → users`, `seller → users`, `items.product → products` | `orderNumber` (unique), `{customer, createdAt}`, `{seller, status, createdAt}`, `{status, createdAt}` |

*Referencing* is used for users/categories/products (they change independently); *embedding* is used for cart items, order items and status history (always read together with their parent). Order items store **price snapshots** so later price edits never change past orders.

## 6. Key design decisions
1. **No overselling.** Checkout reserves stock with one atomic operation per item:
   `Product.findOneAndUpdate({ _id, isActive: true, stock: { $gte: qty } }, { $inc: { stock: -qty } })`.
   The check and decrement cannot be interleaved by another request, so stock never goes negative. If any item fails, earlier reservations are rolled back. (This works on a standalone MongoDB; multi-document transactions would need a replica set.)
2. **Server-side pricing.** Clients send only product IDs and quantities; price and totals come from the database at checkout.
3. **Order status state machine:** `pending → confirmed → shipped → delivered`; `pending|confirmed → cancelled`. Anything else returns `409`. Status changes are guarded by the current status (`findOneAndUpdate({_id, status})`) so stock cannot be restored twice.
4. **One order per seller.** A cart with items from several sellers is split into separate orders (shared `checkoutId`), so each seller only sees and manages their own items.
5. **Ownership/RBAC.** Sellers modify only their products/orders; customers only their cart/orders; admins everything. Enforced in middleware/controllers, not just hidden in the UI.
6. **Refresh tokens** are stored hashed, rotated on every use, and re-use of an old token revokes all sessions.

## 7. REST API

Base URL `http://localhost:5000`. All responses are JSON: `{ "status": "success" | "fail" | "error", ... }`. Errors: `{ "status": "fail", "message": "...", "errors": [{ "field", "message" }] }`.
Auth header: `Authorization: Bearer <accessToken>`.

Common errors: `400` validation/malformed id · `401` missing/invalid/expired token · `403` wrong role or not the owner · `404` not found · `409` conflict (duplicate, insufficient stock, invalid status transition).

### Authentication
| Method & Path | Auth | Body | Success |
|---|---|---|---|
| POST `/api/auth/register` | – | `name, email, password(≥8, letters+digits), role? (customer\|seller), phone?` | 201 `{user, accessToken, refreshToken}` |
| POST `/api/auth/login` | – | `email, password` | 200 `{user, accessToken, refreshToken}` |
| POST `/api/auth/refresh` | – | `refreshToken` | 200 new token pair (old one invalidated) |
| POST `/api/auth/logout` | – | `refreshToken` | 200 |

### Users
| Method & Path | Auth | Notes |
|---|---|---|
| GET `/api/users/me` | any | own profile |
| PATCH `/api/users/me` | any | `name`, `phone` only |
| GET `/api/users?role=&page=&limit=` | admin | paginated list |
| GET / PATCH / DELETE `/api/users/:id` | admin | PATCH body: `role`, `isActive` |

### Categories
| Method & Path | Auth | Notes |
|---|---|---|
| GET `/api/categories`, `/api/categories/:id` | public | |
| POST `/api/categories` | admin | `name, description?` – 409 if duplicate |
| PATCH `/api/categories/:id` | admin | |
| DELETE `/api/categories/:id` | admin | 409 if products exist |

### Products
| Method & Path | Auth | Notes |
|---|---|---|
| GET `/api/products` | public | query: `q, category, seller, minPrice, maxPrice, inStock, sort(price_asc\|price_desc\|newest\|name), page, limit` |
| GET `/api/products/:id` | public | |
| GET `/api/products/seller/mine` | seller | own listings incl. inactive |
| GET `/api/products/alerts/low-stock` | seller, admin | products where `stock ≤ lowStockThreshold` |
| POST `/api/products` | seller, admin | `name, description?, price, category, stock, lowStockThreshold?`; admin must also pass `seller` |
| PATCH `/api/products/:id` | owner seller, admin | any product field incl. `stock`, `isActive` (403 for other sellers) |
| DELETE `/api/products/:id` | owner seller, admin | 204 |

### Cart (customer only)
| Method & Path | Body | Notes |
|---|---|---|
| GET `/api/cart` | – | items, `lineTotal`, `subtotal` (server-calculated) |
| POST `/api/cart/items` | `productId, quantity` | 409 if exceeds stock |
| PATCH `/api/cart/items/:productId` | `quantity` | |
| DELETE `/api/cart/items/:productId` | – | |
| DELETE `/api/cart` | – | clear |

### Orders
| Method & Path | Auth | Notes |
|---|---|---|
| POST `/api/orders/checkout` | customer | `shippingAddress{fullName,phone,line1,line2?,city,state,postalCode,country?}`, `paymentMethod (COD\|SIMULATED_CARD)` → 201 `orders[]`; 400 empty cart; 409 out of stock |
| GET `/api/orders?status=&page=&limit=` | any | customer: own · seller: assigned · admin: all |
| GET `/api/orders/:id` | owner customer/seller, admin | 403 otherwise |
| PATCH `/api/orders/:id/status` | seller (own), admin | `status (confirmed\|shipped\|delivered\|cancelled), note?` – 409 on invalid transition |
| POST `/api/orders/:id/cancel` | customer (own) | restores stock; only while `pending`/`confirmed` |

### Reports (seller = own data, admin = platform-wide)
| Path | Pipeline | Query |
|---|---|---|
| GET `/api/reports/sales-summary` | `$match → $group($dateToString) → $project → $sort` | `from, to, groupBy=day\|month` |
| GET `/api/reports/best-selling` | `$match → $unwind(items) → $group → $sort → $limit` | `limit, from, to` |
| GET `/api/reports/inventory-summary` | `$match → $group(category) → $lookup → $unwind → $project` | – |
| GET `/api/reports/order-status` | `$match → $group(status)` | `from, to` |

## 8. Real-time (Socket.IO)
Connect with the JWT access token: `io("http://localhost:5000", { auth: { token } })`. Invalid/missing token → `connect_error`.
Rooms: `user:<userId>` (everyone), `role:admin` (admins).

| Event (server → client) | Sent to | Payload |
|---|---|---|
| `connected` | the connecting user | `{ message, user }` |
| `order:placed` | the seller of the order | `{ orderId, orderNumber, total, items, message }` |
| `order:statusChanged` | the customer (and the seller if someone else changed it) | `{ orderId, orderNumber, previousStatus, status, message }` |
| `stock:low` | the product's seller + all admins | `{ productId, name, stock, threshold, message }` |

**EventEmitter usage:** `src/utils/events.js` exports a shared bus. Controllers emit `order.placed`, `order.statusChanged` and `stock.low`; `src/listeners/index.js` subscribes and pushes Socket.IO messages. Business logic therefore never depends on the socket layer, and more listeners (e-mail, audit log) can be added without touching controllers.

**Try it:** open `http://localhost:5000/demo.html`, log in as `seller1@shop.com`, then use Postman to checkout as a customer or change an order status.

## 9. Testing with Postman
Import `docs/Postman_Collection.json`, run `npm run seed`, then run the collection with the **Collection Runner** (top to bottom; tokens and IDs are stored automatically). It contains ~87 requests with test scripts covering:

* ✅ success cases · ❌ validation failures · 🔍 not-found (404) · 🔒 missing/invalid token (401) · 🚫 insufficient role / not owner (403) · ⚠️ conflicts (duplicate email, duplicate category, invalid status transition, double cancel)
* Business rules: stock exceeded in cart, empty-cart checkout, **oversell test** (two customers, one unit left → second checkout gets 409), cancellation restoring stock, refresh-token reuse rejection.

Re-run `npm run seed` before running the collection again, since it consumes stock.

## 10. Suggested viva talking points
* Trace `POST /api/orders/checkout`: route → `protect` → `restrictTo('customer')` → `validate` → controller → atomic `findOneAndUpdate` → `Order.create` → event emit → Socket.IO.
* Why atomic updates instead of read-then-write? (race conditions)
* Why snapshot prices in orders? Why hash refresh tokens? Why one order per seller?
* Explain each index and which query it serves.

## 11. Possible extensions
Coupons, reviews/ratings, wishlist, real payment gateway, MongoDB transactions on a replica set, persistent notification inbox, Jest + Supertest automated tests.
