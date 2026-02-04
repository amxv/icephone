# Cloudflare R2 Integration Guide for Next.js

A comprehensive guide to integrating Cloudflare R2 object storage in Next.js applications, based on real production implementation patterns.

## Table of Contents

1. [Setup and Configuration](#1-setup-and-configuration)
2. [Utility Code](#2-utility-code)
3. [Server Actions Usage](#3-server-actions-usage)
4. [Frontend Component Usage](#4-frontend-component-usage)
5. [Integration Patterns](#5-integration-patterns)

---

## 1. Setup and Configuration

### Environment Variables

Create these environment variables in your `.env.local`:

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
```

**Where to find these values:**
- `R2_ACCOUNT_ID`: Cloudflare Dashboard > R2 > Overview (in the URL or sidebar)
- Access keys: Cloudflare Dashboard > R2 > Manage R2 API Tokens > Create API Token

### Package Dependencies

Install the AWS SDK S3 client (R2 is S3-compatible):

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
# or
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**package.json dependencies:**
```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.940.0",
    "@aws-sdk/s3-request-presigner": "^3.940.0"
  }
}
```

### Next.js Configuration

Configure remote image patterns in `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Enable unoptimized for R2 direct URLs (or use a custom loader)
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
  },
};

export default nextConfig;
```

---

## 2. Utility Code

### R2 Client Initialization

**`src/lib/storage/r2.ts`**

```typescript
import { S3Client } from "@aws-sdk/client-s3";

// Initialize S3-compatible client for R2
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Required for R2
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

/**
 * Generate R2 key for user uploads
 * Pattern: uploads/{userId}/{timestamp}-{filename}
 */
export function getUploadKey(
  userId: string,
  filename: string,
  timestamp: number = Date.now()
): string {
  // Sanitize filename to remove special characters
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `uploads/${userId}/${timestamp}-${sanitized}`;
}

/**
 * Generate R2 key for product images
 * Pattern: products/{productId}/{imageIndex}.{ext}
 */
export function getProductImageKey(
  productId: string,
  imageIndex: number,
  extension: string = "png"
): string {
  return `products/${productId}/${imageIndex}.${extension}`;
}

/**
 * Generate R2 key for user avatars
 * Pattern: avatars/{userId}.{ext}
 */
export function getAvatarKey(userId: string, extension: string = "png"): string {
  return `avatars/${userId}.${extension}`;
}
```

### Upload Functions

**`src/lib/storage/upload.ts`**

```typescript
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "./r2";
import { retryWithBackoff } from "../utils/retry";

export interface UploadBufferParams {
  buffer: Buffer;
  key: string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadFromUrlParams {
  url: string;
  key: string;
  contentType: string;
  metadata?: Record<string, string>;
}

/**
 * Upload a buffer directly to R2
 * Use this for server-side uploads where you have the file data
 */
export async function uploadBuffer(params: UploadBufferParams): Promise<string> {
  const { buffer, key, contentType, metadata } = params;

  await retryWithBackoff(
    async () => {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: metadata,
        })
      );
      console.log(`Uploaded to R2: ${key}`);
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
    }
  );

  return key;
}

/**
 * Download from a URL and upload to R2
 * Useful for transferring images from external services (AI generation, CDNs)
 */
export async function uploadFromUrl(params: UploadFromUrlParams): Promise<string> {
  const { url, key, contentType, metadata } = params;

  await retryWithBackoff(
    async () => {
      // Download from URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download from ${url}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Upload to R2
      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: metadata,
        })
      );

      console.log(`Uploaded to R2 from URL: ${key}`);
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
    }
  );

  return key;
}
```

### Download Functions

**`src/lib/storage/download.ts`**

```typescript
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "./r2";
import { retryWithBackoff } from "../utils/retry";

/**
 * Download a file from R2 as a Buffer
 * Useful for server-side processing (image manipulation, PDF generation)
 */
export async function downloadAsBuffer(key: string): Promise<Buffer> {
  const buffer = await retryWithBackoff(
    async () => {
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });

      const response = await r2Client.send(command);

      if (!response.Body) {
        throw new Error(`No body returned for R2 key: ${key}`);
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
    }
  );

  if (!buffer || buffer.length === 0) {
    throw new Error(`Failed to download from R2: ${key} (empty buffer)`);
  }

  return buffer;
}
```

### Presigned URL Functions

**`src/lib/storage/presigned-urls.ts`**

```typescript
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "./r2";

