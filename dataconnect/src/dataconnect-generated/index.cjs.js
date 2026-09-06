const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'default',
  service: 'gen-lang-client-0345619653-service',
  location: 'asia-east2'
};
exports.connectorConfig = connectorConfig;

const createJournalEntryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateJournalEntry', inputVars);
}
createJournalEntryRef.operationName = 'CreateJournalEntry';
exports.createJournalEntryRef = createJournalEntryRef;

exports.createJournalEntry = function createJournalEntry(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createJournalEntryRef(dcInstance, inputVars));
}
;

const updateMemoryStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateMemoryStatus', inputVars);
}
updateMemoryStatusRef.operationName = 'UpdateMemoryStatus';
exports.updateMemoryStatusRef = updateMemoryStatusRef;

exports.updateMemoryStatus = function updateMemoryStatus(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateMemoryStatusRef(dcInstance, inputVars));
}
;

const listMyEntriesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListMyEntries');
}
listMyEntriesRef.operationName = 'ListMyEntries';
exports.listMyEntriesRef = listMyEntriesRef;

exports.listMyEntries = function listMyEntries(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listMyEntriesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listMyMemoriesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListMyMemories');
}
listMyMemoriesRef.operationName = 'ListMyMemories';
exports.listMyMemoriesRef = listMyMemoriesRef;

exports.listMyMemories = function listMyMemories(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listMyMemoriesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
