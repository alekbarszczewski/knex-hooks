
const helpers = {

  getUpdateData (builder) {
    return builder._single.update;
  },

  getInsertData (builder) {
    return builder._single.insert;
  },

  extendKnex (knex, callback) {
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
