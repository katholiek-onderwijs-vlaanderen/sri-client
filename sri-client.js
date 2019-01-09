const util = require('util');
const validate = require('jsonschema').validate;
const commonUtils = require('./common-utils');
const Cache = require('./cache.js');
const Batch = require('./batch');

module.exports = class SriClient {
  constructor(config = {}) {
    this.configuration = config;
    this.groupBy = config.groupBy || 100;
    this.cache = new Cache(config.caching, this);
  }

  createBatch() {
    return new Batch(this);
  }

  /*get configuration() {
    return this._configuration;
  }

  set configuration(configuration) {
    this._configuration = configuration;
  }*/

  getBaseUrl(options) {
    const baseUrl = options.baseUrl || this.configuration.baseUrl;
    if (!baseUrl) {
      throw Error({message: "There is no baseUrl configured. The specification for the node-sri-client module can be found at https://bitbucket.org/vskovzw/kathondvla-utils"});
    }
    return baseUrl;
  }

  //should be defined by sub classes.
  getRaw() {}

  get(href, params, options = {}) {
    return this.wrapGet(href, params, options, true);
  }

  async wrapGet(href, params, options, isSingleResource) {
    try {
      let result;
      if(options.inBatch && !this.cache.has(href, params, options.caching)) {
        const batch = [{
          href: commonUtils.parametersToString(href, params),
          verb: 'GET'
        }];
        const batchResp = await this.put(options.inBatch, batch, options);
        if(batchResp[0].status < 300) {
          result = batchResp[0].body;
        } else {
          throw batchResp[0].body;
        }
      } else {
        result = await this.cache.get(href, params, options, !isSingleResource);
        if(isSingleResource && result.results) {
          throw Error('Do not use the get method to ask for lists. Use getList or getAll instead. You can also use getRaw but this method does not use caching, client side expansion and inclusion.');
        }
      }
      if(options.expand) {
        await this.expandJson(result, options.expand, options.caching, options.logging ? options.logging.replace('get', '').replace('expand', 'expand,get') : undefined);
      }
      if(options.include) {
        await this.includeJson(result, options.include, options.caching, options.logging ? options.logging.replace('get', '').replace('expand', 'expand,get') : undefined);
      }
      return result;
    } catch(error) {
      throw error;
    }
  }

  async getAllFromResult(data, options) {
    var results = data.results;
    if (data.$$meta.next) {
      const nextResult = await this.wrapGet(data.$$meta.next, undefined, options);
      const nextResults = await this.getAllFromResult(nextResult, options);
      results = results.concat(nextResults);
    }
    return results;
  }

  async getAll(href, params = {}, options = {}) {
    // We want to do expansions for all results at the end of this method.
    // We set it to undifined that the underlying get method does not take care of this.
    const expand = options.expand;
    options.expand = undefined;
    params.limit = params.limit || 500;
    const result = await this.wrapGet(href, params, options);
    var allResults = await this.getAllFromResult(result, options);
    if (!options.raw && !(params && params.expand && params.expand === 'NONE')) {
      allResults = allResults.map(function (item) {
        return item.$$expanded;
      });
    }
    allResults.count = function () {
      return result.$$meta.count;
    };
    if(expand) {
      await this.expandJson(allResults, expand, options.caching, options.logging ? options.logging.replace('get', '').replace('expand', 'expand,get') : undefined);
    }
    return allResults;
  }

  async getList(href, params, options = {}) {
    const result = await this.wrapGet(href, params, options);
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
  }

  async getAllHrefsWithoutBatch(baseHref, parameterName, hrefs, params, options) {
    params.expand = params.expand || 'FULL';
    var total = 0;
    //const promises = []; TODO make use of pQueue to do this in concurrency
    var allResults = [];
    const map = {};
    while(total < hrefs.length) {
      //var query = commonUtils.parametersToString(baseHref, params) + '&'+parameterName+'=';
      let parameterValue = '';
      for(var i = 0; i <= (options.groupBy ? options.groupBy : this.groupBy) && total < hrefs.length; i++) {
        map[hrefs[i]] = null;
        parameterValue += (i === 0 ? '' : ',')+hrefs[total];
        total++;
      }
      const thisParams = Object.assign({}, params);
      const thisOptions = Object.assign({}, options);
      thisParams[parameterName] = parameterValue;
      const results = await this.getAll(baseHref, thisParams, thisOptions);
      allResults = allResults.concat(results);
    }

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
  }

  getAllReferencesTo(baseHref, params = {}, parameterName, values, options = {}) {
    params.limit = 500;
    return this.getAllHrefsWithoutBatch(baseHref, parameterName, values, params, options);
  }

  async getAllHrefs(hrefs, batchHref, params = {}, options = {}) {
    params.limit = 500;
    const baseHref = commonUtils.getPathFromPermalink(hrefs[0]);
    if(!batchHref) {
      return this.getAllHrefsWithoutBatch(baseHref, 'hrefs', hrefs, params, options);
    }
    var total = 0;
    const batch = [];
    const map = {};

    while(total < hrefs.length) {
      var query = commonUtils.parametersToString(baseHref, params) + '&hrefs'+'=';
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
    const batchResp = await this.sendPayload(batchHref, batch, options, batchHref === '/persons/batch' ? 'PUT' : 'POST');
    if(options.expand) {
      await this.expandJson(batchResp, options.expand, options.caching, options.logging ? options.logging.replace('get', '').replace('expand', 'expand,get') : undefined);
    }
    if(options.include) {
      await this.includeJson(batchResp, options.include, options.logging ? options.logging.replace('get', '').replace('expand', 'expand,get') : undefined);
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
  }

  //should be defined by subClasses
  sendPayload() {}

  async wrapSendPayload(href, payload, options = {}, method) {
    const resp = await this.sendPayload(href, payload, options, method);
    this.cache.onDataAltered(href, payload, method);
    return resp;
  }

  put(href, payload, options) {
    return this.wrapSendPayload(href, payload, options, 'PUT');
  }
  updateResource(resource, options) {
    return this.put(resource.$$meta.permalink, resource, options);
  }
  post(href, payload, options) {
    return this.wrapSendPayload(href, payload, options, 'POST');
  }

  //should be defined by subClasses
  delete() {}

  async wrapDelete(href, options) {
    const resp = await this.delete(href, options);
    this.cache.onDataAltered(href, null, 'DELETE');
    return resp;
  }

  //group all hrefs with the same path together so we can also retreive them togheter in one API call
/*const getPathsMap = function(hrefs) {

};*/

  async add$$expanded(hrefs, json, properties, includeOptions, cachingOptions, loggingOptions) {
    //const pathsMap = getPathsMap(hrefs);
    const uncachedHrefs = {};
    const hrefsMap = {};
    for(let href of hrefs) {
      if(this.cache.has(href, undefined, cachingOptions)) {
        hrefsMap[href] = await this.cache.get(href, undefined, {caching: cachingOptions, logging: loggingOptions}, false);
      } else {
        const path = commonUtils.getPathFromPermalink(href);
        if(!uncachedHrefs[path]) {
          uncachedHrefs[path] = [];
        }
        uncachedHrefs[path].push(href);
      }
    }
    const promises = [];
    for(let path of Object.keys(uncachedHrefs)) {
      // TODO: make configurable to know on which batch the hrefs can be retrieved
      // TODO: use p-fun here because this could be a problem if there are too many hrefs
      promises.push(this.getAllHrefs(uncachedHrefs[path], null, {}, {asMap: true, include: includeOptions, caching: cachingOptions, logging: loggingOptions}).then(function(newMap) {
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
    newHrefs = [...newHrefs];
    hrefs = [...hrefs];
    let converged = hrefs.size === newHrefs.size;
    if(converged) {
      for(let i = 0; i < hrefs.length; i++) {
        if(hrefs[i] !== newHrefs[i]) {
          converged = false;
          break;
        }
      }
    }
    if(converged) {
      console.warn('[WARNING] The data is inconsistent. There are hrefs that can not be retrieved because they do not exist or because they are deleted. hrefs: ' + JSON.stringify([...newHrefs]));
    }
    if(newHrefs.length > 0 && !converged) {
      await this.add$$expanded(newHrefs, json, properties, null, cachingOptions, loggingOptions);
    }
  }

  async expandJson(json, properties, cachingOptions, loggingOptions) {
    if(!Array.isArray(properties)) {
      properties = [properties];
    }
    let allHrefs = new Set();
    for(let property of properties) {
      let propertyName = property;
      let includeOptions = null;
      let required = true;
      let localCachingOptions = null;
      if (!(typeof property === 'string' || property instanceof String)) {
        propertyName = property.property;
        includeOptions = property.include;
        required = property.required;
        localCachingOptions = property.caching;
      }
      if(includeOptions || localCachingOptions) {
        let localHrefs = travelHrefsOfJson(json, propertyName.split('.'), {required: required});
        if(localHrefs.length > 0) {
          await this.add$$expanded(localHrefs, json, [property], includeOptions, localCachingOptions || cachingOptions, loggingOptions);
        }
      } else {
        allHrefs = new Set([...allHrefs, ...travelHrefsOfJson(json, propertyName.split('.'), {required: required})]);
      }
    };
    if(allHrefs.size > 0) {
      await this.add$$expanded(allHrefs, json, properties, undefined, cachingOptions, loggingOptions);
    }
  }

  async includeJson(json, inclusions, cachingOptions = {}, loggingOptions) {
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
      const localCachingOptions = options.caching;
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
            promises.push(this.getAll(options.href, options.filters, {include: options.include, caching: localCachingOptions || cachingOptions, logging: loggingOptions}).then(function(results) {
              resource[options.alias] = options.singleton ? (results.length === 0 ? null : results[0]) : results;
            }));
            return [];
          }
        });
        await Promise.all(promises);
      } else {
        const hrefs = travelHrefsOfJson(json, ('$$meta.permalink').split('.'));
        const results = await this.getAllReferencesTo(options.href, options.filters, referenceParameterName, hrefs, {expand: options.expand, include: options.include, caching: localCachingOptions || cachingOptions, logging: loggingOptions});
        // this is not super optimal. Everything splits out in groups of 100. Expansion and inclusion is done for each batch of 100 urls. But the bit bellow is not working.
        /*if(options.expand) {
          expandJson(results, options.expand, core);
        }*/
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
          resource[options.alias] = options.singleton ? (inclusions.length === 0 ? null : inclusions[0]) : inclusions;
        }
      }
    }
  }


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