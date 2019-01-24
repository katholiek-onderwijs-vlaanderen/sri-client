/* global angular*/
module.exports = function(configurations) {
  var module = angular.module('ng-sri-client', ['ngSanitize']);

  if(!Array.isArray(configurations)) {
    configurations = [configurations];
  }

  const factory = {};

  for(let config of configurations) {
    const name = config.name ? config.name : 'sriClient';
    factory[name] = require('./ng-sri-client')(config);
  }

  module.factory(factory);

  return 'ng-sri-client';
};
