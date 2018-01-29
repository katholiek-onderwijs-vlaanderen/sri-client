const _ = require('lodash');
const util = require('util');

const addSubCityHref = async function (address, api) {
  const thisSubCityClean = address.subCity.split('(')[0].trim();
  var subCities = null;
  if(!address.nisCode && address.streetHref) {
    try {
      const street = await api.get(address.streetHref);
      address.nisCode = street.city.href.split('/')[3];
    } catch(error) {
      console.warn('street with permalink ' + address.streetHref + ' can not be found in the API');
    }
  }
  if(address.nisCode) {
    subCities = await api.getAll('/commons/subcities', {city: address.nisCode});
  } else {
    subCities = await api.getAll('/commons/subcities', {nameContains: address.subCity.replace(/\'/g, "''")});
  }
  var matches = [];
  var checkedSubCities = null;
  subCities.forEach(function(subCity) {
    checkedSubCities = checkedSubCities ? checkedSubCities + ', ' : '';
    checkedSubCities += subCity.name + ' [ ' + subCity.city.$$expanded.name + '] ' + util.inspect(subCity.zipCodes);
    if(subCity.name.split('(')[0].trim().toLowerCase() === thisSubCityClean.toLowerCase()) {
      if(address.zipCode) {
        // check if the zipCode corresponds with one of the zipCodes of the subCity
        let index = _.findIndex(subCity.zipCodes, function(zipCode) {
          return zipCode.toString() === address.zipCode;
        });
        if(index > -1) {
          matches.push(subCity);
        }
      } else {
        matches.push(subCity);
      }
    }
  });
  if(matches.length > 1) {
    console.warn('multiple subCity matches for ' + address.subCity);
    if(address.nisCode) {
      checkedSubCities += ' in niscode '+ address.nisCode;
    }
    console.warn('checked for the following sub cities: ' + checkedSubCities);
  } else if(matches.length === 0) {
    console.warn('no subCity match could be found for ' + address.zipCode + ' ' + address.subCity);
    if(address.nisCode) {
      checkedSubCities += ' in niscode '+ address.nisCode;
    }
    console.warn('checked for the following sub cities: ' + checkedSubCities);
  } else {
    address.subCityHref = matches[0].$$meta.permalink;
    if(!address.city) {
      address.city = matches[0].city.$$expanded.name;
    }
    address.cityHref = matches[0].city.href;
  }
};

const addStreetHref = async function(address, api) {
  if(!address.nisCode && !address.cityHref && !address.subCityHref) {
    addSubCityHref(address, api);
  }
  var niscode = address.nisCode;
  if(!niscode && address.cityHref) {
    const words = address.cityHref.split('/');
    niscode = words[words.length-1];
  }
  const streets = await api.getAll('/commons/streets', {city: niscode});
  const matches = [];
  streets.forEach(function(street) {
    if(isStreetNameMatch(street.name, address.street)) {
      matches.push(street);
    }
  });
  if(matches.length > 1) {
    console.warn('multiple street matches for ' + address.street + ' in ' + address.subCity);
  } else if(matches.length === 0) {
    console.warn('no street match could be found for ' + address.street + ' in ' + address.subCity);
  } else {
    address.streetHref = matches[0].$$meta.permalink;
  }
};

const isSameSubcity = function (a, b) {
  return a.subCity.replace(/\s?\(.+\)/g, '').toLowerCase() === b.subCity.replace(/\s?\(.+\)/g, '').toLowerCase();
};

const isSameHouseNumberAndMailBox = function (a, b) {
  var x =
    (
      (!a.houseNumber && !b.houseNumber) ||
      (
        a.houseNumber && b.houseNumber &&
        a.houseNumber.replace(/[\_\s\/]/g, '').toLowerCase() === b.houseNumber.replace(/[\_\s\/]/g, '').toLowerCase()
      )
    ) &&
    (
      ((!a.mailboxNumber || a.mailboxNumber.trim() === '') && (!b.mailboxNumber || b.mailboxNumber.trim() === '')) ||
      ( a.mailboxNumber && b.mailboxNumber &&
        a.mailboxNumber.replace(/[\_\s\/]/g, '').toLowerCase() === b.mailboxNumber.replace(/[\_\s\/]/g, '').toLowerCase())
    );
  return x;
};

const isStreetNameMatch = function (a, b) {
  const aWords = a.toLowerCase().replace(/[\-]/g, ' ').split(' ');
  const bWords = b.toLowerCase().replace(/[\-]/g, ' ').split(' ');
  if(aWords.join('') === bWords.join('')) {
    return true;
  } else if(aWords.length === bWords.length) {
    for(var i = 0; i < aWords.length; i++) {
      if(!aWords[i].endsWith('.') && !bWords[i].endsWith('.')) {
        if(aWords[i] !== bWords[i]) {
          return false;
        }
      } else if(aWords[i].endsWith('.') && bWords[i].endsWith('.')) {
        if(aWords[i].length === bWords[i].length) {
          if(aWords[i] !== bWords[i]) {
            return false;
          }
        } else if(aWords[i].length < bWords[i].length) {
          if(!bWords[i].startsWith(aWords[i].substring(0, aWords[i].length-1))) {
            return false;
          }
        } else {
          if(!aWords[i].startsWith(bWords[i].substring(0, bWords[i].length-1))) {
            return false;
          }
        }
      } else if(aWords[i].endsWith('.')) {
        if(!bWords[i].startsWith(aWords[i].substring(0, aWords[i].length-1))) {
          return false;
        }
      } else {
        if(!aWords[i].startsWith(bWords[i].substring(0, bWords[i].length-1))) {
          return false;
        }
      }
    }
    return true;
  }
  return false;
};

const isSameStreet = function (a, b) {
  var x = (a.streetHref && b.streetHref && a.streetHref === b.streetHref) ||
        (
          //a.street.toLowerCase() === b.street.toLowerCase() &&
          isStreetNameMatch(a.street, b.street) &&
          (
            (a.city && b.city && a.city.toLowerCase === b.city.toLowerCase) ||
            (a.zipCode === b.zipCode && isSameSubcity(a, b))
          )
        );
  return x;
};

module.exports = {
  isSameHouseNumberAndMailbox: isSameHouseNumberAndMailBox,
  isSameStreet: isSameStreet,
  addSubCityHref: addSubCityHref,
  addStreetHref: addStreetHref
};
