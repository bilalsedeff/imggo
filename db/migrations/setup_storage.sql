-- ============================================================================
-- Setup Storage Bucket for Images
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Verify/Update the images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  false,  -- Private bucket
  52428800,  -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- ✅ DONE!
-- ============================================================================
-- Note: Storage RLS policies cannot be created via SQL in Supabase SQL Editor
-- They must be configured via Dashboard UI:
--
-- 1. Go to: Storage > Policies
-- 2. Click "Create Policy" for 'objects' table
-- 3. Use the policy templates provided below
-- ============================================================================

SELECT '✅ Storage bucket verified!' AS status;
SELECT
  'Bucket: ' || name ||
  ' | Public: ' || public ||
  ' | Size: ' || (file_size_limit / 1048576) || 'MB' AS info
FROM storage.buckets WHERE id = 'images';

-- ============================================================================
-- MANUAL POLICY SETUP (Copy these to Dashboard if needed)
-- ============================================================================
/*
Storage > Policies > New Policy for "objects" table:

1. INSERT Policy - "Users can upload to own folder"
   Target roles: authenticated
   WITH CHECK expression:
   bucket_id = 'images' AND (auth.uid())::text = (storage.foldername(name))[1]

2. SELECT Policy - "Users can read own files"
   Target roles: authenticated
   USING expression:
   bucket_id = 'images' AND (auth.uid())::text = (storage.foldername(name))[1]

3. UPDATE Policy - "Users can update own files"
   Target roles: authenticated
   USING & WITH CHECK expression:
   bucket_id = 'images' AND (auth.uid())::text = (storage.foldername(name))[1]

4. DELETE Policy - "Users can delete own files"
   Target roles: authenticated
   USING expression:
   bucket_id = 'images' AND (auth.uid())::text = (storage.foldername(name))[1]
*/
