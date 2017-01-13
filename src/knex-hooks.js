
const makeArray = require('make-array');
const co = require('co');
const remove = require('lodash.remove');
const isFunction = require('lodash.isfunction');
const builderParams = require('./builder-params');
const runHooks = require('./run-hooks');
const helpers = require('./helpers');
const errorMessages = require('./error-messages');
const enumOrArray = require('./enum-or-array');

const knexHooks = function (knex) {
  if (knex.addHook) {
    return knex;
  }

  let hooks = [];

  knex.addHook = function (when, method, table, handler) {

    // validate arguments
    if (!enumOrArray(when, ['before', 'after', '*'])) {
      throw new TypeError(errorMessages.addHook_when);
    }
    if (!enumOrArray(method, ['insert', 'update', 'delete', 'select', '*'])) {
      throw new TypeError(errorMessages.addHook_method);
    }
    if (Array.isArray(table)) {
      table.forEach(t => {
        if (typeof t !== 'string') {
          throw new TypeError(errorMessages.addHook_table);
        }
      });
    } else if (typeof table !== 'string') {
      throw new TypeError(errorMessages.addHook_table);
    }
    if (!isFunction(handler)) {
      throw new TypeError(errorMessages.addHook_handler);
    }

    // add hook
    hooks.push({
      when: makeArray(when).map(v => (v.toLowerCase())),
      method: makeArray(method).map(v => (v.toLowerCase())),
      table: makeArray(table),
      handler: co.wrap(handler),
    });

    // make it chainable
    return knex;
  };

  helpers.extendKnex(knex, (knex, isRoot) => {

    (function (queryBuilder) {
      knex.client.queryBuilder = function () {
        const qb = queryBuilder.apply(this, arguments);
        qb.__hooks = true;
        qb.hooks = function (enable) {
          if (!arguments.length) {
            enable = true;
          }
          this.__hooks = !!enable;
          return this;
        };
        return qb;
      };
    })(knex.client.queryBuilder);

    (function (runner) {
      knex.client.runner = function () {
        const _runner = runner.apply(this, arguments);
        (function (run) {
          _runner.run = function () {
            const args = arguments;
            const params = builderParams(this.builder);
            if (!params || !this.builder.__hooks) {
              return run.apply(this, args);
            }
            return runHooks('before', params.method, params.table, {
              builder: this.builder,
              hooks,
              data: params.data,
            })
            .then(() => {
              return run.apply(this, args);
            })
            .then((result) => {
              const handlerParams = {
                builder: this.builder,
                hooks,
                data: params.data,
                result,
              };
              return runHooks('after', params.method, params.table, handlerParams);
            });
          };
        })(_runner.run);
        return _runner;
      };
    })(knex.client.runner);

  });

  return knex;
};

module.exports = knexHooks;
module.exports.helpers = helpers;
