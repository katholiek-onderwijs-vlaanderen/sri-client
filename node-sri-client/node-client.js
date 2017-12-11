const request = require('request');
const util = require('util');
const common = require('../common-sri-client.js');
const commonUtils = require('../common-utils');

const SriClientError = function(obj) {
  this.status = obj.status;
  this.body = obj.body;
  this.getResponseHeader = obj.getResponseHeader;
  this.stack = obj.stack;
};
//SriClientError.prototype = Error.prototype;

var configuration = {};
var baseRequest = null;
const setConfiguration = function (config) {
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
    defaultOptions.headers[config.accessToken.name] = config.accessToken.value;
  }
  baseRequest = request.defaults(defaultOptions);
};

const getBaseUrl = function (config) {
  const baseUrl = config.baseUrl || configuration.baseUrl;
  if (!baseUrl) {
    throw Error("There is no baseUrl configured. The specification for the node-sri-client module can be found at https://bitbucket.org/vskovzw/kathondvla-utils");
  }
  return baseUrl;
};

const handleError = function (httpRequest, error, response = {}, config, stack) {
  config.pending = false;
  if((configuration && configuration.logging) || config.logging) {
    console.error(response.statusCode + ': An error occured for ' + httpRequest);
    if(response.body) {
      console.error(util.inspect(response.body, {depth: 7}));
    } else {
      console.error(error);
    }
  }
  return {
    status: response.statusCode || null,
    body: response.body || null,
    getResponseHeader: response.getHeader,
    stack: stack
  };
};

const doGet = async function (href, params, config = {}) {
  config.pending = true;
  var baseUrl = getBaseUrl(config);
  if((configuration && configuration.logging === 'debug') || config.logging === 'debug') {
    console.log('GET ' + baseUrl + common.paramsToString(href, params));
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
        reject(new SriClientError(handleError('GET ' + baseUrl + common.paramsToString(href, params), error, response, config, stack)));
      }
    });
  });
};

const sendPayload = async function (href, payload, config = {}, method) {
  config.pending = true;
  const baseUrl = getBaseUrl(config);
  if((configuration && configuration.logging === 'debug') || config.logging === 'debug') {
    console.log(method + ' ' + baseUrl + href + ':\n' + JSON.stringify(payload));
  }
  if(config.strip$$Properties) {
    if(payload instanceof Array) {
      payload = commonUtils.strip$$PropertiesFromBatch(payload);
    } else {
      payload = commonUtils.strip$$Properties(payload);
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
        };
        config.pending = false;
        resolve(body);
      } else {
        reject(new SriClientError(handleError(method + ' ' + baseUrl + href, error, response, config)));
      }
    });
  });
};

const put = async function (href, payload, config) {
  return sendPayload(href, payload, config, 'PUT');
};

const post = async function (href, payload, config) {
  return sendPayload(href, payload, config, 'POST');
};

const doDelete = async function (href, config = {}) {
  config.pending = true;
  var baseUrl = getBaseUrl(config);
  return new Promise(function(resolve, reject) {
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
    });
  });
};

const that = {
  setConfiguration: setConfiguration,
  SriClientError: SriClientError,
  get: doGet,
  put: put,
  updateResource: function (resource, config) {
    return put(resource.$$meta.permalink);
  },
  post: post,
  delete: doDelete
};

that.getList = function (href, params, config) {
  return common.getList(href, params, config, that);
};

that.getAll = function (href, params, config) {
  return common.getAll(href, params, config, that);
};

that.getAllHrefs = function (hrefs, batchHref, params, config) {
  return common.getAllHrefs(hrefs, batchHref, params, config, that);
};

that.getAllReferencesTo = function (baseHref, params, referencingParameterName, values, config) {
  return common.getAllReferencesTo(baseHref, params, referencingParameterName, values, config, that);
};

module.exports = function(configuration) {
  if(configuration) {
    setConfiguration(configuration);
  }
  return that;
};