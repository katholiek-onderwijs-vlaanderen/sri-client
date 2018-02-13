/**
 * Created by matthias.snellings on 10/07/2014.
 * Old file with bunch of utilty functions that should be moved to common-utils, date-utils, address-utils,....
 */
module.exports = [function () {
  'use strict';
  var that = {};

	that.getUUID = function () {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	};

	that.arrayContainsResource = function (array, key) {
		for(var i = 0; i < array.length; i++) {
			if(array[i].key === key) {
				return true;
			}
		}
		return false;
	};

	that.inputToDateString = function( input ) {
		var date;
		if ( typeof(input) === "string" ) {
			date = input.split( "/" ).reverse().join( "-" );
		}
		else {
			date = that.dateToString( input );
		}
		return date;
	};

	/***************************** PERIODICAL UTILS ********************************************/
	var appendZero = function( number ) {
		return number > 9 ? number : 0 + "" + number;
	};

	var dateToString = function( date ) {
		return date.getFullYear() + '-' + appendZero( date.getMonth() + 1 ) + '-' + appendZero( date.getDate() );
	};
	that.dateToString = dateToString;

	that.getActiveElems = function (elems, date) {
		date = dateToString(new Date());
		var a = [];
		for(var i = 0; i < elems.length; i++) {
			if(date >= elems[i].startDate && (elems[i].endDate === undefined || elems[i].endDate >= date) ) {
				a.push(elems[i]);
			}
		}
		return a;
	};

	that.getNotEndedElems = function (elems, date) {
		date = date || dateToString(new Date());
		var a = [];
		for(var i = 0; i < elems.length; i++) {
			if(elems[i].endDate === undefined || elems[i].endDate >= date ) {
				a.push(elems[i]);
			}
		}
		return a;
	};

	that.getActiveOrFutureElems = function (elems, date) {
		if(elems.length === 0)
			return undefined;
		date = dateToString(new Date());
		var current = [];
		var notEnded = [];
		for(var i = 0; i < elems.length; i++) {
			if(elems[i].endDate === undefined || elems[i].endDate >= date ) {
				notEnded.push(elems[i]);
				if(date >= elems[i].startDate) {
					current.push(elems[i]);
				}
			}
		}
		return current.length > 0 ? current : notEnded;
	};

	/***************************** Plato cleanup UTILS => Can be removed when new Persons API is there ********************************************/

	that.replaceSpecialCharacters = function (string) {
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

	that.cleanPhone = function( phone ) {
		var oldValue = phone.number;
		phone.number = phone.number.replace( /\//g, '' ).replace( /\./g, '' ).replace( /\s/g, '' ).replace( /\(/g, '' ).replace( /\)/g, '' );
		if ( phone.number.substring( 0, 1 ) !== "+" ) {
			if ( phone.number.length === 10 ) {
				phone.number = phone.number.substring( 0, 4 ) + ' ' + phone.number.substring( 4, 6 ) + ' ' + phone.number.substring( 6, 8 ) + ' ' + phone.number.substring( 8 );
			}
			else if ( phone.number.length === 9 ) {
				if ( phone.number.substring( 0, 2 ) === "02" || phone.number.substring( 0, 2 ) === "03" || phone.number.substring( 0, 2 ) === "04" || phone.number.substring( 0, 2 ) === "09" ) {
					phone.number = phone.number.substring( 0, 2 ) + ' ' + phone.number.substring( 2, 5 ) + ' ' + phone.number.substring( 5, 7 ) + ' ' + phone.number.substring( 7 );
				}
				else {
					phone.number = phone.number.substring( 0, 3 ) + ' ' + phone.number.substring( 3, 5 ) + ' ' + phone.number.substring( 5, 7 ) + ' ' + phone.number.substring( 7 );
				}
			}
			else {
				phone.number = oldValue;
			}
		}
	};
	that.cleanBankAccount = function( bankAccount ) {
		if ( bankAccount.$$iban || bankAccount.$$bic ) {
			bankAccount.iban = bankAccount.$$iban.replace( /\s/g, '' );
			bankAccount.bic = bankAccount.$$bic && bankAccount.$$bic != '' ? bankAccount.$$bic.replace( /\s/g, '' ) : undefined;
		}
		else {
			bankAccount.iban = '';
			bankAccount.bic = '';
		}
	};
	that.printBankAccount = function( bankAccount ) {
		bankAccount.$$iban = bankAccount.iban.replace( /\s/g, '' );
		bankAccount.$$bic = bankAccount.bic ? bankAccount.bic.replace( /\s/g, '' ) : '';
		if ( bankAccount.$$iban !== '' ) {
			bankAccount.$$iban = bankAccount.$$iban.substring( 0, 4 ) + ' ' + bankAccount.$$iban.substring( 4, 8 ) + ' ' + bankAccount.$$iban.substring( 8, 12 ) + ' ' + bankAccount.$$iban.substring( 12, 16 );
		}
		if ( bankAccount.$$bic !== '' ) {
			bankAccount.$$bic = bankAccount.$$bic.substring( 0, 4 ) + ' ' + bankAccount.$$bic.substring( 4, 8 );
		}
	};

	return that;
}];