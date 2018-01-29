const _ = require('lodash');
let now = null;

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
}

function getNow() {
  'use strict';
  if(now) {
    return toString(now);
  }
  return toString(new Date());
}

function setNow(newNow) {
  'use strict';
  now = parse(newNow);
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

function isOverlapping(a, b) {
  'use strict';
  return isBefore(a.startDate, b.endDate) && isAfter(a.endDate, b.startDate);
}

function isConsecutive(a, b) {
  return (a.endDate !== null && a.endDate === b.startDate) || (b.endDate !== null && b.endDate === a.startDate);
}

function isConsecutiveWithOneDayInBetween(a, b) {
  return (a.endDate !== null && getNextDay(a.endDate) === b.startDate) || (b.endDate !== null && getNextDay(b.endDate) === a.startDate);
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

function getActiveResources(array, referenceDate = getNow()) {
  return _.filter(array, function(resource) {
    if(resource.$$expanded) {
      resource = resource.$$expanded;
    }
    return resource.startDate <= referenceDate && (!resource.endDate || resource.endDate > referenceDate);
  });
};

function getNonAbolishedResources(array, referenceDate = getNow()) {
  return _.filter(array, function(resource) {
    if(resource.$$expanded) {
      resource = resource.$$expanded;
    }
    return resource.startDate <= referenceDate;
  });
};

function onEndDateSet(newEndDate, oldEndDate, dependencies, batch) {
  if(newEndDate === oldEndDate) {
    return;
  }
  for(let dependency of dependencies) {
    if(dependency.endDate === oldEndDate) {
      const index = _.findIndex(batch, elem => elem.href === dependency.$$meta.permalink);
      if(index > -1) {
        batch[index].body.endDate = newEndDate;
      } else {
        dependency.endDate = newEndDate;
        batch.push({
          href: dependency.$$meta.permalink,
          verb: 'PUT',
          body: dependency
        });
      }
    }
  }
}

function onStartDateSet(newStartDate, oldStartDate, dependencies, batch) {
  if(newStartDate === oldStartDate) {
    return;
  }
  for(let dependency of dependencies) {
    if(dependency.startDate === oldStartDate) {
      const index = _.findIndex(batch, elem => elem.href === dependency.$$meta.permalink);
      if(index > -1) {
        batch[index].body.startDate = newStartDate;
      } else {
        dependency.startDate = newStartDate;
        batch.push({
          href: dependency.$$meta.permalink,
          verb: 'PUT',
          body: dependency
        });
      }
    }
  }
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
  isOverlapping: isOverlapping,
  isConsecutive: isConsecutive,
  isConsecutiveWithOneDayInBetween: isConsecutiveWithOneDayInBetween,
  getStartOfSchoolYear: getStartofSchoolYear,
  getEndOfSchoolYear: getEndofSchoolYear,
  getPreviousDay: getPreviousDay,
  getNextDay: getNextDay,
  getActiveResources: getActiveResources,
  getNonAbolishedResources: getNonAbolishedResources,
  onStartDateSet: onStartDateSet,
  onEndDateSet: onEndDateSet
};
