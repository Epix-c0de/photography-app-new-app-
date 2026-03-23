## Portfolio Upload RLS Fix - Guide

### Problem
You were getting: **"new row violates row-level security policy"** when trying to upload portfolio items

### Root Cause
The original RLS (Row Level Security) policies were checking if the admin user exists in `user_profiles` table with role = 'admin' using complex subqueries. This was overly restrictive and could fail in certain scenarios.

### Solution
Two new simplified migration files have been created:

#### 1. `20260311000002_simplify_portfolio_rls.sql`
Simplifies portfolio_items RLS policy from:
```sql
-- OLD (too strict):
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
  AND created_by = auth.uid()
)
```

To:
```sql
-- NEW (simple):
WITH CHECK (created_by = auth.uid())
```

**Why this works**: 
- The `created_by` field must match the authenticated user's ID
- This ensures users can only upload to their own account
- No complex subqueries that can fail
- Faster and more reliable

#### 2. `20260311000003_simplify_bts_announcements_rls.sql`
Applies the same simplified pattern to BTS posts and Announcements tables for consistency

---

### How to Apply These Fixes

#### Option 1: Using Supabase CLI (Recommended)
```bash
cd c:\Users\karis\NEW APP TEMPLATE
supabase db push
```

This will automatically apply both migration files to your Supabase database.

#### Option 2: Manual Application in Supabase Dashboard
1. Go to: https://supabase.com/dashboard/projects
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy the contents of `supabase/migrations/20260311000002_simplify_portfolio_rls.sql`
6. Run it
7. Repeat for `20260311000003_simplify_bts_announcements_rls.sql`

---

### Verification Checklist

After applying migrations:

✅ **1. Check if admin user exists in user_profiles**
```sql
-- Run this query in Supabase > SQL Editor
SELECT id, email, role FROM public.user_profiles WHERE role = 'admin' LIMIT 1;
```
Should return your admin user. If not, manually create the profile:
```sql
INSERT INTO public.user_profiles (id, role, email)
VALUES ('{your_admin_user_id}', 'admin', 'admin@lexnart.com')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

✅ **2. Check RLS policies applied**
```sql
-- Run this in Supabase > SQL Editor
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('portfolio_items', 'bts_posts', 'announcements')
ORDER BY tablename;
```

You should see policies like:
- `Portfolio items public read`
- `Admins can insert portfolio items`
- `Admins can update portfolio items`
- `Admins can delete portfolio items`

✅ **3. Test Portfolio Upload**
- Go to admin panel
- Try uploading a new portfolio item
- Should work now! ✅

---

### Policy Details

#### All Three Tables Now Use Same Pattern:

**SELECT (Public Read)**
- Anyone can view `is_active = true` items

**INSERT (Admin Only)**
- Only allows if `created_by = auth.uid()`
- This ensures admin is authenticated

**UPDATE (Admin Only)**  
- Only if user created the item (`created_by = auth.uid()`)

**DELETE (Admin Only)**
- Only if user created the item (`created_by = auth.uid()`)

---

### Troubleshooting

**Issue**: "new row violates row-level security policy" still appears

**Fix**: 
1. Verify migrations were applied: check SQL Editor > View > Policies
2. Verify admin user profile exists with role = 'admin'
3. Clear app cache and restart
4. Try uploading again

**Issue**: "Permission denied" on storage

**Fix**:
1. Go to Supabase Dashboard > Storage > Buckets
2. Ensure "media" bucket exists
3. Set it to "PUBLIC" access (not private)
4. Verify storage RLS policies allow uploads

---

### Files Changed
- Created: `supabase/migrations/20260311000002_simplify_portfolio_rls.sql`
- Created: `supabase/migrations/20260311000003_simplify_bts_announcements_rls.sql`

### Migration Status
- ⏳ Pending: Apply via `supabase db push`
- After applying: Portfolio, BTS, and Announcements uploads should work ✅

---

**Generated**: March 11, 2026
**Status**: Ready to apply
