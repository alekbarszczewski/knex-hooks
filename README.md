
# knex-hooks

[![Build Status](https://travis-ci.org/alekbarszczewski/knex-hooks.svg?branch=master)](https://travis-ci.org/alekbarszczewski/knex-hooks)

Allows to easily add before/after insert/update/delete/select hooks to knex.

## Install

```sh
npm install --save knex-hooks
```

## Usage

```js
const knexHooks = require('knex-hooks');

const knex = require('knex')({
  client: 'pg',
  connection: 'postgres://localhost/db',
});

// init knex-hooks on knex instance
knexHooks(knex);

// add hook
knex.addHook('before', 'insert', 'users', (when, method, table, params) => {

  // use helper to extract insert data from query builder
  const data = knexHooks.helpers.getInsertData(params.query);

  // check if it's single row or multi row insert
  const rows = Array.isArray(data) ? data : [data];

  // modify insert data for each row
  rows.forEach(row => {
    row.created_at = new Date();
  });
});

knex('users').insert({ name: 'john' }).then(...);
```

#### Adding hooks

```js
knex.addHook(when, method, table, function callback (when, method, table, params) {
  // if it's `before` hook you can use params.query to modify query
  // if it's `after` hook you can use params.result to modify query result by either modifying it or assigning your custom response to params.result
  // you can return promise here
});
```

Adds new hook to knex instance

| argument | type                 | possible values / description / examples
|----------|----------------------|-----------------------
| when     | string/array<string> | `"before"`, `"after"`, `"*"`, `["before", "after"]`
| method   | string/array<string> | `"insert"`, `"update"`, `"delete"`, `"select"`, `"*"`, `["insert", "update", ...]`
| table    | string/array<string> | `"my_table"`, `"*"`, `["my_table1", "my_table2", ...]`

Callback arguments

| argument      | type         | possible values / description / examples
|---------------|--------------|-----------------------
| when          | string       | `"before"`, `"after"`
| method        | string       | `"insert"`, `"update"`, `"delete"`, `"select"`
| table         | string       | `"my_table"`
| params        | object       |
| params.query  | knex Builder | *knex query builder instance* (ie. `knex('table').insert('*')`)
| params.result | query result | *query result (only for `after` hooks) - might be modified/replaced by previous hooks*

#### Modifying query in 'before' hooks

```js
const helpers = require('knex-hooks').helpers;

// before insert
knex.addHook('before', 'insert', 'users', (when, method, table, params) => {
  const insertData = helpers.getInsertData(params.query);
  insertData['created_at'] = insertData['updated_at'] = new Date();
});
knex('users').insert({ name: 'john' }).then(...);

// before update
knex.addHook('before', 'update', 'users', (when, method, table, params) => {
  const updateData = helpers.getUpdateData(params.query);
  updateData['updated_at'] = new Date();
});
knex('users').update({ name: 'john' }).then(...);

// before select
knex.addHook('before', 'select', 'users', (when, method, table, params) => {
  params.query.where({ is_deleted: false });
});
knex('users').select('*').then(...);
```

#### Modifying query result in 'after' hooks

```js
knex.addHook('after', 'select', 'users', (when, method, table, params) => {
  params.result.forEach(row => {
    row['full_name'] = row['first_name'] + ' ' + row['last_name'];
  })
});
knex('users').select('*').then(...);
```

#### Disabling hooks

You can disable ALL hooks on individual query by calling `.hooks(false)` method on knex builder:

```js
knex('users').insert({ name: 'john' }).hooks(false).then(...); // hooks won't run for this query
```

#### Helpers

**getInsertData** / **getUpdateData**

These helpers allows to easily get inert/update data from knex builder

```js
const helpers = require('knex-hooks').helpers;

helpers.getInsertData( knex('users').insert({ name: 'john' }) ); // returns { name: 'john' }
helpers.getUpdateData( knex('users').update({ name: 'john' }) ); // returns { name: 'john' }
```

**extendKnex**

Allows to modify knex instance (even sub-instances created by transations)

```js
const helpers = require('knex-hooks').helpers;

helpers.extendKnex(knex, function callback (knex, isRoot) {
  // knex is instance you passed as first argument (isRoot = true) or transaction-specific instance (isRoot = false)
  // you can modify knex/knex.client here
});
```

**extendBuilder**

Allows to modify knex builder (even sub-instances created by transations)

```js
const helpers = require('knex-hooks').helpers;

helpers.extendBuilder(knex, function callback (builder, isRoot) {
  // builder is knex query builder instance
  // you can modify builder here (ie. add some methods/properties to it)
  // for example builder.myCustomMethod = function () { this._myCustomFlag = true; };
});
```
