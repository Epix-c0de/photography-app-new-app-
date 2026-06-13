# Super Admin Dashboard - Complete Implementation & Security Plan

## Issues to Address

### 1. **Unassociated Client Problem** (CRITICAL)
**Problem**: Clients who discover the app via shared links but aren't associated with any admin will have a blank app.

**Solution**: Implement Admin Assignment Flow
- When a client first opens the app via any link, check if they have an `owner_admin_id`
- If not assigned, show an onboarding screen:
  - "Welcome to Epix Visuals!"
  - "Enter the photographer code or scan QR code"
  - Input field for photographer code
  - Option to browse registered photographers
- Store a mapping of photographer codes to admin IDs
- Assign the client to the admin automatically

**Database Changes**:
```sql
-- Add photographer_code to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS photographer_code TEXT UNIQUE;

-- Generate codes for existing admins
UPDATE user_profiles 
SET photographer_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8))
WHERE role = 'admin' AND photographer_code IS NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_photographer_code ON user_profiles(photographer_code);
```

---

### 2. **Payment Security** (CRITICAL)
**Problem**: M-Pesa credentials stored in plain text in the database.

**Solution**: Encrypt Payment Credentials
- Use Supabase Vault for storing sensitive credentials
- Never expose credentials in API responses
- Use environment variables for super admin credentials

**Implementation**:
```sql
-- Use Supabase Vault (encrypted storage)
-- Store credentials using vault.create_secret()
SELECT vault.create_secret('mpesa_consumer_key', 'actual_key_value');
SELECT vault.create_secret('mpesa_consumer_secret', 'actual_secret_value');
SELECT vault.create_secret('mpesa_passkey', 'actual_passkey_value');

-- Modify platform_payment_settings to reference vault
ALTER TABLE platform_payment_settings 
ADD COLUMN mpesa_consumer_key_vault_id UUID REFERENCES vault.secrets(id),
ADD COLUMN mpesa_consumer_secret_vault_id UUID REFERENCES vault.secrets(id),
ADD COLUMN mpesa_passkey_vault_id UUID REFERENCES vault.secrets(id);

-- Remove plain text columns (after migration)
-- ALTER TABLE platform_payment_settings 
-- DROP COLUMN mpesa_consumer_key,
-- DROP COLUMN mpesa_consumer_secret,
-- DROP COLUMN mpesa_passkey;
```

**Edge Function for Payment Processing**:
```typescript
// supabase/functions/process-payment/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Service role can access vault
  )
  
  // Fetch credentials from vault (encrypted)
  const { data: secrets } = await supabase.rpc('get_payment_secrets')
  
  // Use secrets to process payment
  // Credentials never leave the server
})
```

---

### 3. **Admin-Specific Payment Routing** (CRITICAL)
**Problem**: Ensure user app payments go to the correct admin's M-Pesa account.

**Solution**: Admin-Level Payment Configuration
- Each admin has their own M-Pesa credentials
- Super admin credentials are only for admin subscriptions
- Client payments use the photographer's credentials

**Database Schema**:
```sql
-- Add payment settings to user_profiles for each admin
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS mpesa_till_number TEXT,
ADD COLUMN IF NOT EXISTS mpesa_paybill_number TEXT,
ADD COLUMN IF NOT EXISTS mpesa_account_name TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'manual' CHECK (payment_method IN ('manual', 'mpesa', 'bank'));

-- Payment routing table
CREATE TABLE IF NOT EXISTS admin_payment_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('gallery', 'booking')),
  mpesa_consumer_key_vault_id UUID REFERENCES vault.secrets(id),
  mpesa_consumer_secret_vault_id UUID REFERENCES vault.secrets(id),
  mpesa_shortcode TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(admin_id, payment_type)
);
```

**Payment Flow**:
1. Client initiates payment for gallery
2. System looks up gallery's owner_admin_id
3. Fetch admin's payment configuration
4. Route payment to admin's M-Pesa account
5. Super admin gets commission (10%) via background job

---

### 4. **Auto Photo Unlock on Payment** (CRITICAL)
**Problem**: Photos don't unlock automatically when client pays.

**Solution**: Webhook-Based Photo Unlock
- M-Pesa sends callback to Edge Function
- Edge Function verifies payment
- Updates `payments` table status to 'success'
- Triggers photo unlock via database trigger

