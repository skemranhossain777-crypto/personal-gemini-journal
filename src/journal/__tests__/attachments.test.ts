import { describe, expect, it } from 'vitest';
import { pathFromStorageUrl } from '../attachments';

describe('pathFromStorageUrl', () => {
  it('decodes the object path from a Firebase Storage URL', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/users%2Fu1%2Fattachments%2Fabc?alt=media&token=x';
    expect(pathFromStorageUrl(url)).toBe('users/u1/attachments/abc');
  });

  it('handles non-GCS URLs as external (null)', () => {
    expect(pathFromStorageUrl('https://example.com/photo.jpg')).toBeNull();
    expect(pathFromStorageUrl('not-a-url')).toBeNull();
    expect(pathFromStorageUrl('')).toBeNull();
  });
});
