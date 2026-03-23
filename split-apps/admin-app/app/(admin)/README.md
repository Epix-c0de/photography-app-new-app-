# Admin Panel Documentation

## 1. Admin Flows
The Admin Panel is the control center for photographers. It is protected by **Role-Based Access Control (RBAC)** and **Biometric Security**.

### Authentication
- **Login**: Email/Password via Supabase Auth.
- **Session**: Persisted securely.
- **Biometric Guard**: Sensitive actions (Upload, Delete, Payment) require immediate biometric verification (FaceID/TouchID).

### Client Management
- **Create**: Add new clients with name, phone, and email.
- **Manage**: Assign packages, view history, and disable access.
- **CRM**: Track total spend and last shoot date.

### Gallery Management
1. **Create Gallery**: Define name, client, and price.
2. **Upload**: Select photos -> Backend processes 'watermarked' and 'clean' variants.
3. **Release**:
   - *Locked*: Client sees cover only (or watermarked).
   - *Unlocked*: Client can download clean photos.

## 2. Security Rules
- **Data Isolation**: Admins can only see their own clients and galleries.
- **Audit Logging**: All critical actions are logged to `audit_logs` table.
- **Abuse Prevention**: Rate limits on SMS sending and Uploads are enforced by Edge Functions.

## 3. Upload Logic
The upload process is designed for reliability:
1. **Selection**: Admin picks multiple photos.
2. **Compression**: (Optional) Client-side optimization before upload.
3. **Storage**:
   - `photos-watermarked` bucket -> For preview.
   - `photos-clean` bucket -> Secure vault.
4. **Database**: `photos` records created with `storage_path`.

## 4. SMS & Payments
### SMS System
- **Sending**: Automated messages for "Gallery Ready" or "Payment Received".
- **Bundles**: Admins purchase SMS credits via M-Pesa.
- **Balance**: Checked before every send. Failed sends due to low balance trigger admin notification.

### Payments
- **Revenue**: Tracked in `admin_resources`.
- **Method**: M-Pesa integration.
- **Status**: Real-time updates via Supabase Realtime/Webhooks.
