const SriClient = require('../sri-client.js');
const commonUtils = require('../common-utils');
const SriClientError = require('../sri-client-error');

const MAX_REDIRECTS = 20;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

class NodeFetchClient extends SriClient {

  constructor(config = {}) {
    super(config);
    this.setDefaultHeaders(config);
    this.cache.initialise();
  }

  setDefaultHeaders(config) {
    this.defaultHeaders = config.headers || {};
    if (config.username && config.password) {
      this.defaultHeaders['Authorization'] = 'Basic ' + Buffer.from(config.username + ':' + config.password).toString('base64');
    }
    if (config.accessToken) {
      this.defaultHeaders[config.accessToken.name] = config.accessToken.value;
    }
  }

  setConfiguration(config) {
    super.setConfiguration(config);
    this.setDefaultHeaders(config);
  }

  /**
   * fetch with a timeout that resets on every redirect (same as node-fetch v2,
   * see README). Without a timeout, or with redirect !== 'follow', the native
   * redirect handling is used.
   */
  async fetchWithTimeout(url, init, options) {
    const redirectMode = options.redirect || 'follow';
    const hasTimeout = options.timeout && options.timeout > 0;
    if (!hasTimeout || redirectMode !== 'follow') {
      return fetch(url, { ...init, redirect: redirectMode, signal: this.buildSignal(options) });
    }

    let currentUrl = url;
    let currentInit = { ...init };
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // new signal per hop => timeout resets on every redirect
      const response = await fetch(currentUrl, {
        ...currentInit,
        redirect: 'manual',
        signal: this.buildSignal(options),
      });

      const location = response.headers.get('location');
      if (!REDIRECT_STATUSES.has(response.status) || !location) {
        if (hop > 0) {
          Object.defineProperty(response, 'redirected', { value: true });
        }
        return response;
      }

      await response.body?.cancel(); // release the connection
      const nextUrl = new URL(location, currentUrl);

      // 303 (and 301/302 on POST) => GET without body, same as the fetch spec
      if ((response.status === 303 && !['GET', 'HEAD'].includes(currentInit.method))
        || ((response.status === 301 || response.status === 302) && currentInit.method === 'POST')) {
        const { body, ...rest } = currentInit;
        currentInit = { ...rest, method: 'GET' };
        currentInit.headers = { ...currentInit.headers };
        for (const name of Object.keys(currentInit.headers)) {
          if (['content-length', 'content-type', 'content-encoding', 'content-language', 'content-location'].includes(name.toLowerCase())) {
            delete currentInit.headers[name];
          }
        }
      }
      // do not send credentials to another origin
      if (nextUrl.origin !== new URL(currentUrl).origin) {
        currentInit.headers = { ...currentInit.headers };
        for (const name of Object.keys(currentInit.headers)) {
          if (['authorization', 'proxy-authorization', 'cookie', 'cookie2'].includes(name.toLowerCase())) {
            delete currentInit.headers[name];
          }
        }
      }
      currentUrl = nextUrl.href;
    }
    throw new TypeError('fetch failed', { cause: new Error(`maximum redirect reached at: ${currentUrl}`) });
  }

  /**
   * Combines an optional timeout and an optional cancel signal into a single AbortSignal.
   * @returns {AbortSignal|undefined}
   */
  buildSignal(options) {
    const signals = [];
    if (options.timeout && options.timeout > 0) {
      signals.push(AbortSignal.timeout(options.timeout));
    }
    if (options.cancel) {
      signals.push(options.cancel);
    }
    if (signals.length === 0) {
      return undefined;
    }
    return signals.length === 1 ? signals[0] : AbortSignal.any(signals);
  }

  async getRaw(href, params, optionsParam = {}) {
    const options = { ...this.configuration, ...optionsParam };
    let baseUrl = this.getBaseUrl(options);
    const logging = options.logging || this.configuration.logging;
    if (logging && typeof logging === 'string' && /get/.test(logging.toLowerCase())) {
      console.log('[sri-client] GET ' + baseUrl + commonUtils.parametersToString(href, params));
    }
    const stack = new Error().stack;
    let thisHeaders = { ...this.defaultHeaders };
    if (optionsParam.headers) {
      thisHeaders = { ...this.defaultHeaders, ...optionsParam.headers };
    }
    try {
      const response = await this.fetchWithTimeout(baseUrl + commonUtils.parametersToString(href, params), {
        method: 'GET',
        cache: options.cache || 'default',
        // credentials: options.credentials || 'omit',
        redirect: options.redirect || "follow",
        // signal: options.cancel,
        signal: this.buildSignal(options),
        headers: thisHeaders
      }, options);
      if (response.ok) {
        const resp = await this.readResponse(response);
        return options.fullResponse ? resp : resp.body;
      } else {
        if (logging && typeof logging === 'string' && /get/.test(logging.toLowerCase())) {
          console.log('[sri-client] response is not ok!', response);
        }
        throw await this.handleError('GET ' + baseUrl + commonUtils.parametersToString(href, params), response, options, stack);
      }
    } catch(error) {
      if (error instanceof SriClientError) {
        throw error;
      }
      if (logging && typeof logging === 'string' && /get/.test(logging.toLowerCase())) {
        console.log('[sri-client] an error occured when doing fetch', error);
      }
      throw await this.handleError('GET ' + baseUrl + commonUtils.parametersToString(href, params), error, options, stack);
    }
  }

  async sendPayload(href, payload, optionsParam = {}, method) {
    const options = { ...this.configuration, ...optionsParam };
    const baseUrl = this.getBaseUrl(options);
    const logging = options.logging || this.configuration.logging;
    if (logging && typeof logging === 'string' && (new RegExp(method.toLowerCase())).test(logging.toLowerCase())) {
      console.log('[sri-client] ' + method + ' ' + baseUrl + href + ':\n' + JSON.stringify(payload));
    }
    const stack = new Error().stack;
    let thisHeaders = { 'Content-Type': 'application/json;charset=UTF-8' , ...this.defaultHeaders };
    if (optionsParam.headers) {
      thisHeaders = { ...thisHeaders, ...optionsParam.headers };
    }
    if (!options.raw && options.strip$$Properties !== false) {
      if (payload instanceof Array) {
        payload = commonUtils.strip$$PropertiesFromBatch(payload);
      } else {
        payload = commonUtils.strip$$Properties(payload);
      }
    }
    try {
      const response = await this.fetchWithTimeout(baseUrl + href, {
          method: method,
          cache: 'no-cache',
          credentials: options.credentials || 'omit',
          redirect: options.redirect || 'follow',
          signal: this.buildSignal(options),
          headers: thisHeaders,
          body: options.raw ? payload : JSON.stringify(payload)
        }, options);

      if (response.ok) {
        const resp = await this.readResponse(response);
        return options.fullResponse ? resp : resp.body;
      } else {
        if (logging && typeof logging === 'string' && (new RegExp(method.toLowerCase())).test(logging.toLowerCase())) {
          console.log('[sri-client] response is not ok!', response);
        }
        throw await this.handleError(method + baseUrl + href, response, options, stack);
      }
    } catch (error) {
      if (error instanceof SriClientError) {
        throw error;
      }
      if (logging && typeof logging === 'string' && (new RegExp(method.toLowerCase())).test(logging.toLowerCase())) {
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
      const response = await this.fetchWithTimeout(baseUrl + href, {
        method: 'DELETE',
        cache: 'no-cache',
        credentials: 'omit',
        signal: this.buildSignal(options),
        headers: thisHeaders
      }, options);
      if (response.ok) {
        const resp = await this.readResponse(response);
        return options.fullResponse ? resp : resp.body;
      } else {
        throw await this.handleError('DELETE' + baseUrl + href, response, options, stack);
      }
    } catch (error) {
      if (error instanceof SriClientError) {
        throw error;
      }
      throw await this.handleError('DELETE' + baseUrl + href, error, options, stack);
    }
  }

  /**
   * @param {*} response the reponse to read
   * @returns {Promise<{
   *  status: number,
   *  headers: Array<Record<string, string>>,
   *  body: any,
   *  redirected: boolean
   * }>}
   * @throws {SriClientError} when the response can not be read
   */
  async readResponse(response) {
    let headers = null;
    try {
      headers = [...response.headers].reduce( (acc, cur) => Object.assign({}, acc, {[cur[0]]: cur[1]}), {} );
      const contentType = headers['content-type'];

      let body = null;
      body = await response.text();
      if (body && contentType.match(/application\/(?:ld\+)?json/g)) {
        // try {
          body = JSON.parse(body);
        // } catch(err) {
        //   console.error('[sri-client] Json parse is mislukt!', response);
        // }
      }

      return {
        status: response.status,
        headers: headers,
        body: body,
        redirected: response.redirected
      };
    } catch(err) {
      console.warn('[sri-client] Het response kon niet worden uitgelezen.', response);
      throw new SriClientError({
        status: response.status,
        body: null,
        headers: headers,
        originalResponse: response,
        error: err
      });
    }
  }

  /**
   * handleError tries to read the body of an sri response
   * in case the response code is not in the 200 range.
   *
   * In this case the json should contain certain fields providing
   * extra information about the issue.
   *
   * @param {*} httpRequest
   * @param {*} response
   * @param {*} options
   * @param {*} stack
   * @returns {SriClientError}
   * @throws {SriClientError} in the (unlikely) case that the response body cannot be read
   */
   async handleError(httpRequest, response, options, stack) {
    // No real Response (timeout, abort, network error like ENOTFOUND)
    if (!(response instanceof Response)) {
      return new SriClientError({
        status: null,
        body: null,
        originalResponse: null,
        headers: null,
        error: response,
        stack: stack
      });
    }

    const resp = await this.readResponse(response);

    return new SriClientError({
      status: response.status || null,
      body: resp.body,
      originalResponse: response,
      headers: resp.headers,
      stack: stack
    });
  };

};



module.exports = function(configuration) {
  return new NodeFetchClient(configuration);
};
