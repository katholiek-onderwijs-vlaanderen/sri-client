const SriClient = require('../sri-client.js');
const SriClientError = require('../sri-client-error');
const commonUtils = require('../common-utils');

module.exports = function(configuration) {


  return ['$http', '$q', function ($http, $q) {

    class NgClient extends SriClient {
      constructor(config = {}) {
        super(config);
        this.cache.initialise();
      }

      /*getBaseUrl(options) {
        let baseUrl = options.baseUrl || configuration.config.baseUrl;
        if (!baseUrl) {
          console.error('There is no baseUrl configured. Do sriClientConfiguration.set(parameters) to configure the vsko-sri-client module.');
          return null;
        }
        return baseUrl;
      };*/

      getRaw(href, params, options = {}) {
        let defer = $q.defer();
        let baseUrl = this.getBaseUrl(options);
        $http({
          method: 'GET',
          url: baseUrl + commonUtils.parametersToString(href, params),
          headers: options.headers,
          timeout: options.cancelPromise,
          transformResponse: function (value) {
            return options.raw ? value : JSON.parse(value);
          }
        }).then(function (response) {
          defer.resolve(response.data);
        }, function (response) {
          let error = handleError(response.data, response.status, response.headers, href);
          defer.reject(new SriClientError(error));
        });
        return defer.promise;
      }

      sendPayload(href, payload, options = {}, method) {
        let defer = $q.defer();
        const baseUrl = this.getBaseUrl(options);
        $http({
          method: method,
          url: baseUrl + href,
          data: payload,
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          headers: options.headers,
          timeout: options.cancelPromise
        }).then(function(response) {
          let body = response.data || {};
          if (typeof body === 'object') {
            body.getResponseHeader = response.headers;
          }
          defer.resolve(body);
        }, function (response) {
          let error = handleError(response.data, response.status, response.headers, href);
          defer.reject(new SriClientError(error));
        });
        return defer.promise;
      }

      delete(href, options = {}) {
        let defer = $q.defer();
        let baseUrl = this.getBaseUrl(options);
        $http({
          method: 'DELETE',
          url: baseUrl + href,
          dataType: 'json',
          headers: options.headers,
          timeout: options.cancelPromise
        }).then(function (response) {
          defer.resolve(response.data);
        }, function (response) {
          let error = handleError(response.data, response.status, response.headers, href);
          defer.reject(new SriClientError(error));
        });
        return defer.promise;
      }
    }

    const handleError = function (body, status, headers, href) {
      return {
        status: status || null,
        body: body,
        getResponseHeader: headers
      };
    };

    return new NgClient(configuration);
  }];
};
