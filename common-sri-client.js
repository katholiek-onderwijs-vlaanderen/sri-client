const util = require('util');
const validate = require('jsonschema').validate;
const commonUtils = require('./common-utils');

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
  params.limit = params.limit || 500;
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
    await expandJson(allResults, expand, core);
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
  params.expand = 'FULL';
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
    const thisParams = Object.assign({}, params);
    thisParams[parameterName] = parameterValue;
    //const partPromise = getAll(query, null, options, core);
    const partPromise = getAll(baseHref, thisParams, options, core);
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
    allResults.forEach(function (item) {
      map[item.$$meta.permalink] = item;
    });
    return map;
  } else {
    return allResults;
  }

};

const getAllReferencesTo = function (baseHref, params = {}, parameterName, values, options = {}, core) {
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
  const batchResp = await core.sendPayload(batchHref, batch, options, batchHref === '/persons/batch' ? 'PUT' : 'POST', core.my);
  if(options.expand) {
    await expandJson(batchResp, options.expand, core);
  }
  if(options.include) {
    await includeJson(batchResp, options.include, core);
  }
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

const includeOptionsSchema = {
  type: "object",
  properties: {
    alias: {
      type: "string"
    },
    href: {
      type: "string",
      pattern: "^\/.*$"
    },
    reference: {
      oneOf: [{
        type: "string"
      }, {
        type: "object",
        properties: {
          property: {
            type: "string"
          },
          parameterName: {
            type: "string"
          }
        },
        required: ["property"]
      }]
    },
    params: {
      type:"object"
    },
    collapsed: {
      type: "boolean"
    },
    singleton: {
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

const travelHrefsOfObject = function(object, propertyArray, options) {// required, handlerFunction, resource) {
  if(propertyArray.length === 1 && typeof object[propertyArray[0]] === 'string' && object[propertyArray[0]].match(/^(\/[-a-zA-Z0-9@:%_\+.~#?&=]+)+$/g)) {
    if(options.handlerFunction) {
      return options.handlerFunction(object, propertyArray, options.resource, true);
    } else {
      return [object[propertyArray[0]]];
    }
  }
  if(object.href) {
    if(object.$$expanded) {
      options.resource = options.resource ? options.resource : object.$$expanded;
      /*console.log(propertyArray)
      if(propertyArray[0] === '$$contactDetails')
      console.log(object)*/
      return travelHrefsOfJson(object.$$expanded, propertyArray, options);
    } else if (!options.resource && object.body) {
      return travelHrefsOfJson(object.body, propertyArray, options);
    }
    if(options.handlerFunction) {
      return options.handlerFunction(object, propertyArray, options.resource);
    } else {
      return [object.href];
    }
  } else {
    return travelHrefsOfJson(object, propertyArray, options);
  }
};

const travelHrefsOfJson = function(json, propertyArray, options = {}) {//, required = true, handlerFunction, resource) {
  options.required = options.required === false ? options.required : true;
  if(propertyArray.length === 0) {
    return [];
  }
  let hrefs = [];
  if(json.$$meta && json.results) {
    json = json.results;
  }
  if(!options.resource && Array.isArray(json)) {
    for(let item of json) {
      hrefs = [...hrefs, ...travelHrefsOfObject(item, [...propertyArray], Object.assign({}, options))];
    }
  } else {
    if(!options.resource) {
      options.resource = json;
    }
    const nextPropertyName = propertyArray.shift();
    const subResource = json[nextPropertyName];
    if(!subResource) {
      // When the config says the property is not required
      if(!options.required) {
        return [];
      }
      throw new Error('There is no property ' + nextPropertyName + ' in the object: \n' + util.inspect(json, {depth: 5}) + '\n Set required = false if the property path contains non required resources.');
    }
    if(Array.isArray(subResource)) {
      for(let item of subResource) {
        hrefs = [...hrefs, ...travelHrefsOfObject(item, [...propertyArray], Object.assign({}, options))];
      }
    } else {
      hrefs = travelHrefsOfObject(subResource, propertyArray, options);
    }
  }
  return hrefs;
};

const travelResoure = function(resource, handlerFunction) {
  if(handlerFunction) {
    return handlerFunction(resource);
  } else {
    return resource;
  }
};

const travelResourcesOfJson = function(json, handlerFunction) {
  let resources = [];
  if(json.$$meta && json.results) {
    json = json.results;
  }
  if(Array.isArray(json)) {
    for(let item of json) {
      if(item.href) {
        if(item.$$expanded) {
           resources = [...resources, travelResoure(item.$$expanded, handlerFunction)];
        } else if (item.body) {
          resources = [...resources, ...travelResourcesOfJson(item.body, handlerFunction)];
        }
      } else {
        resources = [...resources, travelResoure(item, handlerFunction)];
      }
    }
  } else {
    resources = [travelResoure(json, handlerFunction)];
  }
  return resources;
};

const add$$expanded = async function(hrefs, json, properties, includeOptions, core) {
  const pathsMap = {};
  const hrefsMap = {};
  //group all hrefs with the same path together so we can also retreive them togheter in one API call
  for(let href of hrefs) {
    const path = commonUtils.getPathFromPermalink(href);
    if(!pathsMap[path]) {
      pathsMap[path] = [];
    }
    pathsMap[path].push(href);
  }
  const promises = [];
  for(let path of Object.keys(pathsMap)) {
    // TODO: make configurable to know on which batch the hrefs can be retrieved
    promises.push(getAllHrefs(pathsMap[path], null, {}, {asMap: true, include: includeOptions}, core).then(function(newMap) {
      Object.assign(hrefsMap, newMap);
    }));
  }
  await Promise.all(promises);
  let newHrefs = new Set();
  for(let property of properties) {
    let propertyName = property;
    let required = true;
    if (!(typeof property === 'string' || property instanceof String)) {
      propertyName = property.property;
      required = property.required;
    }
    const localHrefs = travelHrefsOfJson(json, propertyName.split('.'), {
      required: required,
      handlerFunction: function(object, propertyArray, resource, isDirectReference) {
        let expandedObject = hrefsMap[object.href];
        if(!expandedObject) {
          return [object.href];
        }
        if(isDirectReference) {
          object['$$'+propertyArray[0]] = hrefsMap[object[propertyArray[0]]];
          return travelHrefsOfJson(object['$$'+propertyArray[0]], propertyArray);
        }
        object.$$expanded = expandedObject;
        return travelHrefsOfJson(object.$$expanded, propertyArray);
      }
    });
    newHrefs = new Set([...newHrefs, ...localHrefs]);
  };
  if(newHrefs.size > 0) {
    await add$$expanded(newHrefs, json, properties, null, core);
  }
  /*// make configurable to know on which batch the hrefs can be retrieved
  const hrefsMap = await getAllHrefs(hrefs, null, {}, {asMap: true, include: includeOptions}, core);
  const newHrefs = travelHrefsOfJson(json, property.split('.'), function(object, propertyArray, resource, isDirectReference) {
    if(isDirectReference) {
      object['$$'+propertyArray[0]] = hrefsMap[object[propertyArray[0]]];
      return travelHrefsOfJson(object['$$'+propertyArray[0]], propertyArray);
    }
    object.$$expanded = hrefsMap[object.href];
    return travelHrefsOfJson(object.$$expanded, propertyArray);
  });
  if(newHrefs.length > 0) {
    await add$$expanded(newHrefs, json, property, null, core);
  }*/
};

const expandJson = async function(json, properties, core) {
  if(!Array.isArray(properties)) {
    properties = [properties];
  }
  let allHrefs = new Set();
  for(let property of properties) {
    let propertyName = property;
    let includeOptions = null;
    let required = true;
    if (!(typeof property === 'string' || property instanceof String)) {
      propertyName = property.property;
      includeOptions = property.include;
      required = property.required;
    }
    if(includeOptions) {
      let localHrefs = travelHrefsOfJson(json, propertyName.split('.'), {required: required});
      if(localHrefs.length > 0) {
        await add$$expanded(localHrefs, json, [property], includeOptions, core);
      }
    } else {
      allHrefs = new Set([...allHrefs, ...travelHrefsOfJson(json, propertyName.split('.'), {required: required})]);
    }
  };
  if(allHrefs.size > 0) {
    await add$$expanded(allHrefs, json, properties, null, core);
  }
};

const includeJson = async function(json, inclusions, core) {
  if(!Array.isArray(inclusions)) {
    inclusions = [inclusions];
  }
  for(let options of inclusions) {
    validate(options, includeOptionsSchema);
    options.expanded = options.expanded ? options.expanded : true; // default is true
    //options.required = options.required ? options.required : true; // default is true
    //options.reference can just be a string when the parameter name is the same as the reference property itself or it can be an object which specifies both.
    let referenceProperty = options.reference;
    let referenceParameterName = options.reference;
    if (!(typeof options.reference === 'string' || options.reference instanceof String)) {
      referenceProperty = options.reference.property;
      referenceParameterName = options.reference.parameterName ? options.reference.parameterName : referenceProperty;
    }
    if(!options.expanded) {
      // with collapsed you can not get all references and map them again because the resource information will not be there
      const promises = [];
      travelHrefsOfJson(json, ('$$meta.permalink').split('.'), {
        required: true,
        handlerFunction: function(object, propertyArray, resource) {
          options.filters = options.filters || {};
          if(options.collapsed) {
            options.filters.expand = 'NONE';
          }
          options.filters[referenceParameterName] = object[propertyArray[0]];
          promises.push(getAll(options.href, options.filters, {include: options.include}, core).then(function(results) {
            resource['$$'+options.alias] = options.singleton ? (results.length === 0 ? null : results[0]) : results;
          }));
          return [];
        }
      });
      await Promise.all(promises);
    } else {
      const hrefs = travelHrefsOfJson(json, ('$$meta.permalink').split('.'));
      const results = await getAllReferencesTo(options.href, options.filters, referenceParameterName, hrefs, {expand: options.expand, include: options.include}, core);
      const map = {};
      for(let result of results) {
        const permalinks = travelHrefsOfJson(result, referenceProperty.split('.'), {required: true});
        if(permalinks.length > 1) {
          console.warn('SRI_CLIENT_INCLUDE: we do not support yet the possibility that options.reference references an array property. Contact us to request that we add this feature.');
        }
        const permalink = permalinks[0];
        if(!map[permalink]) {
          map[permalink] = [];
        }
        map[permalink].push(result);
      }
      // travel resources and add $$ included property
      const resources = travelResourcesOfJson(json);
      for(let resource of resources) {
        let inclusions = map[resource.$$meta.permalink];
        if(!inclusions) {
          inclusions = [];
        }
        resource['$$'+options.alias] = options.singleton ? (inclusions.length === 0 ? null : inclusions[0]) : inclusions;
      }
    }
  }
};

module.exports = {
  paramsToString: paramsToString,
  getList: getList,
  getAll: getAll,
  getAllHrefs: getAllHrefs,
  getAllReferencesTo: getAllReferencesTo,
  expand: expandJson,
  include: includeJson
};