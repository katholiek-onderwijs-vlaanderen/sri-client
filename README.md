# README #

# sri-client #

* this is the project with all kind of utilities for clients which are using  A [sri4node][sri4node-project] API.
* version 1.0.0

## sri-clients ##
The project contains two client modules with all kind of functions to do API requests according to [SRI (Standard ROA Interface)][sri-documentation]:

* an Angular 1 module
* a node module

They both have the same generic interface

### generic interface ###

* **get(href, parameters, configuration):** http get of the href with the given parameters. Returns a promise with the exact result from the api.
* **getList(href, parameters, configuration):** http get of the href with the given parameters where href is suposed to be a list resource.
Returns a promise with the array of the expanded results that match the query (so not an object with an href and $$expanded, but the object that is $$expanded.
The list of results is limited to only one API call so the lenght will be maximum the limit. The result also has a method count() which returns the count from the $$meta section.
* **getAll(href, parameters, configuration):** http get of the href with the given parameters where href is suposed to be a list resource.
Returns a promise with the array of the expanded results that match the query (so not an object with an href and $$expanded, but the object that is $$expanded.
The list of results is all the results that match the query, because the next links are requested as well and concatenated to the result.
The result also has a method count() which returns the count from the $$meta section.
* **put(href, payload, configuration):** http put to href with the given payload.
* **updateResouce(resource, configuration):** http to resource.$$meta.permalink with resouce as payload. Compact function to do an update of an existing resource.
* **post(href, payload, configuration):** http post to href with the given payload.
* **delete(href, configuration):** http delete to href.
* **getAllHrefs(hrefs, batchHref, parameters, configuration):** returns an array of all objects for hrefs, a given array with permalinks.
All these parameters need to be of the same resource type! You can provide expansion (or other) parameters with parameters.
It will get all these permalinks in the most efficient way if an href to the corresponding batch url is provided.
If the batch url is null it will get them in individual request in groups of 100  (can be overwritten with config.groupBy) permalinks in order to not make the request url too long.
* **getAllReferencesTo(baseHref, params, referencingParameterName, hrefsArray, config):** Same as getAll but you can add a referencingParameterName and an array of hrefs.
It will add referencingParameterName as a parameter and add the hrefsArray as a comma separated string,
but it will only request them in groups of 100 (can be overwritten with config.groupBy) to make sure the request url does not get too long.
If the name of the resource is too long you might have to use config.groupBy to decrease the number of hrefs it groups in one request

All these methods return a promise. If the response status >= 400, the result will return an error object with:

* **status:** the http status of the response, null if there was no response.
* **body:** the body of the response if it was present.
* **getResponseHeader(headerName):** method that returns the value of the given headerName of the response.

If the result of put, updateResouce or post was < 300 the promise returns an object with:

* **getResponseHeader(headerName):** method that returns the value of the given headerName of the response.

All methods have a **configuration** object that you can pass on as a parameter. You can specify the following properties:

* **angular-sri-client**
  * **baseUrl:** sends the http request to this baseUrl instead of the default baseUrl that is set in the initialisation of the configuration.
  * **headers:** An object with headers that are added on the http request. f.e.: {'foo': 'bar'} adds a header foo with value bar.
  * **cancelPromise:** A promise that will cancel the request, if it gets resolved.
  * **pending:** boolean that will be set to true by every method when the request starts and set to false once the result is fetched.
  * **raw:** boolean that can be used for getList and getAll. If set to true the array of results will contain the raw result of the body.results, so the items will be an object with an href and a $$expanded object.
* **node-sri-client**
  * **baseUrl:** sends the http request to this baseUrl instead of the default baseUrl that is set in the initialisation of the configuration.
  * **headers:** An object with headers that are added on the http request. f.e.: {'foo': 'bar'} adds a header foo with value bar.
  * **timeout:** The number of miliseconds to wait before the request times out. (default timeout is 10 seconds for a GET, 30 seconds for a sendPayload and 120 seconds for a batch)
  * **strip$$Properties:** strips the $$-properties from the payload.
  * **logging:** logs the response body if the status code >= 400 to the console for any value. If the value is 'debug' the request url will also be logged to the console.
  * **raw:** boolean that can be used for getList and getAll. If set to true the array of results will contain the raw result of the body.results, so the items will be an object with an href and a $$expanded object.
  * **asMap:** boolean that can be used for getAllHrefs. If set to true an object with be returned which contains all the hrefs as keys and the object to which it refers as value.


### angular-sri-client ###

```javascript
@gunther add here how to use the module.
```

The module contains an Oauth Interceptor to support authentication to the KathOndVla Oauth Server.
On every call to the baseUrl configured in the configuration it will make sure that a bearer token is added for authentication.
If the token is expired it will take care of getting a new one. If you are not or no longer logged in it will redirect you to the login page.

#### initialisation ####

angular-sri-client requires to specify a baseUrl and the oauth parameters.
Call the sriClientConfiguration service and call sriClientConfiguration.set(newConfiguration) to initialise the configuration for the module.

The possible properties are:

* baseUrl: the default baseUrl for all the api calls.
* oauth: add here the vsko-oauth-configuration.json object that is generated by the deploy process. If not present of false, there will be no oauth integration.
* logging: For every request logs the response body if the status code >= 400 to the console for any value. If the value is 'debug' the request url will also be logged to the console.

### node-sri-client ###

Here is an example how to use the module.

```javascript
const configuration = {
  baseUrl: 'https://api.katholiekonderwijs.vlaanderen'
}

const api = require('sri-client/node-sri-client')(configuration)

let secondarySchools = await api.get('/schools', {educationLevels: 'SECUNDAIR'});
```

this configuration can have te following properties:

* baseUrl: the default baseUrl for all the api calls.
* username: username for basic authentication calls.
* password: password for basic authentication calls.
* headers: each request will have the headers specified added in the request header.
* accessToken: an object with properties name and value. Each request will have a request header added with the given name and value. This is added to the headers if they are specified.

#### error handling ####

If the response is different from status code 200 or 201 or there is no response the response is rejected and an error object is returned of type SriClientError.
So you can catch errors coming from the sri client and catch http error by filtering on  this error, for example:

```javascript
// create a batch array
try {
  await api.put('/batch', batch);
} catch (error) {
  if(error instanceof api.SriClientError) {
    console.error(util.inspect(responseError.body, {depth:7}));
    console.error(responseError.stack);
  } else {
    console.error(error.stack);
  }
}
```

An SriClientError has the following properties:

* status: the status code of the response (null if there was no response)
* body: payload of the response.
* getResponseHeader(): function that returns the whole responseHeader [is not working yet]
* stack: stack trace that leads back to where the api was called from in the code

## common-utils ##

This is a library with common utility functions

* **generateUUID():** returns a generated uuid of version 4.
* **strip$$Properties(object):** returns a copy of the object with all the properties that start with '$$' removed
* **strip$$PropertiesFromBatch(batchArray):** returns a copy of the batchArray with all the properties of the body in the batch objects that start with '$$' removed

## date-utils ##

This is a library with utility functions for string dates as specified in the sri api in the format yyyy-MM-dd.
So if we talk about a date as a string it is in that format.
If a date as a string is null or undefined it is interpreted as infinitely in the future.

* **getNow():** returns the current date as a string
* **setNow(dateString):** sets now to another date for the whole library. From now on getNow() will return this date.
* **toString(date):** return the javascript date as a string
* **parse(dateString):** returns the dateString as a javascript date
* **isBeforeOrEqual(a,b):** returns true if a is before or on the same day as b, where a and b are dates as strings
* **isAfterOrEqual(a,b):** returns true if a is after or on the same day as b, where a and b are dates as strings
* **isBefore(a,b):** returns true if a is strictly before b, where a and b are dates as strings
* **isAfter(a,b):** returns true if a is strictly after b, where a and b are dates as strings
* **getFirst(arrayOfDateStrings):** returns the date that is first in time from arrayOfDateStrings
* **getLast(arrayOfDateStrings):** returns the date that is last in time from arrayOfDateStrings
* **isOverlapping(a, b):** returns true if there is an overlapping period between a en b where a and b are objects with a property startDate and endDate (which can be null/undefined)
* **getStartOfSchoolYear(dateString):** returns the first of september before datestring (the first of september before getNow() if dateString is null),
* **getEndOfSchoolYear(dateString):** returns the first of september after dateString (the first of september after getNow() if dateString is null),
* **getPreviousDay(dateString):** returns the day before dateString as a string
* **getNextDay(dateString):** returns the day after dateString as a string

## address-utils ##

This is a library with utility functions for address objects as specified in the sri api.

* **isSameHouseNumberAndMailbox(a, b):** returns true if sri address a and sri address b have the same mailboxNumber and houseNumber. The match is case insensitive and ingores white spaces and underscores.
* **isSameStreet(a, b):** returns true if sri address a and sri address b are the same streets. This means a match on  the street name in the same city. If both addresses have a streetHref a match is done based on this reference because it is a reference to the same street, independent of how it is spelled. Otherwise A match on street name is case insensitive and takes into account that parts of the name are abbreviated with a dot. For example 'F. Lintsstraat' matches with 'Frederik lintsstraat'.
* **addSubCityHref(sriAddress, api) [async]:** adds a subCityHref reference to the sriAddress. api is an instance of an sri-client library (can be both the angular-sri-client or the node-sri-client)
* **addStreetHref(sriAddress, api) [async]:** adds a streetHref reference to the sriAddress. api is an instance of an sri-client library (can be both the angular-sri-client or the node-sri-client)

### Questions ###

Mail to gunther.claes@katholiekonderwijs.vlaanderen, matthias.snellings@katholiekonderwijs.vlaanderen.

[sri-documentation]: https://github.com/dimitrydhondt/sri
[sri4node-project]: https://github.com/katholiek-onderwijs-vlaanderen/sri4node