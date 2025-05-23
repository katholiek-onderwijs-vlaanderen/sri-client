const printAddress = function(address) {
  return address.street + (address.houseNumber ? ' ' + address.houseNumber : '') + (address.mailboxNumber ? ' bus ' + address.mailboxNumber : '') +
    ', ' + address.zipCode + ' ' + address.subCity;
};

const addSubCityHref = async function (address, api, dateUtils = require('../date-utils')) {
  const thisSubCityClean = address.subCity.split('(')[0].trim();
  let subCities = null;
  if (address.nisCode && !address.cityHref) {
    address.cityHref = '/sam/commons/cities/'+address.nisCode;
  }
  if (!address.cityHref && address.streetHref) {
    try {
      const street = await api.get(address.streetHref);
      if (dateUtils.isBefore(street.endDate, dateUtils.getNow())) {
        address.cityHref = street.city.href;
      }
    } catch(error) {
      console.warn('street with permalink ' + address.streetHref + ' can not be found in the API');
    }
  }
  if (address.cityHref) {
    subCities = await api.getAll('/sam/commons/subcities', {city: address.cityHref}, {expand: 'city'});
    // when cities were merged on 01/01/2019 and we still had to be able to handle the past schoolyear. Subcities are not linked historically.
    if (subCities.length === 0) {
      subCities = await api.getAll('/sam/commons/subcities', {nameContains: thisSubCityClean}, {expand: 'city'});
    }
  } else {
    subCities = await api.getAll('/sam/commons/subcities', {nameContains: thisSubCityClean}, {expand: 'city'});
  }
  let matches = [];
  let checkedSubCities = null;
  subCities.forEach(function(subCity) {
    checkedSubCities = checkedSubCities ? checkedSubCities + ', ' : '';
    checkedSubCities += subCity.name + ' [ ' + subCity.city.$$expanded.name + '] ' + JSON.stringify(subCity.zipCodes);
    if (subCity.name.split('(')[0].trim().toLowerCase() === thisSubCityClean.toLowerCase()) {
      if (address.zipCode) {
        // check if the zipCode corresponds with one of the zipCodes of the subCity
        if (subCity.zipCodes.some(zipCode => zipCode.toString() === address.zipCode)) {
          matches.push(subCity);
        }
      } else {
        matches.push(subCity);
      }
    }
  });
  if (matches.length > 1) {
    console.warn('multiple subCity matches for ' + address.subCity);
    if (address.nisCode) {
      checkedSubCities += ' in niscode '+ address.nisCode;
    }
    console.warn('checked for the following sub cities: ' + checkedSubCities);
  } else if (matches.length === 0) {
    console.warn('no subCity match could be found for ' + address.street + ' ' + address.houseNumber + ', ' + address.zipCode + ' ' + address.subCity);
    if (address.nisCode) {
      checkedSubCities += ' in niscode '+ address.nisCode;
    }
    console.warn('checked for the following sub cities: ' + checkedSubCities);
  } else {
    address.subCityHref = matches[0].$$meta.permalink;
    if (!address.city) {
      address.city = matches[0].city.$$expanded.name;
    }
    address.cityHref = matches[0].city.href;
  }
};

const addStreetHref = async function(address, api, dateUtils = require('../date-utils'), changeStreetName = false) {
  if (!address.nisCode && !address.cityHref && !address.subCityHref) {
    await addSubCityHref(address, api);
  }
  /*if (!address.nisCode && address.cityHref) {
    const words = address.cityHref.split('/');
    address.nisCode = words[words.length-1];
  }*/
  if (!address.cityHref && address.nisCode) {
    address.cityHref = '/sam/commons/cities/' + address.niscode;
  } else if (address.city) {
    const citiesByName =  await api.getAll('/sam/commons/cities', { name: address.city });
    if (citiesByName.length === 1) {
      address.cityHref = citiesByName[0].$$meta.permalink;
    }
  }
  if (!address.cityHref) {
    console.warn('no street match could be found for ' + address.street + ' in ' + address.subCity + ' because there is no city in the address.');
    return;
  }
  const streets = await api.getAll('/sam/commons/streets', {city: address.cityHref, endDateAfter: dateUtils.getNow()});
  const matches = [];
  streets.forEach(function(street) {
    if (isStreetNameMatch(street.name, address.street)) {
      matches.push(street);
    }
  });
  if (matches.length > 1) {
    let nbOfExactMatches = 0;
    let exactMatch = null;
    matches.forEach(street => {
      if (street.name === address.street) {
        nbOfExactMatches++;
        exactMatch = street;
      }
    });
    if (nbOfExactMatches === 1) {
      address.streetHref = exactMatch.$$meta.permalink;
      if (changeStreetName) {
        address.street = exactMatch.name;
      }
    } else {
      console.warn('multiple street matches for ' + address.street + ' in ' + address.subCity);
    }
  } else if (matches.length === 0) {
    console.warn('no street match could be found for ' + address.street + ' in ' + address.subCity);
  } else {
    address.streetHref = matches[0].$$meta.permalink;
    if (changeStreetName) {
      address.street = matches[0].name;
    }
  }
};

