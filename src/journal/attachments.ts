import type { FirebaseStorage } from 'firebase/storage';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getAuthInstance, getStorageInstance } from '../services/firebase';
import type { Attachment } from '../data';

/**
 * Upload/purge of attachment blobs (images, voice notes, files) for the
 * current user. Files live under `users/{uid}/attachments/{id}` in Cloud
 * Storage; the Firestore `Attachment` record (id/kind/url/caption/createdAt) is
 * written by the caller as part of the entry draft.
 *
 * Storage is optional at runtime: if Firebase Storage is unavailable, uploads
 * fail with a descriptive `DataError`-shaped error so the UI can toast instead
 * of silently dropping the file (the editor stays fully usable without it).
 */
export interface AttachmentStore {
  upload(file: File, kind: Attachment['kind']): Promise<Attachment>;
  remove(attachment: Attachment): Promise<void>;
}

export function createFirebaseAttachmentStore(storage: FirebaseStorage | null = null): AttachmentStore {
  return {
    async upload(file, kind) {
      const activeStorage = storage ?? getStorageInstance();
      const uid = getAuthInstance().currentUser?.uid;
      if (!uid) throw new Error('Sign in to attach files.');
      if (file.size === 0) throw new Error('That file is empty.');
      const id = genId();
      const fileRef = ref(activeStorage, `users/${uid}/attachments/${id}`);
      try {
        await uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' });
        const url = await getDownloadURL(fileRef);
        return { id, kind, url, caption: undefined, createdAt: new (await import('firebase/firestore')).Timestamp(Math.floor(Date.now() / 1000), 0) };
      } catch (err) {
        throw new Error(`Upload failed: ${(err as { message?: string }).message ?? 'unknown error'}.`);
      }
    },

    async remove(attachment) {
      if (!attachment.url) return;
      const activeStorage = storage ?? getStorageInstance();
      const path = pathFromStorageUrl(attachment.url);
      if (!path) return; // external URL (e.g. a pasted link) — nothing to purge
      try {
        await deleteObject(ref(activeStorage, path));
      } catch {
        // Purging is best-effort; the attachment record is removed regardless.
      }
    },
  };
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** `/users/{uid}/attachments/{id}` from a Firebase Storage URL, or null for
 * host-agnostic/external URLs (nothing to purge there). */
export function pathFromStorageUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/firebasestorage\.googleapis\.com$/.test(u.hostname) && !u.hostname.startsWith('firebasestorage.googleapis.com')) {
      return null;
    }
    const decoded = decodeURIComponent(u.pathname);
    const marker = '/o/';
    const idx = decoded.indexOf(marker);
    if (idx === -1) return null;
    return decoded.slice(idx + marker.length).replace(/[?#].*$/, '');
  } catch {
    return null;
  }
}
