
const bluebird = require('bluebird');
const co = require('co');

const _runHooks = co.wrap(function *(when, method, table, params) {

  if (method === 'del') { method = 'delete'; }

  const isAfter = when === 'after';

  // select hooks to run
  const hooks = params.hooks.filter(hook => {
    return (hook.when.indexOf(when) !== -1 || hook.when.indexOf('*') !== -1)
      && (hook.method.indexOf(method) !== -1 || hook.method.indexOf('*') !== -1)
      && (hook.table.indexOf(table) !== -1 || hook.table.indexOf('*') !== -1);
  });

  let result = params.result;

  // run selected hooks
  for (let i = 0; i < hooks.length; ++i) {
    const hook = hooks[i];
    const hookParams = {
      query: params.builder,
    };
    if (isAfter) {
      hookParams.result = result;
    }
    yield hook.handler(when, method, table, hookParams);
    result = hookParams.result;
  }

  return result;
});

// wrap with knex.Promise
const runHooks = function () {
  return bluebird.Promise.resolve()
  .then(() => {
    return _runHooks.apply(this, arguments);
  });
};

module.exports = runHooks;
