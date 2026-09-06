# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createJournalEntry, updateMemoryStatus, listMyEntries, listMyMemories } from '@firebase/dataconnect-journal';


// Operation CreateJournalEntry:  For variables, look at type CreateJournalEntryVars in ../index.d.ts
const { data } = await CreateJournalEntry(dataConnect, createJournalEntryVars);

// Operation UpdateMemoryStatus:  For variables, look at type UpdateMemoryStatusVars in ../index.d.ts
const { data } = await UpdateMemoryStatus(dataConnect, updateMemoryStatusVars);

// Operation ListMyEntries: 
const { data } = await ListMyEntries(dataConnect);

// Operation ListMyMemories: 
const { data } = await ListMyMemories(dataConnect);


```