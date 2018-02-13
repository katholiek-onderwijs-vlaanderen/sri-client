/* global angular*/
var module = angular.module('ng-sri-client', ['ngSanitize']);

module.factory({
                 vskoApi2: require('./angular-sri-client'),
                 apiUtils: require('./apiUtils')
               });

module.provider('sriClientConfiguration', require('./sri-client-configuration.js'));

module.constant('dateUtils', require('../date-utils'));

module.exports = module;