**Database Trigger**:
```sql
-- Function to unlock photos when payment succeeds
CREATE OR REPLACE FUNCTION unlock_photos_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment status changed to 'success'
  IF NEW.status = 'success' AND OLD.status != 'success' THEN
    -- Update gallery photos to unlocked
    UPDATE gallery_photos
    SET is_locked = FALSE, unlocked_at = NOW()
    WHERE gallery_id = NEW.gallery_id
      AND client_id = NEW.client_id;
      
    -- Update gallery payment status
    UPDATE galleries
    SET payment_status = 'paid', paid_at = NOW()
    WHERE id = NEW.gallery_id
      AND client_id = NEW.client_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_unlock_photos ON payments;
CREATE TRIGGER trigger_unlock_photos
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION unlock_photos_on_payment();
```

**M-Pesa Callback Handler**:
```typescript
// supabase/functions/mpesa-callback/index.ts
Deno.serve(async (req) => {
  const callbackData = await req.json()
  
  // Verify M-Pesa signature
  // Extract transaction details
  const { ResultCode, CheckoutRequestID, Amount, MpesaReceiptNumber } = callbackData
  
  if (ResultCode === 0) { // Success
    // Update payment record
    await supabase
      .from('payments')
      .update({
        status: 'success',
        mpesa_code: MpesaReceiptNumber,
        paid_at: new Date().toISOString()
      })
      .eq('checkout_request_id', CheckoutRequestID)
    
    // Trigger will automatically unlock photos
  }
  
  return new Response('OK', { status: 200 })
})
```

---

### 5. **Admin App Organization** (UX IMPROVEMENT)
**Problem**: Admin app is congested and confusing for photographers.

**Solution**: Redesign Admin Navigation with Categories

**New Navigation Structure**:
```
📊 Dashboard (Overview)
├─ 📸 Content Management
│  ├─ Galleries (Upload, Manage)
│  ├─ Behind The Scenes
│  └─ Portfolio
│
├─ 👥 Client Management
│  ├─ All Clients
│  ├─ Invite Client
│  └─ Messages/Chat
│
├─ 📅 Business Operations
│  ├─ Bookings
│  ├─ Packages
│  └─ Invoices
│
├─ ⚙️ Settings
│  ├─ Profile
│  ├─ Payment Setup
│  ├─ Delivery Links
│  └─ Watermark
│
└─ 📈 Analytics (if needed)
```

**Implementation - Grouped Sidebar**:
- Use collapsible sections
- Icons for visual clarity
- Current section highlighted in gold
- Reduce clutter by grouping related features

---

### 6. **Links Tab Enhancement**
**Problem**: Links tab should show all photographer-specific sharing links.

**Solution**: Dynamic Link Generator per Admin

**Links to Display**:
```typescript
type AdminLinks = {
  // Gallery Sharing
  galleryShareBaseUrl: string // https://app.epixvisuals.app/gallery/{galleryId}
  
  // BTS Sharing
  btsShareBaseUrl: string // https://app.epixvisuals.app/bts/{btsId}
  
  // Announcements
  announcementsUrl: string // https://app.epixvisuals.app/announcements?admin={adminId}
  
  // Client Invite
  clientInviteUrl: string // https://app.epixvisuals.app/join?code={photographerCode}
  
  // Portfolio
  portfolioUrl: string // https://portfolio.epixvisuals.app/{photographerCode}
  
  // Booking Link
  bookingUrl: string // https://app.epixvisuals.app/book?photographer={photographerCode}
}
```

