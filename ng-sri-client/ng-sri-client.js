const common = require('../common-sri-client.js');
let cache = new Map();
module.exports = ['$http', '$q', 'sriClientConfiguration', '$timeout', function ($http, $q, configuration, $timeout) {
  const getBaseUrl = function (config) {
    var baseUrl = config.baseUrl || configuration.config.baseUrl;
    if (!baseUrl) {
      console.error('There is no baseUrl configured. Do sriClientConfiguration.set(parameters) to configure the vsko-sri-client module.');
      return null;
    }
    return baseUrl;
  };

  const handleError = function (body, status, headers, href, config) {
    config.pending = false;
    return {
      status: status || null,
      body: body,
      getResponseHeader: headers
    };
  };

  const doGet = function (href, params, config = {}) {
    config.pending = true;
    var defer = $q.defer();
    var baseUrl = getBaseUrl(config);
    if(!baseUrl) {
      defer.reject(null);
    } else {
      if (cache.has({url: baseUrl + href, params: params})) {
        defer.resolve(cache.get({url: baseUrl + href, params: params}));
      } else {
        $http({
          method: 'GET',
          url: baseUrl + href,
          params: params,
          headers: config.headers,
          timeout: config.cancelPromise,
          transformResponse: function (value) {
            return JSON.parse(value);
          }
        }).then(function (response) {
          config.pending = false;
          defer.resolve(response.data);
          cache.set({url: baseUrl + href, params: params}, response.data);
        }, function (response) {
          var error = handleError(response.data, response.status, response.headers, href, config);
          defer.reject(error);
        });
      }
    }
    return defer.promise;
  };

  const getAllFromResult = function (data, config = {}) {
    var defer = $q.defer();
    var results = data.results;
    if (data.$$meta.next) {
      doGet(data.$$meta.next, undefined, config).then(function (nextResult) {
        getAllFromResult(nextResult, config).then(function (nextResults) {
          results = results.concat(nextResults);
          defer.resolve(results);
        }, function (error) { defer.reject(error); });
      }, function (error) { defer.reject(error); });
    } else {
      defer.resolve(results);
    }
    return defer.promise;
  };

/*  var getList = function (href, params, config = {}) {
    var defer = $q.defer();
    doGet(href, params, config).then(function (result) {
      var results = result.results;
      if (!config.raw && !(params && params.expand && params.expand === 'NONE')) {
        results = results.map(function (item) {
          return item.$$expanded;
        });
      }
      results.count = function () {
        return result.$$meta.count;
      };
      defer.resolve(results);
    }, function (error) { defer.reject(error); });
    return defer.promise;
  };

  var getAll = function (href, params, config = {}) {
    var defer = $q.defer();
    doGet(href, params, config).then(function (result) {
      getAllFromResult(result, config).then(function (allResults) {
        if (!config.raw && !(params && params.expand && params.expand === 'NONE')) {
          allResults = allResults.map(function (item) {
            return item.$$expanded;
          });
        }
        allResults.count = function () {
          return result.$$meta.count;
        };
        defer.resolve(allResults);
      }, function (error) { defer.reject(error); });
    }, function (error) { defer.reject(error); });
    return defer.promise;
  };*/

  var sendPayload = function (href, payload, config = {}, method) {
    config.pending = true;
    var defer = $q.defer();
    var baseUrl = getBaseUrl(config);
    if (!baseUrl) {
      defer.reject(null);
    } else {
      $http({
        method: method,
        url: baseUrl + href,
        data: payload,
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        headers: config.headers,
        timeout: config.cancelPromise
      }).then(function(response) {
        var body = {};
        if (response && response.data && typeof response.data === 'object'){
          body = response.data;
        }
        body.getResponseHeader = {};
        if (response && response.headers){
          body.getResponseHeader = response.headers;
        }
        config.pending = false;
        defer.resolve(body);
      }, function (response) {
        var error = handleError(response.data, response.status, response.headers, href, config);
        defer.reject(error);
      });
    }
    return defer.promise;
  };

  const put = function (href, payload, config) {
    return sendPayload(href, payload, config, 'PUT');
  };

  const post = function (href, payload, config) {
    return sendPayload(href, payload, config, 'POST');
  };

  const doDelete = function (href, config = {}) {
    var defer = $q.defer();
    config.pending = true;
    var baseUrl = getBaseUrl(config);
    if (!baseUrl) {
      defer.reject(null);
    } else {
      $http({
        method: 'DELETE',
        url: baseUrl + href,
        dataType: 'json',
        headers: config.headers,
        timeout: config.cancelPromise
      }).then(function (response) {
        config.pending = false;
        defer.resolve(response.data);
      }, function (response) {
        var error = handleError(response.data, response.status, response.headers, href, config);
        defer.reject(error);
      });
    }
    return defer.promise;
  };

  const that = {
    get: doGet,
    sendPayload: sendPayload,
    put: put,
    updateResource: function (resource, options) {
      return put(resource.$$meta.permalink, resource, options);
    },
    post: post,
    delete: doDelete
  };

  that.get = async function(href, params, options = {}) {
    const result = await doGet(href, params, options);
    if(options.expand) {
      await common.expand(result, options.expand, that);
    }
    if(options.include) {
      await common.include(result, options.include, that);
    }
    return result;
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
}];
