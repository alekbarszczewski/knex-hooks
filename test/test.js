
const co = require('co');
const sinon = require('sinon');
const expect = require('expect.js');
const Raw = require('knex/lib/raw');
const values = require('object.values');
const Builder = require('knex/lib/query/builder');
const knexHooks = require('./../src/knex-hooks');

const helpers = knexHooks.helpers;

const makeKnex = function (options) {
  const knex = require('knex')({
    client: process.env.KNEX_CLIENT,
    connection: process.env.DATABASE_URL,
  });
  knexHooks(knex, options);
  return knex;
};

const addHandlers = function (knex, table, hooks) {
  hooks = hooks || {};
  const whens = ['before', 'after'];
  const methods = ['insert', 'update', 'delete', 'select'];
  const handlers = {};
  for (let i = 0; i < whens.length; ++i) {
    const when = whens[i];
    for (let j = 0; j < methods.length; ++j) {
      const method = methods[j];
      const name = `${when}_${method}`;
      const handler = sinon.spy(hooks[name]);
      handlers[name] = { spy: handler, name, method, when, table };
      knex.addHook(when, method, table, handler);
    }
  }
  return handlers;
};

describe('knex-hooks', function () {

  before(co.wrap(function *() {
    const knex = makeKnex();
    yield knex.schema.dropTableIfExists('test1');
    yield knex.schema.dropTableIfExists('test2');
    yield knex.schema.createTable('test1', function (table) {
      table.increments();
      table.string('name');
    });
    yield knex.schema.createTable('test2', function (table) {
      table.increments();
      table.string('name');
    });
  }));

  beforeEach(co.wrap(function *() {
    this.knex = makeKnex();
    yield this.knex('test1').truncate();
    yield this.knex('test2').truncate();
  }));

  it('should run before/after insert/update/delete/select hooks', co.wrap(function *() {
    const handlers = addHandlers(this.knex, 'test1');
    yield this.knex('test1').insert({ name: 'john' }).returning('*');
    yield this.knex('test1').update({ name: 'john' }).returning('*');
    yield this.knex('test1').select('*');
    yield this.knex('test1').delete().where({ name: 'john' }).returning('*');
    values(handlers).forEach(handler => {
      expect(handler.spy.calledOnce).to.equal(true);
      expect(handler.spy.firstCall.args[0]).to.equal(handler.when);
      expect(handler.spy.firstCall.args[1]).to.equal(handler.method);
      expect(handler.spy.firstCall.args[2]).to.equal(handler.table);
      const params = handler.spy.firstCall.args[3];
      expect(params.query).to.be.a(Builder);
      if (handler.when === 'before') {
        expect(params.result).to.equal(undefined);
      } else {
        expect(params.result).to.eql([{ id: 1, name: 'john' }]);
      }
    });
  }));

  it('should allow to modify input data via builder', co.wrap(function *() {
    const hooks = {};
    ['before'].forEach(when => {
      ['insert', 'update', 'delete', 'select'].forEach(method => {
        hooks[`${when}_${method}`] = function (when, method, table, params) {
          if (method === 'insert') {
            params.query._single.insert = { name: 'mark' };
          } else if (method === 'update') {
            params.query._single.update = { name: 'jimmy' };
          } else if (method === 'select') {
            params.query.where({ name: 'xxx' });
          } else if (method === 'delete') {
            params.query.where({ name: 'xxx' });
          }
        };
      });
    });
    const handlers = addHandlers(this.knex, 'test1', hooks);
    const insertResult = yield this.knex('test1').insert({ name: 'john' }).returning('*');
    const updateResult = yield this.knex('test1').update({ name: 'john' }).returning('*');
    const selectResult = yield this.knex('test1').select('*');
    const deleteResult = yield this.knex('test1').delete().returning('*');
    values(handlers).forEach(handler => {
      expect(handler.spy.calledOnce).to.equal(true);
    });
    expect(insertResult).to.eql([{ id: 1, name: 'mark' }]);
    expect(updateResult).to.eql([{ id: 1, name: 'jimmy' }]);
    expect(selectResult).to.eql([]);
    expect(deleteResult).to.eql([]);
  }));

  it('should allow to modify output data by returning new result', co.wrap(function *() {
    const hooks = {};
    const hooks2 = {};
    ['after'].forEach(when => {
      ['insert', 'update', 'delete', 'select'].forEach(method => {
        hooks[`${when}_${method}`] = function (when, method, table, params) {
          expect(params.result).to.eql([{ id: 1, name: 'john' }]);
          params.result = { custom: true };
        };
        hooks2[`${when}_${method}`] = function (when, method, table, params) {
          expect(params.result).to.eql({ custom: true });
          params.result = null;
        };
      });
    });
    const handlers = addHandlers(this.knex, 'test1', hooks);
    const handlers2 = addHandlers(this.knex, 'test1', hooks2);
    const insertResult = yield this.knex('test1').insert({ name: 'john' }).returning('*');
    const updateResult = yield this.knex('test1').update({ name: 'john' }).returning('*');
    const selectResult = yield this.knex('test1').select('*');
    const deleteResult = yield this.knex('test1').delete().returning('*');
    values(handlers).forEach(handler => {
      expect(handler.spy.calledOnce).to.equal(true);
    });
    values(handlers2).forEach(handler => {
      expect(handler.spy.calledOnce).to.equal(true);
    });
    expect(insertResult).to.eql(null);
    expect(updateResult).to.eql(null);
    expect(selectResult).to.eql(null);
    expect(deleteResult).to.eql(null);
  }));

  it('should run hooks for multiple whens, methods and tables', co.wrap(function *() {
    const handler1 = sinon.spy();
    const handler2 = sinon.spy();
    this.knex.addHook(['before', 'after'], ['insert', 'update', 'delete', 'select'], ['test1', 'test2'], handler1);
    this.knex.addHook('*', '*', '*', handler2);
    const tables = ['test1', 'test2'];
    for (let i = 0; i < tables.length; ++i) {
      const table = tables[i];
      yield this.knex(table).insert({ name: 'john' }).returning('*');
      yield this.knex(table).update({ name: 'john' }).returning('*');
      yield this.knex(table).select('*');
      yield this.knex(table).delete().where({ name: 'john' }).returning('*');
    }
    expect(handler1.callCount).to.equal(16);
    expect(handler2.callCount).to.equal(16);
    [handler1, handler2].forEach(handler => {
      ['test1', 'test2'].forEach((table, tableIdx) => {
        ['insert', 'update', 'select', 'delete'].forEach((method, methodIdx)  => {
          ['before', 'after'].forEach((when, whenIdx) => {
            const callNum = tableIdx * 8 + methodIdx * 2 + whenIdx;
            const call = handler.getCall(callNum);
            expect(call.args[0]).to.equal(when);
            expect(call.args[1]).to.equal(method);
            expect(call.args[2]).to.equal(table);
          });
        });
      });
    });
  }));

  it('should catch and rethrow errors from `before` hooks', co.wrap(function *() {
    const handler = function () {
      throw new Error('custom_error');
    };
    this.knex.addHook(['before', 'after'], ['insert', 'update', 'delete', 'select'], ['test1'], handler);
    const table = 'test1';
    const promises = [
      this.knex(table).insert({ name: 'john' }).returning('*'),
      this.knex(table).update({ name: 'john' }).returning('*'),
      this.knex(table).select('*'),
      this.knex(table).delete().where({ name: 'john' }).returning('*'),
    ];
    const spy = sinon.spy();
    for (let i = 0; i < promises.length; ++i) {
      try {
        yield promises[i];
      } catch (err) {
        spy();
        expect(err.message).to.equal('custom_error');
      }
    }
    expect(spy.callCount).to.equal(4);
  }));

  it('should catch and rethrow errors from `after` hooks', co.wrap(function *() {
    const handler = function () {
      throw new Error('custom_error');
    };
    this.knex.addHook(['after'], ['insert', 'update', 'delete', 'select'], ['test1'], handler);
    const table = 'test1';
    const promises = [
      this.knex(table).insert({ name: 'john' }).returning('*'),
      this.knex(table).update({ name: 'john' }).returning('*'),
      this.knex(table).select('*'),
      this.knex(table).delete().where({ name: 'john' }).returning('*'),
    ];
    const spy = sinon.spy();
    for (let i = 0; i < promises.length; ++i) {
      try {
        yield promises[i];
      } catch (err) {
        spy();
        expect(err.message).to.equal('custom_error');
      }
    }
    expect(spy.callCount).to.equal(4);
  }));

  it('should allow to return promises and preserve hooks order', co.wrap(function *() {
    this.timeout(2000);
    const spy1 = sinon.spy();
    const spy2 = sinon.spy();
    const handler1 = function () {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          spy1();
          resolve();
        }, 50);
      });
    };
    const handler2 = function () {
      spy2();
    };
    this.knex.addHook(['before', 'after'], ['insert', 'update', 'delete', 'select'], ['test1', 'test2'], handler1);
    this.knex.addHook(['before', 'after'], ['insert', 'update', 'delete', 'select'], ['test1', 'test2'], handler2);
    const tables = ['test1', 'test2'];
    for (let i = 0; i < tables.length; ++i) {
      const table = tables[i];
      yield this.knex(table).insert({ name: 'john' }).returning('*');
      yield this.knex(table).update({ name: 'john' }).returning('*');
      yield this.knex(table).select('*');
      yield this.knex(table).delete().where({ name: 'john' }).returning('*');
    }
    expect(spy1.callCount).to.equal(16);
    expect(spy2.callCount).to.equal(16);
    ['test1', 'test2'].forEach((table, tableIdx) => {
      ['insert', 'update', 'select', 'delete'].forEach((method, methodIdx)  => {
        ['before', 'after'].forEach((when, whenIdx) => {
          const callNum = tableIdx * 8 + methodIdx * 2 + whenIdx;
          const call1 = spy1.getCall(callNum);
          const call2 = spy2.getCall(callNum);
          expect(call1.calledBefore(call2)).to.equal(true);
        });
      });
    });
  }));

  it('should not run hooks for raw queries', co.wrap(function *() {
    const handlers = addHandlers(this.knex, 'test1');
    yield this.knex.raw(`insert into test1 values (1, 'john')`);
    yield this.knex.raw(`update test1 set name = 'john'`);
    yield this.knex.raw(`delete from test1 where name = 'john'`);
    yield this.knex.raw(`select * from test1`);
    values(handlers).forEach(handler => {
      expect(handler.spy.called).to.equal(false);
    });
  }));

  it('should work with transactions', co.wrap(function *() {
    const handlers = addHandlers(this.knex, 'test1');
    yield this.knex.transaction(function(trx) {
      return co.wrap(function *() {
        yield trx('test1').insert({ name: 'john' }).returning('*');
        yield trx('test1').update({ name: 'john' }).returning('*');
        yield trx('test1').delete().where({ name: 'john' }).returning('*');
        yield trx('test1').select('*');
        yield trx.transaction(function (trx2) {
          return co.wrap(function *() {
            yield trx2('test1').insert({ name: 'john' }).returning('*');
            yield trx2('test1').update({ name: 'john' }).returning('*');
            yield trx2('test1').delete().where({ name: 'john' }).returning('*');
            yield trx2('test1').select('*');
          })();
        });
      })();
    });
    values(handlers).forEach(handler => {
      expect(handler.spy.calledOnce).to.equal(true);
    });
  }));

  it('should disable hooks by setting builder.hooks(false)', co.wrap(function *() {
    const handlers = addHandlers(this.knex, 'test1');
    yield this.knex('test1').insert({ name: 'john' }).returning('*').hooks(false);
    yield this.knex('test1').update({ name: 'john' }).returning('*').hooks(false);
    yield this.knex('test1').delete().where({ name: 'john' }).returning('*').hooks(false);
    yield this.knex('test1').select('*').hooks(false);
    yield this.knex.transaction(function(trx) {
      return co.wrap(function *() {
        yield trx('test1').insert({ name: 'john' }).returning('*').hooks(false);
        yield trx('test1').update({ name: 'john' }).returning('*').hooks(false);
        yield trx('test1').delete().where({ name: 'john' }).returning('*').hooks(false);
        yield trx('test1').select('*').hooks(false);
      })();
    });
    values(handlers).forEach(handler => {
      expect(handler.spy.called).to.equal(false);
    });
  }));

  it('should throw TypeError on any invalid argument', function () {
    const sets = [
      [10, 'insert', 'table1', function () {}],
      [['before', 10], 'insert', 'table1', function () {}],
      ['before', 10, 'table1', function () {}],
      ['before', ['insert', 10], 'table1', function () {}],
      ['before', 'insert', 10, function () {}],
      ['before', 'insert', ['table1', 10], function () {}],
      ['before', 'insert', 'table1', 10],
      ['before', 'insert', 'table1'],
    ];
    const errors = [];
    sets.forEach(args => {
      expect(this.knex.addHook.bind(this.knex, args[0], args[1], args[2], args[3])).to.throwError((err) => {
        errors.push(err);
      });
    });
    expect(errors.length).to.equal(sets.length);
    errors.forEach(err => {
      expect(err).to.be.a(TypeError);
    });
  });

  describe('helpers', () => {

    describe('getInsertData', () => {

      it('should return insert data from query builder', function () {
        const query = this.knex('test1').insert({ name: 'john' });
        const data = helpers.getInsertData(query);
        expect(data).to.eql({ name: 'john' });
      });

      it('should throw error on invalid argument', function () {
        expect(helpers.getInsertData.bind(helpers, {})).to.throwError((err) => {
          expect(err).to.be.a(TypeError);
        });
      });

    });

    describe('getUpdateData', () => {

      it('should return update data from query builder', function () {
        const query = this.knex('test1').update({ name: 'john' });
        const data = helpers.getUpdateData(query);
        expect(data).to.eql({ name: 'john' });
      });

      it('should throw error on invalid argument', function () {
        expect(helpers.getInsertData.bind(helpers, {})).to.throwError((err) => {
          expect(err).to.be.a(TypeError);
        });
      });

    });

    describe('extendKnex', () => {

      it('should allow to modify knex instance and sub instnaces generated by transactions', co.wrap(function *() {
        const spy = sinon.spy((knex, isRoot) => {
          knex.__isRoot = isRoot;
        });
        helpers.extendKnex(this.knex, spy);
        const trx = yield this.knex.transaction(trx => {
          return Promise.resolve(trx);
        });
        expect(spy.calledTwice).to.equal(true);
        expect(spy.firstCall.args[0]).to.equal(this.knex);
        expect(spy.firstCall.args[1]).to.equal(true);
        expect(spy.secondCall.args[0]).to.equal(trx);
        expect(spy.secondCall.args[1]).to.equal(false);
        expect(spy.firstCall.args[0]).to.not.equal(spy.secondCall.args[0]);
        expect(this.knex.__isRoot).to.equal(true);
        expect(trx.__isRoot).to.equal(false);
      }));

      it('should allow to extendKnex twice', co.wrap(function *() {
        const spy1 = sinon.spy((knex, isRoot) => {
          knex.__isRoot1 = isRoot;
        });
        const spy2 = sinon.spy((knex, isRoot) => {
          knex.__isRoot2 = isRoot;
        });
        helpers.extendKnex(this.knex, spy1);
        helpers.extendKnex(this.knex, spy2);
        const trx = yield this.knex.transaction(trx => {
          return Promise.resolve(trx);
        });
        [spy1, spy2].forEach(spy => {
          expect(spy.calledTwice).to.equal(true);
          expect(spy.firstCall.args[0]).to.equal(this.knex);
          expect(spy.firstCall.args[1]).to.equal(true);
          expect(spy.secondCall.args[0]).to.equal(trx);
          expect(spy.secondCall.args[1]).to.equal(false);
          expect(spy.firstCall.args[0]).to.not.equal(spy.secondCall.args[0]);
          expect(this.knex.__isRoot1).to.equal(true);
          expect(this.knex.__isRoot2).to.equal(true);
          expect(trx.__isRoot1).to.equal(false);
          expect(trx.__isRoot2).to.equal(false);
        });
      }));

      it('should throw error on invalid `callback` argument', function () {
        expect(helpers.extendKnex.bind(helpers, this.knex, {})).to.throwError((err) => {
          expect(err).to.be.a(TypeError);
        });
      });

    });

    describe('extendBuilder', () => {

      it('should allow to modify knex builder instance and sub instnaces generated by transactions', co.wrap(function *() {
        const spy = sinon.spy((builder, isRoot) => {
          builder.customMethod = function () { return this; };
        });
        helpers.extendBuilder(this.knex, spy);
        const q1 = this.knex('test1').select('*');
        expect(q1.customMethod()).to.equal(q1);
        expect(spy.calledOnce).to.equal(true);
        expect(spy.firstCall.args[0]).to.equal(q1);
        const trx = yield this.knex.transaction(trx => {
          const q2 = this.knex('test1').select('*');
          expect(q2.customMethod()).to.equal(q2);
          expect(spy.calledTwice).to.equal(true);
          expect(spy.secondCall.args[0]).to.equal(q2);
          return Promise.resolve(true);
        });
        expect(trx).to.equal(true);
      }));

      it('should allow to modify knex builder twice', co.wrap(function *() {
        const spy1 = sinon.spy((builder, isRoot) => {
          builder.customMethod1 = function () { return 1; };
        });
        const spy2 = sinon.spy((builder, isRoot) => {
          builder.customMethod2 = function () { return 2; };
        });
        helpers.extendBuilder(this.knex, spy1);
        helpers.extendBuilder(this.knex, spy2);
        const q1 = this.knex('test1').select('*');
        expect(q1.customMethod1()).to.equal(1);
        expect(q1.customMethod2()).to.equal(2);
        expect(spy1.calledOnce).to.equal(true);
        expect(spy1.firstCall.args[0]).to.equal(q1);
        expect(spy2.calledOnce).to.equal(true);
        expect(spy2.firstCall.args[0]).to.equal(q1);
        const trx = yield this.knex.transaction(trx => {
          const q2 = this.knex('test1').select('*');
          expect(q2.customMethod1()).to.equal(1);
          expect(q2.customMethod2()).to.equal(2);
          expect(spy1.calledTwice).to.equal(true);
          expect(spy1.secondCall.args[0]).to.equal(q2);
          expect(spy2.calledTwice).to.equal(true);
          expect(spy2.secondCall.args[0]).to.equal(q2);
          return Promise.resolve(true);
        });
        expect(trx).to.equal(true);
      }));

      it('should throw error on invalid `callback` argument', function () {
        expect(helpers.extendBuilder.bind(helpers, this.knex, {})).to.throwError((err) => {
          expect(err).to.be.a(TypeError);
        });
      });

    });

  });

});

// TODO multi db tests