**Settings Page - Links Tab Update**:
```tsx
// Show photographer-specific links
const AdminLinksTab = () => {
  const [photographerCode, setPhotographerCode] = useState('')
  const [links, setLinks] = useState<AdminLinks | null>(null)
  
  useEffect(() => {
    // Fetch photographer code and generate links
    fetchAdminLinks()
  }, [])
  
  const fetchAdminLinks = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('photographer_code, id')
      .eq('id', userId)
      .single()
    
    if (data) {
      setPhotographerCode(data.photographer_code)
      setLinks(generateLinks(data.photographer_code, data.id))
    }
  }
  
  return (
    <div>
      <h3>Your Sharing Links</h3>
      
      {/* Photographer Code */}
      <div>
        <label>Photographer Code</label>
        <div className="code-display">{photographerCode}</div>
        <button onClick={() => navigator.clipboard.writeText(photographerCode)}>
          Copy Code
        </button>
      </div>
      
      {/* Gallery Share Link */}
      <LinkDisplay
        label="Gallery Share Link"
        url={links?.galleryShareBaseUrl}
        description="Share this link with clients to view their galleries"
      />
      
      {/* BTS Share Link */}
      <LinkDisplay
        label="Behind The Scenes Link"
        url={links?.btsShareBaseUrl}
        description="Share behind-the-scenes content"
      />
      
      {/* Client Invite Link */}
      <LinkDisplay
        label="Client Invitation Link"
        url={links?.clientInviteUrl}
        description="Send this to new clients to join your studio"
        highlightColor="gold"
      />
      
      {/* Portfolio Link */}
      <LinkDisplay
        label="Portfolio Website"
        url={links?.portfolioUrl}
        description="Your public portfolio page"
      />
      
      {/* QR Code Generator */}
      <div>
        <h4>QR Codes</h4>
        <QRCodeDisplay value={links?.clientInviteUrl} label="Client Invitation" />
        <QRCodeDisplay value={links?.portfolioUrl} label="Portfolio" />
      </div>
    </div>
  )
}
```

---

## Implementation Priority

### Phase 1: Critical Security (Week 1)
1. ✅ Encrypt M-Pesa credentials using Supabase Vault
2. ✅ Implement admin-specific payment routing
3. ✅ Create payment webhook handler
4. ✅ Implement auto photo unlock trigger

### Phase 2: Client Assignment Flow (Week 1-2)
1. ✅ Add photographer_code to database
2. ✅ Create client onboarding screen
3. ✅ Implement photographer code validation
4. ✅ Auto-assign clients to photographers

### Phase 3: Admin App Reorganization (Week 2)
1. ✅ Redesign navigation with grouped categories
2. ✅ Implement collapsible sidebar sections
3. ✅ Improve visual hierarchy
4. ✅ Add quick action buttons

### Phase 4: Links Enhancement (Week 2-3)
1. ✅ Build dynamic link generator
2. ✅ Create QR code display
3. ✅ Add copy-to-clipboard functionality
4. ✅ Display all photographer-specific links

---

## Security Checklist

- [ ] M-Pesa credentials stored in Supabase Vault (encrypted)
- [ ] Payment endpoints use service role key (server-side only)
- [ ] RLS policies prevent admins from accessing other admins' payment data
- [ ] Webhook signatures verified before processing payments
- [ ] HTTPS-only for all payment transactions
- [ ] Rate limiting on payment endpoints
- [ ] Audit log for all payment configuration changes
- [ ] Two-factor authentication for super admin
- [ ] Photographer code is unique and non-guessable
- [ ] Client assignment requires valid photographer code

---

## Testing Scenarios

### Payment Flow Test
1. Client views locked gallery
2. Client clicks "Unlock Photos"
3. M-Pesa STK push sent
4. Client enters PIN and pays
5. M-Pesa callback received
6. Payment status updated to 'success'
7. Photos automatically unlock
8. Client can now download/view photos

### Client Assignment Test
1. New client opens app via shared link
2. No owner_admin_id assigned
3. Onboarding screen appears
4. Client enters photographer code
5. System validates code
6. Client assigned to photographer
7. Client sees photographer's galleries

### Admin Payment Routing Test
1. Client pays for Gallery A (owned by Admin X)
2. System routes payment to Admin X's M-Pesa
3. Super admin receives 10% commission
4. Both transactions recorded in database
5. Admin X sees payment in dashboard

---

## Database Migration Order

1. **20260602000003_payment_security.sql** - Vault setup, encryption
2. **20260602000004_photographer_codes.sql** - Add photographer codes
3. **20260602000005_payment_routing.sql** - Admin payment routes
4. **20260602000006_photo_unlock_trigger.sql** - Auto unlock on payment
5. **20260602000007_client_assignment.sql** - Client-photographer mapping

Would you like me to create these migration files and implement the solutions?
