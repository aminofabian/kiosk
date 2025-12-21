# S3 Banner Image Management

## Overview

Banner images are stored on AWS S3 and their metadata is stored in the `business.settings` JSON field. This allows businesses to upload custom banners for their storefronts.

## Environment Variables

Add these to your `.env.local` file (server-side only):

```env
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET_NAME=your-bucket-name
```

## Banner Types

1. **Homepage** - Displayed on the homepage
2. **Category** - Displayed for specific categories
3. **Promo** - Date-limited promotional banners

## API Endpoints

### Upload Banner

```
POST /api/businesses/[id]/banners
Content-Type: multipart/form-data

Form fields:
- file: File (required) - Image file (max 5MB, jpeg/png/webp/avif)
- title: string (optional)
- alt: string (optional)
- type: 'homepage' | 'category' | 'promo' (required)
- categoryId: string (required if type='category')
- startDate: string (optional) - ISO date string
- endDate: string (optional) - ISO date string
```

### Get Banners

```
GET /api/businesses/[id]/banners

Returns:
{
  success: true,
  data: {
    all: Banner[],
    active: Banner[] // Filtered by active status and date range
  }
}
```

### Update Banner

```
PUT /api/businesses/[id]/banners/[bannerId]

Body:
{
  title?: string,
  alt?: string,
  active?: boolean,
  position?: number,
  startDate?: string,
  endDate?: string
}
```

### Delete Banner

```
DELETE /api/businesses/[id]/banners/[bannerId]
```

## Banner Storage Structure

S3 path: `banners/{businessId}/{uuid}.{ext}`

Example: `banners/abc-123/xyz-456.jpg`

URL format: `https://alexawriters.s3.eu-north-1.amazonaws.com/banners/{businessId}/{uuid}.{ext}`

## Banner Data Structure

```typescript
interface Banner {
  id: string;
  url: string; // S3 URL
  s3Key: string; // S3 key for deletion
  title?: string;
  alt?: string;
  type: 'homepage' | 'category' | 'promo';
  categoryId?: string;
  categoryName?: string;
  startDate?: number; // Unix timestamp
  endDate?: number; // Unix timestamp
  active: boolean;
  position: number; // Sort order
  createdAt: number; // Unix timestamp
}
```

## Usage Examples

### Upload a Homepage Banner

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('type', 'homepage');
formData.append('title', 'Welcome Banner');
formData.append('alt', 'Welcome to our store');

const response = await fetch(`/api/businesses/${businessId}/banners`, {
  method: 'POST',
  body: formData,
});
```

### Get Active Homepage Banners

```typescript
import { getHomepageBanners } from '@/lib/utils/banners';

const business = await getBusiness(businessId);
const bannersData = parseBusinessBanners(business.settings);
const homepageBanners = getHomepageBanners(bannersData.banners);
```

### Display Banner in Component

```tsx
import Image from 'next/image';

{banner && (
  <Image
    src={banner.url}
    alt={banner.alt || banner.title || 'Banner'}
    width={1200}
    height={400}
    className="w-full h-auto"
  />
)}
```

## Security

- Only users with `business_settings` permission can manage banners
- Business ID is verified to match the authenticated user's business
- File size limited to 5MB
- Only image file types allowed (jpeg, png, webp, avif)
- Files are stored with public-read ACL for direct access

## Notes

- When a banner is deleted, the S3 object is also deleted
- Banner positions are automatically re-indexed when banners are deleted
- Promo banners are automatically filtered by date range
- The system supports multiple banners per type, ordered by position
