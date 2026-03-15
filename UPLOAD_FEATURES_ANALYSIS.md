# Admin Upload Features Analysis

## Overview
The admin panel includes three main uploading features: **BTS Posts**, **Announcements**, and **Portfolio Items**. All are managed through the [bts-announcements.tsx](app/(admin)/bts-announcements.tsx) file and use the Supabase `media` storage bucket.

---

## 1. BTS POSTS UPLOADING ✓

### Location
- **File**: [app/(admin)/bts-announcements.tsx](app/(admin)/bts-announcements.tsx#L145-L500)
- **Function**: `uploadBtsPost()`
- **Database Table**: `bts_posts`
- **Storage Bucket**: `media/bts/`

### Features
✅ **Media Support**
- Images (PNG, JPG, WEBP, HEIC, TIFF)
- Videos (MP4, MOV)
- Background music file support (optional)

✅ **Functionality**
- Auto-generated captions by category (Wedding, Portrait, Corporate, Event, Portfolio, Other)
- Manual caption editing
- Category selection
- Expiry date configuration (1-365 days)
- Scheduled posting
- Background music upload (MP3, etc.)
- Video thumbnail generation (TODO: Currently stubbed)

✅ **Error Handling**
- Storage bucket validation
- Permission/RLS policy checks
- Network error detection
- User-friendly error messages with actionable solutions

✅ **Database Fields**
```tsx
{
  title: string,
  media_url: string,
  image_url: string | null,  // Thumbnail for videos
  media_type: 'image' | 'video',
  category: BTSCategory,
  expires_at: ISO date,
  scheduled_for: ISO date | null,
  music_url: string | null,
  has_music: boolean,
  is_active: boolean,
  created_by: user_id,
  caption: string
}
```

### Status: ✅ WORKING
- All core functionality implemented
- Video thumbnail generation pending (returns null gracefully)
- Comprehensive error handling

---

## 2. ANNOUNCEMENTS UPLOADING ✓

### Location
- **File**: [app/(admin)/bts-announcements.tsx](app/(admin)/bts-announcements.tsx#L500-L750)
- **Function**: `uploadAnnouncement()`
- **Database Table**: `announcements`
- **Storage Bucket**: `media/announcements/`

### Features
✅ **Media Support**
- Images and videos supported
- Auto-detection of media type

✅ **Functionality**
- Title and description fields
- HTML content support (`content_html`)
- Category and tag support
- Target audience selection (Wedding Clients, Event Clients, Repeat Customers)
- Expiry configuration
- Scheduled delivery
- Video thumbnail generation (TODO: Currently stubbed)

✅ **Error Handling**
- Storage bucket validation
- RLS policy enforcement
- Network error detection
- Permission checking

✅ **Database Fields**
```tsx
{
  title: string,
  description: string,
  content_html: string,
  media_url: string,
  image_url: string | null,  // Thumbnail for videos
  media_type: 'image' | 'video',
  category: string,
  tag: string,
  expires_at: ISO date,
  scheduled_for: ISO date | null,
  target_audience: string[],
  is_active: boolean,
  created_by: user_id
}
```

### Status: ✅ WORKING
- All core functionality implemented
- Video thumbnail generation pending
- Full audience targeting support

---

## 3. PORTFOLIO UPLOADING ✓

### Location
- **File**: [app/(admin)/bts-announcements.tsx](app/(admin)/bts-announcements.tsx#L750-L900)
- **Function**: `uploadPortfolio()`
- **Database Table**: `portfolio_items`
- **Storage Bucket**: `media/portfolio/`

### Features
✅ **Media Support**
- Images and videos supported
- Auto-detection of media type

✅ **Functionality**
- Title and description fields
- Category selection
- Featured flag
- Top-rated flag
- Video thumbnail generation (TODO: Currently stubbed)
- Public visibility control

✅ **Error Handling**
- Storage bucket validation
- RLS policy checks
- Network error detection
- Permission validation

✅ **Database Fields**
```tsx
{
  title: string,
  description: string,
  category: string,
  media_url: string,
  image_url: string | null,  // Thumbnail for videos
  media_type: 'image' | 'video',
  is_featured: boolean,
  is_top_rated: boolean,
  is_active: boolean,
  created_by: user_id,
  is_public: boolean (default: true)
}
```

### Status: ✅ WORKING
- All core functionality implemented
- Video thumbnail generation pending
- Flagging system working

---

## 4. COMMON UPLOAD FEATURES

### Storage Configuration
All three features use the **`media`** bucket with public access:
```
media/
├── bts/
│   └── {timestamp}.{ext}
├── announcements/
│   └── {timestamp}.{ext}
├── portfolio/
│   └── {timestamp}.{ext}
├── music/
│   └── {timestamp}.{ext}
└── thumbnails/
    └── {timestamp}_thumbnail.jpg
```

### Common Error Handling
1. **Bucket Not Found**: Guides user to create bucket in Supabase Dashboard
2. **Permission Denied**: Checks RLS policies
3. **Network Errors**: Detects and recommends reconnection
4. **Timeout Errors**: Suggests file size reduction or retry
5. **Database Errors**: Indicates Supabase service issues

### Common Validation
- ✅ File extension extraction
- ✅ MIME type detection
- ✅ File size checking
- ✅ Media type inference (image vs video)
- ✅ Safe file naming (removes special characters)

---

## 5. KNOWN ISSUES & TODOS

### 🔧 Pending Implementations
1. **Video Thumbnail Generation**
   - Currently disabled (returns null gracefully)
   - Requires: `expo-video-thumbnails` or `react-native-create-thumbnail`
   - Affects: BTS Posts, Announcements, Portfolio Items
   - Impact: Videos show no preview image

2. **Music File Metadata**
   - Music files upload successfully
   - Metadata extraction not implemented
   - Duration/format info not stored

### ✅ Working Features
- Image uploads ✓
- Video uploads ✓
- File URL generation ✓
- Database storage ✓
- RLS policy enforcement ✓
- Error messaging ✓
- User feedback ✓

---

## 6. UPLOAD FLOW SUMMARY

### All Three Features Follow This Pattern:
```
1. Validate input (media + title/description)
2. Ensure bucket exists (via Edge Function)
3. Fetch file from device
4. Upload blob to Supabase Storage
5. Get public URL
6. Generate thumbnail (video only) - TODO
7. Insert database record with created_by
8. Clear form and refresh list
9. Show success alert
```

### Error Recovery:
- Network errors → Can retry
- Permission errors → Check RLS
- Bucket not found → Create bucket
- Database errors → Check migrations
- Timeout → Reduce file size or retry

---

## 7. VALIDATION CHECKLIST ✅

- [x] BTS Posts upload working
- [x] Announcements upload working
- [x] Portfolio upload working
- [x] File type detection working
- [x] Storage bucket configuration correct
- [x] Error handling comprehensive
- [x] Database schema compatible
- [x] RLS policies enforced
- [x] User feedback adequate
- [ ] Video thumbnails (TODO)
- [ ] Music metadata (TODO)

---

## 8. RECOMMENDATIONS

### Immediate Actions
1. **Create Supabase Buckets** (if not exists):
   - `media` bucket (public access)

### Near-term Improvements
1. Implement video thumbnail generation
2. Add music metadata extraction
3. Add bulk upload support
4. Add upload progress indicators

### Long-term Enhancements
1. Image optimization/compression
2. Video encoding
3. Metadata preservation
4. Advanced scheduling
5. Content moderation tools

---

## Files Involved
- 📄 [app/(admin)/bts-announcements.tsx](app/(admin)/bts-announcements.tsx) - Main UI & upload logic
- 📄 [services/admin.ts](services/admin.ts) - Backend service methods
- 📄 [contexts/AuthContext.tsx](contexts/AuthContext.tsx) - User authentication
- 📄 Database tables: `bts_posts`, `announcements`, `portfolio_items`

