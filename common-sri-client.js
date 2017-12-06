
const getAllFromResult = async function (data, config, core) {
  var results = data.results;
  if (data.$$meta.next) {
    const nextResult = await core.doGet(data.$$meta.next, undefined, config);
    const nextResults = await getAllFromResult(nextResult, config);
    results = results.concat(nextResults);
  }
  return results;
};

const getAll = async function (href, params = {}, config = {}, core) {
  params.limit = 500;
  const result = await core.doGet(href, params, config);
  var allResults = await getAllFromResult(result, config, core);
  if (!config.raw && !(params && params.expand && params.expand === 'NONE')) {
    allResults = allResults.map(function (item) {
      return item.$$expanded;
    });
  }
  allResults.count = function () {
    return result.$$meta.count;
  };
  return allResults;
};

const getList = async function (href, params, config = {}, core) {
  const result = await core.doGet(href, params, config);
  var results = result.results;
  if (!config.raw && !(params && params.expand && params.expand === 'NONE')) {
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
const getAllHrefsWithoutBatch = async function (baseHref, parameterName, hrefs, params, config, core) {
  var total = 0;
  const promises = [];
  var allResults = [];
  const map = {};
  while(total < hrefs.length) {
    var query = paramsToString(baseHref, params) + '&'+parameterName+'=';
    for(var i = 0; i <= (config.groupBy ? config.groupBy : splitSize) && total < hrefs.length; i++) {
      map[hrefs[i]] = null;
      query += (i === 0 ? '' : ',')+hrefs[total];
      total++;
    }
    const partPromise = getAll(query, null, config);
    promises.push(partPromise);
    partPromise.then(function(results) {
      allResults = allResults.concat(results);
    }).catch(function(error) {
      throw error;
    });

    await Promise.all(promises);
    if(config.raw) {
      throw new Error('You can not get a raw result for getAllHrefs or getAllReferencesTo');
    } else if(config.asMap) {
      allResults.forEach(function (item) {
        map[item.href] = item.$$expanded;
      });
      return map;
    } else {
      return allResults;
    }
  }
};

const getAllReferencesTo = async function (baseHref, params = {}, parameterName, values, config = {}, core) {
  params.limit = 500;
  return getAllHrefsWithoutBatch(baseHref, 'hrefs', values, params, config, core);
};

const getAllHrefs = async function (hrefs, batchHref, params = {}, config = {}, core) {
  params.limit = 500;
  const hrefParts = hrefs[0].split('/');
  hrefParts.splice(hrefParts.length-1);
  const baseHref = hrefParts.join('/');
  if(!batchHref !== 'hrefs') {
    return getAllHrefsWithoutBatch(baseHref, 'hrefs', hrefs, params, config, core);
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
  const batchResp = await core.sendPayload(batchHref, batchHref === '/persons/batch' ? 'PUT' : 'GET', config);
  return new Promise(function(resolve, reject) {
    var ret = [];
    for(var i = 0; i < batchResp.length; i++) {
      if(batchResp[i].status === 200) {
        var results = batchResp[i].body.results;
        if(config.asMap) {
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
    if(config.asMap) {
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