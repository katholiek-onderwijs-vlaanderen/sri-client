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
    this.cache.initialise();
  }

  getRaw(href, params, options = {}) {
    var baseUrl = this.getBaseUrl(options);
    const logging = options.logging || this.configuration.logging;
    if(/get/.test(logging)) {
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
          reject(new SriClientError(this.handleError('GET ' + baseUrl + commonUtils.parametersToString(href, params), error, response, options, stack)));
        }
      });
    });
  }

  sendPayload(href, payload, options = {}, method) {
    const baseUrl = this.getBaseUrl(options);
    const logging = options.logging || this.configuration.logging;
    if((new RegExp(method.toLowerCase)).test(logging)) {
      console.log(method + ' ' + baseUrl + href + ':\n' + JSON.stringify(payload));
    }
    if(options.strip$$Properties !== false) {
      payload = commonUtils.strip$$Properties(payload);
      /*if(payload instanceof Array) {
        payload = commonUtils.strip$$PropertiesFromBatch(payload);
      } else {
        payload = commonUtils.strip$$Properties(payload);
      }*/
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
          const body = (response && response.data && typeof response.data === 'object') ? response.data : {};

          body.getResponseHeader = function(header) {
            return response.headers[header];
          };
          body.getStatusCode = function() {
            return response.statusCode;
          };
          resolve(body);
        } else {
          reject(new SriClientError(this.handleError(method + ' ' + baseUrl + href, error, response, options)));
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
          reject(new SriClientError(this.handleError('DELETE ' + baseUrl + href, error, response, options)));
        }
      });
    });
  }

  handleError(httpRequest, error, response = {}, options, stack) {
    const logging = options.logging || options.logging === false ? options.logging : this.configuration.logging;
    if(logging) {
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
      headers: response.headers || null,
      stack: stack
    };
  };
};



module.exports = function(configuration) {
  return new NodeClient(configuration);
};
