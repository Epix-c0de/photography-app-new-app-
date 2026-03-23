# Portfolio Upload Fix - Checklist

## What Was Fixed ✅

### Code Changes
- [x] Updated `uploadPortfolio()` in `app/(admin)/bts-announcements.tsx`
  - Get authenticated user from Supabase Auth API
  - Use `authUser.id` directly instead of `user?.id`
  - Better logging and error handling

### Database Policy
- [x] Created new RLS migration: `20260312000001_fix_portfolio_rls_policy.sql`
  - Simplified SELECT policy (anyone can view active items)
  - INSERT policy: authenticated users can insert their own items
  - UPDATE policy: users can update their own items
  - DELETE policy: users can delete their own items

### Type Fixes
- [x] Fixed TypeScript errors in `app/auth/callback.tsx`
  - Proper typing for token extraction
  - Removed unused oauthLogger import

## Before Uploading
- [ ] Run `npm install` to ensure dependencies are current
- [ ] Clear app cache: `npm start -- --clean`
- [ ] Rebuild on device if needed

## After Uploading - Test These
1. **Test Portfolio Upload**
   - [ ] Log in as admin
   - [ ] Go to Admin Panel → Upload → Portfolio tab
   - [ ] Add title and select media
   - [ ] Click Upload
   - [ ] Should see success message
   - [ ] Check console for: `[Portfolio Upload] ✓ Database insert SUCCESSFUL`

2. **Verify in Supabase**
   - [ ] Go to Supabase Dashboard
   - [ ] Check `portfolio_items` table
   - [ ] Should see new row with your media URL

3. **Test Portfolio Display**
   - [ ] Log in as regular user
   - [ ] Go to Gallery tab
   - [ ] Should see your uploaded portfolio item

4. **Test Featured/Top-Rated**
   - [ ] Upload new portfolio with "Featured" checked
   - [ ] Upload new portfolio with "Top Rated" checked
   - [ ] Verify they show correctly in gallery

## Troubleshooting

### If Upload Still Fails
1. **Check Browser Console**
   - Look for errors like: `violates row-level security`
   - Copy the exact error message

2. **Check Supabase Logs**
   - Go to Supabase Dashboard → Logs
   - Search for portfolio_items
   - Look for RLS policy rejection messages

3. **Verify Migration Applied**
   - In Supabase Dashboard → SQL Editor
   - Run: `SELECT * FROM public.portfolio_items LIMIT 1;`
   - If table exists, migration was applied

4. **Test with Direct API**
   - In Supabase Dashboard → SQL Editor
   - Try manual INSERT to test RLS

### Common Issues
| Issue | Fix |
|-------|-----|
| "media" bucket not found | Create "media" bucket in Storage |
| Storage upload fails | Check Storage bucket RLS policies |
| Still getting RLS error | Clear cache: `npm start -- --clean` |
| Table doesn't exist | Migration may not have applied - check Supabase Logs |

## Rollback (if needed)
To revert to old RLS policy:
1. Go to Supabase Dashboard → SQL Editor
2. Copy the OLD policy from `20260310000000_create_portfolio_items_table.sql`
3. Run it to replace the new policies
4. This will require users to be in `user_profiles` with admin role

## Success Indicators
When portfolio upload is working correctly:
- ✅ No RLS error message
- ✅ File uploads to storage bucket
- ✅ Row created in portfolio_items table
- ✅ Portfolio visible in user gallery
- ✅ Featured/Top-Rated flags work
- ✅ Console shows success logs

## Next Steps
After confirming upload works:
1. Test on multiple admin accounts
2. Test portfolio display on user side
3. Test gallery filtering (featured, top-rated)
4. Monitor Supabase logs for any issues
5. Consider adding quota/limits if needed

