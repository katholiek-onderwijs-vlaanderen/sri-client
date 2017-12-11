
const getAllFromResult = async function (data, options, core) {
  var results = data.results;
  if (data.$$meta.next) {
    const nextResult = await core.get(data.$$meta.next, undefined, options, core.my);
    const nextResults = await getAllFromResult(nextResult, options, core);
    results = results.concat(nextResults);
  }
  return results;
};

const getAll = async function (href, params = {}, options = {}, core) {
  params = params || {};
  options = options || {};
  params.limit = 500;
  const result = await core.get(href, params, options, core.my);
  var allResults = await getAllFromResult(result, options, core);
  if (!options.raw && !(params && params.expand && params.expand === 'NONE')) {
    allResults = allResults.map(function (item) {
      return item.$$expanded;
    });
  }
  allResults.count = function () {
    return result.$$meta.count;
  };
  return allResults;
};

const getList = async function (href, params, options = {}, core) {
  options = options || {};
  const result = await core.get(href, params, options, core.my);
  var results = result.results;
  if (!options.raw && !(params && params.expand && params.expand === 'NONE')) {
    results = results.map(function (item) {
      return item.$$expanded;
    });
  }
  results.count = function () {
    return result.$$meta.count;
  };
  return results;
};

const paramsToString = function (path, params) {
  var ret = path;
  for (var key in params) {
    if (params.hasOwnProperty(key)) {
      if(!ret.match(/\?/g)) {
        ret += '?';
      } else {
        ret += '&';
      }
      ret += key + '=' + params[key];
    }
  }
  return ret;
};

const splitSize = 100;
const getAllHrefsWithoutBatch = async function (baseHref, parameterName, hrefs, params, options, core) {
  var total = 0;
  const promises = [];
  var allResults = [];
  const map = {};
  while(total < hrefs.length) {
    var query = paramsToString(baseHref, params) + '&'+parameterName+'=';
    for(var i = 0; i <= (options.groupBy ? options.groupBy : splitSize) && total < hrefs.length; i++) {
      map[hrefs[i]] = null;
      query += (i === 0 ? '' : ',')+hrefs[total];
      total++;
    }
    const partPromise = getAll(query, null, options);
    promises.push(partPromise);
    partPromise.then(function(results) {
      allResults = allResults.concat(results);
    }).catch(function(error) {
      throw error;
    });

    await Promise.all(promises);
    if(options.raw) {
      throw new Error('You can not get a raw result for getAllHrefs or getAllReferencesTo');
    } else if(options.asMap) {
      allResults.forEach(function (item) {
        map[item.href] = item.$$expanded;
      });
      return map;
    } else {
      return allResults;
    }
  }
};

const getAllReferencesTo = async function (baseHref, params = {}, parameterName, values, options = {}, core) {
  params = params || {};
  options = options || {};
  params.limit = 500;
  return getAllHrefsWithoutBatch(baseHref, 'hrefs', values, params, options, core);
};

const getAllHrefs = async function (hrefs, batchHref, params = {}, options = {}, core) {
  params = params || {};
  options = options || {};
  params.limit = 500;
  const hrefParts = hrefs[0].split('/');
  hrefParts.splice(hrefParts.length-1);
  const baseHref = hrefParts.join('/');
  if(!batchHref !== 'hrefs') {
    return getAllHrefsWithoutBatch(baseHref, 'hrefs', hrefs, params, options, core);
  }
  var total = 0;
  const batch = [];
  const map = {};

  while(total < hrefs.length) {
    var query = paramsToString(baseHref, params) + '&hrefs'+'=';
    for(var i = 0; i <= 500 && total < hrefs.length; i++) {
      map[hrefs[i]] = null;
      query += (i === 0 ? '' : ',')+hrefs[total];
      total++;
    }
    var part = {
        verb: "GET",
        href: query
    };
    batch.push(part);
  }
  const batchResp = await core.sendPayload(batchHref, batchHref === '/persons/batch' ? 'PUT' : 'GET', options, core.my);
  return new Promise(function(resolve, reject) {
    var ret = [];
    for(var i = 0; i < batchResp.length; i++) {
      if(batchResp[i].status === 200) {
        var results = batchResp[i].body.results;
        if(options.asMap) {
          results.forEach(function (item) {
            map[item.href] = item.$$expanded;
          });
        } else {
          ret = ret.concat(results);
        }
      } else {
        reject(batchResp);
      }
    }
    if(options.asMap) {
      resolve(map);
    } else {
      resolve(ret);
    }
  });
};

module.exports = {
  paramsToString: paramsToString,
  getList: getList,
  getAll: getAll,
  getAllHrefs: getAllHrefs,
  getAllReferencesTo: getAllReferencesTo
};