const isSameSubcity = function (a, b) {
  return a.subCity.replace(/\s?\(.+\)/g, '').toLowerCase() === b.subCity.replace(/\s?\(.+\)/g, '').toLowerCase();
};

const isSameHouseNumberAndMailbox = function (a, b) {
  let x =
    (
      (!a.houseNumber && !b.houseNumber) ||
      (
        a.houseNumber && b.houseNumber &&
        a.houseNumber.toLowerCase()
          .replace(/^[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]/g, '')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]([0-9])/g, '_$1')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]([a-zA-Z])/g, '$1')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]$/g, '') ===
        b.houseNumber.toLowerCase()
          .replace(/^[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]/g, '')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]([0-9])/g, '_$1')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]([a-zA-Z])/g, '$1')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]$/g, '')
      )
    ) &&
    (
      ((!a.mailboxNumber || a.mailboxNumber.trim() === '') && (!b.mailboxNumber || b.mailboxNumber.trim() === '')) ||
      ( a.mailboxNumber && b.mailboxNumber &&
        a.mailboxNumber.toLowerCase()
          .replace(/^[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]/g, '')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]([0-9])/g, '_$1')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]([a-zA-Z])/g, '$1')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]$/g, '') ===
        b.mailboxNumber.toLowerCase()
          .replace(/^[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]/g, '')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]([0-9])/g, '_$1')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]([a-zA-Z])/g, '$1')
          .replace(/[\_\s\/\.\-\(\)]*[\_\s\/\.\-\(\)]$/g, '')
        )
    );
  return x;
};

const isStreetNameMatch = function (a, b) {
  const bracesPattern = /(.*)\s\((.*)\)/g;
  if (a.match(bracesPattern)) {
    return isStreetNameMatch(a.replace(bracesPattern, '$1'), b) || isStreetNameMatch(a.replace(bracesPattern, '$2 $1'), b);
  }
  if (b.match(bracesPattern)) {
    return isStreetNameMatch(a, b.replace(bracesPattern, '$1')) || isStreetNameMatch(a , b.replace(bracesPattern, '$2 $1'));
  }
  const aWords = a.replace(/\.([A-Z])/g, '. $1').toLowerCase().replace(/st\-/g, 'sint-').replace(/st\.\s/g, 'sint ').replace(/st\./g, 'sint ').replace(/dr\.?\s/g, 'dokter ').replace(/[\-]/g, ' ').split(' ');
  const bWords = b.replace(/\.([A-Z])/g, '. $1').toLowerCase().replace(/st\-/g, 'sint-').replace(/st\.\s/g, 'sint ').replace(/st\./g, 'sint ').replace(/dr\.?\s/g, 'dokter ').replace(/[\-]/g, ' ').split(' ');
  if (aWords.join('') === bWords.join('')) {
    return true;
  } else if (aWords.length === bWords.length) {
    for (let i = 0; i < aWords.length; i++) {
      if (!aWords[i].endsWith('.') && !bWords[i].endsWith('.')) {
        if (aWords[i] !== bWords[i]) {
          return false;
        }
      } else if (aWords[i].endsWith('.') && bWords[i].endsWith('.')) {
        if (aWords[i].length === bWords[i].length) {
          if (aWords[i] !== bWords[i]) {
            return false;
          }
        } else if (aWords[i].length < bWords[i].length) {
          if (!bWords[i].startsWith(aWords[i].substring(0, aWords[i].length-1))) {
            return false;
          }
        } else {
          if (!aWords[i].startsWith(bWords[i].substring(0, bWords[i].length-1))) {
            return false;
          }
        }
      } else if (aWords[i].endsWith('.')) {
        if (!bWords[i].startsWith(aWords[i].substring(0, aWords[i].length-1))) {
          return false;
        }
      } else {
        if (!aWords[i].startsWith(bWords[i].substring(0, bWords[i].length-1))) {
          return false;
        }
      }
    }
    return true;
  }
  return false;
};

const isSameStreet = function (a, b) {
  let x = (a.streetHref && b.streetHref && a.streetHref === b.streetHref) ||
        (
          //a.street.toLowerCase() === b.street.toLowerCase() &&
          isStreetNameMatch(a.street, b.street) &&
          (
            (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) ||
            (a.zipCode === b.zipCode && isSameSubcity(a, b))
          )
        );
  return x;
};

module.exports = {
  printAddress: printAddress,
  isSameHouseNumberAndMailbox: isSameHouseNumberAndMailbox,
  isSameStreet: isSameStreet,
  isStreetNameMatch: isStreetNameMatch,
  addSubCityHref: addSubCityHref,
  addStreetHref: addStreetHref
};
