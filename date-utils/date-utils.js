const _ = require('lodash');
let now = new Date();

function appendZero(number) {
  'use strict';
  return number > 9 ? number : 0 + '' + number;
}
function toString(date) {
  'use strict';
  return date.getFullYear() + '-' + appendZero(date.getMonth() + 1) + '-' + appendZero(date.getDate());
}

function parse(stringDate) {
  'use strict';
  if(!stringDate) {
    return undefined;
  }
  var parts = stringDate.split('-');
  return new Date(parseInt(parts[0], 10), appendZero(parseInt(parts[1], 10) - 1), appendZero(parseInt(parts[2], 10)));
  // return new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
}

function getNow() {
  'use strict';
  return toString(now);
}

function setNow(newNow) {
  'use strict';
  now = newNow;
}

function isBeforeOrEqual(a, b) {
  'use strict';
  return a === b || !b || (a !== null && a < b);
}

function isAfter(a, b) {
  'use strict';
  return !isBeforeOrEqual(a, b);
}

function isAfterOrEqual(a, b) {
  'use strict';
  return a === b || !a || (b !== null && a > b);
}

function isBefore(a, b) {
  'use strict';
  return !isAfterOrEqual(a, b);
}

function getFirst(array) {
  'use strict';
  _.remove(array, function (x) {
    return !x;
  });
  const sorted = array.sort(function (a, b) {
    return a < b ? -1 : 1;
  });
  return sorted[0];
}

function getLast(array) {
  'use strict';
  const index = _.findIndex(array, function (x) {
    return !x;
  });
  if (index > -1) {
    return null;
  }
  const sorted = array.sort(function (a, b) {
    return a < b ? -1 : 1;
  });
  return sorted[sorted.length - 1];
}

function overlaps(a, b) {
  'use strict';
  return isBefore(a.startDate, b.endDate) && isAfter(a.endDate, b.startDate);
}


function getEndofSchoolYear(stringDate) {
  'use strict';
  const date = parse(stringDate) || now;
  var ret = null;
  if (date.getMonth() < 8) {
    ret = toString(new Date(date.getFullYear(), 8, 1));
  } else {
    ret = toString(new Date(date.getFullYear() + 1, 8, 1));
  }
  return ret;
}

function getStartofSchoolYear(stringDate) {
  'use strict';
  const date = parse(stringDate) || now;
  var ret = null;
  if (date.getMonth() < 8) {
    ret = toString(new Date(date.getFullYear() - 1, 8, 1));
  } else {
    ret = toString(new Date(date.getFullYear(), 8, 1));
  }
  return ret;
}

function getNextDay(date) {
  'use strict';
  if (!date) {
    return date;
  }
  var nextDay = parse(date);
  nextDay.setDate(nextDay.getDate() + 1);
  return toString(nextDay);
}

function getPreviousDay(date) {
  'use strict';
  if (!date) {
    return date;
  }
  var nextDay = parse(date);
  nextDay.setDate(nextDay.getDate() - 1);
  return toString(nextDay);
}

module.exports = {
  getNow: getNow,
  setNow: setNow,
  toString: toString,
  parse: parse,
  isBeforeOrEqual: isBeforeOrEqual,
  isAfterOrEqual: isAfterOrEqual,
  isBefore: isBefore,
  isAfter: isAfter,
  getFirst: getFirst,
  getLast: getLast,
  isOverlapping: overlaps,
  getStartofSchoolYear: getStartofSchoolYear,
  getEndofSchoolYear: getEndofSchoolYear,
  getPreviousDay: getPreviousDay,
  getNextDay: getNextDay
};
