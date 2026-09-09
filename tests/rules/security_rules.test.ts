// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';

const PROJECT_ID = 'demo-firestore-rules';
const OWNER = 'alice';
const INTRUDER = 'mallory';

const here = dirname(fileURLToPath(import.meta.url));
const rulesText = readFileSync(resolve(here, '../../firestore.rules'), 'utf8');

const ts = () => Timestamp.fromMillis(1_700_000_000_000);

interface Fixture {
  name: string;
  docId: string;
  allowUpdate: boolean;
  breakKey: string;
  breakValue: unknown;
  build(uid: string): Record<string, unknown>;
  patch(): Record<string, unknown>;
}

const FIXTURES: Fixture[] = [
  {
    name: 'journalEntries',
    docId: 'entry-1',
    allowUpdate: true,
    breakKey: 'mode',
    breakValue: 'bogus',
    build: (uid) => ({
      id: 'entry-1',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      title: 'A quiet morning',
      body: 'Notes for today.',
      mode: 'free-write',
      mood: null,
      energy: null,
      tags: ['morning'],
      location: null,
      attachments: [],
      favorite: false,
      archived: false,
      private: false,
      aiMetadata: {
        summary: 'Reflecting on a quiet morning.',
        suggestedTags: ['morning'],
        emotion: 'calm',
        generatedBy: 'gemini',
        modality: 'image',
        transcript: '',
        modelUsed: 'gemini-3.6-flash',
      },
    }),
    patch: () => ({ title: 'A revised morning' }),
  },
  {
    name: 'memories',
    docId: 'mem-1',
    allowUpdate: true,
    breakKey: 'title',
    breakValue: '',
    build: (uid) => ({
      id: 'mem-1',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      type: 'lesson',
      title: 'First coffee',
      narrative: 'A short narrative.',
      importance: 3,
      confidence: 0.8,
      sourceEntryIds: [],
      tags: [],
      saved: true,
      occurredAt: null,
    }),
    patch: () => ({ title: 'First coffee, revised' }),
  },
  {
    name: 'conversations',
    docId: 'conv-1',
    allowUpdate: true,
    breakKey: 'skill',
    breakValue: 'bogus',
    build: (uid) => ({
      id: 'conv-1',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      title: 'Morning reflection',
      skill: 'reflect',
      messages: [],
    }),
    patch: () => ({ title: 'Morning reflection, revised' }),
  },
  {
    name: 'goals',
    docId: 'goal-1',
    allowUpdate: true,
    breakKey: 'status',
    breakValue: 'bogus',
    build: (uid) => ({
      id: 'goal-1',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      title: 'Ship the app',
      description: '',
      status: 'active',
      progress: 0,
      targetDate: null,
      milestones: [],
      relatedEntryIds: [],
      tags: [],
    }),
    patch: () => ({ title: 'Ship the app beautifully' }),
  },
  {
    name: 'habits',
    docId: 'habit-1',
    allowUpdate: true,
    breakKey: 'frequency',
    breakValue: 'bogus',
    build: (uid) => ({
      id: 'habit-1',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      name: 'Drink water',
      description: '',
      frequency: 'daily',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      streak: 0,
      log: [],
    }),
    patch: () => ({ streak: 1 }),
  },
  {
    name: 'collections',
    docId: 'collection-1',
    allowUpdate: true,
    breakKey: 'color',
    breakValue: 'red',
    build: (uid) => ({
      id: 'collection-1',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      name: 'Travel',
      description: '',
      color: '#1f2d5a',
      entryIds: [],
    }),
    patch: () => ({ name: 'Travel 2024' }),
  },
  {
    name: 'timelineEvents',
    docId: 'event-1',
    allowUpdate: true,
    breakKey: 'month',
    breakValue: 13,
    build: (uid) => ({
      id: 'event-1',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      type: 'journal',
      title: 'First hike',
      description: '',
      occurredAt: ts(),
      year: 2024,
      month: 3,
      day: 1,
      source: null,
      tags: [],
    }),
    patch: () => ({ title: 'First big hike' }),
  },
  {
    name: 'insights',
    docId: 'insight-1',
    allowUpdate: true,
    breakKey: 'kind',
    breakValue: 'bogus',
    build: (uid) => ({
      id: 'insight-1',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      kind: 'daily',
      title: 'Week in review',
      narrative: 'A narrative.',
      content: 'Longer content.',
      periodStart: ts(),
      periodEnd: ts(),
      themes: [],
      sourceIds: [],
      saved: false,
    }),
    patch: () => ({ saved: true }),
  },
  {
    name: 'aiInteractions',
    docId: 'int-1',
    allowUpdate: false,
    breakKey: 'skill',
    breakValue: 'bogus',
    build: (uid) => ({
      id: 'int-1',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      skill: 'reflect',
      prompt: 'Prompt text.',
      response: 'Response text.',
      contextRefs: [],
    }),
    patch: () => ({ skill: 'coach' }),
  },
  {
    name: 'settings',
    docId: 'preferences',
    allowUpdate: true,
    breakKey: 'language',
    breakValue: 'x',
    build: (uid) => ({
      id: 'preferences',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      language: 'en',
      timezone: 'UTC',
      aiPreferences: {
        reflectionSuggestions: true,
        patternDetection: true,
        weeklySummaries: true,
        memorySuggestions: true,
        askBeforeSavingMemory: true,
        allowHistoricalContext: true,
      },
      writingAssistant: {
        suggestions: true,
        grammar: true,
        rewriting: true,
      },
      notificationPreferences: {
        reflectionReminders: true,
        memorySuggestions: true,
        goalReminders: true,
      },
    }),
    patch: () => ({ language: 'fr' }),
  },
  {
    name: 'notifications',
    docId: 'notif-1',
    allowUpdate: true,
    breakKey: 'kind',
    breakValue: 'bogus',
    build: (uid) => ({
      id: 'notif-1',
      uid,
      createdAt: ts(),
      updatedAt: ts(),
      kind: 'system',
      title: 'Reminder',
      body: 'Time to reflect.',
      data: null,
      read: false,
    }),
    patch: () => ({ read: true }),
  },
];

