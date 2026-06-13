# Epix Visuals Platform - Deployment Checklist

## Pre-Deployment Tasks

### 1. Database Migrations ✅
Run these migrations in order:

```bash
# Already completed
✅ 20260602000001_privacy_and_tagging.sql
✅ 20260602000002_super_admin_features.sql

# New migrations (run these now)
⏳ 20260602000003_photographer_codes_and_assignment.sql
⏳ 20260602000004_photo_auto_unlock.sql
```

**How to Run**:
```bash
# Navigate to supabase directory
cd supabase

# Run migrations
npx supabase db push
```

### 2. Install Dependencies

**Super Admin Dashboard**:
```bash
cd super-admin-dashboard
npm install chart.js react-chartjs-2
npm run build
```

**User App**:
```bash
cd split-apps/user-app
npm install
```

**Admin App**:
```bash
cd split-apps/admin-app
npm install
```

### 3. Environment Variables

Ensure all `.env` files are configured:

**Super Admin Dashboard** (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://gghqurnamjdxoriuuopf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**Admin App** (`split-apps/admin-app/.env`):
```env
EXPO_PUBLIC_SUPABASE_URL=https://gghqurnamjdxoriuuopf.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**User App** (`split-apps/user-app/.env`):
```env
EXPO_PUBLIC_SUPABASE_URL=https://gghqurnamjdxoriuuopf.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## Feature Verification

### ✅ Client Assignment Flow
1. Create test client account
2. Open user app
3. Should see photographer assignment screen
4. Enter valid photographer code
5. Verify successful assignment
6. Check database: `clients` table has `owner_admin_id`

### ✅ Photo Auto-Unlock
1. Upload locked gallery as admin
2. Send gallery link to client
3. Client initiates payment
4. Complete M-Pesa payment (or simulate)
5. Verify photos unlock automatically
6. Check `gallery_photos.is_locked = false`
7. Check `payments.status = 'success'`

### ✅ Super Admin Dashboard
1. Login as `epixshots002@gmail.com`
2. Navigate to all pages:
   - ✅ Dashboard
   - ✅ Photographers (with storage metrics)
   - ✅ Clients
   - ✅ Revenue (with charts)
   - ✅ Fraud Detection
   - ✅ Settings (Payment, Pricing, Webhooks, Links)
3. Verify all data loads correctly
4. Test photographer actions (extend, deactivate, lifetime)

### ⏳ Admin App Organization
1. Open admin app
2. Verify bottom tab bar has 5 items only
3. Navigate through each section
4. Check settings screen uses card layout
5. Verify all features still accessible

### ⏳ Links Tab Enhancement
1. Open Super Admin → Settings → Links tab
2. Verify all URL fields present:
   - Admin App URL
   - Client App URL
   - Onboarding URL
   - Deep Link Scheme
3. Test save functionality
4. Verify changes persist

---

## Security Verification

### Database Security
```sql
-- Test RLS policies
-- As regular admin, try to access other admin's data
SELECT * FROM galleries WHERE owner_admin_id != auth.uid(); -- Should return empty

-- As client, try to access other client's galleries
SELECT * FROM galleries WHERE client_id != (SELECT user_id FROM clients WHERE user_id = auth.uid()); -- Should return empty

-- Test photographer code uniqueness
INSERT INTO user_profiles (photographer_code) VALUES ('TEST1234'); -- Should fail if duplicate
```

### API Endpoints
- ✅ `/api/photographers` - Only super admin can access
- ✅ `/api/payments` - Filtered by owner_admin_id
- ✅ `/api/galleries` - Filtered by owner_admin_id
- ✅ `/api/clients` - Filtered by owner_admin_id

### Payment Security
- ⏳ M-Pesa credentials encrypted (Vault implementation pending)
- ✅ RLS on `platform_payment_settings` (super admin only)
- ⏳ Webhook signature verification (implementation pending)
- ✅ Payment status transitions logged

---

## Performance Checklist

### Database Indexes
```sql
-- Verify indexes exist
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';

-- Expected indexes:
✅ idx_photographer_code (user_profiles)
✅ idx_fraud_flags_user (fraud_flags)
✅ idx_fraud_flags_status (fraud_flags)
✅ idx_client_assignment_client (client_assignment_log)
✅ idx_client_assignment_admin (client_assignment_log)
```

### Query Optimization
- ✅ Photographer storage metrics uses single RPC call
- ✅ Revenue metrics aggregated in database
- ✅ Fraud detection runs as scheduled job (recommended)

### Image Optimization
- ✅ Thumbnails generated on upload
- ✅ Signed URLs cached (24-hour expiry)
- ⏳ CDN caching for public images

---

## User Testing Scenarios

### Scenario 1: New Photographer Onboards
1. Visits `join.epixvisuals.app`
2. Creates account and completes onboarding
3. Selects subscription plan and pays
4. Gets photographer code
5. Accesses admin app
6. Uploads first gallery
7. Shares link with client

**Expected Result**: All steps complete smoothly, photographer receives code immediately

### Scenario 2: Client Discovers App
1. Client clicks gallery share link from WhatsApp
2. Opens user app (not logged in)
3. Creates account
4. Sees photographer assignment screen
5. Enters photographer code from link or manual entry
6. Gets assigned to correct photographer
7. Sees their galleries

**Expected Result**: Client never sees blank app, seamless assignment

### Scenario 3: Client Pays for Gallery
1. Client views locked gallery
2. Clicks "Unlock Photos" button
3. M-Pesa STK push appears
4. Client enters PIN and confirms
5. Payment processes
6. Photos unlock automatically (no refresh needed)
7. Client can download/share

**Expected Result**: Instant unlock, no manual admin intervention

### Scenario 4: Super Admin Manages Platform
1. Super admin logs in
2. Views all photographers and their metrics
3. Detects fraud pattern (excessive storage)
4. Flags suspicious account
5. Reviews revenue pipeline
6. Updates pricing tiers
7. Extends photographer subscription

**Expected Result**: All operations succeed, data accurate

---

## Post-Deployment Monitoring

### Day 1
- [ ] Monitor error logs in Supabase dashboard
- [ ] Check payment callback success rate
- [ ] Verify photo unlock trigger fires
- [ ] Monitor API response times
- [ ] Check storage usage growth

### Week 1
- [ ] Review fraud detection patterns
- [ ] Analyze revenue trends
- [ ] Check client assignment success rate
- [ ] Monitor photographer churn
- [ ] Gather user feedback

### Month 1
- [ ] Review platform commission accuracy
- [ ] Optimize slow queries
- [ ] Scale infrastructure if needed
- [ ] Implement additional security features
- [ ] Add analytics dashboard

---

## Known Limitations & Future Enhancements

### Current Limitations
1. **Payment**: Only M-Pesa supported (Kenya)
2. **Language**: English only
3. **Storage**: No quota limits enforced yet
4. **Fraud**: Manual review required
5. **Analytics**: Basic metrics only

### Planned Enhancements
1. **Multi-Currency Support**: USD, EUR via Stripe
2. **Internationalization**: Swahili, French
3. **Storage Quotas**: Enforce limits per tier
4. **AI Fraud Detection**: Automated flagging
5. **Advanced Analytics**: Predictive insights
6. **Mobile Payment**: Airtel Money, Tigo Pesa
7. **White-Label**: Custom branding per photographer
8. **API Access**: For third-party integrations

---

## Emergency Contacts

### Critical Issues
- **Database Down**: Contact Supabase support
- **Payment Failures**: Check M-Pesa API status
- **Security Breach**: Revoke keys immediately, contact security team

### Support Channels
- **Super Admin**: epixshots002@gmail.com
- **Technical Support**: [Your support email]
- **Supabase Dashboard**: https://supabase.com/dashboard

---

## Success Metrics

### Week 1 Targets
- ✅ 0 critical bugs
- ✅ 95%+ payment success rate
- ✅ 0 unassigned clients
- ✅ <2s page load times

### Month 1 Targets
- ✅ 50+ active photographers
- ✅ 500+ clients assigned
- ✅ 98%+ uptime
- ✅ <5% support ticket rate

### Quarter 1 Targets
- ✅ 200+ paying photographers
- ✅ 5,000+ clients
- ✅ $50,000+ revenue
- ✅ 4.5+ star rating

---

## Final Checklist Before Launch

- [ ] All migrations run successfully
- [ ] Super admin dashboard accessible
- [ ] Admin app builds and runs
- [ ] User app builds and runs
- [ ] Photographer codes generated
- [ ] Payment webhooks configured
- [ ] Photo unlock tested end-to-end
- [ ] Client assignment tested
- [ ] Fraud detection working
- [ ] Revenue tracking accurate
- [ ] Settings persist correctly
- [ ] All links functional
- [ ] Error logging enabled
- [ ] Backup strategy in place
- [ ] Documentation complete
- [ ] Team trained on admin functions

---

**Ready to Launch! 🚀**

After completing this checklist, your platform is production-ready with:
- ✅ Secure client assignment
- ✅ Automatic photo unlocking
- ✅ Comprehensive super admin controls
- ✅ Organized admin interface
- ✅ Revenue tracking
- ✅ Fraud detection
- ✅ Scalable architecture

Good luck with your launch!
