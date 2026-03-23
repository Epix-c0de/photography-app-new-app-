# Schema Mismatch Fixed - Portfolio Items

## Issue Found
The migration was trying to use columns that don't exist in the actual `portfolio_items` table schema:
- ❌ `is_public` (doesn't exist)
- ❌ `owner_admin_id` (doesn't exist)  
- ❌ `media_urls` array (doesn't exist)
- ❌ `media_types` array (doesn't exist)

## Actual Schema
The real `portfolio_items` table has:
- ✅ `created_by` (instead of `owner_admin_id`)
- ✅ `is_active` (instead of `is_public`)
- ✅ `media_url` single field (not array)
- ✅ `media_type` single field (not array)
- ✅ `is_featured` boolean
- ✅ `is_top_rated` boolean

## Fixes Applied

### 1. Migration File Updated
**File**: `supabase/migrations/20260311000001_fix_uploads_and_rls.sql`

**Changes**:
- ✅ Fixed RLS policies to use `created_by` instead of `owner_admin_id`
- ✅ Fixed SELECT policy to check `is_active = true` instead of `is_public = true`
- ✅ Fixed INSERT policy to set `created_by = auth.uid()`
- ✅ Fixed indexes to use correct column names

### 2. App Code Updated
**File**: `app/(admin)/bts-announcements.tsx` - Line 705

**Changes**:
```tsx
// ❌ BEFORE (trying to use arrays and wrong fields):
{
  owner_admin_id: user?.id,
  media_urls: [publicUrl],
  media_types: [inferMediaType(...)],
  is_public: true,
}

// ✅ AFTER (using correct single-value fields):
{
  created_by: user?.id,
  media_url: publicUrl,
  media_type: inferMediaType(...),
  is_active: true,
}
```

## Now Ready
The migration will now work correctly. Run it with:
```bash
supabase db push
```

## Verification
After running migration, try uploading a portfolio item. It should now:
1. ✅ Insert successfully (no "column does not exist" error)
2. ✅ Save to database with correct fields
3. ✅ Display on user screens
4. ✅ Follow RLS permissions

