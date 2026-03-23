# Upload Issues - Root Cause Analysis & Fixes Applied

## Executive Summary
The upload features (BTS posts, Announcements, Portfolio) were failing due to **THREE CRITICAL ISSUES**:
1. **Schema mismatches** - Upload code inserting fields that don't exist in database
2. **Broken query filters** - User-facing screens using chained `.or()` calls (only last one applies)
3. **Missing/incorrect RLS policies** - Database wouldn't accept inserts from admin users

---

## ISSUE #1: Schema Mismatches

### Problem: BTS Posts Upload

**Error**: Trying to insert fields that don't exist
```javascript
// ❌ WRONG - These fields don't exist in bts_posts table:
{
  image_url: thumbnailUrl,      // NOT A COLUMN
  has_music: hasMusic,           // NOT A COLUMN
}
```

**Root Cause**: `bts_posts` table schema only has:
- `media_url` (not `image_url`)
- `music_url` (for music file, not `has_music` flag)
- No `has_music` column at all

**Fix Applied**: [Line 383 in app/(admin)/bts-announcements.tsx](app/(admin)/bts-announcements.tsx#L383)
- Removed `image_url` field
- Removed `has_music` field
- Kept `music_url` for actual music file uploads

---

### Problem: Portfolio Items Upload

**Error**: Using wrong field names and data types
```javascript
// ❌ WRONG:
{
  title: portfolioTitle,
  media_url: publicUrl,                 // Should be media_urls (array)
  media_type: type,                      // Should be media_types (array)
  image_url: thumbnailUrl,              // Field doesn't exist
  is_top_rated: true,                   // Field doesn't exist
  is_active: true,                      // Should be is_public
  created_by: user?.id,                 // Should be owner_admin_id
}
```

**Root Cause**: `portfolio_items` table uses DIFFERENT schema:
```sql
CREATE TABLE portfolio_items (
  owner_admin_id uuid,        -- NOT created_by
  media_urls text[],          -- ARRAY not single field
  media_types text[],         -- ARRAY not single field
  is_featured boolean,        -- exists
  is_public boolean,          -- NOT is_active
  content_type text,          -- REQUIRED: 'bts' or 'portfolio'
  -- NO: image_url, is_top_rated, is_active, created_by
)
```

**Fix Applied**: [Line 705 in app/(admin)/bts-announcements.tsx](app/(admin)/bts-announcements.tsx#L705)
```javascript
// ✅ CORRECT:
{
  owner_admin_id: user?.id,
  title: portfolioTitle,
  description: portfolioDescription,
  content_type: 'portfolio',
  category: portfolioCategory,
  media_urls: [publicUrl],            // Array with single URL
  media_types: [inferMediaType(...)], // Array with media type
  is_featured: portfolioFeatured,
  is_public: true,
}
```

---

### Problem: Announcements Upload

**Status**: ✅ CORRECT - No changes needed
- Uses `image_url` ✓ (exists in schema)
- Uses `media_url` ✓ (exists in schema)
- Uses `content_html` ✓ (exists in schema)
- Uses `target_audience` ✓ (array field exists)
- Uses `scheduled_for` ✓ (exists in schema)
- Uses `created_by` ✓ (exists in schema)

---

## ISSUE #2: Broken Query Filters (User-Facing Screens)

### Problem: Chained `.or()` Calls Don't Work as Expected

**Code**: [app/(tabs)/home/index.tsx - Lines 321-330](app/(tabs)/home/index.tsx#L321-L330)
```javascript
// ❌ WRONG - Only the LAST .or() is applied!
const { data, error } = await supabase
  .from('bts_posts')
  .select('*')
  .eq('is_active', true)
  .or(`expires_at.is.null,expires_at.gt.${nowIso}`)    // ← This is ignored
  .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`) // ← Only this applies
```

**Root Cause**: Supabase PostgREST API behavior
- When you chain multiple `.or()` calls, only the LAST one is applied
- The previous `.or()` is completely overwritten
- This means only `scheduled_for` filter is checked, not expiry!

**Result**: Items with EXPIRED times still show up (because expiry filter is ignored)

**Fix Applied**: Combine all OR conditions into a SINGLE `.or()` call
```javascript
// ✅ CORRECT - All conditions in one .or()
.or(`expires_at.is.null,expires_at.gt.${nowIso},scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
```

**Files Fixed**:
1. [app/(tabs)/home/index.tsx - BTS fetch](app/(tabs)/home/index.tsx#L321)
2. [app/(tabs)/home/index.tsx - Announcements fetch](app/(tabs)/home/index.tsx#L426)

---

## ISSUE #3: RLS Policies

### Problem: Admins Can't Insert New Items

**Cause**: RLS policies were too restrictive or missing INSERT permissions

**Solutions Applied**:

#### For `bts_posts`:
- ✅ Added INSERT policy allowing admins to insert when `created_by = auth.uid()`
- ✅ Verified admin role check against `user_profiles.role`
- ✅ Simplified SELECT to allow all users to view

#### For `announcements`:
- ✅ Added INSERT policy allowing admins to insert when `created_by = auth.uid()`
- ✅ Verified admin role check
- ✅ Allow public SELECT

#### For `portfolio_items`:
- ✅ Added INSERT policy allowing admins to insert when `owner_admin_id = auth.uid()`
- ✅ Added separate SELECT policies for public vs. own items
- ✅ Updated to use `owner_admin_id` field in RLS checks

**Migration Applied**: [supabase/migrations/20260311000001_fix_uploads_and_rls.sql](supabase/migrations/20260311000001_fix_uploads_and_rls.sql)

---

## Verification Checklist

### After applying fixes, verify:

- [ ] **Database**
  - [ ] Run migration: `20260311000001_fix_uploads_and_rls.sql`
  - [ ] Verify `media` storage bucket exists and is PUBLIC
  - [ ] Check RLS is enabled on all three tables

- [ ] **Admin Upload Screen** [app/(admin)/bts-announcements.tsx](app/(admin)/bts-announcements.tsx)
  - [ ] Try uploading BTS post - should save to `bts_posts` table
  - [ ] Try uploading Announcement - should save to `announcements` table  
  - [ ] Try uploading Portfolio - should save to `portfolio_items` table
  - [ ] Check browser console for success logs

- [ ] **User-Facing Screens**
  - [ ] Go to Home tab - should see BTS posts and Announcements
  - [ ] Go to Announcements tab - should see all active announcements
  - [ ] Items should filter out expired content

- [ ] **Database Validation**
  - [ ] Check `bts_posts` table has rows with `created_by` filled
  - [ ] Check `announcements` table has rows with `created_by` filled
  - [ ] Check `portfolio_items` table has rows with `owner_admin_id` filled

---

## Summary of Changes

### Code Changes:
1. ✅ [app/(admin)/bts-announcements.tsx](app/(admin)/bts-announcements.tsx#L383) - Removed invalid fields from BTS insert
2. ✅ [app/(admin)/bts-announcements.tsx](app/(admin)/bts-announcements.tsx#L705) - Fixed portfolio insert to use correct schema
3. ✅ [app/(tabs)/home/index.tsx](app/(tabs)/home/index.tsx#L321) - Fixed BTS fetch filter query
4. ✅ [app/(tabs)/home/index.tsx](app/(tabs)/home/index.tsx#L426) - Fixed Announcements fetch filter query

### Database Changes:
5. ✅ [supabase/migrations/20260311000001_fix_uploads_and_rls.sql](supabase/migrations/20260311000001_fix_uploads_and_rls.sql) - Comprehensive RLS policy fixes

---

## Next Steps

1. **Apply the migration** to your Supabase database
2. **Test uploads** from the admin panel
3. **Verify items appear** on user-facing screens
4. **Monitor console logs** for any remaining errors
5. **If issues persist**, check:
   - Are you logged in as an admin?
   - Does `media` storage bucket exist?
   - Do you have proper JWT tokens?

---

## Additional Notes

### Why Items Weren't Showing:
- **Admin side**: Items weren't being saved due to schema mismatches
- **User side**: Filter queries were broken (chained `.or()` issue), so even if items existed, they wouldn't display

### The Chain `.or()` Bug Explanation:
In Supabase, this:
```javascript
.or('condition1')
.or('condition2')
```
Does NOT mean: "condition1 OR condition2"  
It means: "ignore condition1, only apply condition2"

Solution: Always combine conditions in ONE `.or()` call:
```javascript
.or('condition1,condition2')
```

