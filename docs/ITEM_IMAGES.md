# Product images (Backblaze B2)

Product photos are stored in Backblaze B2 via the S3-compatible API and saved on each item as `image_url`.

## Credentials

Backblaze provides two key types:

| Key type | keyID shape | API used |
|----------|-------------|----------|
| **Master Application Key** | Short (e.g. `661d4c5d3f57`) | **B2 Native API** (automatic) |
| **Application Key** (recommended for production) | 25 chars starting with `005` | S3-compatible API |

```env
BACKBLAZE_KEY_ID=661d4c5d3f57
BACKBLAZE_APPLICATION_KEY=your-long-application-key-secret
BACKBLAZE_BUCKET_NAME=kioskke
BACKBLAZE_REGION=us-east-005
# ENDPOINT only required for 25-char S3 application keys:
BACKBLAZE_ENDPOINT=https://s3.us-east-005.backblazeb2.com
```

The Master key **does not work** with the S3 API — the app detects this and uses the B2 Native API instead.

## API

```
POST /api/items/[id]/image
Content-Type: multipart/form-data
file: image (max 5MB, jpeg/png/webp/avif)

DELETE /api/items/[id]/image
```

Requires `manage_items` permission.

## Storage path

`items/{businessId}/{itemId}/{uuid}.{ext}`

## Display

POS Quick Sell, catalog grids, and add-to-cart use `resolveItemImageUrl(item)`:

1. `item.image_url` (uploaded)
2. Built-in name map (`lib/utils/item-images.ts`)

## Admin UI

**Admin → Items → Add/Edit** — “Product photo” section on the last step (new items) or when editing.
