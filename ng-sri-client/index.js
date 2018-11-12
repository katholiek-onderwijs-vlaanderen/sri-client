/* global angular*/
var module = angular.module('ng-sri-client', ['ngSanitize']);

module.factory({
 sriClient: require('./ng-sri-client'),
});

//module.provider('sriClientConfiguration', require('./sri-client-configuration.js'));

module.exports = module;
