/* global angular*/
var module = angular.module('ng-sri-client', ['ngSanitize']);

module.provider('sriClientConfiguration', require('./sri-client-configuration.js'));

module.exports = function(configurations) {
  if(!Array.isArray(configurations)) {
    configurations = [configurations];
  }

  const factory = {};

  for(let config of configurations) {
    const name = config.name ? config.name : 'sriClient';
    factory[name] = require('./ng-sri-client')(config);
  }

  module.factory(factory);

  return module;
};
