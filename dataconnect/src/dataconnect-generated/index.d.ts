import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateJournalEntryData {
  journalEntry_insert: JournalEntry_Key;
}

export interface CreateJournalEntryVariables {
  title: string;
  body: string;
  mode: string;
  mood?: number | null;
  energy?: number | null;
  tags?: string[] | null;
}

export interface JournalEntry_Key {
  id: UUIDString;
  __typename?: 'JournalEntry_Key';
}

export interface ListMyEntriesData {
  journalEntries: ({
    id: UUIDString;
    title: string;
    body: string;
    mode: string;
    mood?: number | null;
    energy?: number | null;
    tags?: string[] | null;
    favorite: boolean;
    archived: boolean;
    createdAt: DateString;
    updatedAt: DateString;
  } & JournalEntry_Key)[];
}

export interface ListMyMemoriesData {
  memories: ({
    id: UUIDString;
    type: string;
    title: string;
    narrative: string;
    importance: number;
    confidence: number;
    saved: boolean;
    status: string;
    occurredAt: DateString;
    createdAt: DateString;
  } & Memory_Key)[];
}

export interface Memory_Key {
  id: UUIDString;
  __typename?: 'Memory_Key';
}

export interface UpdateMemoryStatusData {
  memory_update?: Memory_Key | null;
}

export interface UpdateMemoryStatusVariables {
  id: UUIDString;
  status: string;
  saved: boolean;
}

export interface User_Key {
  id: string;
  __typename?: 'User_Key';
}

interface CreateJournalEntryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateJournalEntryVariables): MutationRef<CreateJournalEntryData, CreateJournalEntryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateJournalEntryVariables): MutationRef<CreateJournalEntryData, CreateJournalEntryVariables>;
  operationName: string;
}
export const createJournalEntryRef: CreateJournalEntryRef;

export function createJournalEntry(vars: CreateJournalEntryVariables): MutationPromise<CreateJournalEntryData, CreateJournalEntryVariables>;
export function createJournalEntry(dc: DataConnect, vars: CreateJournalEntryVariables): MutationPromise<CreateJournalEntryData, CreateJournalEntryVariables>;

interface UpdateMemoryStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMemoryStatusVariables): MutationRef<UpdateMemoryStatusData, UpdateMemoryStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateMemoryStatusVariables): MutationRef<UpdateMemoryStatusData, UpdateMemoryStatusVariables>;
  operationName: string;
}
export const updateMemoryStatusRef: UpdateMemoryStatusRef;

export function updateMemoryStatus(vars: UpdateMemoryStatusVariables): MutationPromise<UpdateMemoryStatusData, UpdateMemoryStatusVariables>;
export function updateMemoryStatus(dc: DataConnect, vars: UpdateMemoryStatusVariables): MutationPromise<UpdateMemoryStatusData, UpdateMemoryStatusVariables>;

interface ListMyEntriesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyEntriesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyEntriesData, undefined>;
  operationName: string;
}
export const listMyEntriesRef: ListMyEntriesRef;

export function listMyEntries(options?: ExecuteQueryOptions): QueryPromise<ListMyEntriesData, undefined>;
export function listMyEntries(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyEntriesData, undefined>;

interface ListMyMemoriesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyMemoriesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyMemoriesData, undefined>;
  operationName: string;
}
export const listMyMemoriesRef: ListMyMemoriesRef;

export function listMyMemories(options?: ExecuteQueryOptions): QueryPromise<ListMyMemoriesData, undefined>;
export function listMyMemories(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyMemoriesData, undefined>;

