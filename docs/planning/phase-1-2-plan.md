# Phase 1 & Phase 2 Gap Resolution Plan

This document outlines the detailed roadmap for implementing **Phase 1** and **Phase 2** of the API Boilerplate Gap Resolution.

---

## 🗺️ Scope of Work

### Phase 1: Critical Security & Safety Fixes
1. **Fix `Math.random()` in `OTPGenerator`**
   - Secure the OTP generation utility by utilizing cryptographically secure pseudo-random number generator (`crypto.randomInt`).
2. **Rate Limiting / Throttling**
   - Configure global and route-specific throttling using `@nestjs/throttler` to protect auth and sensitive endpoints.
3. **CORS Methods Configuration**
   - Explicitly permit standard `HEAD` and `OPTIONS` HTTP methods.

### Phase 2: Routing & Validation Infrastructure
4. **Request ID Propagation Middleware**
   - Correlate request flows through logs using a generated `x-request-id` header/property.
5. **Global Validation Pipe**
   - Bind NestJS validation globally to automatically parse and sanitize incoming DTOs via Zod.
6. **Conditional Environment Variables**
   - Reduce setup friction by making integrations (Brevo, Cloudinary, Google OAuth) optional at boot time.
7. **Complete `.env.example`**
   - Document all configuration options and Docker variables in the example file.

---

## 🛠️ Step-by-Step Implementation Details

### Step 1: Secure the OTP Generator
* **File**: `f:\boilerplate\api\src\core\helpers\app.helpers.ts`
* **Modification**: Change `Math.random()` to use `crypto.randomInt` from Node's built-in `crypto` module.

### Step 2: Set Up Throttling (Rate Limiting)
* **Files**:
  * `f:\boilerplate\api\src\core\guards\throttler.guard.ts` (NEW)
  * `f:\boilerplate\api\src\app.module.ts` (MODIFY)
* **Modification**:
  - Implement a customized throttler guard that checks the client IP safely (extracting it from `x-forwarded-for` or request connection).
  - Register `ThrottlerModule` in `AppModule` with dynamic limits (e.g. 10 requests per second, 100 requests per minute).
  - Register the custom throttler guard as a global guard.

### Step 3: Add HEAD and OPTIONS to CORS Methods
* **File**: `f:\boilerplate\api\src\main.ts`
* **Modification**: Add `'HEAD'` and `'OPTIONS'` to CORS methods array.

### Step 4: Implement Request ID Middleware
* **Files**:
  * `f:\boilerplate\api\src\core\middlewares\request-id.middleware.ts` (NEW)
  * `f:\boilerplate\api\src\main.ts` (MODIFY)
* **Modification**:
  - Write standard Express middleware that checks for `x-request-id` in request headers, generates one if missing, attaches it to the request as `req['requestId']`, and puts it in the response headers.
  - Apply the middleware globally in `main.ts` using `app.use()`.

### Step 5: Global Validation Pipe Registration
* **File**: `f:\boilerplate\api\src\main.ts`
* **Modification**: Register `ZodValidationPipe` globally using `app.useGlobalPipes()`.

### Step 6: Make Third-Party Credentials Optional
* **File**: `f:\boilerplate\api\src\core\validators\env.ts`
* **Modification**: Change `.shape` schemas of Cloudinary and Google schemas to be `.optional()` under `envSchema`. Raise warnings or service-level errors only when their actual controllers/services are invoked. Email provider credentials (Brevo, Resend, etc.) are no longer env-based — they are configured at runtime via the SMTP Providers API.

### Step 7: Update `.env.example`
* **File**: `f:\boilerplate\api\.env.example`
* **Modification**: Sync all keys, add comments, and specify default configuration values.
