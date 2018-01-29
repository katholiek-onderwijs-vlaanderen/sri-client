const util = require('util');
var validate = require('jsonschema').validate;

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
  const expand = options.expand;
  options.expand = undefined;
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
  if(expand) {
    await expandJson(allResults, options.expand, core);
  }
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
    //var query = paramsToString(baseHref, params) + '&'+parameterName+'=';
    let parameterValue = '';
    for(var i = 0; i <= (options.groupBy ? options.groupBy : splitSize) && total < hrefs.length; i++) {
      map[hrefs[i]] = null;
      parameterValue += (i === 0 ? '' : ',')+hrefs[total];
      total++;
    }
    params[parameterName] = parameterValue;
    //const partPromise = getAll(query, null, options, core);
    const partPromise = getAll(baseHref, params, options, core);
    promises.push(partPromise);
    partPromise.then(function(results) {
      allResults = allResults.concat(results);
    }).catch(function(error) {
      throw error;
    });
  }

  await Promise.all(promises);
  if(options.raw) {
    throw new Error('You can not get a raw result for getAllHrefs or getAllReferencesTo');
  } else if(options.asMap) {
    console.log('allresults:');
    console.log(allResults);
    allResults.forEach(function (item) {
      map[item.$$meta.permalink] = item;
    });
    return map;
  } else {
    return allResults;
  }

};

const getAllReferencesTo = async function (baseHref, params = {}, parameterName, values, options = {}, core) {
  params = params || {};
  options = options || {};
  params.limit = 500;
  return getAllHrefsWithoutBatch(baseHref, parameterName, values, params, options, core);
};

const getAllHrefs = async function (hrefs, batchHref, params = {}, options = {}, core) {
  params = params || {};
  options = options || {};
  params.limit = 500;
  const hrefParts = hrefs[0].split('/');
  hrefParts.splice(hrefParts.length-1);
  const baseHref = hrefParts.join('/');
  if(!batchHref) {
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

const travelHrefsOfObject = function(object, propertyArray, hrefsMap, first) {
  //console.log(object)
  console.log('json is:')
  console.log(object)
  if(object.href) {
    if(object.$$expanded) {
      return travelHrefsOfJson(object.$$expanded, propertyArray, hrefsMap);
    } else if (first && object.body) {
      return travelHrefsOfJson(object.body, propertyArray, hrefsMap);
    }
    if(hrefsMap) {
      console.log('set the $$expanded from the hrefMap:')
      console.log(hrefsMap)
      object.$$expanded = hrefsMap[object.href];
      return travelHrefsOfJson(object.$$expanded, propertyArray);
    } else {
      return [object.href];
    }
  } else {
    return travelHrefsOfJson(object, propertyArray, hrefsMap);
  }
};

const travelHrefsOfJson = function(json, propertyArray, hrefsMap, first) {
  console.log(propertyArray)
  console.log(first)

  if(propertyArray.length === 0) {
    return [];
  }
  let hrefs = [];
  if(json.$$meta && json.results) {
    json = json.results;
  }
  if(first && Array.isArray(json)) {
    for(let item of json) {
      hrefs = [...hrefs, ...travelHrefsOfObject(item, propertyArray, hrefsMap, true)];
    }
  } else {
    const nextPropertyName = propertyArray.shift();
    const subResource = json[nextPropertyName];
    if(!subResource) {
      throw new Error('There is no property ' + nextPropertyName + ' in the resouce: \n' + util.inspect(json, {depth: 5}));
    }
    if(Array.isArray(subResource)) {
      for(let item of subResource) {
        hrefs = [...hrefs, ...travelHrefsOfObject(item, propertyArray, hrefsMap)];
      }
    } else {
      hrefs = travelHrefsOfObject(subResource, propertyArray, hrefsMap);
    }
  }
  return hrefs;
};

const add$$expanded = async function(hrefs, json, property, core) {
  // make configurable to know on which batch the hrefs can be retrieved
  const results = await getAllHrefs(hrefs, null, {}, {asMap: true}, core);
  const newHrefs = travelHrefsOfJson(json, property.split('.'), results, true);
  console.log('the hrefs zijn:')
    console.log(hrefs);
  if(newHrefs.length > 0) {
    console.log('en nu expanden maar:')
    await add$$expanded(newHrefs, json, property, core);
  }
}

const expandJson = async function(json, properties, core) {
  if(!Array.isArray(properties)) {
    properties = [properties];
  }
  const promises = [];
  //let everythingWasAlreadyExpanded = true;
  for(let property of properties) {
    const hrefs = travelHrefsOfJson(json, property.split('.'), null, true);
    console.log('the hrefs zijn')
    console.log(hrefs);
    if(hrefs.length > 0) {
      console.log('en nu expanden maar')
      //promises.push(add$$expanded(hrefs, json, property, core));
      await add$$expanded(hrefs, json, property, core);

      //everythingWasAlreadyExpanded = false;
      // make configurable to know on which batch the hrefs can be retrieved
      /*promises.push(getAllHrefs(hrefs, null, {}, {asMap: true}, core).then( results => {
        console.log('race')
        travelHrefsOfJson(json, property.split('.'), results, true);
      }));*/
    }
  };
  await Promise.all(promises);
  /*console.log('conditie')
  if(!everythingWasAlreadyExpanded) {
    await expandJson(json, properties, core);
  }*/
};


/*{ type: “SCHOOL” },
             { limit: 10,
               include: [
                 { alias: “rels”,
                   url: “/ous/relations”,
                   reference: “from”,
                   params: { type: “IS_PART_OF” }
                   collapsed: false,
                   expand: [ “to” ]
                   //include: [ { alias: … } ]
                 }
               ]
               expand: [ “institutionNumber” ]
              }*/
const includeOptionsSchema = {
  type: "object",
  properties: {
    alias: {
      type: "string"
    },
    url: {
      type: "string",
      pattern: "^\/.*$"
    },
    reference: {
      type: "string"
    },
    params: {
      type:"object"
    },
    collapsed: {
      type: "boolean"
    },
    expand: {
      type: "array",
      items: {
        type: "string"
      }
    }
  },
  required: ['alias', 'url', 'reference']
};
const include = async function(json, inclusions) {
  if(!Array.isArray(inclusions)) {
    inclusions = [inclusions];
  }
  for(let options of inclusions) {
    validate(options, includeOptionsSchema);
    const hrefs = travelHrefsOfJson(json, options.reference.split('.'), null, true);
  }
}

module.exports = {
  paramsToString: paramsToString,
  getList: getList,
  getAll: getAll,
  getAllHrefs: getAllHrefs,
  getAllReferencesTo: getAllReferencesTo,
  expand: expandJson
};