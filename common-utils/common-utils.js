const generateUUID = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
  });
};

const strip$$Properties = function (obj) {
  const newObj = {};
  Object.keys(obj).forEach(function(key) {
    if(!key.match(/^\$\$/)) {
      newObj[key] = obj[key];
    }
  });
  return newObj;
};

const strip$$PropertiesFromBatch = function (batch) {
  const newBatch = [];
  for(let obj of batch) {
    newBatch.push({
      href: obj.href,
      verb: obj.verb,
      body: strip$$Properties(obj.body)
    });
  }
  return newBatch;
};

module.exports = {
  generateUUID: generateUUID,
  strip$$Properties: strip$$Properties,
  strip$$PropertiesFromBatch: strip$$PropertiesFromBatch
};