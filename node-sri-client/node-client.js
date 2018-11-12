const request = require('requestretry');
const util = require('util');
const SriClient = require('../sri-client.js');
const commonUtils = require('../common-utils');
const SriClientError = require('../sri-client-error');

class NodeClient extends SriClient {
  constructor(config = {}) {
    super(config);
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
    this.baseRequest = request.defaults(defaultOptions);
  }

  getRaw(href, params, options = {}) {
    var baseUrl = this.getBaseUrl(options);
    if((this.configuration.logging === 'debug') || options.logging === 'debug') {
      console.log('GET ' + baseUrl + commonUtils.parametersToString(href, params));
    }
    var stack = new Error().stack;
    return new Promise((resolve, reject) => {
      this.baseRequest({
        method: 'GET',
        url: baseUrl + commonUtils.parametersToString(href, params),
        //qs: params,
        json: true,
        maxAttempts: options.maxAttempts || 3,
        retryDelay: options.retryDelay || 5000,
        retryStrategy: options.retryStrategy || request.RetryStrategies.HTTPOrNetworkError,
        delayStrategy: options.delayStrategy,
        headers: options.headers,
        timeout: options.timeout || 10000
      }, (error, response, body) => {
        if(!error && response.statusCode >= 200 && response.statusCode < 400) {
          resolve(response.body);
        } else {
          reject(new SriClientError(handleError('GET ' + baseUrl + commonUtils.parametersToString(href, params), error, response, this.configuration, options, stack)));
        }
      });
    });
  }

  sendPayload(href, payload, options = {}, method) {
    const baseUrl = this.getBaseUrl(options);
    if((this.configuration.logging === 'debug') || options.logging === 'debug') {
      console.log(method + ' ' + baseUrl + href + ':\n' + JSON.stringify(payload));
    }
    if(options.strip$$Properties !== false) {
      if(payload instanceof Array) {
        payload = commonUtils.strip$$PropertiesFromBatch(payload);
      } else {
        payload = commonUtils.strip$$Properties(payload);
      }
    }
    return new Promise((resolve, reject) => {
      this.baseRequest({
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
      }, (error, response) => {
        if(!error && response.statusCode >= 200 && response.statusCode < 400) {
          const body = response.body || {};
          body.getResponseHeader = function(header) {
            return response.headers[header];
          };
          body.getStatusCode = function() {
            return response.statusCode;
          };
          resolve(body);
        } else {
          reject(new SriClientError(handleError(method + ' ' + baseUrl + href, error, response, this.configuration, options)));
        }
      });
    });
  }

  delete(href, options) {
    const baseUrl = this.getBaseUrl(options);
    return new Promise((resolve, reject) => {
      this.baseRequest({
        method: 'DELETE',
        url: baseUrl + href,
        json:true,
        maxAttempts: options.maxAttempts || 3,
        retryDelay: options.retryDelay || 5000,
        retryStrategy: options.retryStrategy || request.RetryStrategies.HTTPOrNetworkError,
        headers: options.headers,
        timeout: options.timeout || 30000
      }, (error, response) => {
        if(!error && response.statusCode >= 200 && response.statusCode < 400) {
          resolve(response.body);
        } else {
          reject(new SriClientError(handleError('DELETE ' + baseUrl + href, error, response, this.configuration, options)));
        }
      });
    });
  }
};

const handleError = function (httpRequest, error, response = {}, configuration, options, stack) {
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

module.exports = function(configuration) {
  return new NodeClient(configuration);
};