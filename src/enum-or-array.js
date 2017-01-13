
const enumOrArray = function (value, enums) {
  if (typeof value === 'string') {
    return enums.indexOf(value) !== -1;
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; ++i) {
      if (typeof value[i] !== 'string' || enums.indexOf(value[i]) === -1) {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
};

module.exports = enumOrArray;
