const request = require('request');
const util = require('util');

/*class SriClientError extends Error {
  constructor(obj) {
    this.status = obj.status,
    this.body = obj.body,
    this.getResponseHeader = obj.getResponseHeader
  }
}*/
var SriClientError = function(obj) {
  this.status = obj.status;
  this.body = obj.body;
  this.getResponseHeader = obj.getResponseHeader;
  this.stack = obj.stack;
}
//SriClientError.prototype = Error.prototype;

var configuration = {};
var baseRequest = null;
function setConfiguration(config) {
  configuration = config;
  const defaultOptions = {
    headers: config.headers || {}
  };
  if(config.username && config.password) {
    defaultOptions.auth = {
      user: config.username,
      pass: config.password
    };
  }
  if(config.accessToken) {
    defaultOptions.headers[config.accessToken.name] = config.accessToken.value
  }
  baseRequest = request.defaults(defaultOptions);
}

function getBaseUrl (config) {
  const baseUrl = config.baseUrl || configuration.baseUrl;
  if (!baseUrl) {
    throw Error("There is no baseUrl configured. The specification for the node-sri-client module can be found at https://bitbucket.org/vskovzw/kathondvla-utils");
  }
  return baseUrl;
};

function handleError(httpRequest, error, response, config, stack) {
  config.pending = false;
  response = response || {};
  if((configuration && configuration.logging) || config.logging) {
    console.error(response.statusCode + ': An error occured for ' + httpRequest)
    if(response.body) {
      console.error(util.inspect(response.body, {depth: 7}));
    } else {
      console.error(error);
    }
  }
  return {
    status: response.statusCode || null,
    body: response.body,
    getResponseHeader: response.getHeader,
    stack: stack
  };
}

async function doGet(href, params, config) {
  config = (typeof config === 'undefined' ? {} : config);
  config.pending = true;
  var baseUrl = getBaseUrl(config);
  if((configuration && configuration.logging === 'debug') || config.logging === 'debug') {
    console.log('GET ' + baseUrl + paramsToString(href, params));
  }
  var stack = new Error().stack;
  return new Promise(function(resolve, reject) {
    baseRequest({
      method: 'GET',
      url: baseUrl + href,
      qs: params,
      json: true,
      headers: config.headers,
      timeout: config.timeout || 10000
    }, function(error, response, body) {
      if(!error && response.statusCode >= 200 && response.statusCode < 400) {
        resolve(response.body);
      } else {
        reject(new SriClientError(handleError('GET ' + baseUrl + paramsToString(href, params), error, response, config, stack)));
      }
    });
  });
};

async function getAllFromResult(data, config) {
  config = (typeof config === 'undefined' ? {} : config);
  var results = data.results;
  if (data.$$meta.next) {
    const nextResult = await doGet(data.$$meta.next, undefined, config);
    const nextResults = await getAllFromResult(nextResult, config);
    results = results.concat(nextResults);
  }
  return results;
};

