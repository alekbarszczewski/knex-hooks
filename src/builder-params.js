
const methods = ['insert', 'update', 'del', 'select'];

const builderParams = function (builder) {
  const method = builder._method;
  if (methods.indexOf(method) === -1) { return null; }
  const table = builder._single.table;
  if (!table) { return null; }
  const params = { method, table };
  return params;
};

module.exports = builderParams;
