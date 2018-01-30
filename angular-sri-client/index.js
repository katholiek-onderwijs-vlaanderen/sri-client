/* global angular*/
var module = angular.module('vskoSriClient', ['ngSanitize']);

module.factory({
                 vskoApi2: require('./vsko-api'),
                 apiUtils: require('./apiUtils')
               });

module.provider('sriClientConfiguration', require('./sri-client-configuration.js'));

module.constant('dateUtils', require('../date-utils'));

module.exports = module;
