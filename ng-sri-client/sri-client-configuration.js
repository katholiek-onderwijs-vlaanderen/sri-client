module.exports = [function () {
  'use strict';

  this.set = function (newConfig) {
    this.config = newConfig;
  };

  this.$get = function () {
    return this;
  };
}];