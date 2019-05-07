const generateUUID = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
  });
};

const splitPermalink = function(permalink) {
  const parts = permalink.split('/');
  return {
    path: parts.slice(0, parts.length-1).join('/'),
    key: parts[parts.length-1]
  };
};

const getKeyFromPermalink = function(permalink) {
  return splitPermalink(permalink).key;
};

const getPathFromPermalink = function(permalink) {
  return splitPermalink(permalink).path;
};

const replaceSpecialCharacters = function (string) {
		return string
			.replace(/[\u00C0-\u00C5\u00E0-\u00E5]/g, 'a')
			.replace(/[\u00C6\u00E6]/g, 'ae')
			.replace(/[\u00C7\u00E7]/g, 'c')
			.replace(/[\u00C8-\u00CB\u00E8-\u00EB]/g, 'e')
			.replace(/[\u00CC-\u00CF\u00EC-\u00EF]/g, 'i')
			.replace(/[\u00D1\u00F1]/g, 'n')
			.replace(/[\u00D2-\u00D6\u00D8\u00F2-\u00F6\u00F8]/g, 'o')
			.replace(/[\u00D9-\u00DC\u00F9-\u00FC]/g, 'u')
			.replace(/[\u00DD\u00FD\u00FF]/g, 'y')
			.replace(/[\u00DF]/g, 'ss')
			.replace(/[ł]/g, 'l')
			.replace(/[^a-zA-Z0-9\-]/g, '');
	};

const strip$$Properties = function (obj) {
  if(!obj || typeof obj !== 'object') {
    return obj;
  }
  if(Array.isArray(obj)) {
    const newArray = [];
    obj.forEach(elem => {
      newArray.push(strip$$Properties(elem));
    });
    return newArray;
  } else {
    const newObj = {};
    Object.keys(obj).forEach(function(key) {
      if(!key.match(/^\$\$/)) {
        newObj[key] = strip$$Properties(obj[key]);
      }
    });
    return newObj;
  }
};

const strip$$PropertiesFromObject = function(obj, newBatch) {
  newBatch.push({
    href: obj.href,
    verb: obj.verb,
    body: strip$$Properties(obj.body)
  });
};

const strip$$PropertiesFromBatch = function (batch) {
  if(!batch) {
    return batch;
  }
  const newBatch = [];
  for(let obj of batch) {
    if(Array.isArray(obj)) {
      const newSubBatch = [];
      for(let subObj of obj) {
        strip$$PropertiesFromObject(subObj, newSubBatch);
      }
      newBatch.push(newSubBatch);
    } else {
      strip$$PropertiesFromObject(obj, newBatch);
    }
  }
  return newBatch;
};

const paramsToString = function (path, params) {
  var ret = path;
  for (var key in params) {
    if (params.hasOwnProperty(key)) {
      if(!ret.match(/\?/g)) {
        ret += '?';
      } else {
        ret += '&';
      }
      ret += encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }
  }
  return ret;
};

module.exports = {
  generateUUID: generateUUID,
  splitPermalink: splitPermalink,
  getKeyFromPermalink: getKeyFromPermalink,
  getPathFromPermalink: getPathFromPermalink,
  parametersToString: paramsToString,
  replaceSpecialCharacters: replaceSpecialCharacters,
  strip$$Properties: strip$$Properties,
  strip$$PropertiesFromBatch: strip$$PropertiesFromBatch
};