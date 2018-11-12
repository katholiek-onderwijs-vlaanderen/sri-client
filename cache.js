const commonUtils = require('./common-utils');
const deepcopy = require('deepcopy/index.js');
const util = require('util')

const pDebounce = require('p-debounce');

const checkCacheSize = (cache, maxSize) => {
  return new Promise(resolve => {
    console.log('we gaan eens kijken of de cache niet te groot is');
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
    if(fullHref.toLowerCase().match(/\?(limit\=[^&]+|offset\=[^&]+|keyoffset\=[^&]+|hrefs\=[^&]+|expand\=full)(&(limit\=[^&]+|offset\=[^&]+|keyoffset\=[^&]+|hrefs\=[^&]+|expand\=full))*$/g)) {
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
  constructor(timeout = 0, maxSize = 10) {
    this.timeout = timeout;
    this.maxSize = maxSize;
    this.cache = {
      basicLists: {},
      complexHrefs: {},
      totalSize: 0
    };
  }

  async get(href, params, options = {}, isList, client) {
    const cacheOptions = options.caching || {};
    const timeout = cacheOptions.timeout || this.timeout;
    if(timeout === 0) {
      return client.getRaw(href, params, options);
    }
    const fullHref = commonUtils.parametersToString(href, params);
    const cacheRecord = this.getCacheRecord(fullHref);
    if(!cacheRecord || (new Date().getTime() - cacheRecord.timestamp.getTime() > timeout * 1000)) {
      console.log('cache MISS for ' + fullHref);
      const body = client.getRaw(href, params, options);
      this.updateCacheRecord(fullHref, body);
      body.then(result => {
        if(isList && (!href.match(/^.+[\?\&]expand\=.+$/) || href.match(/^.+[\?\&]expand\=FULL.*$/))) {
          result.results.forEach(obj => {
            this.updateCacheRecord(obj.href, Promise.resolve(obj.$$expanded));
          });
        }

        debouncedCheckCacheSize(this.cache, this.maxSize);
      });
      const resolvedBody = await body;
      return deepcopy(resolvedBody);
    } else {
      console.log('cache HIT for ' + fullHref);
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

  updateCacheRecord(fullHref, body) {
    const cacheRecord = createCacheRecord(body);
    switch(getHrefType(fullHref)) {
      case 'PERMALINK':
        const parts = commonUtils.splitPermalink(fullHref);
        if(!this.cache[parts.path]) {
          this.cache[parts.path] = {};
        }
        this.cache[parts.path][parts.key] = cacheRecord;
        break;
      case 'BASIC_LIST':
        console.log('das een basic list he')
        this.cache.basicLists[fullHref] = cacheRecord;
        break;
      case 'COMPLEX':
        return this.cache.complexHrefs[fullHref] = cacheRecord;
        break;
    }
    return cacheRecord;
  }

  onResourceUpdated(permalink) {
    console.log('handle invalid cache entries because of '+ permalink)
    this.cache.complex = {};
    const parts = commonUtils.splitPermalink(permalink);
    Object.keys(this.cache.basicLists).forEach(entry => {
      if(entry.startsWith(parts.path)) {
        this.cache.basicLists[entry] = undefined;
      }
    });
    const group = this.cache[parts.path];
    if(group) {
      group[parts.key] = undefined;
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