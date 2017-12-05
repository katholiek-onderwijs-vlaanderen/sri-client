module.exports = ['$http', '$q', 'sriClientConfiguration', '$timeout', function ($http, $q, configuration, $timeout) {
  var getBaseUrl = function (config) {

    var baseUrl = config.baseUrl || configuration.config.baseUrl;
    if (!baseUrl) {
      console.error('There is no baseUrl configured. Do sriClientConfiguration.set(parameters) to configure the vsko-sri-client module.');
      return null;
    }
    return baseUrl;
  };

  var handleError = function (body, status, headers, href, config) {
    config.pending = false;
    return {
      status: status || null,
      body: body,
      getResponseHeader: headers
    };
  };

  var doGet = function (href, params, config) {
    config = (typeof config === 'undefined' ? {} : config);
    config.pending = true;
    var defer = $q.defer();
    var baseUrl = getBaseUrl(config);
    if(!baseUrl) {
      defer.reject(null);
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
      }).success(function (body, status, headers) {
        config.pending = false;
        defer.resolve(body);
      }).error(function (body, status, headers) {
        var error = handleError(body, status, headers, href, config);
        defer.reject(error);
      });
    }
    return defer.promise;
  };

  var getAllFromResult = function (data, config) {
    config = (typeof config === 'undefined' ? {} : config);
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

  var getList = function (href, params, config) {
    config = (typeof config === 'undefined' ? {} : config);
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

  var getAll = function (href, params, config) {
    var defer = $q.defer();
    config = (typeof config === 'undefined' ? {} : config);
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
  };

  var sendPayload = function (href, payload, config, method) {
    config = (typeof config === 'undefined' ? {} : config);
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
      }).success(function(body, status, headers) {
        body = body || {};
        body.getResponseHeader = headers;
        config.pending = false;
        defer.resolve(body);
      }).error(function (body, status, headers) {
        var error = handleError(body, status, headers, href, config);
        defer.reject(resp);
      });
    }
    return defer.promise;
  };

  var put = function (href, payload, config) {
    return sendPayload(href, payload, config, 'PUT');
  };

  var post = function (href, payload, config) {
    return sendPayload(href, payload, config, 'POST');
  };

  var doDelete = function (href, config) {
    config = (typeof config === 'undefined' ? {} : config);
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
      }).success(function (body, status, headers) {
        config.pending = false;
        defer.resolve(body);
      }).error(function (body, status, headers) {
        var error = handleError(body, status, headers, href, config);
        defer.reject(resp);
      });
    }
    return defer.promise;
  };

  return {
    get: doGet,
    getList: getList,
    getAll: getAll,
    put: put,
    updateResource: function (resource, config) {
      return put(resource.$$meta.permalink);
    },
    post: post,
    delete: doDelete
  };
}];
