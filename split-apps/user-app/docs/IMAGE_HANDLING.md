# Image Handling & Gallery Architecture

## Overview
This document outlines the architecture for image handling in the Admin Gallery section, including optimizations for performance, caching, and user experience.

## Key Features

### 1. Two-Tier Loading
- **Thumbnails**: The grid view uses `expo-image` to load optimized images. Currently, we use the `watermarked` variant which is suitable for preview.
- **Full Resolution**: (Future) When tapping a photo, a higher resolution version can be loaded.
- **Caching**: `expo-image` is configured with `cachePolicy="memory-disk"` to cache images locally, reducing network usage and speeding up subsequent loads.

### 2. Pagination & Infinite Scroll
- **Batch Fetching**: Photos are fetched in batches (default 50) using `AdminService.gallery.getPhotos`.
- **Infinite Scroll**: The `FlatList` component triggers `onEndReached` to load the next page of photos automatically.
- **State Management**: 
  - `page`: Tracks current page index.
  - `hasMore`: Boolean flag to stop fetching when no more photos exist.
  - `loadingMore`: Prevents duplicate requests during scroll.

### 3. Batch Gallery Queries
- **Multi-Gallery Support**: The `getPhotos` service now accepts an array of `gallery_id`s. This allows viewing all photos from a client across multiple galleries in a single unified stream.
- **Supabase Query**: Uses `.in('gallery_id', ids)` for efficient batch retrieval.

### 4. Image Security
- **Signed URLs**: All images are accessed via Supabase Storage Signed URLs with a 1-hour expiry.
- **Dynamic Signing**: URLs are signed in batches corresponding to the pagination page, ensuring fresh tokens without overwhelming the server.

### 5. UI/UX Optimizations
- **Transitions**: Images fade in (`transition={200}`) for a smooth experience.
- **Placeholders**: Client avatars use a fallback placeholder if `avatar_url` is missing.
- **Loading States**: Activity indicators show initial load and pagination progress.
- **Batch Actions**: A floating action bar allows bulk operations (Mark Paid/Unpaid) on selected photos.

## Data Schema

### `photos` Table
- `id`: UUID
- `gallery_id`: UUID (Foreign Key)
- `storage_path`: String (Path in Supabase Storage)
- `variant`: String ('watermarked' | 'original' | 'thumbnail')
- `created_at`: Timestamp

### `user_profiles` Table
- `id`: UUID (matches auth.users.id)
- `avatar_url`: String (Public URL or Storage Path)

## Testing
- Unit tests for pagination logic are located in `__tests__/admin-gallery-pagination.test.tsx`.
- Manual testing should verify:
  - Infinite scroll loads more photos.
  - Pull-to-refresh resets the list.
  - Batch actions update UI and Database.
  - Images load with caching behavior.
