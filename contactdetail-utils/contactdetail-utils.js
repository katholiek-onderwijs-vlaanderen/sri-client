const addressUtils = require('../address-utils');

const formatPhoneNumber = function(phone) {
  let propertyName, newValue;
  if(typeof phone === 'string' || phone instanceof String) {
    propertyName = null;
    newValue = phone;
  } else {
    propertyName = phone.value ? 'value' : 'number';
    newValue = phone[propertyName];
  }
  newValue = newValue.replace(/\//g, '').replace(/\./g, '').replace(/\s/g, '').replace(/\(/g, '').replace(/\)/g, '').replace(/\-/g, '').replace(/\'/g, '');
  if(!newValue.match(/^\+?0*[1-9]{1}[0-9]{6}[0-9]{0,8}$/)) {
    throw new Error('InvalidPhoneNumber');
  }
  if(newValue.substring(0,2) === '00') {
    newValue = newValue.replace(/^00/, '+');
  }
  if(newValue.match(/^0[89]00/)) {
    newValue = newValue.substring(0,4) + ' ' + newValue.substring(4);
  } else if(newValue.substring(0,1) !== '+') {
    if(newValue.length === 10 && newValue.substring(0,2) === '04') {
      newValue = newValue.substring(0,4) + ' ' + newValue.substring(4,6) + ' ' + newValue.substring(6,8) + ' ' + newValue.substring(8);
    } else if(newValue.length === 9) {
      if(newValue.substring(0,2) === '02' || newValue.substring(0,2) === '03' || newValue.substring(0,2) === '04' || newValue.substring(0,2) === '09') {
        newValue = newValue.substring(0,2) + ' ' + newValue.substring(2,5) + ' ' + newValue.substring(5,7) + ' ' + newValue.substring(7);
      } else if(newValue.substring(0,1) === '0') {
        newValue = newValue.substring(0,3) + ' ' + newValue.substring(3,5) + ' ' + newValue.substring(5,7) + ' ' + newValue.substring(7);
      } else {
        throw new Error('InvalidPhoneNumber');
        newValue = phone.number.replace(/^0*/,'+');
      }
    } else {
      throw new Error('InvalidPhoneNumber');
      //phone.number = phone.number.replace(/^0*/,'+');
    }
  }
  if(propertyName) {
    phone[propertyName] = newValue;
  }
  return newValue;
};

module.exports = {
  formatPhoneNumber: formatPhoneNumber,
  isSameHouseNumberAndMailbox: addressUtils.isSameHouseNumberAndMailBox,
  isSameStreet: addressUtils.isSameStreet,
  addSubCityHref: addressUtils.addSubCityHref,
  addStreetHref: addressUtils.addStreetHref
};