let testEnv: RulesTestEnvironment;
let ownerDb: ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore'] extends (...args: any[]) => any
  ? ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>
  : never;
let intruderDb: typeof ownerDb;
let anonDb: typeof ownerDb;

const ownerRef = (name: string, docId: string) => doc(ownerDb, 'users', OWNER, name, docId);
const intruderRef = (name: string, docId: string) => doc(intruderDb, 'users', OWNER, name, docId);
const anonRef = (name: string, docId: string) => doc(anonDb, 'users', OWNER, name, docId);

async function seed(fixture: Fixture) {
  await assertSucceeds(setDoc(ownerRef(fixture.name, fixture.docId), fixture.build(OWNER)));
}

describe('Firestore security rules — owner-scoped data layer', () => {
  beforeAll(async () => {
    setLogLevel('silent');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: rulesText,
      },
    });
    ownerDb = testEnv.authenticatedContext(OWNER, {}).firestore();
    intruderDb = testEnv.authenticatedContext(INTRUDER, {}).firestore();
    anonDb = testEnv.unauthenticatedContext().firestore();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe.each(FIXTURES)('$name', (fixture) => {
    it('allows the owner to create a valid document', async () => {
      await assertSucceeds(setDoc(ownerRef(fixture.name, fixture.docId), fixture.build(OWNER)));
    });

    it('allows the owner to read their document', async () => {
      await seed(fixture);
      await assertSucceeds(getDoc(ownerRef(fixture.name, fixture.docId)));
    });

    it('enforces the schema validator on owner writes', async () => {
      const bad = fixture.build(OWNER);
      bad[fixture.breakKey] = fixture.breakValue;
      await assertFails(setDoc(ownerRef(fixture.name, fixture.docId), bad));
    });

    it('rejects an owner update-bypass that rewrites the pedigree (uid)', async () => {
      await seed(fixture);
      await assertFails(updateDoc(ownerRef(fixture.name, fixture.docId), { uid: INTRUDER }));
    });

    it(`allows the owner to update ${fixture.allowUpdate ? '' : '→ DENIED (audit trail)'}`, async () => {
      await seed(fixture);
      const p = updateDoc(ownerRef(fixture.name, fixture.docId), fixture.patch());
      if (fixture.allowUpdate) {
        await assertSucceeds(p);
      } else {
        await assertFails(p);
      }
    });

    it('allows the owner to delete their document', async () => {
      await seed(fixture);
      await assertSucceeds(deleteDoc(ownerRef(fixture.name, fixture.docId)));
    });

    it('denies a non-owner read', async () => {
      await seed(fixture);
      await assertFails(getDoc(intruderRef(fixture.name, fixture.docId)));
    });

    it('denies a non-owner write into the owner partition', async () => {
      const docData = fixture.build(OWNER);
      await assertFails(setDoc(intruderRef(fixture.name, fixture.docId), docData));
    });

    it('denies unauthenticated read', async () => {
      await seed(fixture);
      await assertFails(getDoc(anonRef(fixture.name, fixture.docId)));
    });

    it('denies unauthenticated write', async () => {
      await assertFails(setDoc(anonRef(fixture.name, fixture.docId), fixture.build(OWNER)));
    });
  });

  describe('malicious and boundary document ids', () => {
    const f = FIXTURES[0];

    it('rejects an over-length document id', async () => {
      const data = f.build(OWNER);
      data.id = 'a'.repeat(129);
      await assertFails(setDoc(doc(ownerDb, 'users', OWNER, 'journalEntries', 'a'.repeat(129)), data));
    });

    it('rejects reserved/prototype document ids', async () => {
      // `__proto__` is rejected by the emulator itself (INVALID_ARGUMENT), the
      // rest are rejected by the rules (PERMISSION_DENIED). Both must fail.
      for (const badId of ['constructor', 'prototype', '__proto__']) {
        const data = f.build(OWNER);
        data.id = badId;
        const attempt = setDoc(doc(ownerDb, 'users', OWNER, 'journalEntries', badId), data);
        if (badId === '__proto__') {
          await expect(attempt).rejects.toBeTruthy();
        } else {
          // eslint-disable-next-line no-await-in-loop
          await assertFails(attempt);
        }
      }
    });

it('rejects a document id containing a path separator (path escape)', async () => {
      // The client SDK refuses to even build a reference whose segments would
      // traverse out of the document — no attacker can express the ref.
      expect(() => doc(ownerDb, 'users', OWNER, 'journalEntries', 'a/b')).toThrow(/Invalid document reference/);
    });
  });

  describe('collection traversal boundaries', () => {
    const f = FIXTURES[0];

    it('denies listing the root users collection', async () => {
      await assertFails(getDocs(collection(ownerDb, 'users')));
    });

    it('denies listing another user subcollection', async () => {
      await assertFails(getDocs(collection(intruderDb, 'users', OWNER, 'journalEntries')));
    });

    it('denies writes into an unknown subcollection', async () => {
      await assertFails(
        setDoc(doc(ownerDb, 'users', OWNER, 'hiddenPanel', 'x'), f.build(OWNER)),
      );
    });

    it('denies writes deeper than the subcollection layer', async () => {
      await assertFails(
        setDoc(doc(ownerDb, 'users', OWNER, 'journalEntries', f.docId, 'child', 'y'), f.build(OWNER)),
      );
    });
  });

  describe('journalEntries — aiMetadata field rigor (multimodal saves)', () => {
    const entryRef = () => doc(ownerDb, 'users', OWNER, 'journalEntries', 'meta-1');

    it('allows a full aiMetadata map incl. modelUsed (client multimodal save shape)', async () => {
      await assertSucceeds(setDoc(entryRef(), FIXTURES[0].build(OWNER)));
    });

    it('rejects aiMetadata with an injected extra key (hasOnly enforcement)', async () => {
      const data = FIXTURES[0].build(OWNER);
      data.aiMetadata = { ...(data.aiMetadata as Record<string, unknown>), adminFlag: true };
      await assertFails(setDoc(entryRef(), data));
    });

    it('rejects aiMetadata when modelUsed is not a string (type bound)', async () => {
      const data = FIXTURES[0].build(OWNER);
      data.aiMetadata = { ...(data.aiMetadata as Record<string, unknown>), modelUsed: 12345 };
      await assertFails(setDoc(entryRef(), data));
    });

    it('rejects aiMetadata transcript over the size bound', async () => {
      const data = FIXTURES[0].build(OWNER);
      data.aiMetadata = { ...(data.aiMetadata as Record<string, unknown>), transcript: 'x'.repeat(120001) };
      await assertFails(setDoc(entryRef(), data));
    });
  });

  describe('legacy collections (preserved working functionality)', () => {
    const legacyInteraction = {
      id: 'int-1',
      userId: OWNER,
      title: 'Legacy companion session',
      mode: 'free-write',
      messages: [{ id: 'm1', role: 'user', content: 'Hi there', timestamp: '1700000000000' }],
      createdAt: '1700000000000',
      updatedAt: '1700000000000',
    };

    it('allows the owner to persist + read legacy interactions', async () => {
      await assertSucceeds(setDoc(doc(ownerDb, 'users', OWNER, 'interactions', 'int-1'), legacyInteraction));
      await assertSucceeds(getDoc(doc(ownerDb, 'users', OWNER, 'interactions', 'int-1')));
    });

    it('denies intruder reads of owner interactions', async () => {
      await assertSucceeds(setDoc(doc(ownerDb, 'users', OWNER, 'interactions', 'int-1'), legacyInteraction));
      await assertFails(getDoc(doc(intruderDb, 'users', OWNER, 'interactions', 'int-1')));
    });

    it('denies an intruder who forges the owner userId in a legacy interaction', async () => {
      const forged = { ...legacyInteraction, userId: OWNER };
      await assertFails(setDoc(doc(intruderDb, 'users', OWNER, 'interactions', 'int-1'), forged));
    });

    it('keeps roles read-only for owners and denies everyone else', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'roles', OWNER), { role: 'admin' });
      });
      await assertSucceeds(getDoc(doc(ownerDb, 'roles', OWNER)));
      await assertFails(getDoc(doc(intruderDb, 'roles', OWNER)));
      await assertFails(setDoc(doc(ownerDb, 'roles', OWNER), { role: 'admin' }));
      await assertFails(deleteDoc(doc(ownerDb, 'roles', OWNER)));
    });
  });

  describe('cross-account isolation', () => {
    it('rejects an intruder who forges an owner uid in the data payload', async () => {
      const f = FIXTURES[0];
      const forged = f.build(OWNER); // data.uid = OWNER, but caller is INTRUDER
      await assertFails(setDoc(doc(intruderDb, 'users', OWNER, 'journalEntries', f.docId), forged));
    });

    it('rejects an intruder writing to their own partition claiming another uid', async () => {
      const f = FIXTURES[0];
      const forged = f.build(OWNER); // data.uid = OWNER inside intruder partition
      await assertFails(setDoc(doc(intruderDb, 'users', INTRUDER, 'journalEntries', f.docId), forged));
    });

    it('allows an intruder full access to their own partition', async () => {
      const f = FIXTURES[0];
      await assertSucceeds(setDoc(doc(intruderDb, 'users', INTRUDER, 'journalEntries', f.docId), f.build(INTRUDER)));
      await assertSucceeds(getDoc(doc(intruderDb, 'users', INTRUDER, 'journalEntries', f.docId)));
    });
  });
});