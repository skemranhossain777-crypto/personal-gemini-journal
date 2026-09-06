# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `default`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListMyEntries*](#listmyentries)
  - [*ListMyMemories*](#listmymemories)
- [**Mutations**](#mutations)
  - [*CreateJournalEntry*](#createjournalentry)
  - [*UpdateMemoryStatus*](#updatememorystatus)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `default`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@firebase/dataconnect-journal` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@firebase/dataconnect-journal';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@firebase/dataconnect-journal';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListMyEntries
You can execute the `ListMyEntries` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMyEntries(options?: ExecuteQueryOptions): QueryPromise<ListMyEntriesData, undefined>;

interface ListMyEntriesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyEntriesData, undefined>;
}
export const listMyEntriesRef: ListMyEntriesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMyEntries(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyEntriesData, undefined>;

interface ListMyEntriesRef {
  ...
  (dc: DataConnect): QueryRef<ListMyEntriesData, undefined>;
}
export const listMyEntriesRef: ListMyEntriesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMyEntriesRef:
```typescript
const name = listMyEntriesRef.operationName;
console.log(name);
```

### Variables
The `ListMyEntries` query has no variables.
### Return Type
Recall that executing the `ListMyEntries` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMyEntriesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListMyEntries`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMyEntries } from '@firebase/dataconnect-journal';


// Call the `listMyEntries()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMyEntries();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMyEntries(dataConnect);

console.log(data.journalEntries);

// Or, you can use the `Promise` API.
listMyEntries().then((response) => {
  const data = response.data;
  console.log(data.journalEntries);
});
```

### Using `ListMyEntries`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMyEntriesRef } from '@firebase/dataconnect-journal';


// Call the `listMyEntriesRef()` function to get a reference to the query.
const ref = listMyEntriesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMyEntriesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.journalEntries);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.journalEntries);
});
```

## ListMyMemories
You can execute the `ListMyMemories` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMyMemories(options?: ExecuteQueryOptions): QueryPromise<ListMyMemoriesData, undefined>;

interface ListMyMemoriesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyMemoriesData, undefined>;
}
export const listMyMemoriesRef: ListMyMemoriesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMyMemories(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyMemoriesData, undefined>;

interface ListMyMemoriesRef {
  ...
  (dc: DataConnect): QueryRef<ListMyMemoriesData, undefined>;
}
export const listMyMemoriesRef: ListMyMemoriesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMyMemoriesRef:
```typescript
const name = listMyMemoriesRef.operationName;
console.log(name);
```

### Variables
The `ListMyMemories` query has no variables.
### Return Type
Recall that executing the `ListMyMemories` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMyMemoriesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListMyMemories`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMyMemories } from '@firebase/dataconnect-journal';


// Call the `listMyMemories()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMyMemories();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMyMemories(dataConnect);

console.log(data.memories);

// Or, you can use the `Promise` API.
listMyMemories().then((response) => {
  const data = response.data;
  console.log(data.memories);
});
```

### Using `ListMyMemories`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMyMemoriesRef } from '@firebase/dataconnect-journal';


// Call the `listMyMemoriesRef()` function to get a reference to the query.
const ref = listMyMemoriesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMyMemoriesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.memories);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.memories);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateJournalEntry
You can execute the `CreateJournalEntry` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createJournalEntry(vars: CreateJournalEntryVariables): MutationPromise<CreateJournalEntryData, CreateJournalEntryVariables>;

interface CreateJournalEntryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateJournalEntryVariables): MutationRef<CreateJournalEntryData, CreateJournalEntryVariables>;
}
export const createJournalEntryRef: CreateJournalEntryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createJournalEntry(dc: DataConnect, vars: CreateJournalEntryVariables): MutationPromise<CreateJournalEntryData, CreateJournalEntryVariables>;

interface CreateJournalEntryRef {
  ...
  (dc: DataConnect, vars: CreateJournalEntryVariables): MutationRef<CreateJournalEntryData, CreateJournalEntryVariables>;
}
export const createJournalEntryRef: CreateJournalEntryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createJournalEntryRef:
```typescript
const name = createJournalEntryRef.operationName;
console.log(name);
```

### Variables
The `CreateJournalEntry` mutation requires an argument of type `CreateJournalEntryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateJournalEntryVariables {
  title: string;
  body: string;
  mode: string;
  mood?: number | null;
  energy?: number | null;
  tags?: string[] | null;
}
```
### Return Type
Recall that executing the `CreateJournalEntry` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateJournalEntryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateJournalEntryData {
  journalEntry_insert: JournalEntry_Key;
}
```
### Using `CreateJournalEntry`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createJournalEntry, CreateJournalEntryVariables } from '@firebase/dataconnect-journal';

// The `CreateJournalEntry` mutation requires an argument of type `CreateJournalEntryVariables`:
const createJournalEntryVars: CreateJournalEntryVariables = {
  title: ..., 
  body: ..., 
  mode: ..., 
  mood: ..., // optional
  energy: ..., // optional
  tags: ..., // optional
};

// Call the `createJournalEntry()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createJournalEntry(createJournalEntryVars);
// Variables can be defined inline as well.
const { data } = await createJournalEntry({ title: ..., body: ..., mode: ..., mood: ..., energy: ..., tags: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createJournalEntry(dataConnect, createJournalEntryVars);

console.log(data.journalEntry_insert);

// Or, you can use the `Promise` API.
createJournalEntry(createJournalEntryVars).then((response) => {
  const data = response.data;
  console.log(data.journalEntry_insert);
});
```

### Using `CreateJournalEntry`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createJournalEntryRef, CreateJournalEntryVariables } from '@firebase/dataconnect-journal';

// The `CreateJournalEntry` mutation requires an argument of type `CreateJournalEntryVariables`:
const createJournalEntryVars: CreateJournalEntryVariables = {
  title: ..., 
  body: ..., 
  mode: ..., 
  mood: ..., // optional
  energy: ..., // optional
  tags: ..., // optional
};

// Call the `createJournalEntryRef()` function to get a reference to the mutation.
const ref = createJournalEntryRef(createJournalEntryVars);
// Variables can be defined inline as well.
const ref = createJournalEntryRef({ title: ..., body: ..., mode: ..., mood: ..., energy: ..., tags: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createJournalEntryRef(dataConnect, createJournalEntryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.journalEntry_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.journalEntry_insert);
});
```

## UpdateMemoryStatus
You can execute the `UpdateMemoryStatus` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateMemoryStatus(vars: UpdateMemoryStatusVariables): MutationPromise<UpdateMemoryStatusData, UpdateMemoryStatusVariables>;

interface UpdateMemoryStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMemoryStatusVariables): MutationRef<UpdateMemoryStatusData, UpdateMemoryStatusVariables>;
}
export const updateMemoryStatusRef: UpdateMemoryStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateMemoryStatus(dc: DataConnect, vars: UpdateMemoryStatusVariables): MutationPromise<UpdateMemoryStatusData, UpdateMemoryStatusVariables>;

interface UpdateMemoryStatusRef {
  ...
  (dc: DataConnect, vars: UpdateMemoryStatusVariables): MutationRef<UpdateMemoryStatusData, UpdateMemoryStatusVariables>;
}
export const updateMemoryStatusRef: UpdateMemoryStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateMemoryStatusRef:
```typescript
const name = updateMemoryStatusRef.operationName;
console.log(name);
```

### Variables
The `UpdateMemoryStatus` mutation requires an argument of type `UpdateMemoryStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateMemoryStatusVariables {
  id: UUIDString;
  status: string;
  saved: boolean;
}
```
### Return Type
Recall that executing the `UpdateMemoryStatus` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateMemoryStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateMemoryStatusData {
  memory_update?: Memory_Key | null;
}
```
### Using `UpdateMemoryStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateMemoryStatus, UpdateMemoryStatusVariables } from '@firebase/dataconnect-journal';

// The `UpdateMemoryStatus` mutation requires an argument of type `UpdateMemoryStatusVariables`:
const updateMemoryStatusVars: UpdateMemoryStatusVariables = {
  id: ..., 
  status: ..., 
  saved: ..., 
};

// Call the `updateMemoryStatus()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateMemoryStatus(updateMemoryStatusVars);
// Variables can be defined inline as well.
const { data } = await updateMemoryStatus({ id: ..., status: ..., saved: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateMemoryStatus(dataConnect, updateMemoryStatusVars);

console.log(data.memory_update);

// Or, you can use the `Promise` API.
updateMemoryStatus(updateMemoryStatusVars).then((response) => {
  const data = response.data;
  console.log(data.memory_update);
});
```

### Using `UpdateMemoryStatus`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateMemoryStatusRef, UpdateMemoryStatusVariables } from '@firebase/dataconnect-journal';

// The `UpdateMemoryStatus` mutation requires an argument of type `UpdateMemoryStatusVariables`:
const updateMemoryStatusVars: UpdateMemoryStatusVariables = {
  id: ..., 
  status: ..., 
  saved: ..., 
};

// Call the `updateMemoryStatusRef()` function to get a reference to the mutation.
const ref = updateMemoryStatusRef(updateMemoryStatusVars);
// Variables can be defined inline as well.
const ref = updateMemoryStatusRef({ id: ..., status: ..., saved: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateMemoryStatusRef(dataConnect, updateMemoryStatusVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.memory_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.memory_update);
});
```

