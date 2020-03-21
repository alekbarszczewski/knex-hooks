
const methods = ['insert', 'update', 'del', 'select'];

const builderParams = function (builder) {
  let method = builder._method;
  if (method === 'first') { method = 'select'; }
  if (methods.indexOf(method) === -1) { return null; }
  const table = builder._single.table;
  if (!table) { return null; }
  if (typeof table === 'object') { return builderParams(table); }
  const params = { method, table };
  return params;
};

module.exports = builderParams;