// Expiry times in seconds
const VIEW_EXPIRY = 60 * 60 * 24 * 7; // 7 days
const DOWNLOAD_EXPIRY = 60 * 60; // 1 hour
const UPLOAD_EXPIRY = 60 * 15; // 15 minutes

/**
 * Generate a presigned URL for viewing/downloading a file
 * Default expiry: 7 days
 */
export async function getViewUrl(
  key: string,
  expiresIn: number = VIEW_EXPIRY
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading with shorter expiry
 * Default expiry: 1 hour
 */
export async function getDownloadUrl(
  key: string,
  expiresIn: number = DOWNLOAD_EXPIRY
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a presigned URL for direct client-side uploads
 * Default expiry: 15 minutes
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = UPLOAD_EXPIRY
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate presigned URLs for multiple keys in parallel
 */
export async function getViewUrls(keys: string[]): Promise<Map<string, string>> {
  const urlPromises = keys.map(async (key) => {
    const url = await getViewUrl(key);
    return { key, url };
  });

  const results = await Promise.all(urlPromises);

  const urlMap = new Map<string, string>();
  for (const { key, url } of results) {
    urlMap.set(key, url);
  }

  return urlMap;
}
```

### Retry Utility

**`src/lib/utils/retry.ts`**

```typescript
export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
}

/**
 * Retry a function with exponential backoff
 * Default: 3 attempts with 1s initial delay (1s -> 2s -> 4s)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000 } = options;

  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Calculate delay with exponential backoff (1s, 2s, 4s)
      const delay = initialDelay * Math.pow(2, attempt - 1);

      console.log(
        `Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`,
        error instanceof Error ? error.message : error
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### Barrel Export

**`src/lib/storage/index.ts`**

```typescript
// R2 Storage utilities
// All R2 operations should be performed server-side only

export {
  r2Client,
  R2_BUCKET_NAME,
  getUploadKey,
  getProductImageKey,
  getAvatarKey,
} from "./r2";

export { uploadBuffer, uploadFromUrl } from "./upload";
export type { UploadBufferParams, UploadFromUrlParams } from "./upload";

export { downloadAsBuffer } from "./download";

export {
  getViewUrl,
  getDownloadUrl,
  getUploadUrl,
  getViewUrls,
} from "./presigned-urls";
```

---

## 3. Server Actions Usage

### Pattern 1: Direct Server-Side Upload (FormData)

Best for: Admin uploads, CMS content, where file goes through server.

**`src/actions/admin/brands.ts`**

```typescript
'use server';

import { uploadBuffer, getViewUrl } from '@/lib/storage';

export async function uploadBrandLogo(
  brandId: string,
  formData: FormData
): Promise<{ success: boolean; data?: { logoKey: string; logoUrl: string }; error?: string }> {
  try {
    // 1. Validate user role (example with auth)
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || session.user.role !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }

    // 2. Get file from FormData
    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    // 3. Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      return { success: false, error: 'Invalid file type. Use JPG, PNG, WebP, or SVG.' };
    }

    // 4. Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: 'File too large. Maximum size is 2MB.' };
    }

    // 5. Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // 6. Generate storage key
    const extension = file.name.split('.').pop() || 'png';
    const logoKey = `brands/${brandId}/logo.${extension}`;

    // 7. Upload to R2
    await uploadBuffer({
      buffer,
      key: logoKey,
      contentType: file.type,
    });

    // 8. Update database with logo key
    await db
      .update(brands)
      .set({ logoKey, updatedAt: new Date() })
      .where(eq(brands.id, brandId));

    // 9. Get view URL for immediate display
    const logoUrl = await getViewUrl(logoKey);

    return { success: true, data: { logoKey, logoUrl } };
  } catch (error) {
    console.error('Error uploading brand logo:', error);
    return { success: false, error: 'Failed to upload logo' };
  }
}
```

### Pattern 2: Presigned URL for Client-Side Upload

Best for: Large files, user uploads, where you want to bypass server bandwidth.

**`src/actions/supplier/products.ts`**

```typescript
'use server';

import { getUploadUrl, getProductImageKey } from '@/lib/storage';

/**
 * Get presigned URL for product image upload
 * Client will upload directly to R2 using this URL
 */
export async function getProductImageUploadUrl(
  productId: string,
  imageIndex: number,
  contentType: string
): Promise<{ success: boolean; data?: { uploadUrl: string; imageKey: string }; error?: string }> {
  try {
    // 1. Validate user authorization
    const supplierProfile = await getSupplierProfile();
    if (!supplierProfile) {
      return { success: false, error: 'Unauthorized' };
    }

    // 2. Get file extension from content type
    const extension = contentType.split('/')[1] || 'jpg';

    // 3. Generate storage key
    const imageKey = getProductImageKey(productId, imageIndex, extension);

    // 4. Generate presigned upload URL (15 min expiry by default)
    const uploadUrl = await getUploadUrl(imageKey, contentType);

    return {
      success: true,
      data: { uploadUrl, imageKey },
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return { success: false, error: 'Failed to generate upload URL' };
  }
}
```

### Pattern 3: Upload from External URL

Best for: AI-generated images, migrating content from other services.

**`src/actions/admin/content.ts`**

```typescript
'use server';

import { uploadFromUrl, getViewUrl } from '@/lib/storage';

export async function generateHeroBannerWithAI(prompt: string): Promise<{
  success: boolean;
  data?: { mediaKey: string; mediaUrl: string };
  error?: string;
}> {
  try {
    // 1. Call AI service to generate image
    const result = await executeAIImageGeneration({ prompt });

    if (!result.output?.imageUrl) {
      return { success: false, error: 'Image generation failed' };
    }

    // 2. Generate unique key for the new image
    const bannerId = nanoid();
    const newMediaKey = `banners/hero/ai-${bannerId}.png`;

    // 3. Download from AI service and upload to R2
    await uploadFromUrl({
      url: result.output.imageUrl,
      key: newMediaKey,
      contentType: 'image/png',
      metadata: {
        source: 'ai-generated',
        prompt: prompt.slice(0, 200), // Truncate for metadata
      },
    });

    // 4. Get view URL
    const newMediaUrl = await getViewUrl(newMediaKey);

    return {
      success: true,
      data: { mediaKey: newMediaKey, mediaUrl: newMediaUrl },
    };
  } catch (error) {
    console.error('Error generating banner:', error);
    return { success: false, error: 'Failed to generate banner' };
  }
}
```

### Pattern 4: Delete Object from R2

**`src/actions/ai/kid-photos.ts`**

```typescript
'use server';

import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from '@/lib/storage/r2';

export async function deleteKidPhoto(kidName: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 1. Find the photo record
    const [photo] = await db
      .select()
      .from(kidPhotos)
      .where(
        and(
          eq(kidPhotos.userId, user.id),
          eq(kidPhotos.kidName, kidName)
        )
      );

    if (!photo) {
      return { success: false, error: 'Photo not found' };
    }

    // 2. Delete from R2
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: photo.imageKey,
      })
    );

    // 3. Delete from database
    await db.delete(kidPhotos).where(eq(kidPhotos.id, photo.id));

    return { success: true };
  } catch (error) {
    console.error('Error deleting photo:', error);
    return { success: false, error: 'Failed to delete photo' };
  }
}
```

---

## 4. Frontend Component Usage

### Client-Side Image Optimization Utility

**`src/lib/utils/image-optimization.ts`**

```typescript
/**
 * Client-side image optimization utility
 * Converts images to WebP format with compression
 */

