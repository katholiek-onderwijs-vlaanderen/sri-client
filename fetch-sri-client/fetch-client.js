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

  async getRaw(href, params, options = {}) {
    var baseUrl = this.getBaseUrl(options);
    const logging = options.logging || this.configuration.logging;
    if(logging && typeof logging === 'string' && /get/.test(logging.toLowerCase())) {
      console.log('GET ' + baseUrl + commonUtils.parametersToString(href, params));
    }
    const stack = new Error().stack;
    try {
      const response = await fetch(baseUrl + commonUtils.parametersToString(href, params), {
        method: 'GET',
        cache: 'no-cache',
        credentials: options.credentials || 'omit',
        redirect: options.redirect || "follow",
        signal: options.cancel,
        headers: Object.assign(this.defaultHeaders, options.headers ? options.headers : {})
      });
      if(response.ok) {
        /*try {
          const text = await response.text();
          if(options.raw || !text) {
            return text;
          } else {
            try {
              return JSON.parse(text);
            } catch(err) {
              return text;
            }
          }
        } catch(err) {
          return response.html();
        }*/
        const resp = await this.readResponse(response);
        return options.fullResponse ? resp : resp.body;
      } else {
        throw new SriClientError(await this.handleError('GET ' + baseUrl + commonUtils.parametersToString(href, params), response, options, stack));
      }
    } catch(error) {
      throw new SriClientError(await this.handleError('GET ' + baseUrl + commonUtils.parametersToString(href, params), error, options, stack));
    }
    /*return new Promise((resolve, reject) => {
      fetch(baseUrl + commonUtils.parametersToString(href, params), {
        method: 'GET',
        cache: 'no-cache',
        credentials: options.credentials || 'omit',
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
    });*/
  }

  async sendPayload(href, payload, options = {}, method) {
    const baseUrl = this.getBaseUrl(options);
    const logging = options.logging || this.configuration.logging;
    if(logging && typeof logging === 'string' && (new RegExp(method.toLowerCase)).test(logging.toLowerCase())) {
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
    try {
      const response = await fetch(baseUrl + href, {
          method: method,
          cache: 'no-cache',
          credentials: options.credentials || 'omit',
          redirect: options.redirect || "follow",
          signal: options.cancel,
          headers: Object.assign(this.defaultHeaders, {'Content-Type': 'application/json;charset=UTF-8'}, options.headers ? options.headers : {}),
          body: JSON.stringify(payload)
        });

      if(response.ok) {
        /*try {
          const text = await response.text();
          if(options.raw || !text) {
            return text;
          } else {
            try {
              return JSON.parse(text);
            } catch(err) {
              return text;
            }
          }
        } catch(err) {
          return response.html();
        }*/
        const resp = await this.readResponse(response);
        return options.fullResponse ? resp : resp.body;
      } else {
        throw new SriClientError(await this.handleError(method + baseUrl + href, response, options, stack));
      }
    } catch (error) {
      throw new SriClientError(await this.handleError(method + baseUrl + href, error, options, stack));
    }
  }

  async delete(href, options = {}) {
    const baseUrl = this.getBaseUrl(options);
    const stack = new Error().stack;
    try {
      const response = await fetch(baseUrl + href, {
        method: 'DELETE',
        cache: 'no-cache',
        credentials: 'omit',
        signal: options.cancel,
        headers: Object.assign(this.defaultHeaders, options.headers ? options.headers : {})
      });
      //const text = await response.text();
      if(response.ok) {
        /*if(options.raw || !text) {
          return text;
        } else {
          try {
            return JSON.parse(text);
          } catch(err) {
            return text;
          }
        }*/
        const resp = await this.readResponse(response);
        return options.fullResponse ? resp : resp.body;
      } else {
        throw new SriClientError(await this.handleError('DELETE' + baseUrl + href, response, options, stack));
      }
    } catch (error) {
      throw new SriClientError(await this.handleError('DELETE' + baseUrl + href, error, options, stack));
    }
    /*return new Promise((resolve, reject) => {
      fetch(baseUrl + href, {
        method: 'DELETE',
        cache: 'no-cache',
        credentials: 'omit',
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
    });*/
  }

  async readResponse(response) {
    const headers = [...response.headers].reduce( (acc, cur) => Object.assign({}, acc, {[cur[0]]: cur[1]}), {} );

    const contentType = headers['content-type'];

    let body = null;
    if(contentType.match(/html/g)) {
      console.log('response is html', response);
      body = await response.text();
      console.log('omzetten naar text is gelukt!', body)
    } else {
      body = await response.text();
      if(body && contentType.match(/application\/json/g)) {
        try {
          body = JSON.parse(body);
        } catch(err) {
          console.log('Json parse is mislukt!', response);
        }
      }
    }

    return {
      headers: headers,
      body: body
    };
  };

  async handleError(httpRequest, response, options, stack) {
    /*const logging = options.logging || options.logging === false ? options.logging : this.configuration.logging;
    if(logging) {
      console.error(response.status + ': An error occured for ' + httpRequest);
      if(response.body) {
        console.error(util.inspect(response.body, {depth: 7}));
      } else {
        console.error(error);
      }
    }*/


    if(!response || !response.status) {
      return response;
    }
    const resp = await this.readResponse(response);

    return new SriClientError({
      status: response.status || null,
      body: resp.body,
      headers: resp.headers,
      stack: stack
    });
  };

};



module.exports = function(configuration) {
  return new FetchClient(configuration);
};