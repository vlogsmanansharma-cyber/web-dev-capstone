import json
items = {}
def req(folder, name, method, path, body=None, token=None, status=200, extra=None, pre=None):
    script = [f"pm.test('{name} -> expect {status}', function () {{ pm.response.to.have.status({status}); }});"]
    if extra: script += extra
    ev = [{"listen": "test", "script": {"type": "text/javascript", "exec": script}}]
    if pre: ev.append({"listen": "prerequest", "script": {"type": "text/javascript", "exec": pre}})
    r = {"method": method, "header": [{"key": "Content-Type", "value": "application/json"}],
         "url": "{{baseUrl}}" + path}
    if token: r["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": "{{%s}}" % token, "type": "string"}]}
    else: r["auth"] = {"type": "noauth"}
    if body is not None: r["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2)}
    items.setdefault(folder, []).append({"name": name, "event": ev, "request": r})

def setvar(var, expr): return [f"var j = pm.response.json(); pm.collectionVariables.set('{var}', {expr});"]
def login(folder, label, email, pw, var, refresh=None):
    ex = setvar(var, "j.data.accessToken")
    if refresh: ex += [f"pm.collectionVariables.set('{refresh}', j.data.refreshToken);"]
    req(folder, f"Login {label}", "POST", "/api/auth/login", {"email": email, "password": pw}, None, 200, ex)

NIL = "000000000000000000000000"
A = "1. Authentication"
req(A, "Health check", "GET", "/api/health")
req(A, "Register customer (valid)", "POST", "/api/auth/register",
    {"name": "Test User", "email": "test{{$timestamp}}@example.com", "password": "Passw0rd123"}, None, 201)
req(A, "Register - validation failure (weak password, bad email)", "POST", "/api/auth/register",
    {"name": "X", "email": "not-an-email", "password": "123"}, None, 400)
req(A, "Register - cannot self-register as admin", "POST", "/api/auth/register",
    {"name": "Evil", "email": "evil{{$timestamp}}@example.com", "password": "Passw0rd123", "role": "admin"}, None, 400)
req(A, "Register - duplicate email (conflict)", "POST", "/api/auth/register",
    {"name": "Dup", "email": "customer1@shop.com", "password": "Passw0rd123"}, None, 409)
login(A, "admin", "admin@shop.com", "Admin@123", "adminToken")
login(A, "seller 1", "seller1@shop.com", "Seller@123", "sellerToken")
login(A, "seller 2", "seller2@shop.com", "Seller@123", "seller2Token")
login(A, "customer 1", "customer1@shop.com", "Customer@123", "customerToken", "refreshToken")
login(A, "customer 2", "customer2@shop.com", "Customer@123", "customer2Token")
req(A, "Login - wrong password", "POST", "/api/auth/login", {"email": "customer1@shop.com", "password": "wrong"}, None, 401)
req(A, "Refresh token (rotation)", "POST", "/api/auth/refresh", {"refreshToken": "{{refreshToken}}"}, None, 200,
    ["var j = pm.response.json(); pm.collectionVariables.set('oldRefresh', pm.collectionVariables.get('refreshToken')); pm.collectionVariables.set('refreshToken', j.data.refreshToken); pm.collectionVariables.set('customerToken', j.data.accessToken);"])
req(A, "Refresh - reuse of rotated token is rejected", "POST", "/api/auth/refresh", {"refreshToken": "{{oldRefresh}}"}, None, 401)
login(A, "customer 1 again (after revocation)", "customer1@shop.com", "Customer@123", "customerToken", "refreshToken")
req(A, "Logout", "POST", "/api/auth/logout", {"refreshToken": "{{refreshToken}}"}, None, 200)
req(A, "GET /users/me - no token (unauthorized)", "GET", "/api/users/me", None, None, 401)
req(A, "GET /users/me - invalid token", "GET", "/api/users/me", None, "badToken", 401)
req(A, "GET /users/me - valid", "GET", "/api/users/me", None, "customerToken", 200)

U = "2. Users"
req(U, "Update my profile", "PATCH", "/api/users/me", {"name": "Asha Updated"}, "customerToken", 200)
req(U, "Update my profile - validation failure (empty body)", "PATCH", "/api/users/me", {}, "customerToken", 400)
req(U, "Admin: list users (paginated)", "GET", "/api/users?role=seller&page=1&limit=5", None, "adminToken", 200)
req(U, "Customer: list users (forbidden)", "GET", "/api/users", None, "customerToken", 403)
req(U, "Admin: get user - not found", "GET", f"/api/users/{NIL}", None, "adminToken", 404)

C = "3. Categories"
req(C, "List categories (public)", "GET", "/api/categories", None, None, 200, setvar("categoryId", "j.data.categories[0]._id"))
req(C, "Admin: create category", "POST", "/api/categories", {"name": "Toys {{$timestamp}}", "description": "Toys & games"}, "adminToken", 201, setvar("newCategoryId", "j.data.category._id"))
req(C, "Admin: create category - duplicate", "POST", "/api/categories", {"name": "Electronics"}, "adminToken", 409)
req(C, "Customer: create category (forbidden)", "POST", "/api/categories", {"name": "Hack"}, "customerToken", 403)
req(C, "Create category - no token", "POST", "/api/categories", {"name": "Hack"}, None, 401)
req(C, "Get category - not found", "GET", f"/api/categories/{NIL}", None, None, 404)
req(C, "Get category - malformed id", "GET", "/api/categories/abc", None, None, 400)
req(C, "Admin: delete empty category", "DELETE", "/api/categories/{{newCategoryId}}", None, "adminToken", 204)

P = "4. Products"
req(P, "List products (search, filter, sort, paginate)", "GET", "/api/products?q=wireless&minPrice=100&maxPrice=5000&sort=price_asc&page=1&limit=5", None, None, 200,
    setvar("productId", "j.data.products[0]._id"))
req(P, "List products - invalid query", "GET", "/api/products?sort=random&limit=999", None, None, 400)
req(P, "Find Bluetooth Speaker (stock = 1)", "GET", "/api/products?q=bluetooth", None, None, 200, setvar("speakerId", "j.data.products[0]._id"))
req(P, "Seller1: create product", "POST", "/api/products",
    {"name": "Laptop Stand", "description": "Aluminium stand", "price": 1299.5, "category": "{{categoryId}}", "stock": 15}, "sellerToken", 201, setvar("newProductId", "j.data.product._id"))
req(P, "Create product - validation failure (negative price)", "POST", "/api/products",
    {"name": "Bad", "price": -5, "category": "{{categoryId}}", "stock": 1}, "sellerToken", 400)
req(P, "Create product - invalid category", "POST", "/api/products",
    {"name": "Bad", "price": 5, "category": NIL, "stock": 1}, "sellerToken", 400)
req(P, "Customer: create product (forbidden)", "POST", "/api/products",
    {"name": "X", "price": 5, "category": "{{categoryId}}", "stock": 1}, "customerToken", 403)
req(P, "Create product - no token", "POST", "/api/products", {"name": "X"}, None, 401)
req(P, "Seller2: update seller1's product (forbidden)", "PATCH", "/api/products/{{newProductId}}", {"price": 1}, "seller2Token", 403)
req(P, "Seller1: update own product", "PATCH", "/api/products/{{newProductId}}", {"price": 1199}, "sellerToken", 200)
req(P, "Seller1: lower stock below threshold (emits stock:low)", "PATCH", "/api/products/{{newProductId}}", {"stock": 2}, "sellerToken", 200)
req(P, "Seller1: my products", "GET", "/api/products/seller/mine", None, "sellerToken", 200)
req(P, "Seller1: low-stock alerts", "GET", "/api/products/alerts/low-stock", None, "sellerToken", 200)
req(P, "Get product - not found", "GET", f"/api/products/{NIL}", None, None, 404)
req(P, "Seller1: delete own product", "DELETE", "/api/products/{{newProductId}}", None, "sellerToken", 204)

K = "5. Cart"
req(K, "Customer: view cart", "GET", "/api/cart", None, "customerToken", 200)
req(K, "Add item", "POST", "/api/cart/items", {"productId": "{{productId}}", "quantity": 2}, "customerToken", 201)
req(K, "Add item - quantity exceeds stock (conflict)", "POST", "/api/cart/items", {"productId": "{{productId}}", "quantity": 99}, "customerToken", 409)
req(K, "Add item - validation failure", "POST", "/api/cart/items", {"productId": "bad", "quantity": 0}, "customerToken", 400)
req(K, "Add item - product not found", "POST", "/api/cart/items", {"productId": NIL, "quantity": 1}, "customerToken", 404)
req(K, "Update quantity", "PATCH", "/api/cart/items/{{productId}}", {"quantity": 3}, "customerToken", 200,
    ["pm.test('server-calculated subtotal present', function(){ pm.expect(pm.response.json().data.cart.subtotal).to.be.a('number'); });"])
req(K, "Seller: access cart (forbidden)", "GET", "/api/cart", None, "sellerToken", 403)
req(K, "Remove item not in cart", "DELETE", f"/api/cart/items/{NIL}", None, "customerToken", 404)
req(K, "Clear cart", "DELETE", "/api/cart", None, "customerToken", 204)

O = "6. Orders and Inventory"
addr = {"fullName": "Asha Customer", "phone": "9876543210", "line1": "12 MG Road", "city": "Delhi", "state": "Delhi", "postalCode": "110001"}
req(O, "Checkout - empty cart", "POST", "/api/orders/checkout", {"shippingAddress": addr, "paymentMethod": "COD"}, "customerToken", 400)
req(O, "Add item to cart", "POST", "/api/cart/items", {"productId": "{{productId}}", "quantity": 1}, "customerToken", 201)
req(O, "Checkout - validation failure (no address)", "POST", "/api/orders/checkout", {"paymentMethod": "BITCOIN"}, "customerToken", 400)
req(O, "Checkout - success (simulated payment)", "POST", "/api/orders/checkout", {"shippingAddress": addr, "paymentMethod": "SIMULATED_CARD"}, "customerToken", 201,
    setvar("orderId", "j.data.orders[0]._id"))
req(O, "Customer: list my orders", "GET", "/api/orders?page=1&limit=5", None, "customerToken", 200)
req(O, "Customer: get my order", "GET", "/api/orders/{{orderId}}", None, "customerToken", 200)
req(O, "Customer2: get someone else's order (forbidden)", "GET", "/api/orders/{{orderId}}", None, "customer2Token", 403)
req(O, "Order not found", "GET", f"/api/orders/{NIL}", None, "customerToken", 404)
req(O, "Seller: invalid transition pending -> delivered", "PATCH", "/api/orders/{{orderId}}/status", {"status": "delivered"}, "sellerToken", 409)
req(O, "Seller2: update another seller's order (forbidden)", "PATCH", "/api/orders/{{orderId}}/status", {"status": "confirmed"}, "seller2Token", 403)
req(O, "Customer: update status (forbidden)", "PATCH", "/api/orders/{{orderId}}/status", {"status": "confirmed"}, "customerToken", 403)
req(O, "Seller: confirm order (emits order:statusChanged)", "PATCH", "/api/orders/{{orderId}}/status", {"status": "confirmed"}, "sellerToken", 200)
req(O, "Seller: ship order", "PATCH", "/api/orders/{{orderId}}/status", {"status": "shipped"}, "sellerToken", 200)
req(O, "Customer: cancel a shipped order (rejected)", "POST", "/api/orders/{{orderId}}/cancel", {}, "customerToken", 409)
req(O, "Seller: status validation failure", "PATCH", "/api/orders/{{orderId}}/status", {"status": "teleported"}, "sellerToken", 400)
req(O, "Cancel flow: add item", "POST", "/api/cart/items", {"productId": "{{productId}}", "quantity": 2}, "customerToken", 201)
req(O, "Cancel flow: checkout (COD)", "POST", "/api/orders/checkout", {"shippingAddress": addr, "paymentMethod": "COD"}, "customerToken", 201, setvar("cancelOrderId", "j.data.orders[0]._id"))
req(O, "Cancel flow: customer cancels (stock restored)", "POST", "/api/orders/{{cancelOrderId}}/cancel", {"note": "Changed my mind"}, "customerToken", 200)
req(O, "Cancel flow: cancel again (conflict)", "POST", "/api/orders/{{cancelOrderId}}/cancel", {}, "customerToken", 409)
req(O, "Oversell test: customer1 adds last speaker", "POST", "/api/cart/items", {"productId": "{{speakerId}}", "quantity": 1}, "customerToken", 201)
req(O, "Oversell test: customer2 adds last speaker", "POST", "/api/cart/items", {"productId": "{{speakerId}}", "quantity": 1}, "customer2Token", 201)
req(O, "Oversell test: customer1 checkout succeeds", "POST", "/api/orders/checkout", {"shippingAddress": addr, "paymentMethod": "SIMULATED_CARD"}, "customerToken", 201)
req(O, "Oversell test: customer2 checkout rejected (stock never negative)", "POST", "/api/orders/checkout", {"shippingAddress": addr, "paymentMethod": "SIMULATED_CARD"}, "customer2Token", 409)
req(O, "Admin: list all orders by status", "GET", "/api/orders?status=confirmed", None, "adminToken", 200)

R = "7. Reports (aggregation)"
req(R, "Seller: sales summary by day", "GET", "/api/reports/sales-summary?groupBy=day", None, "sellerToken", 200)
req(R, "Admin: sales summary by month with date range", "GET", "/api/reports/sales-summary?groupBy=month&from=2020-01-01&to=2030-01-01", None, "adminToken", 200)
req(R, "Best-selling products", "GET", "/api/reports/best-selling?limit=3", None, "adminToken", 200)
req(R, "Inventory summary", "GET", "/api/reports/inventory-summary", None, "sellerToken", 200)
req(R, "Order status breakdown", "GET", "/api/reports/order-status", None, "adminToken", 200)
req(R, "Reports - invalid groupBy", "GET", "/api/reports/sales-summary?groupBy=year", None, "adminToken", 400)
req(R, "Reports - customer forbidden", "GET", "/api/reports/sales-summary", None, "customerToken", 403)
req(R, "Reports - no token", "GET", "/api/reports/sales-summary", None, None, 401)

col = {"info": {"name": "E-Commerce & Inventory API", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        "description": "Run `npm run seed` first, then run this collection top-to-bottom with the Collection Runner."},
       "variable": [{"key": "baseUrl", "value": "http://localhost:5000"}],
       "item": [{"name": f, "item": its} for f, its in items.items()]}
json.dump(col, open("docs/Postman_Collection.json", "w"), indent=2)
print(sum(len(v) for v in items.values()), "requests")