interface OptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 for WebP compression
}

const DEFAULT_OPTIONS: OptimizeOptions = {
  maxWidth: 2400,
  maxHeight: 2400,
  quality: 0.75,
};

/**
 * Optimizes an image file by converting to WebP and optionally resizing
 */
export async function optimizeImage(
  file: File,
  options: OptimizeOptions = {}
): Promise<File> {
  const { maxWidth, maxHeight, quality } = { ...DEFAULT_OPTIONS, ...options };

  // If already WebP and under 1MB, skip optimization
  if (file.type === 'image/webp' && file.size < 1024 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;

      if (maxWidth && width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (maxHeight && height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      // Round to avoid subpixel issues
      width = Math.round(width);
      height = Math.round(height);

      canvas.width = width;
      canvas.height = height;

      // Use better image smoothing for downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw the image
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to WebP
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert image to WebP'));
            return;
          }

          // Generate new filename with .webp extension
          const originalName = file.name.replace(/\.[^/.]+$/, '');
          const newFile = new File([blob], `${originalName}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });

          // Clean up
          URL.revokeObjectURL(img.src);
          resolve(newFile);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    // Load the image from the file
    img.src = URL.createObjectURL(file);
  });
}
```

### Image Upload Component with Presigned URLs

**`src/components/supplier/products/image-upload.tsx`** (simplified)

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { getProductImageUploadUrl } from '@/actions/supplier/products';
import { optimizeImage } from '@/lib/utils/image-optimization';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';

export interface ImageItem {
  id?: string;
  imageKey: string;
  displayOrder: number;
  previewUrl?: string;
}

interface ImageUploadProps {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  productId?: string;
  maxImages?: number;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function ImageUpload({
  images,
  onChange,
  productId,
  maxImages = 6,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Invalid file type. Please use JPG, PNG, or WebP.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 20MB.';
    }
    return null;
  };

  const uploadFile = useCallback(async (file: File, index: number): Promise<ImageItem | null> => {
    try {
      // 1. Optimize image (convert to WebP, resize if needed)
      const optimizedFile = await optimizeImage(file);
      const contentType = optimizedFile.type;
      const tempProductId = productId || `temp-${nanoid()}`;

      // 2. Get presigned upload URL from server
      const result = await getProductImageUploadUrl(tempProductId, index, contentType);

      if (!result.success || !result.data) {
        toast.error(result.error || 'Failed to get upload URL');
        return null;
      }

      const { uploadUrl, imageKey } = result.data;

      // 3. Upload directly to R2 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: optimizedFile,
        headers: {
          'Content-Type': contentType,
        },
      });

      if (!uploadResponse.ok) {
        toast.error(`Upload failed: ${uploadResponse.status}`);
        return null;
      }

      // 4. Create local preview URL
      const previewUrl = URL.createObjectURL(optimizedFile);

      return {
        imageKey,
        displayOrder: index,
        previewUrl,
      };
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed');
      return null;
    }
  }, [productId]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = maxImages - images.length;

    if (fileArray.length > remainingSlots) {
      toast.error(`Can only upload ${remainingSlots} more image(s)`);
      fileArray.splice(remainingSlots);
    }

    // Validate files
    const validFiles: File[] = [];
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) return;

    setUploading(true);

    // Upload files in parallel
    const startIndex = images.length;
    const uploadPromises = validFiles.map((file, i) => uploadFile(file, startIndex + i));
    const results = await Promise.all(uploadPromises);

    // Update state with successful uploads
    const successfulUploads = results.filter((r): r is ImageItem => r !== null);

    if (successfulUploads.length > 0) {
      onChange([...images, ...successfulUploads]);
      toast.success(`${successfulUploads.length} image(s) uploaded`);
    }

    setUploading(false);
  }, [images, maxImages, onChange, uploadFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />
        <p>Click or drag to upload images</p>
        <p className="text-sm text-muted-foreground">
          {images.length} / {maxImages} images
        </p>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-3 gap-4">
        {images.map((image, index) => (
          <div key={image.imageKey} className="relative aspect-square">
            {image.previewUrl && (
              <Image
                src={image.previewUrl}
                alt={`Image ${index + 1}`}
                fill
                className="object-cover rounded-lg"
              />
            )}
          </div>
        ))}
      </div>

      {uploading && <p>Uploading...</p>}
    </div>
  );
}
```

### Customer Photo Upload Component

**`src/components/customer/KidPhotosManager.tsx`** (simplified flow)

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import {
  getKidPhotoUploadUrl,
  confirmKidPhotoUpload,
  deleteKidPhoto,
} from '@/actions/ai/kid-photos';
import { toast } from 'sonner';

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function KidPhotosManager({ initialPhotos }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File, kidName: string) => {
    const normalizedName = kidName.toLowerCase().trim().replace(/\s+/g, '-');

    try {
      // 1. Get presigned upload URL
      const result = await getKidPhotoUploadUrl(normalizedName);

      if (!result.success || !result.data) {
        toast.error(result.error || 'Failed to get upload URL');
        return false;
      }

      const { uploadUrl, imageKey } = result.data;

      // 2. Convert to PNG if needed (for consistency)
      let uploadFile = file;
      if (file.type !== 'image/png') {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new window.Image();

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            resolve();
          };
          img.onerror = reject;
          img.src = URL.createObjectURL(file);
        });

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );

        if (blob) {
          uploadFile = new File([blob], `${normalizedName}.png`, { type: 'image/png' });
        }
      }

      // 3. Upload to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: uploadFile,
        headers: { 'Content-Type': 'image/png' },
      });

      if (!uploadResponse.ok) {
        toast.error('Failed to upload photo');
        return false;
      }

      // 4. Confirm upload (create/update database record)
      const confirmResult = await confirmKidPhotoUpload(normalizedName, imageKey);

      if (!confirmResult.success || !confirmResult.data) {
        toast.error(confirmResult.error || 'Failed to save photo');
        return false;
      }

      // 5. Update local state
      setPhotos((prev) => [...prev, confirmResult.data!]);
      toast.success(`Photo added for ${normalizedName}`);
      return true;
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload photo');
      return false;
    }
  }, []);

  // ... rest of component
}
```

---

## 5. Integration Patterns

### Database Record + R2 Key Pattern

Store the R2 key (not the full URL) in your database. Generate presigned URLs on demand.

**Schema Example (Drizzle):**

```typescript
export const products = pgTable('products', {
  id: varchar('id', { length: 21 }).primaryKey(),
  titleEn: varchar('title_en', { length: 255 }).notNull(),
  // ... other fields
});

export const productImages = pgTable('product_images', {
  id: varchar('id', { length: 21 }).primaryKey(),
  productId: varchar('product_id', { length: 21 })
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  imageKey: varchar('image_key', { length: 500 }).notNull(), // R2 key
  altTextEn: text('alt_text_en'),
  displayOrder: integer('display_order').default(0),
});
```

**Fetching with URLs:**

```typescript
export async function getProductWithImages(productId: string) {
  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(productImages.displayOrder);

  // Generate presigned URLs for all images
  const imagesWithUrls = await Promise.all(
    images.map(async (img) => ({
      ...img,
      imageUrl: await getViewUrl(img.imageKey),
    }))
  );

  return {
    ...product[0],
    images: imagesWithUrls,
  };
}
```

### Cleanup Pattern: Delete Old Files When Updating

When updating a record, delete the old R2 object if the key changes:

```typescript
export async function updateUserPhoto(userId: string, newImageKey: string) {
  // 1. Get existing record
  const [existing] = await db
    .select()
    .from(userPhotos)
    .where(eq(userPhotos.userId, userId));

  // 2. Delete old image from R2 if key changed
  if (existing && existing.imageKey !== newImageKey) {
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: existing.imageKey,
        })
      );
    } catch (deleteError) {
      console.error('Failed to delete old image:', deleteError);
      // Continue anyway - not critical
    }
  }

  // 3. Update database
  await db
    .update(userPhotos)
    .set({ imageKey: newImageKey, updatedAt: new Date() })
    .where(eq(userPhotos.userId, userId));
}
```

### Key Naming Conventions

Organize your R2 bucket with consistent key patterns:

```
products/{productId}/{imageIndex}.webp     # Product images
brands/{brandId}/logo.png                   # Brand logos
banners/hero/{bannerId}.png                 # Hero banners
banners/promo/{bannerId}.png                # Promotional banners
avatars/{userId}.png                        # User avatars
kid-photos/{userId}/{kidName}.png           # User kid photos
try-on-results/{userId}/{nanoid}.png        # AI try-on results
uploads/{userId}/{timestamp}-{filename}     # Generic user uploads
```

### Error Handling Best Practices

```typescript
export async function safeGetViewUrl(imageKey: string | null): Promise<string | null> {
  if (!imageKey) return null;

  try {
    return await getViewUrl(imageKey);
  } catch (error) {
    console.error(`Failed to get view URL for ${imageKey}:`, error);
    return null; // Return null instead of crashing
  }
}
```

---

## Summary

This guide covers:

1. **Setup**: R2 client initialization with AWS SDK S3 compatibility
2. **Server utilities**: Upload, download, presigned URLs with retry logic
3. **Server actions**: Four patterns for different upload scenarios
4. **Frontend components**: Client-side optimization, presigned URL uploads
5. **Integration patterns**: Database + R2 key storage, cleanup, naming conventions

Key takeaways:
- Use presigned URLs for client-side uploads to reduce server bandwidth
- Store R2 keys (not URLs) in your database
- Generate presigned view URLs on demand with appropriate expiry times
- Use retry logic for reliability
- Optimize images on the client before upload
- Clean up old R2 objects when updating records
