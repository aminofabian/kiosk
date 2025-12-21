# Banner Image S3 Implementation Summary

## ✅ What Was Implemented

### 1. AWS S3 Integration
- ✅ Installed `@aws-sdk/client-s3` package
- ✅ Created S3 utility functions (`lib/aws/s3.ts`)
  - `uploadBannerToS3()` - Upload images to S3
  - `deleteBannerFromS3()` - Delete images from S3
  - `extractS3KeyFromUrl()` - Extract S3 key from URL for deletion

### 2. Banner Type System
- ✅ Created banner types (`lib/types/banner.ts`)
  - Banner interface with all metadata
  - BusinessBanners interface for settings JSON
  - Parse/serialize functions for business settings

### 3. Banner Management API
- ✅ `POST /api/businesses/[id]/banners` - Upload banner
- ✅ `GET /api/businesses/[id]/banners` - Get all/active banners
- ✅ `PUT /api/businesses/[id]/banners/[bannerId]` - Update banner
- ✅ `DELETE /api/businesses/[id]/banners/[bannerId]` - Delete banner

### 4. Banner Utilities
- ✅ `lib/utils/banners.ts` - Helper functions
  - `getActiveBanners()` - Filter active banners by date
  - `getHomepageBanners()` - Get homepage banners
  - `getCategoryBanners()` - Get category-specific banners
  - `getPromoBanners()` - Get promotional banners

### 5. Configuration
- ✅ Updated `next.config.ts` to allow S3 image domains
- ✅ Created `.env.example` documentation
- ✅ Created comprehensive documentation (`S3_BANNERS.md`)

## 🎯 Features

### Banner Types
1. **Homepage** - Displayed on storefront homepage
2. **Category** - Category-specific banners
3. **Promo** - Date-limited promotional banners

### Metadata Stored
- Title, alt text
- Type (homepage/category/promo)
- Category association (for category banners)
- Date range (startDate/endDate for promo banners)
- Position (sort order)
- Active status
- S3 URL and key

### Security
- Permission-based access (`business_settings` permission required)
- Business ID verification
- File size validation (max 5MB)
- File type validation (images only)
- Server-side uploads only

## 📋 Setup Instructions

### 1. Environment Variables

Add to `.env.local`:

```env
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET_NAME=your-bucket-name
```

### 2. S3 Bucket Configuration

Ensure your S3 bucket (`alexawriters`) has:
- Public read access for uploaded images (or use CloudFront CDN)
- Proper CORS settings if needed
- Lifecycle policies if you want automatic cleanup of old banners

### 3. Test Upload

```typescript
const formData = new FormData();
formData.append('file', imageFile);
formData.append('type', 'homepage');
formData.append('title', 'Welcome Banner');

const response = await fetch(`/api/businesses/${businessId}/banners`, {
  method: 'POST',
  body: formData,
});
```

## 🔧 Usage in Components

### Display Homepage Banners

```tsx
import { getHomepageBanners } from '@/lib/utils/banners';
import { parseBusinessBanners } from '@/lib/types/banner';
import Image from 'next/image';

const bannersData = parseBusinessBanners(business.settings);
const homepageBanners = getHomepageBanners(bannersData.banners);

{homepageBanners.map((banner) => (
  <Image
    key={banner.id}
    src={banner.url}
    alt={banner.alt || banner.title || 'Banner'}
    width={1200}
    height={400}
    className="w-full"
  />
))}
```

## 📁 File Structure

```
lib/
  aws/
    s3.ts              # S3 upload/delete functions
  types/
    banner.ts          # Banner type definitions
  utils/
    banners.ts         # Banner filtering helpers

app/api/businesses/
  [id]/
    banners/
      route.ts         # POST (upload), GET (list)
      [bannerId]/
        route.ts       # PUT (update), DELETE
```

## 🚨 Important Notes

1. **ACL Permissions**: The code uses `ACL: 'public-read'`. If your bucket doesn't allow ACLs, remove this and use bucket policies instead.

2. **CORS**: If uploading directly from browser in future, ensure S3 bucket has proper CORS configuration.

3. **Costs**: Monitor S3 storage costs. Consider lifecycle policies to archive/delete old banners.

4. **CDN**: For better performance, consider using CloudFront in front of S3.

5. **Image Optimization**: Consider adding image optimization/resizing before upload to reduce storage costs.

## 🔄 Next Steps

1. **Create UI Components** - Banner upload/management interface in admin panel
2. **Display Banners** - Integrate banner display in storefront
3. **Image Optimization** - Add server-side image processing (sharp, etc.)
4. **CDN Integration** - Set up CloudFront for faster image delivery
5. **Bulk Operations** - Add endpoints for bulk banner operations

## 📚 Documentation

- See `S3_BANNERS.md` for detailed API documentation
- See code comments in `lib/aws/s3.ts` for S3 utility usage
