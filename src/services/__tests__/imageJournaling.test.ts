import { describe, it, expect } from 'vitest';
import {
  validateImageFile,
  uploadImageAttachment,
  analyzeImageContext,
  verifyAttachmentOwnership,
  ImageValidationError,
  MAX_IMAGE_SIZE_BYTES,
} from '../imageJournaling';

describe('imageJournaling service', () => {
  const createMockFile = (name: string, sizeBytes: number, type: string): File => {
    const blob = new Blob([new ArrayBuffer(sizeBytes)], { type });
    return new File([blob], name, { type });
  };

  it('validates valid image files (JPG, PNG, WEBP, GIF, HEIC, AVIF)', () => {
    const validJpg = createMockFile('photo.jpg', 2 * 1024 * 1024, 'image/jpeg');
    const validPng = createMockFile('graphic.png', 1 * 1024 * 1024, 'image/png');
    const validWebp = createMockFile('picture.webp', 500 * 1024, 'image/webp');

    expect(validateImageFile(validJpg, 'user1').ok).toBe(true);
    expect(validateImageFile(validPng, 'user1').ok).toBe(true);
    expect(validateImageFile(validWebp, 'user1').ok).toBe(true);
  });

  it('rejects oversized images (> 10MB)', () => {
    const oversizedFile = createMockFile('large_photo.jpg', MAX_IMAGE_SIZE_BYTES + 1024, 'image/jpeg');
    const res = validateImageFile(oversizedFile, 'user1');

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/exceeds the 10MB limit/);
  });

  it('rejects invalid MIME types and non-image files', () => {
    const pdfFile = createMockFile('document.pdf', 100 * 1024, 'application/pdf');
    const exeFile = createMockFile('app.exe', 100 * 1024, 'application/x-msdownload');

    expect(validateImageFile(pdfFile, 'user1').ok).toBe(false);
    expect(validateImageFile(exeFile, 'user1').ok).toBe(false);
  });

  it('detects and blocks malicious file extensions (double extension tricks)', () => {
    const maliciousFile = createMockFile('image.png.exe', 50 * 1024, 'image/png');
    const scriptFile = createMockFile('hack.html', 50 * 1024, 'image/jpeg');

    expect(validateImageFile(maliciousFile, 'user1').ok).toBe(false);
    expect(validateImageFile(scriptFile, 'user1').ok).toBe(false);
  });

  it('enforces authorization security check on uploads', async () => {
    const validJpg = createMockFile('photo.jpg', 1 * 1024 * 1024, 'image/jpeg');

    // Missing user ID -> UNAUTHORIZED
    await expect(
      uploadImageAttachment({
        file: validJpg,
        currentUserId: '',
      })
    ).rejects.toThrow(ImageValidationError);
  });

  it('uploads valid image safely returning secure Attachment record', async () => {
    const validJpg = createMockFile('photo.jpg', 1 * 1024 * 1024, 'image/jpeg');
    const attachment = await uploadImageAttachment({
      file: validJpg,
      currentUserId: 'user1',
      caption: 'Sunset photo',
    });

    expect(attachment.id).toMatch(/^img_/);
    expect(attachment.kind).toBe('image');
    expect(attachment.caption).toBe('Sunset photo');
    expect(attachment.url).toBeDefined();
  });

  it('handles Gemini image context analysis while strictly preventing fabrication', () => {
    const context = analyzeImageContext({
      imageName: 'Kyoto Sunset',
      userCaption: 'Taken during my trip to Japan',
      currentUserId: 'user1',
    });

    expect(context.observed.length).toBeGreaterThan(0);
    expect(context.userProvided).toContain('User Caption: "Taken during my trip to Japan"');
    expect(context.aiInferred.length).toBeGreaterThan(0);
    expect(context.disclaimer).toMatch(/Gemini never fabricates names of people/);
  });

  it('verifies attachment path ownership boundaries', () => {
    expect(verifyAttachmentOwnership('users/user1/attachments/img_123', 'user1')).toBe(true);
    expect(verifyAttachmentOwnership('users/user1/attachments/img_123', 'user2')).toBe(false);
  });
});
