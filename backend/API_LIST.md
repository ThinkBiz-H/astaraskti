# Complete API List

Base URL: `/api/v1` (see `docs/API.md` for request/response details and auth requirements per endpoint)

## /auth

- `POST /auth/register`
- `POST /auth/verify-otp`
- `POST /auth/resend-otp`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh-token`
- `POST /auth/forgot-password`
- `POST /auth/reset-password/:token`
- `POST /auth/change-password`
- `GET /auth/me`
- `POST /auth/mobile/register`
- `POST /auth/mobile/login`
- `POST /auth/mobile/verify`
- `POST /auth/mobile/resend-otp`
- `POST /auth/logout-all`
- `GET /auth/sessions`
- `DELETE /auth/sessions/:id`
- `GET /auth/login-history`

## /users

- `GET /users/profile`
- `PUT /users/profile`
- `POST /users/profile/image`
- `DELETE /users/account`
- `GET /users/address`
- `POST /users/address`
- `PUT /users/address/:addressId`
- `DELETE /users/address/:addressId`

## /categories

- `GET /categories`
- `GET /categories/:id/attribute-template`
- `GET /categories/:slug`
- `POST /categories`
- `PUT /categories/:id`
- `DELETE /categories/:id`

## /brands

- `GET /brands`
- `GET /brands/:slug`
- `POST /brands`
- `PUT /brands/:id`
- `DELETE /brands/:id`

## /units

- `GET /units`
- `POST /units`
- `PUT /units/:id`
- `DELETE /units/:id`

## /warehouses

- `GET /warehouses`
- `GET /warehouses/:id`
- `POST /warehouses`
- `PUT /warehouses/:id`
- `DELETE /warehouses/:id`

## /inventory

- `GET /inventory/low-stock`
- `GET /inventory/movements`
- `GET /inventory/stock/:productId`
- `POST /inventory/purchase`
- `POST /inventory/adjust`
- `POST /inventory/damaged`
- `POST /inventory/transfer`
- `POST /inventory/reserve`
- `POST /inventory/release`

## /pages

- `GET /pages`
- `GET /pages/:slug`

## /home-sections

- `GET /home-sections`

## /faqs

- `GET /faqs`

## /settings

- `GET /settings`

## /products

- `GET /products`
- `GET /products/featured/list`
- `GET /products/new-arrivals/list`
- `GET /products/trending/list`
- `GET /products/bestsellers/list`
- `GET /products/top-rated/list`
- `GET /products/me/recently-viewed`
- `DELETE /products/:id`
- `PATCH /products/:id/restore`
- `GET /products/:id/related`
- `GET /products/:id/related-by-brand`
- `POST /products/:id/view`
- `GET /products/:id/reviews`
- `GET /products/:id/reviews/rating-distribution`
- `POST /products/:id/reviews`
- `PUT /products/:id/reviews/:reviewId`
- `DELETE /products/:id/reviews/:reviewId`
- `GET /products/:productId/variants`
- `GET /products/:slug`

## /wishlist

- `GET /wishlist`
- `POST /wishlist/:productId`
- `DELETE /wishlist/:productId`
- `POST /wishlist/:productId/move-to-cart`

## /cart

- `GET /cart`
- `POST /cart`
- `DELETE /cart`
- `POST /cart/apply-coupon`
- `DELETE /cart/remove-coupon`
- `PUT /cart/:productId`
- `DELETE /cart/:productId`

## /coupons

- `GET /coupons/analytics/overview`
- `GET /coupons`
- `POST /coupons`
- `GET /coupons/:id/analytics`
- `GET /coupons/:id`
- `PUT /coupons/:id`
- `DELETE /coupons/:id`

## /orders

- `POST /orders`
- `GET /orders/my-orders`
- `GET /orders`
- `PATCH /orders/:id/status`
- `POST /orders/:id/shipment`
- `POST /orders/:id/shipment/pickup`
- `POST /orders/:id/shipment/cancel`
- `GET /orders/:id/track`
- `GET /orders/:id/invoice`
- `GET /orders/:id`
- `PATCH /orders/:id/cancel`

## /payments

- `POST /payments/verify`
- `POST /payments/failure`
- `POST /payments/cancelled`
- `POST /payments/:orderId/retry`
- `GET /payments/:orderId/transactions`

## /webhooks

- `POST /webhooks/shiprocket`
- `POST /webhooks/razorpay`

## /notifications

- `GET /notifications`
- `PATCH /notifications/read-all`
- `PATCH /notifications/:id/read`
- `POST /notifications/push-token`
- `DELETE /notifications/push-token`
- `DELETE /notifications/:id`
- `DELETE /notifications`

## /blog

- `GET /blog/categories`
- `GET /blog`
- `GET /blog/:slug`

## /admin

- `GET /admin/dashboard/stats`
- `GET /admin/dashboard/recent-orders`
- `GET /admin/dashboard/top-products`
- `GET /admin/dashboard/low-stock`
- `GET /admin/dashboard/charts`
- `GET /admin/dashboard/top-customers`
- `GET /admin/dashboard/category-analytics`
- `GET /admin/dashboard/monthly-revenue`
- `GET /admin/reports/sales`
- `GET /admin/reports/revenue`
- `GET /admin/reports/orders`
- `GET /admin/reports/customers`
- `GET /admin/reports/products`
- `GET /admin/reports/inventory`
- `GET /admin/reports/coupons`
- `GET /admin/reports/tax`
- `GET /admin/reports/profit`
- `GET /admin/users`
- `GET /admin/users/:id`
- `PATCH /admin/users/:id/status`
- `PATCH /admin/users/:id/permissions`
- `DELETE /admin/users/:id`
- `GET /admin/permissions`
- `GET /admin/audit-logs`
- `GET /admin/pages`
- `GET /admin/pages/:id`
- `POST /admin/pages`
- `PUT /admin/pages/:id`
- `PATCH /admin/pages/:id/status`
- `DELETE /admin/pages/:id`
- `GET /admin/home-sections`
- `POST /admin/home-sections`
- `PUT /admin/home-sections/:id`
- `PATCH /admin/home-sections/reorder`
- `DELETE /admin/home-sections/:id`
- `GET /admin/faqs`
- `POST /admin/faqs`
- `PUT /admin/faqs/:id`
- `PATCH /admin/faqs/reorder`
- `DELETE /admin/faqs/:id`
- `GET /admin/blogs`
- `GET /admin/blogs/:id`
- `POST /admin/blogs`
- `PUT /admin/blogs/:id`
- `PATCH /admin/blogs/:id/status`
- `DELETE /admin/blogs/:id`
- `POST /admin/blog-categories`
- `PUT /admin/blog-categories/:id`
- `DELETE /admin/blog-categories/:id`
- `GET /admin/settings`
- `PUT /admin/settings`
- `PUT /admin/settings/logo`
- `PUT /admin/settings/favicon`
- `GET /admin/settings/environment-status`
- `GET /admin/media/folders`
- `POST /admin/media/folders`
- `PUT /admin/media/folders/:id`
- `DELETE /admin/media/folders/:id`
- `GET /admin/media`
- `POST /admin/media/upload`
- `PUT /admin/media/:id`
- `PUT /admin/media/:id/replace`
- `DELETE /admin/media/:id`
- `GET /admin/notification-templates`
- `POST /admin/notification-templates`
- `PUT /admin/notification-templates/:id`
- `DELETE /admin/notification-templates/:id`
- `POST /admin/notifications/broadcast`

## Root-level (not under /api/v1)

- `GET /health`
- `GET /ready`
- `GET /metrics`
- `GET /api-docs` (Swagger UI)
- `GET /sitemap.xml`
- `GET /robots.txt`
