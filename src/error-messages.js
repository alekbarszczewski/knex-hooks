
module.exports = {
  addHook_when: 'argument `when` must be "before", "after", "*" or array of those values',
  addHook_method: 'argument `method` must be "insert", "update", "delete", "select", "*" or array of those values',
  addHook_table: 'argument `table` must be a string or array of strings',
  addHook_handler: 'argument `handler` must be a function',
  getInsertData_builder: 'argument `builder` must be instanceof knex query builder',
  getUpdateData_builder: 'argument `builder` must be instanceof knex query builder',
  extendKnex_callback: 'argument `callback` must be a function',
  extendBuilder_callback: 'argument `callback` must be a function',
};
