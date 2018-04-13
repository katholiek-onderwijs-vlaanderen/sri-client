const request = require('requestretry');
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

const getBaseUrl = function (configuration, options) {
  const baseUrl = options.baseUrl || configuration.baseUrl;
  if (!baseUrl) {
    throw Error("There is no baseUrl configured. The specification for the node-sri-client module can be found at https://bitbucket.org/vskovzw/kathondvla-utils");
  }
  return baseUrl;
};

const handleError = function (httpRequest, error, response = {}, configuration, options, stack) {
  options.pending = false;
  if((configuration && configuration.logging) || options.logging) {
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
    getResponseHeader: function(header) {
      return response.headers[header];
    },
    stack: stack
  };
};

const doGet = async function (href, params, options = {}, my) {
  options.pending = true;
  var baseUrl = getBaseUrl(my.configuration, options);
  if((my.configuration.logging === 'debug') || options.logging === 'debug') {
    console.log('GET ' + baseUrl + common.paramsToString(href, params));
  }
  var stack = new Error().stack;
  return new Promise(function(resolve, reject) {
    my.baseRequest({
      method: 'GET',
      url: baseUrl + href,
      qs: params,
      json: true,
      maxAttempts: options.maxAttempts || 3,
      retryDelay: options.retryDelay || 5000,
      retryStrategy: options.retryStrategy || request.RetryStrategies.HTTPOrNetworkError,
      delayStrategy: options.delayStrategy,
      headers: options.headers,
      timeout: options.timeout || 10000
    }, function(error, response, body) {
      if(!error && response.statusCode >= 200 && response.statusCode < 400) {
        resolve(response.body);
      } else {
        reject(new SriClientError(handleError('GET ' + baseUrl + common.paramsToString(href, params), error, response, my.configuration, options, stack)));
      }
    });
  });
};

const sendPayload = async function (href, payload, options = {}, method, my) {
  options.pending = true;
  const baseUrl = getBaseUrl(my.configuration, options);
  if((my.configuration.logging === 'debug') || options.logging === 'debug') {
    console.log(method + ' ' + baseUrl + href + ':\n' + JSON.stringify(payload));
  }
  if(options.strip$$Properties !== false) {
    if(payload instanceof Array) {
      payload = commonUtils.strip$$PropertiesFromBatch(payload);
    } else {
      payload = commonUtils.strip$$Properties(payload);
    }
  }
  return new Promise(function(resolve, reject) {
    my.baseRequest({
      method: method,
      url: baseUrl + href,
      body: payload,
      json:true,
      maxAttempts: options.maxAttempts || 3,
      retryDelay: options.retryDelay || 5000,
      retryStrategy: options.retryStrategy || request.RetryStrategies.HTTPOrNetworkError,
      delayStrategy: options.delayStrategy,
      headers: options.headers,
      timeout: options.timeout || (payload instanceof Array ? 120000 : 30000)
    }, function(error, response) {
      if(!error && response.statusCode >= 200 && response.statusCode < 400) {
        const body = response.body || {};
        body.getResponseHeaders = function() {
          return response.headers;
        };
        options.pending = false;
        resolve(body);
      } else {
        reject(new SriClientError(handleError(method + ' ' + baseUrl + href, error, response, my.configuration, options)));
      }
    });
  });
};

const doDelete = async function (href, options = {}, my) {
  options.pending = true;
  var baseUrl = getBaseUrl(my.configuration, options);
  return new Promise(function(resolve, reject) {
    my.baseRequest({
      method: 'DELETE',
      url: baseUrl + href,
      json:true,
      maxAttempts: options.maxAttempts || 3,
      retryDelay: options.retryDelay || 5000,
      retryStrategy: options.retryStrategy || request.RetryStrategies.HTTPOrNetworkError,
      headers: options.headers,
      timeout: options.timeout || 30000
    }, function(error, response) {
      if(!error && response.statusCode >= 200 && response.statusCode < 400) {
        options.pending = false;
        resolve(response.body);
      } else {
        reject(new SriClientError(handleError('DELETE ' + baseUrl + href, error, response, my.configuration, options)));
      }
    });
  });
};

module.exports = function(configuration) {
  const that = {
    my: {
      configuration: {},
      baseRequest: null
    },
    SriClientError: SriClientError
  };

  that.setConfiguration = function (config) {
    that.my.configuration = config;
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
    that.my.baseRequest = request.defaults(defaultOptions);
  };

  if(configuration) {
    that.setConfiguration(configuration);
  }

  that.get = async function(href, params, options = {}) {
    const result = await doGet(href, params, options, that.my);
    if(options.expand) {
      await common.expand(result, options.expand, that);
    }
    if(options.include) {
      await common.include(result, options.include, that);
    }
    return result;
  };

  that.sendPayload = function (href, payload, options, method) {
    return sendPayload(href, payload, options, method, that.my);
  };

  that.put = function (href, payload, options) {
    return sendPayload(href, payload, options, 'PUT', that.my);
  };
  that.updateResource = function (resource, options) {
    return that.put(resource.$$meta.permalink, resource, options);
  };
  that.post = function (href, payload, options) {
    return sendPayload(href, payload, options, 'POST', that.my);
  };

  that.delete = function (href, options) {
    return doDelete(href, options, that.my);
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

  return that;
};