const commonUtils = require('./common-utils');
const deepcopy = function(obj) {
  return JSON.parse(JSON.stringify(obj));
};
const util = require('util');

const pDebounce = require('p-debounce');

const checkCacheSize = (cache, maxSize) => {
  return new Promise(resolve => {
    //console.log('we gaan eens kijken of de cache niet te groot is');
    if(memorySizeOf(cache) > maxSize) {
      console.warn('The cache is too big! Help!');
      // Do clean up!
    } else {
      resolve();
    }
  });
};

const debouncedCheckCacheSize = pDebounce(checkCacheSize, 10000);


const createCacheRecord = function (body) {
  const timestamp = new Date();
  const cacheRecord = {
    timestamp: timestamp,
    lastUsed: timestamp,
    body: body,
    estimatedSize: null
  };
  //body.then(result => cacheRecord.estimatedSize = memorySizeOf(result));
  return cacheRecord;
};

const getHrefType = (fullHref, isList) => {
  const containsQuestionMark = fullHref.match(/^.*\?.*$/g);
  if(containsQuestionMark) {
    if(fullHref.toLowerCase().match(/\?(limit\=[^&]+|offset\=[^&]+|keyoffset\=[^&]+|hrefs\=[^&]+|expand\=(full|summary|none))(&(limit\=[^&]+|offset\=[^&]+|keyoffset\=[^&]+|hrefs\=[^&]+|expand\=(full|summary|none)))*$/g)) {
      return 'BASIC_LIST';
    } else {
      return 'COMPLEX';
    }
  } else {
    if(isList) {
      return 'BASIC_LIST';
    } else {
      return 'PERMALINK';
    }
  }
};

function memorySizeOf(object) {
  var objectList = [];
  var stack = [ object ];
  var bytes = 0;

  while ( stack.length ) {
    var value = stack.pop();

    if ( typeof value === 'boolean' ) {
      bytes += 4;
    }
    else if ( typeof value === 'string' ) {
      bytes += value.length * 2;
    }
    else if ( typeof value === 'number' ) {
      bytes += 8;
    }
    else if (typeof value === 'object' && objectList.indexOf( value ) === -1) {
      objectList.push( value );

      for( var i in value ) {
        stack.push( value[ i ] );
      }
    }
  }
  return bytes;
};

module.exports = class Cache {
  constructor(config = {}, api) {
    this.timeout = config.timeout || 0;
    this.maxSize = config.maxSize || 10;
    this.api = api;
    if(config.initialise && !Array.isArray(config.initialise)) {
      this.initialConfig = [config.initialise];
    } else {
      this.initialConfig = config.initialise;
    }
    this.cache = {
      basicLists: {},
      complexHrefs: {},
      totalSize: 0
    };
  }


  initialise() {
    if(this.initialConfig) {
      this.initialConfig.forEach(init => {
        init.hrefs.forEach(href => {
          const cacheConfig = {timeout: init.timeout ? init.timeout : this.timeout};
          this.api.getAll(href, undefined, {caching: cacheConfig});
        });
      });
    }
  }

  async get(href, params, options = {}, isList) {
    const cacheOptions = options.caching || {};
    const timeout = cacheOptions.timeout || this.timeout;
    if(timeout === 0) {
      return this.api.getRaw(href, params, options);
    }
    const fullHref = commonUtils.parametersToString(href, params);
    const cacheRecord = this.getCacheRecord(fullHref, isList);
    if(!cacheRecord || (new Date().getTime() - cacheRecord.timestamp.getTime() > timeout * 1000)) {
      const logging = options.logging || this.api.configuration.logging;
      if(/caching/.test(logging)) {
        console.log('cache MISS for ' + fullHref);
      }
      const body = this.api.getRaw(href, params, options);
      this.updateCacheRecord(fullHref, isList, body);
      body.then(result => {
        if(isList && (!href.toLowerCase().match(/^.+[\?\&]expand\=.+$/) || href.toLowerCase.match(/^.+[\?\&]expand\=full.*$/))) {
          result.results.forEach(obj => {
            this.updateCacheRecord(obj.href, false, Promise.resolve(obj.$$expanded));
          });
        }

        // do not do cache size checking yet. Gunther experience problems when loading 6000 resources of ZILL curriculum which made the app stall for 6 seconds
        //debouncedCheckCacheSize(this.cache, this.maxSize);
      });
      const resolvedBody = await body;
      return deepcopy(resolvedBody);
    } else {
      if(options.logging === 'cacheInfo' || options.logging === 'debug') {
        console.log('cache HIT for ' + fullHref);
      }
      //console.log(util.inspect(cacheRecord, {depth: 10}))
      cacheRecord.lastUsed = new Date;
      const resolvedBody = await cacheRecord.body;
      return deepcopy(resolvedBody);
    }
  }

  has(href, params, cacheOptions = {}, isList) {
    const timeout = cacheOptions.timeout || this.timeout;
    if(timeout === 0) {
      return false;
    }
    const fullHref = commonUtils.parametersToString(href, params);
    const cacheRecord = this.getCacheRecord(fullHref);
    return cacheRecord && (new Date().getTime() - cacheRecord.timestamp.getTime() <= timeout * 1000);
  }

  getCacheRecord(fullHref, isList) {
    switch(getHrefType(fullHref, isList)) {
      case 'PERMALINK':
        const parts = commonUtils.splitPermalink(fullHref);
        const group = this.cache[parts.path];
        return group ? group[parts.key] : undefined;
        break;
      case 'BASIC_LIST':
        return this.cache.basicLists[fullHref];
        break;
      case 'COMPLEX':
        return this.cache.complexHrefs[fullHref];
        break;
    }
  }

  updateCacheRecord(fullHref, isList, body) {
    const cacheRecord = createCacheRecord(body);
    switch(getHrefType(fullHref, isList)) {
      case 'PERMALINK':
        const parts = commonUtils.splitPermalink(fullHref);
        if(!this.cache[parts.path]) {
          this.cache[parts.path] = {};
        }
        this.cache[parts.path][parts.key] = cacheRecord;
        break;
      case 'BASIC_LIST':
        this.cache.basicLists[fullHref] = cacheRecord;
        break;
      case 'COMPLEX':
        return this.cache.complexHrefs[fullHref] = cacheRecord;
        break;
    }
    return cacheRecord;
  }

  onResourceUpdated(permalink) {
    this.cache.complex = {};
    const parts = commonUtils.splitPermalink(permalink);
    Object.keys(this.cache.basicLists).forEach(entry => {
      if(entry.startsWith(parts.path)) {
        delete this.cache.basicLists[entry];
      }
    });
    const group = this.cache[parts.path];
    if(group) {
      delete group[parts.key];
    }
  }

  onBatchPerformed(batch) {
    batch.forEach(outerBatchElem => {
      if(!Array.isArray(outerBatchElem)) {
        outerBatchElem = [outerBatchElem];
      }
      outerBatchElem.forEach(batchElem => {
        if(batchElem.verb === 'PUT' || batchElem.verb === 'DELETE') {
          this.onResourceUpdated(batchElem.href);
        }
      });
    });
  }

  onDataAltered(href, payload, method) {
    if((method === 'PUT' || method === 'POST') && href.match(/\/batch$/)) {
      this.onBatchPerformed(payload);
    } else if(method === 'PUT' || method === 'DELETE') {
      this.onResourceUpdated(href);
    }
  }
};