
const Builder = require('knex/lib/query/builder');
const isFunction = require('lodash.isfunction');
const errorMessages = require('./error-messages');

const helpers = {

  getUpdateData (builder) {
    if (!(builder instanceof Builder)) {
      throw new TypeError(errorMessages.getUpdateData_builder);
    }
    return builder._single.update;
  },

  getInsertData (builder) {
    if (!(builder instanceof Builder)) {
      throw new TypeError(errorMessages.getInsertData_builder);
    }
    return builder._single.insert;
  },

  extendKnex (knex, callback) {
    if (!isFunction(callback)) {
      throw new TypeError(errorMessages.extendKnex_callback);
    }
    callback(knex, true);
    (function (transaction) {
      knex.client.transaction = function (container, config, outerTx) {
        const wrapper = function (trx) {
          callback(trx, false);
          return container(trx);
        };
        return transaction.call(knex.client, wrapper, config, outerTx);
      };
    })(knex.client.transaction);
  },

  extendBuilder (knex, callback) {
    if (!isFunction(callback)) {
      throw new TypeError(errorMessages.extendBuilder_callback);
    }
    helpers.extendKnex(knex, function (knex, isRoot) {
      (function (queryBuilder) {
        knex.client.queryBuilder = function () {
          const qb = queryBuilder.apply(this, arguments);
          callback(qb, isRoot);
          return qb;
        };
      })(knex.client.queryBuilder);
    });
  },

};

module.exports = helpers;
