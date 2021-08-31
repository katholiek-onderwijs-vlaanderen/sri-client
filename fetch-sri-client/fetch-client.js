/* global fetch, Response */
const SriClient = require('../sri-client.js');
const commonUtils = require('../common-utils');
const SriClientError = require('../sri-client-error');

class FetchClient extends SriClient {

  constructor(config = {}) {
    super(config);
    this.setDefaultHeaders(config);
    this.cache.initialise();
  }

  setDefaultHeaders(config) {
    this.defaultHeaders = config.headers || {};
    /*if(config.username && config.password) {
      this.defaultOptions.hearders['Authorization'] = //base64encode config.username+':'+config.password
    }*/
    if(config.accessToken) {
      this.defaultHeaders[config.accessToken.name] = config.accessToken.value;
    }
  }

  setConfiguration(config) {
    super.setConfiguration(config);
    this.setDefaultHeaders(config);
  }

  async getRaw(href, params, optionsParam = {}) {
    const options = { ...this.configuration, ...optionsParam };
    var baseUrl = this.getBaseUrl(options);
    const logging = options.logging;
    if(logging && typeof logging === 'string' && /get/.test(logging.toLowerCase())) {
      console.log('[sri-client] GET ' + baseUrl + commonUtils.parametersToString(href, params));
    }
    const stack = new Error().stack;
    let thisHeaders = { ...this.defaultHeaders };
    if (optionsParam.headers) {
      thisHeaders = { ...this.defaultHeaders, ...optionsParam.headers };
    }
    try {
      const response = await fetch(baseUrl + commonUtils.parametersToString(href, params), {
        method: 'GET',
        cache: options.cache || 'default',
        credentials: options.credentials || 'omit',
        redirect: options.redirect || "follow",
        signal: options.cancel,
        headers: thisHeaders
      });
      if(response.ok) {
        const resp = await this.readResponse(response);
        return options.fullResponse ? resp : resp.body;
      } else {
        if(logging && typeof logging === 'string' && /get/.test(logging.toLowerCase())) {
          console.log('[sri-client] response is not ok!', response);
        }
        throw await this.handleError('GET ' + baseUrl + commonUtils.parametersToString(href, params), response, options, stack);
      }
    } catch(error) {
      if(error instanceof SriClientError) {
        throw error;
      }
      if(logging && typeof logging === 'string' && /get/.test(logging.toLowerCase())) {
        console.log('[sri-client] an error occured when doing fetch', error);
      }
      throw await this.handleError('GET ' + baseUrl + commonUtils.parametersToString(href, params), error, options, stack);
    }
  }

  async sendPayload(href, payload, optionsParam = {}, method) {
    const options = { ...this.configuration, ...optionsParam };
    const baseUrl = this.getBaseUrl(options);
    const logging = options.logging || this.configuration.logging;
    if(logging && typeof logging === 'string' && (new RegExp(method.toLowerCase)).test(logging.toLowerCase())) {
      console.log('[sri-client] ' + method + ' ' + baseUrl + href + ':\n' + JSON.stringify(payload));
    }
    const stack = new Error().stack;
    let thisHeaders = { 'Content-Type': 'application/json;charset=UTF-8' , ...this.defaultHeaders };
    if (optionsParam.headers) {
      thisHeaders = { ...thisHeaders, ...optionsParam.headers };
    }
    if(!options.raw && options.strip$$Properties !== false) {
      if(payload instanceof Array) {
        payload = commonUtils.strip$$PropertiesFromBatch(payload);
      } else {
        payload = commonUtils.strip$$Properties(payload);
      }
    }
    try {
      const response = await fetch(baseUrl + href, {
          method: method,
          cache: 'no-cache',
          credentials: options.credentials || 'omit',
          redirect: options.redirect || 'follow',
          signal: options.cancel,
          headers: thisHeaders,
          body: options.raw ? payload : JSON.stringify(payload)
        });

      if(response.ok) {
        const resp = await this.readResponse(response);
        return options.fullResponse ? resp : resp.body;
      } else {
        if(logging && typeof logging === 'string' && (new RegExp(method.toLowerCase)).test(logging.toLowerCase())) {
          console.log('[sri-client] response is not ok!', response);
        }
        throw await this.handleError(method + baseUrl + href, response, options, stack);
      }
    } catch (error) {
      if(error instanceof SriClientError) {
        throw error;
      }
      if(logging && typeof logging === 'string' && (new RegExp(method.toLowerCase)).test(logging.toLowerCase())) {
        console.log('[sri-client] an error occured when doing fetch', error);
      }
      throw await this.handleError(method + baseUrl + href, error, options, stack);
    }
  }

  async delete(href, optionsParam = {}) {
    const options = { ...this.configuration, ...optionsParam };
    const baseUrl = this.getBaseUrl(options);
    const stack = new Error().stack;
    let thisHeaders = { ...this.defaultHeaders };
    if (optionsParam.headers) {
      thisHeaders = { ...this.defaultHeaders, ...optionsParam.headers };
    }
    try {
      const response = await fetch(baseUrl + href, {
        method: 'DELETE',
        cache: 'no-cache',
        credentials: 'omit',
        signal: options.cancel,
        headers: thisHeaders
      });
      if(response.ok) {
        const resp = await this.readResponse(response);
        return options.fullResponse ? resp : resp.body;
      } else {
        throw await this.handleError('DELETE' + baseUrl + href, response, options, stack);
      }
    } catch (error) {
      if(error instanceof SriClientError) {
        throw error;
      }
      throw await this.handleError('DELETE' + baseUrl + href, error, options, stack);
    }
  }

  async readResponse(response) {
    try {
      const headers = [...response.headers].reduce( (acc, cur) => Object.assign({}, acc, {[cur[0]]: cur[1]}), {} );
      const contentType = headers['content-type'];

      let body = null;
      body = await response.text();
      if(body && contentType.match(/application\/json/g)) {
        try {
          body = JSON.parse(body);
        } catch(err) {
          console.error('[sri-client] Json parse is mislukt!', response);
        }
      }

      return {
        headers: headers,
        body: body,
        redirected: response.redirected
      };
    } catch(err) {
      console.warn('[sri-client] Het response kon niet worden uitgelezen.', response);
    }
  }

  async handleError(httpRequest, response, options, stack) {
    if(!response || !(response instanceof Response)) {
      return response;
    }

    const resp = await this.readResponse(response);

    return new SriClientError({
      status: response.status || null,
      body: resp.body,
      originalResponse: response,
      headers: resp.headers//,
      //stack: stack
    });
  };

};



module.exports = function(configuration) {
  return new FetchClient(configuration);
};