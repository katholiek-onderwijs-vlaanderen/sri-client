const _ = require('lodash');
let now = null;

function appendZero(number) {
  'use strict';
  return number > 9 ? number : 0 + '' + number;
}
function toString(date) {
  'use strict';
  if(!date) {
    return date;
  }
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

function stripTime(isoDateStr) {
  'use strict';
  return isoDateStr ? isoDateStr.split('T')[0] : isoDateStr;
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

function isCovering(a, b) {
  'use strict';
  return isBeforeOrEqual(a.startDate, b.startDate) && isAfterOrEqual(a.endDate, b.endDate);
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

function getNextDay(date, nbOfDays = 1) {
  if (!date) {
    return date;
  }
  let nextDay = parse(date);
  nextDay.setDate(nextDay.getDate() + nbOfDays);
  return toString(nextDay);
}

function getPreviousDay(date, nbOfDays = 1) {
  if (!date) {
    return date;
  }
  let previousDay = parse(date);
  previousDay.setDate(previousDay.getDate() - nbOfDays);
  return toString(previousDay);
}

function getPreviousMonth(date, nbOfMonths = 1) {
  if(!date) {
    return date;
  }
  let previousMonth = parse(date);
  previousMonth.setMonth(previousMonth.getMonth() - nbOfMonths);
  return toString(previousMonth);
}

function getNextMonth(date, nbOfMonths = 1) {
  if(!date) {
    return date;
  }
  let nextYear = parse(date);
  nextYear.setMonth(nextYear.getMonth() + nbOfMonths);
  return toString(nextYear);
}

function getPreviousYear(date, nbOfYears = 1) {
  if(!date) {
    return date;
  }
  let previousYear = parse(date);
  previousYear.setFullYear(previousYear.getFullYear() - nbOfYears);
  return toString(previousYear);
}

function getNextYear(date, nbOfYears = 1) {
  if(!date) {
    return date;
  }
  let nextYear = parse(date);
  nextYear.setFullYear(nextYear.getFullYear() + nbOfYears);
  return toString(nextYear);
}

function getActiveResources(array, referenceDate = getNow()) {
  return _.filter(array, function(resource) {
    if(resource.$$expanded) {
      resource = resource.$$expanded;
    }
    return resource.startDate <= referenceDate && isAfter(resource.endDate, referenceDate);
  });
};

function getNonAbolishedResources(array, referenceDate = getNow()) {
  return _.filter(array, function(resource) {
    if(resource.$$expanded) {
      resource = resource.$$expanded;
    }
    return isAfter(resource.endDate, referenceDate);
  });
};

/*function onEndDateSet(newEndDate, oldEndDate, dependencies, batch) {
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
}*/

class DateError {
  constructor(message, periodic) {
    this.message = message;
    this.periodic = periodic;
  }
}

const adaptPeriod = function(resource, options, periodic, referenceOptions) {
  const onlyEnlargePeriod = referenceOptions && referenceOptions.onlyEnlargePeriod;
  const onlyShortenPeriod = referenceOptions && referenceOptions.onlyShortenPeriod;
  const startDateChanged = options.oldStartDate && (
          (!onlyEnlargePeriod && !onlyShortenPeriod && options.oldStartDate !== resource.startDate) ||
          (onlyEnlargePeriod && !onlyShortenPeriod && isBefore(resource.startDate, options.oldStartDate)) ||
          (onlyShortenPeriod && !onlyEnlargePeriod && isAfter(resource.startDate, options.oldStartDate))
        );
  const endDateChanged =
        (!onlyEnlargePeriod && !onlyShortenPeriod && options.oldEndDate !== resource.endDate) ||
        (onlyEnlargePeriod && !onlyShortenPeriod && isAfter(resource.endDate, options.oldEndDate)) ||
        (onlyShortenPeriod && !onlyEnlargePeriod && isBefore(resource.endDate, options.oldEndDate));

  let ret = false;

  if(endDateChanged) {
    if(options.intermediateStrategy && isBefore(resource.endDate, options.oldEndDate) && isAfter(periodic.endDate, resource.endDate)) {
      if(options.intermediateStrategy === 'FORCE') {
        periodic.endDate = resource.endDate;
        ret = true;
      } else if(options.intermediateStrategy === 'ERROR') {
        throw new DateError(periodic.$$meta ? periodic.$$meta.permalink : JSON.stringify(periodic) + ' has an endDate ('+periodic.endDate+') in between the new endDate and the old endDate.', periodic);
      }
    } else if(periodic.endDate === options.oldEndDate) {
      periodic.endDate = resource.endDate;
      ret = true;
    } else if(isAfterOrEqual(periodic.startDate, resource.endDate)) {
      throw new DateError(periodic.$$meta ? periodic.$$meta.permalink : JSON.stringify(periodic) + ' starts after the new endDate, ' + resource.endDate, periodic);
    }
  }
  if(startDateChanged) {
    if(options.intermediateStrategy && periodic.startDate !== options.startDate && isAfter(resource.startDate, options.oldStartDate) && isBefore(periodic.startDate, resource.startDate)) {
      if(options.intermediateStrategy === 'FORCE') {
        periodic.startDate = resource.startDate;
        ret = true;
      } else if(options.intermediateStrategy === 'ERROR') {
        throw new DateError(periodic.$$meta ? periodic.$$meta.permalink : JSON.stringify(periodic) + ' has a startDate ('+periodic.startDate+') in between the old startDate and the new startDate.', periodic);
      }
    } else if(periodic.startDate === options.oldStartDate) {
      periodic.startDate = resource.startDate;
      ret = true;
    } else if(isBeforeOrEqual(periodic.endDate, resource.startDate)) {
      throw new DateError(periodic.$$meta ? periodic.$$meta.permalink : JSON.stringify(periodic) + ' ends before the new startDate, ' + resource.startDate, periodic);
    }
  }
  return ret;
};

const manageDateChanges = async function(resource, options, api) {
  const startDateChanged = options.oldStartDate && options.oldStartDate !== resource.startDate;
  const endDateChanged = options.oldEndDate !== resource.endDate;

  if(!startDateChanged && !endDateChanged) {
    return null;
  }

  if(options.properties) {
    for(let property of options.properties) {
      if(Array.isArray(resource[property])) {
        for(let elem of resource[property]) {
          adaptPeriod(resource, options, elem);
        }
      } else {
        adaptPeriod(resource, options, resource[property]);
      }
    }
  }

  const ret = {};

  if(options.references) {
    if(!Array.isArray(options.references)) {
      options.references = [options.references];
    }

    for(let reference of options.references) {
      let changes = [];
      reference.parameters = reference.parameters || {};
      if(reference.property) {
        reference.parameters[reference.property] = resource.$$meta.permalink;
      } else if(reference.commonReference) {
        reference.parameters[reference.commonReference] = resource[reference.commonReference].href;
      } else {
        throw new Error('You either have to add a reference or a commonProperty to the configuration for references.');
      }
      if(startDateChanged && !endDateChanged && !options.intermediateStrategy) {
        reference.parameters.startDate = options.oldStartDate;
      }
      //reference.options = {logging: 'debug'}
      const dependencies = await api.getAll(reference.href, reference.parameters, reference.options);
      if(reference.filter) {
        dependencies.filter(reference.filter);
      }
      dependencies.forEach( (dependency, $index) => {
        const batchIndex = options.batch ? _.findIndex(options.batch, elem => elem.href === dependency.$$meta.permalink) : -1;
        const body = batchIndex === -1 ? dependency : options.batch[batchIndex].body;
        const changed = adaptPeriod(resource, options, body, reference);
        if(changed) {
          changes.push(body);
          if(options.batch && batchIndex === -1) {
            options.batch.push({
              href: body.$$meta.permalink,
              verb: 'PUT',
              body: body
            });
          }
        }
      });
      if(reference.alias) {
        ret[reference.alias] = changes;
      }
    }
  }

  return ret;
};

module.exports = {
  getNow: getNow,
  setNow: setNow,
  stripTime: stripTime,
  toString: toString,
  parse: parse,
  isBeforeOrEqual: isBeforeOrEqual,
  isAfterOrEqual: isAfterOrEqual,
  isBefore: isBefore,
  isAfter: isAfter,
  getFirst: getFirst,
  getLast: getLast,
  isOverlapping: isOverlapping,
  isCovering: isCovering,
  isConsecutive: isConsecutive,
  isConsecutiveWithOneDayInBetween: isConsecutiveWithOneDayInBetween,
  getStartOfSchoolYear: getStartofSchoolYear,
  getEndOfSchoolYear: getEndofSchoolYear,
  getPreviousDay: getPreviousDay,
  getNextDay: getNextDay,
  getPreviousMonth: getPreviousMonth,
  getNextMonth: getNextMonth,
  getPreviousYear: getPreviousYear,
  getNextYear: getNextYear,
  getActiveResources: getActiveResources,
  getNonAbolishedResources: getNonAbolishedResources,
  //onStartDateSet: onStartDateSet,
  //onEndDateSet: onEndDateSet,
  manageDateChanges: manageDateChanges,
  DateError: DateError
};
