/* global fetch */
const SriClient = require('../sri-client.js');
const commonUtils = require('../common-utils');
const SriClientError = require('../sri-client-error');

class FetchClient extends SriClient {

  constructor(config = {}) {
    super(config);
    this.defaultHeaders = config.headers || {};
    /*if(config.username && config.password) {
      this.defaultOptions.hearders['Authorization'] = //base64encode config.username+':'+config.password
    }*/
    if(config.accessToken) {
      this.defaultHeaders[config.accessToken.name] = config.accessToken.value;
    }
    this.cache.initialise();
  }

  getRaw(href, params, options = {}) {
    var baseUrl = this.getBaseUrl(options);
    const logging = options.logging || this.configuration.logging;
    if(/get/.test(logging)) {
      console.log('GET ' + baseUrl + commonUtils.parametersToString(href, params));
    }
    const stack = new Error().stack;
    return new Promise((resolve, reject) => {
      fetch(baseUrl + commonUtils.parametersToString(href, params), {
        method: 'GET',
        cache: 'no-cache',
        signal: options.cancel,
        headers: Object.assign(this.defaultHeaders, options.headers ? options.headers : {})
      })
      .then(response => {
        if(response.ok) {
          resolve(options.raw ? response.body : response.json());
        } else {
          reject(new SriClientError(this.handleError('GET ' + baseUrl + commonUtils.parametersToString(href, params), response, options, stack)));
        }
      })
      .catch(error => reject(new SriClientError(this.handleError('GET ' + baseUrl + commonUtils.parametersToString(href, params), error, options, stack))) );
    });
  }

  sendPayload(href, payload, options = {}, method) {
    const baseUrl = this.getBaseUrl(options);
    const logging = options.logging || this.configuration.logging;
    if((new RegExp(method.toLowerCase)).test(logging)) {
      console.log(method + ' ' + baseUrl + href + ':\n' + JSON.stringify(payload));
    }
    const stack = new Error().stack;
    if(options.strip$$Properties !== false) {
      if(payload instanceof Array) {
        payload = commonUtils.strip$$PropertiesFromBatch(payload);
      } else {
        payload = commonUtils.strip$$Properties(payload);
      }
    }
    return new Promise((resolve, reject) => {
      fetch(baseUrl + href, {
        method: method,
        cache: 'no-cache',
        signal: options.cancel,
        headers: Object.assign(this.defaultHeaders, {'Content-Type': 'application/json;charset=UTF-8'}, options.headers ? options.headers : {}),
        body: JSON.stringify(payload)
      })
      .then(response => {
        if(response.ok) {
          resolve(options.raw ? response.body : response.json());
        } else {
          reject(new SriClientError(this.handleError(method + baseUrl + href, response, options, stack)));
        }
      })
      .catch(error => reject(new SriClientError(this.handleError(method + baseUrl + href, error, options, stack))) );
    });
  }

  delete(href, options = {}) {
    const baseUrl = this.getBaseUrl(options);
    const stack = new Error().stack;
    return new Promise((resolve, reject) => {
      fetch(baseUrl + href, {
        method: 'DELETE',
        cache: 'no-cache',
        signal: options.cancel,
        headers: Object.assign(this.defaultHeaders, options.headers ? options.headers : {})
      })
      .then(response => {
        if(response.ok) {
          resolve(options.raw ? response.body : response.json());
        } else {
          reject(new SriClientError(this.handleError('DELETE' + baseUrl + href, response, options, stack)));
        }
      })
      .catch(error => reject(new SriClientError(this.handleError('DELETE' + baseUrl + href, error, options, stack))) );
    });
  }

  handleError(httpRequest, response, options, stack) {
    /*const logging = options.logging || options.logging === false ? options.logging : this.configuration.logging;
    if(logging) {
      console.error(response.status + ': An error occured for ' + httpRequest);
      if(response.body) {
        console.error(util.inspect(response.body, {depth: 7}));
      } else {
        console.error(error);
      }
    }*/
    if(!response.status) {
      return response;
    }
    return new SriClientError({
      status: response.status || null,
      body: response.json() || null,
      headers: response.headers || null,
      stack: stack
    });
  };
};



module.exports = function(configuration) {
  return new FetchClient(configuration);
};