async function getList(href, params, config) {
  config = (typeof config === 'undefined' ? {} : config);
  const result = await doGet(href, params, config);
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

async function getAll(href, params, config) {
  config = (typeof config === 'undefined' ? {} : config);
  params = params || {};
  params.limit = 500;
  const result = await doGet(href, params, config);
  var allResults = await getAllFromResult(result, config);
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

async function sendPayload(href, payload, config, method) {
  config = (typeof config === 'undefined' ? {} : config);
  config.pending = true;
  const baseUrl = getBaseUrl(config);
  if((configuration && configuration.logging === 'debug') || config.logging === 'debug') {
    console.log(method + ' ' + baseUrl + href + ':\n' + JSON.stringify(payload));
  }
  if(config.strip$$Properties) {
    if(payload instanceof Array) {
      payload = strip$$PropertiesFromBatch(payload);
    } else {
      payload = strip$$Properties(payload);
    }
  }
  return new Promise(function(resolve, reject) {
    baseRequest({
      method: method,
      url: baseUrl + href,
      body: payload,
      json:true,
      headers: config.headers,
      timeout: config.timeout || (payload instanceof Array ? 120000 : 30000)
    }, function(error, response) {
      if(!error && response.statusCode >= 200 && response.statusCode < 400) {
        const body = response.body || {};
        body.getResponseHeaders = function() {
          return response.headers;
        }
        config.pending = false;
        resolve(body);
      } else {
        reject(new SriClientError(handleError(method + ' ' + baseUrl + href, error, response, config)));
      }
    })
  });
};

async function put(href, payload, config) {
  return sendPayload(href, payload, config, 'PUT');
};

async function post(href, payload, config) {
  return sendPayload(href, payload, config, 'POST');
};

async function doDelete(href, config) {
  config = (typeof config === 'undefined' ? {} : config);
  config.pending = true;
  var baseUrl = getBaseUrl(config);
  return new Promise(function(defer, resolve) {
    baseRequest({
      method: 'DELETE',
      url: baseUrl + href,
      json:true,
      headers: config.headers,
      timeout: config.timeout || 30000
    }, function(error, response) {
      if(!error && response.statusCode >= 200 && response.statusCode < 400) {
        config.pending = false;
        resolve(response.body);
      } else {
        reject(new SriClientError(reject(handleError(error, response, config))));
      }
    })
  });
};

function paramsToString (path, params) {
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
}

var splitSize = 100;
async function getAllHrefsWithoutBatch(parameterName, hrefs, params, config) {
  var total = 0;
  const promises = [];
  var allResults = [];
  const map = {};
  params = params || {};
  params.limit = 500
  while(total < hrefs.length) {
    //hack because of bad sri4node function
    if(config.href) {
      const hrefParts = config.href.split('/');
      hrefParts.splice(hrefParts.length-1);
      var query = paramsToString(hrefParts.join('/'), params) + '&'+parameterName+'=';
    } else {
      const hrefParts = hrefs[0].split('/');
      hrefParts.splice(hrefParts.length-1);
      var query = paramsToString(hrefParts.join('/'), params) + '&'+parameterName+'=';
    }
    for(var i = 0; i <= splitSize && total < hrefs.length; i++) {
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
      throw new Error('You can not get a raw result for getAllHrefs');
    } else if(config.asMap) {
      allResults.forEach(function (item) {
        map[item.href] = item.$$expanded;
      });
      return map;
    } else {
      return allResults;
    }
  }
}

async function getAllHrefs(parameterName, hrefs, batchHref, params, config) {
  if(!batchHref || parameterName !== 'hrefs') {
    return getAllHrefsWithoutBatch(parameterName, hrefs, params, config);
  }
  var total = 0;
  const batch = [];
  const map = {};
  params = params || {};
  params.limit = 500
  while(total < hrefs.length) {
    //hack because of bad sri4node function
    if(config.href) {
      const hrefParts = config.href.split('/');
      hrefParts.splice(hrefParts.length-1);
      var query = paramsToString(hrefParts.join('/'), params) + '&'+parameterName+'=';
    } else {
      const hrefParts = hrefs[0].split('/');
      hrefParts.splice(hrefParts.length-1);
      var query = paramsToString(hrefParts.join('/'), params) + '&'+parameterName+'=';
    }
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
  const batchResp = await sendPayload(batchHref, batchHref === '/persons/batch' ? 'PUT' : 'GET', config);
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
}

function strip$$Properties(obj) {
  const newObj = {};
  Object.keys(obj).forEach(function(key) {
    if(!key.match(/^\$\$/)) {
      newObj[key] = obj[key];
    }
  });
  return newObj;
}

function strip$$PropertiesFromBatch(batch) {
  const newBatch = [];
  for(let obj of batch) {
    newBatch.push({
      href: obj.href,
      verb: obj.verb,
      body: strip$$Properties(obj.body)
    })
  }
  return newBatch;
}

module.exports = function(configuration) {
  if(configuration) {
    setConfiguration(configuration);
  }
  return {
    setConfiguration: setConfiguration,
    SriClientError: SriClientError,
    get: doGet,
    getList: getList,
    getAll: getAll,
    put: put,
    updateResource: function (resource, config) {
      return put(resource.$$meta.permalink);
    },
    post: post,
    delete: doDelete,
    getAllHrefs: getAllHrefs,
    strip$$Properties: strip$$Properties,
    strip$$PropertiesFromBatch: strip$$PropertiesFromBatch
  }
};