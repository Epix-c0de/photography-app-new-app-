# Admin App Optimization & Backend Upgrade Strategy

This document outlines a comprehensive strategy for refining the Admin app, optimizing backend operations, and reducing the overall app footprint to ensure maximum performance and maintainability.

---

## 1. Admin Screens Analysis

After scanning the `app/(admin)` directory, here is the breakdown of necessary, unneeded, and screens requiring advanced upgrades.

### Necessary Screens (Keep)
These are core to business operations and must be maintained.
*   **`dashboard/index.tsx`**: The main hub for business analytics and overview.
*   **`admin-bookings/index.tsx`**: Crucial for managing incoming photography requests.
*   **`clients/index.tsx` & `clients/gallery/[id].tsx`**: Essential for client CRM and gallery delivery.
*   **`inbox/index.tsx`**: Required for client communication.
*   **`upload.tsx`**: Core functionality for uploading high-res photos.
*   **`settings/index.tsx`**: Global app configurations.
*   **`settings/payments.tsx` & `settings/package-editor.tsx`**: Core revenue and pricing management.

### Unneeded/Redundant Screens (Remove/Consolidate)
These screens can be removed or merged to reduce code bloat and navigation complexity.
*   **`settings/simple-mpesa.tsx` & `settings/mpesa-transactions.tsx`**: Merge these into the main `settings/payments.tsx` to have a single unified "Billing & Transactions" hub.
*   **`settings/manual-payments.tsx`**: Consolidate this into a modal within the main Bookings or Payments screen rather than a standalone page.
*   **`post-details/[id].tsx`**: If this is just a preview of the BTS feed, it can be handled via a modal on the `bts-announcements.tsx` screen rather than a separate route.

### Screens Needing Advanced Upgrades
These screens function but require a significant UX/Architecture overhaul for professional use.
*   **`upload.tsx`**: Needs a massive upgrade. Implement chunked, resumable uploads using Supabase TUS (The Tus Protocol) for massive RAW/JPEG files. Add background upload capabilities so the admin can leave the screen while files upload.
*   **`dashboard/index.tsx`**: Upgrade to include dynamic, interactive charts (using `react-native-chart-kit` or `victory-native`) showing revenue over time, booking conversion rates, and storage usage.
*   **`admin-bookings/index.tsx`**: Convert to a Kanban-style drag-and-drop board (Lead -> Deposit Paid -> Shoot Complete -> Delivered) for easier visual management.

---

## 2. Backend Activities & Edge Functions Upgrade

The current Supabase edge functions perform well but need optimization for scale and reliability.

### Required Backend Upgrades
*   **Image Processing Pipeline (`admin_process_image`)**: 
    *   *Current Issue*: Processing massive files synchronously in Edge Functions can hit timeout limits.
    *   *Upgrade*: Implement a webhook/queue system. When an image is uploaded, trigger a background worker that generates watermarks and thumbnails asynchronously, then updates the database to trigger a real-time notification to the client.
*   **SMS & Delivery Handling (`send_sms`, `delivery-callback`)**:
    *   *Upgrade*: Implement strict retry logic and dead-letter queues. If an SMS fails to send via the provider, the system should automatically retry 3 times with exponential backoff before marking it as 'failed' in the `sms_logs` table.
*   **Storage Consistency (`admin_storage_consistency_check`)**:
    *   *Upgrade*: Automate this via `pg_cron` to run nightly. It should automatically prune orphaned storage files (files in the bucket that have no corresponding row in `gallery_photos`) to save on AWS/Supabase storage costs.
*   **Payment Callbacks (`mpesa-callback`, `stk_push`)**:
    *   *Upgrade*: Ensure complete idempotency. If M-Pesa sends the callback twice due to network lag, the function must guarantee the client's balance/status is only updated once.

---

## 3. App Size Reduction Strategy (Target: < 100MB)

To get the final `.aab` (Android) and `.ipa` (iOS) bundle sizes well below 100MB, we need to aggressively prune unused code and assets.

### Asset Optimization
*   **Vector Graphics**: Replace all `.png` or `.jpg` UI icons with `.svg` using `react-native-svg`. SVGs scale infinitely and take up kilobytes instead of megabytes.
*   **Lottie Animations**: If using `.gif` for loading states or success animations, switch to `lottie-react-native` with lightweight `.json` files.
*   **Font Pruning**: Ensure you are only bundling the exact font weights you use (e.g., Regular, Semi-Bold, Bold). Remove heavy unused weights like Thin, Black, or Italic if not strictly needed.

### Code & Dependency Pruning
*   **Remove Duplicate Libraries**: Ensure you aren't bundling multiple libraries that do the same thing (e.g., using both `moment.js` and `date-fns`). Switch to a native lightweight alternative like `dayjs`.
*   **Lazy Loading**: Use React's `lazy()` and `Suspense` for heavy admin screens (like the dashboard charts or upload pipeline). This prevents the entire JS bundle from loading into memory at startup.
*   **Expo EAS Build Optimizations**: 
    *   Ensure `eas.json` is configured for production builds to strip out all debug symbols.
    *   Enable ProGuard (Android) to strip unused Java code during compilation.
    *   Use Expo's Hermes engine, which pre-compiles JavaScript into lightweight bytecode, significantly reducing app size and improving startup time.