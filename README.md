# README #

# sri-client #

* this is the project with all kind of utilities for clients which are using  A [sri4node][sri4node-project] API.
* version 3.0.15

## sri-clients ##
The project contains three client modules with all kind of functions to do API requests according to [SRI (Standard ROA Interface)][sri-documentation]:

* ng-sri-client: an Angular 1 module
* node-fetch: a node module on the node version of fetch
* fetch-sri-client: a module on browser fetch

They both have the same generic interface

### generic interface ###

* **getRaw(href, parameters, options):** http get of the href with the given parameters. Returns a promise with the exact result from the api.
* **get(href, parameters, options):** http get a single resource with the given href and the parameters. Returns a promise with the resource.
* **getList(href, parameters, options):** http get of the href with the given parameters where href is suposed to be a list resource.
Returns a promise with the array of the expanded results that match the query (so not an object with an href and $$expanded, but the object that is $$expanded.
The list of results is limited to only one API call so the lenght will be maximum the limit. The resulting array will also have properties count and next from the original $$meta section.
* **getAll(href, parameters, options):** http get of the href with the given parameters where href is suposed to be a list resource.
Returns a promise with the array of the expanded results that match the query (so not an object with an href and $$expanded, but the object that is $$expanded.
The list of results is all the results that match the query, because the next links are requested as well and concatenated to the result.
The resulting array will also have properties count and next from the original $$meta section.
* **put(href, payload, options):** http put to href with the given payload.
* **patch(href, payload, options):** http patch to href with the given payload.
* **updateResource(resource, options):** http put to resource.$$meta.permalink with resource as payload. Compact function to do an update of an existing resource.
* **post(href, payload, options):** http post to href with the given payload.
* **delete(href, options):** http delete to href.
* **getAllHrefs(hrefs, parameters, options):** returns an array of all objects for hrefs, a given array with permalinks.
* ~~**getAllHrefs(hrefs, batchHref, parameters, options):** returns an array of all objects for hrefs, a given array with permalinks.
All these parameters need to be of the same resource type! You can provide expansion (or other) parameters with parameters.
It will get all these permalinks in the most efficient way if an href to the corresponding batch url is provided.
If the batch url is null it will get them in individual request in groups of 100  (can be overwritten with options.groupBy) permalinks in order to not make the request url too long.~~ (deprecated: use inBatch option)
* **getAllReferencesTo(baseHref, params, referencingParameterName, hrefsArray, options):** Same as getAll but you can add a referencingParameterName and an array of hrefs.
It will add referencingParameterName as a parameter and add the hrefsArray as a comma separated string,
but it will only request them in groups of 100 (can be overwritten with options.groupBy) to make sure the request url does not get too long.
If the name of the resource is too long you might have to use options.groupBy to decrease the number of hrefs it groups in one request

All these methods return a promise. If the response status >= 400, the result will return an error object with:

* **status:** the http status of the response, null if there was no response.
* **body:** the body of the response if it was present.
* **getResponseHeader(headerName):** method that returns the value of the given headerName of the response.

If the result of put, updateResouce or post was < 300 the promise returns an object with:

* **getResponseHeader(headerName):** method that returns the value of the given headerName of the response.

All methods have an **options** object that you can pass on as a parameter. You can specify the following properties:

* **common**
  * **baseUrl:** sends the http request to this baseUrl instead of the default baseUrl that is set in the initialisation of the configuration.
  * **headers:** An object with headers that are added on the http request. f.e.: {'foo': 'bar'} adds a header foo with value bar.
  * **retry:** An object wih retry configuration for doing retries with exponential backoff strategy. Retries will not be done for http status code 4xx.
    * retries: [required] number of retries you want to do. If retries === 1 => it will only try once again, so two times in total.
    * initialWait: initial number of miliseconds to wait after the initial GET failed and before the first retry is done. The default is 500 miliseconds.
    * factor: Strategy is exponential backoff so by default with 4 retries you will wait 0,5s, then 1s, then 2s and then 4s. If you set factor to 3 for instance the time to wait will be multiplied with 3 instead of two so you will wait 0,5s -> 1,5s -> 4,5s -> 13,5s. If you set factor to 1, you will actually disable exponential backoff.
  * **caching:** An object with properties timeout (in seconds) which overwrites the default timeout (you don't need to set up default caching, you can just start caching several requests). The resource will be get from the cache if it it is not older than the timeout in seconds.
  * **inBatch:** Specify the href where the batch needs to be send to. This is for GET methods (getAll, getList, etc.) and wraps the regular request into a batch request. This can be usefull when their is a potential of an request url that becomes too long.
  * **batchMethod:** if batchMethod is 'POST' the inBatch request will be done with A POST instead of A PUT.
  * **keepBatchAlive:** Only possible for requests to /batch. Handles the batch in a streaming way keeping the connection open so the server does not decide to break off the request (Heroku for example breaks off requests after 30s). This does not mean that you get your response in a streaming way. The response is the same for the client as a regular /batch.
  * **expand:** array with property paths that you want to expand client side. You can expand as deep as you want and don't need to add $$expanded to the path. See the examples.
  You can also replace a property path string with an object to pass on more advanced options. The object contains the following proerties:
    * property: [required] the property path.
    * required: default is true. If true an error will be thrown if a property in the property path can not be found. This is to help the user detect typo's.
    If required is false, no error will be thrown and expansion will be ignored for objects that do not have a property in the property path. If the property path contains properties that are not required you need to set this proeprty to false.
    * include: you can include resources within the expanded resources. Works the same as the include property on the root of the options.
    * caching: overwrite the caching options from this point onwards. For example when you can not cache the resource you are getting but the resources that are expanded can be cached for a very long time.
  Example: api.getAll('/responsibilities/relations', {to: #{an href to a responsibility}}, {expand: [from.organisationalunit]}) expands in two steps first all froms in the resultset, and in a second step all organisationalunits of those froms.
  * **include:** array of objects with configuration to include a property of the/all resrouce(s) (in the resultset). The configuration can contain the following properties:
    * alias: [required] An {{alias}} property will be added to the resource or every resource in the resultset if it is a list. It is recommended to add a $$ prefix in front of them so the client will not send this back to the server on PUT.
    * href: [required] The href on which the included resources can be found
    * reference: an object with the following properties:
      * property:  [required] The property name that references $$meta.permalink of the resource for which you are including resources
      * parameterName: This is the parameter name on the href to reference the $$meta.permalink of the resource you are including resources.
      If not added the property name will be taken as parameter name because in many cases this is the same. There is also a short notation where the value of reference is just the property name as a string instead of an object.
    * filters: filter on the resources you are including (for example include only external identifiers of type INSTITUTION_NUMBER when you are including external identifiers in an organisational unit)
    * expanded: true is default so you don't need to add this property if true. If false all results will be unexpanded and you will get only the hrefs
    * singleton: false is default so you don't need to add this property if false. The value of '$${{alias}}' will be an object (the first object in the resultset) instead of an array. It will be null if there are no results.
    * expand: client side expansion of properties within the included resources. Works the same as the expand property on the root of the options.
    * include: include resources within the included resources. This is just recursive and works the same as the include property on the root of the options.
  * **limit:** return a limited number of results for getList, the limit can also be higher than the maximum limit that the server allows. =TODO
  * **raw:** boolean that can be used for getList and getAll. If set to true the array of results will contain the raw result of the body.results, so the items will be an object with an href and a $$expanded object.
  * **asMap:** boolean that can be used for getAllHrefs. If set to true an object with be returned which contains all the hrefs as keys and the object to which it refers as value.
* **fetch-sri-client**
  * **cancel**: A promise that will cancel the request when resolved
  * **cache**: See [here][fetch-cache-options] for possible options. Default is 'default'
  * **credentials**: omit (default) || include (adds the cookies to the request)
  * **fullResponse**: the response will be an object with properties body and headers
* **node-fetch / node-sri-client**
  * **fullResponse**: the response will be an object with properties body and headers
  * **username**: username for basic authentication
  * **password**: password for basic authentication
  * **timeout**: req/res timeout in ms, it resets on redirect. 0 to disable (OS limit applies).
* **ng-sri-client specific**
  * **raw** default is false. The response will be parsed. If raw is true the response will not be parsed.
  * **cancelPromise:** A promise that will cancel the request, if it gets resolved.
  * **pending:** boolean that will be set to true by every method when the request starts and set to false once the result is fetched.

#### examples ####

```javascript
  const respsOfTeam = await sriClient.getAll('/responsibilities', {organisationalUnit: '/organisationalunits/eb745d58-b818-4569-a06e-68733fe2e5b3'}, {logging: 'debug'});
  const personHrefs = respsOfTeam.map(resp => resp.person.href);
  const persons = await vskoApi.getAllHrefs(personHrefs, '/persons/batch', undefined, {asMap: true});
  // persons is a map with as key the href of a person and as value the resource of that person.

  const externalIdentifierWithOrganisationalUnitExpanded = await sriClient.get(
    '/organisationalunits/externalidentifiers',
    {value: '032557'},
    {
      expand: [
        'organisationalUnit.$$contactDetails.phone.organisationalUnit', // this is circular so not very usefull, but this shows you can expand as deep as you want to
        'organisationalUnit.$$contactDetails.email'
      ]
    });

  const organisationalUnitWithInstitutionNumberIncluded = await sriClient.get('/organisationalunits/a2c36c96-a3a4-11e3-ace8-005056872b95', undefined, {include: {
    alias: '$$institutionNumber',
    href: '/organisationalunits/externalidentifiers',
    filters: {type: 'INSTITUTION_NUMBER'},
    reference: 'organisationalUnit',
    singleton: true
  }});

  const personWithResponsibilitiesIncluded = await sriClient.get('/persons/94417de5-840c-4df4-a10d-fe30683d99e1', undefined, {include: {
    alias: '$$responsibilities',
    href: '/responsibilities',
    reference: {
      property: 'person',
      parameterName: 'personIn'
    },
    expand: ['organisationalUnit']
  }});

  // give all the responsibilies of an organisationalunit (this is the team)
  // and expand the person (client side).
  // Include for this person all his responsibilities
  // and expand the organisationalunits of these responsibilities
  sriClient.getAll('/responsibilies',
    {
      organisationalunit: '/organisationalunits/eb745d58-b818-4569-a06e-68733fe2e5b3',
      expand: 'position' // expand position server side
    },
    {
      expand: [{
        property: 'person', // expand all person properties client side,
        required: false,
        include: [{
          alias: '$$responsibilities', // A $$responsibilities property will be added to every resource in the resultset
          href: '/responsibilities',
          reference: {
            property: 'person',
            parameterName: 'personIn',
          }
          expand: ['organisationalUnit'], // client side expansion of properties within the included resources
        }]
      }]
    }
  );
  // for each responsibility in the resultset, the expanded person will have an added property $$responsibilities,
  // which is an array of all the responsibilities that reference this person.
  // Within these last responsibilities the organisationalUnit will be expanded
  ```


### initialisation ###

It is recommended to initialise the library with some default configuration which can have te following properties:

* baseUrl: the default baseUrl for all the api calls.
* logging: For every request logs the response body if the status code >= 400 to the console for any value. Any value always logs errors. Otherwise you can add a string containing values: 'get','put','post','delete','caching','expand'.
* caching: object with properties
  * timeout: default timeout in seconds that will be used for every call that does not specify it's own caching in the options (default is 0 = no caching)
  * maxSize: maximum size of the cache in MB. When this size is reached the 25% of the hrefs that were not used for the longest time will be removed from the cache. (default is 10MB)
  * initialisation: array of objects
    * hrefs: array of hrefs that should be called
    * timeout: optional timeout that these initial hrefs should be cached. If not mentioned the default timeout above will be taken.

and the following properties are for the node-sri-client only:

* username: username for basic authentication calls.
* password: password for basic authentication calls.
* headers: each request will have the headers specified added in the request header.
* accessToken: an object with properties name and value. Each request will have a request header added with the given name and value. This is added to the headers if they are specified.

#### fetch-sri-client ####

This module uses the Fetch API.
Here is an example how to use the module.

```javascript
const configuration = {
  baseUrl: 'https://api.katholiekonderwijs.vlaanderen',
  caching: {
    timeout: 400,
    initialise: [{
      timeout: 10000,
      hrefs: ['/commons/cities', '/commons/countries']
    ]
  }
}

const api = require('@kathondvla/sri-client/fetch-sri-client')(configuration)

let secondarySchools = await api.get('/schools', {educationLevels: 'SECUNDAIR'});
```

#### ng-sri-client ####

```javascript
const basicConfig = const configuration = {
  name: 'api',
  baseUrl: 'https://api.katholiekonderwijs.vlaanderen'
}

const fastlyConfig = const configuration = {
  name: 'cachedApi',
  baseUrl: 'https://fastly-api.be'
}


// if you only need one version of an API you can just pass on an object as an argument instead of an array: require('@kathondvla/sri-client/ng-sri-client')(basicConfig]);
const app = angular.module('MyApp', [require('@kathondvla/sri-client/ng-sri-client')([basicConfig, fastlyConfig])]);

//inside a component

['api', 'cachedApi', function (api, cachedApi) {
  let secondarySchools = await api.get('/schools', {educationLevels: 'SECUNDAIR'});
  let cities = await cachedApi.getAll('/cities');
}];
```
#### node-sri-client ####

This module is build upon [requestretry][npm-requestretry] which itself is build upon [request][npm-request].
Here is an example how to use the module.

```javascript
const configuration = {
  baseUrl: 'https://api.katholiekonderwijs.vlaanderen',
  username: 'foo',
  password: 'bar',
  caching: {
    timeout: 400,
    initialise: [{
      timeout: 10000,
      hrefs: ['/commons/cities', '/commons/countries']
    ]
  }
}

const api = require('@kathondvla/sri-client/node-sri-client')(configuration)

let secondarySchools = await api.get('/schools', {educationLevels: 'SECUNDAIR'});
```

### caching ###

There is always a cache assigned to the client. If no configuration is added the timout will be 0 and the maxSize is null.
The default timeout can be overwritten by both the get method with options or in options.expand. An empty object for caching configuration or caching = false is the same thing as timeout = 0
which always goes to the api and the response is not stored in the cache.
When timeout is greater than 0 the cache will be checked. There will be a miss when the item is not there or age is larger than timeout in seconds, It will be retrieved from the API and the promise will be added/replaced in the cache.
So if two resources ask the same href close to each other the call will only be done once.
When a list resource is asked, all the individual resources will be added in the cache as well on the condition that no server side expansion is added (or expand=summary).

A PUT or DELETE operation might alter the information in the cache therefore the cache distinguishes 3 kinds of hrefs:
* single resources: they will be only removed on a PUT or DELETE on the resource itself
* basic lists: this are lists which only have basic parameters limit, offset, keyOffset, hrefs or expand=full, summary or none. They will be removed on a PUT or DELETE of a resource with the same resource path.
* complex hrefs: All lists with other parameters or server side expanded single resources. They will be deleted on any PUT or DELETE because they can even be invalid because of the changing of other resources.

Be carefull with server side expansion because they are not cached very well.

### batch ###

To write more compacter code there is a Batch class which helps you to add things in batch just in one line.
On a Batch class you can do the following methods:
* get(href): adds an object to the batch with GET as verb and href as href.
* put(href, payload): adds an object to the batch with PUT as verb, href as href, and resource as body.
* put(resource): adds an object to the batch with PUT as verb, resource.$$meta.permalink as href, and resource as body.
* post(href, payload): adds an object to the batch with POST as verb, href as href, and resource as body.
* delete(href): adds an object to the batch with DELETE as verb and href as href.
* getPayload(): returns the array of the batch. (you can also do batch.array for the same result)
* send(href, sriClient): does a PUT to href with the build up batch array as payload using sriClient. If you have initialised the batch with a client or got the batch from the client [sriClient.createBatch()] you don't have to add the sriClient here.
```javascript
const api = require('@kathondvla/sri-client/node-sri-client')(configuration);
const Batch = require('@kathondvla/sri-client/batch');

try {
  const batch = new Batch(api); // OR api.createBatch();
  batch.put(person.$$meta.permalink, person);
  batch.delete(person.$$emails.primary.href);
  batch.post('/persons/changepassword', passwordPayload);
  await batch.send('/persons/batch'); // OR await api.put('/persons/batch', batch.array)
} catch (error) {
  if(error instanceof SriClientError) {
    console.error(util.inspect(error.body, {depth:7}));
    console.error(error.stack);
  } else {
    console.error(error);
  }
}
```

### error handling ###

If the response is different from status code 200 or 201 or there is no response the response is rejected and an error object is returned of type SriClientError.
So you can catch errors coming from the sri client and catch http error by filtering on  this error, for example:

```javascript
const SriClientError = require('@kathondvla/sri-client/sri-client-error');
// create a batch array
try {
  await api.put('/batch', batch);
} catch (error) {
  if(error instanceof SriClientError) {
    console.error(util.inspect(error.body, {depth:7}));
    console.error(error.stack);
  } else {
    console.error(error);
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

#### usage ####
```javascript
const commonUtils = require('@kathondvla/sri-client/common-utils');
```

#### interface ####

* **generateUUID():** returns a generated uuid of version 4.
* **splitPermalink(permalink):** returns an object with properties key (the key of the permalink) and path (the path of the permalink without the key)
* **getKeyFromPermalink(permalink):** returns the key within the permalink
* **getPathFromPermalink(permalink):** returns the pathe of the permalink without the key,
* **parametersToString(href, parameters):** returns the full path for the combination of the base href and the object of parameters. The parameter names and values are URL encoded.
* **strip$$Properties(object):** returns a copy of the object with all the properties that start with '$$' removed
* **strip$$PropertiesFromBatch(batchArray):** returns a copy of the batchArray with all the properties of the body in the batch objects that start with '$$' removed

## date-utils ##

This is a library with utility functions for string dates as specified in the sri api in the format yyyy-MM-dd.
So if we talk about a date as a string it is in that format.
If a date as a string is null or undefined it is interpreted as infinitely in the future.

#### usage ####
```javascript
const dateUtils = require('@kathondvla/sri-client/date-utils');
```

#### interface ####

* **getNow():** returns the current date as a string
* **setNow(dateString):** sets now to another date for the whole library. From now on getNow() will return this date.
* **toString(date):** return the javascript date as a string
* **parse(dateString):** returns the dateString as a javascript date
* **stripTime(isoDateString):** returns the received isoDateString without the time section. YYYY-MM-DDTHH:mm:ss.sssZ -> YYYY-MM-DD
* **isBeforeOrEqual(a,b):** returns true if a is before or on the same day as b, where a and b are dates as strings
* **isAfterOrEqual(a,b):** returns true if a is after or on the same day as b, where a and b are dates as strings
* **isBefore(a,b):** returns true if a is strictly before b, where a and b are dates as strings
* **isAfter(a,b):** returns true if a is strictly after b, where a and b are dates as strings
* **getFirst(arrayOfDateStrings):** returns the date that is first in time from arrayOfDateStrings
* **getLast(arrayOfDateStrings):** returns the date that is last in time from arrayOfDateStrings
* **isOverlapping(a, b):** returns true if there is an overlapping period between a en b where a and b are objects with a property startDate and endDate (which can be null/undefined)
* **isCovering(a, b):** returns true if the period of b is completely within the period of a.
* **isConsecutive(a, b):**: returns true if the periods of a and b are strictly following each other in any order. So b starts on the same date as a ends or a starts on the same date as b ends.
* **isConsecutiveWithOneDayInBetween(a, b):**: returns true if the periods of a and b are strictly following each other in any order with one day in between. So b starts the day after a ends or a starts the day after b ends.
* **getStartOfSchoolYear(dateString):** returns the first of september before datestring (the first of september before getNow() if dateString is null),
* **getEndOfSchoolYear(dateString):** returns the first of september after dateString (the first of september after getNow() if dateString is null),
* **getClosestSchoolYearSwitch(dateString):** returns the first of september which is the closest to the dateString (the first of september after getNow() if dateString is null) [for all dates in march untill august it returns getEndOfSchoolYear(), for all dates in setember untill februari it returns getStartOfSchoolYear()],
* **getPreviousDay(dateString, nbOfDays):** returns the date which is the given number of days before dateString, as a string. nbOfDays is optional, the default is 1.
* **getNextDay(dateString, nbOfDays):** returns the date which is the given number of days after dateString, as a string. nbOfDays is optional, the default is 1.
* **getPreviousMonth(dateString, nbOfMonths):** returns the date which is the given number of months before dateString, as a string. nbOfMonths is optional, the default is 1.
* **getNexMonth(dateString, nbOfMonths):** returns the date which is the given number of months after dateString, as a string. nbOfMonths is optional, the default is 1.
* **getPreviousYear(dateString, nbOfYears):** returns the date which is a given number of years before dateString, as a string. nbOfYears is optional, the default is 1.
* **getNextYear(dateString, nbOfYears):** returns the date which is the given number of years after dateString, as a string. nbOfYears is optional, the default is 1.
* **getActiveResources(arrayOfResources, referenceDateString):** returns a new array with only the resources that are active on the referenceDateString (getNow() if dateString is null) from array,
which is an array of resources with a period. array can also be an array of hrefs that is expanded.
* **getNonAbolishedResources(arrayOfResources, referenceDateString):**  returns a new array with only the resources that are not abolished on the referenceDateString (getNow() if dateString is null) from array,
which is an array of resources with a period. array can also be an array of hrefs that is expanded.
* **manageDeletes(resource, options, sriClient):** manages the propagation of deletes for the given resource to it's dependencies. It needs sriClient to query these dependenies. The options are:
  * batch: a batch array. All references to this resource that should be deleted as well will be added to this batch array. If a depending resource is already present in the batch, it will be removed from the batch since this no longer seems necessary.
  * references: an array of objects (or one object) with configuration to find the other resources referencing this resource and by consequence should be deleted as well. The configuration has the following properties [we explain this by the example where we delete a basket containing apples and oranges. If we delete the basket, the cookies and the oranges should be deleted as well]:
    * alias: not required but if you add an alias, the function will return an object with the given alias as a property which contains the referencing resources that should be deleted as well. [For example 'apples', the returnin object will have a property 'apples' which is an array of the apples that were in the basket, which will be the given resource]
    * href: the path on which the referencing resources can be found. [for example /fruits/apples, we want to delete all apples that reference the given basket]
    * property: the property name/parameter name of the referencing resource pointing to the given resource. [for example 'basket', the property name within /fruits/apples that is a reference to the baket]
    * commonReference: If a referencing resource is not referencing directly to the given resource but they are related to each other because they are referencing to the same resource. [For example you are not deleting the basket. But the apples and oranges both refer to a promotion which gave two free apples when buying an orange, upon deleting the orange you want to delete all apples that reference the same 'promotion', it is required that apples an oranges both have a property that have the same property name 'promotion']
    * subResources: array with property paths to subResources of the reference which also need to be deleted.
    * parameters: optional parameters to filter on the references. [For example only delete the green apples upon deleting the basket]
    * filter: function that filters out certain resources in memory
    * options: an options object that will be passed on as a parameter to the sriClient.getAll function.
* **manageDateChanges(resource, options, sriClient):** manages the propagation of date changes for the given resource to it's dependencies. It needs an sriClient to query for this dependencies [This works in the same way as deletes but with updates on the period instead of deletes]. The options are:
  * oldStartDate: the old startDate of the resource before it was updated.
  * oldEndDate: the old endDate of the resource before it was updated.
  * batch: a batch array. All references to this resource that should be updated as well will be added to this batch array. If a depending resource is already present in the batch, it will update the body of that batch element.
  * properties: an array of strings containing the property names of the resource that have a period which should be updated together with the main period of the resource.
  * intermediateStrategy: strategy to handle resources which start in between the new and the old startDate (or in between the new and the old endDate). Possible values are: 'NONE' (nothing is done with intermediate resources, validation errors will stop the period change from happening), 'ERROR' (this is the default, if there are intermediate resources an error is thrown of type DateError), 'FORCE' (intermediate resources are forced to adapt their period so there are no conflicts)
  * references: an array of objects (or one object) with configuration to find the other resources referencing this resource and by consequence should have their period updated as well. The configuration has the following properties:
    * alias: not required but if you add an alias, the function will return an object with the given alias as a property which contains the referencing resources that should be updated as well. If there was no period change the returned object is null.
    * href: the path on which the referencing resources can be found.
    * property: the property name/parameter name of the referencing resource pointing to the given resource.
    * intermediateStrategy: overwrite the general intermediateStrategy for this reference.
    * commonReference: If a referencing resource is not referencing directly to the given resource but they are related to each other because they are referencing to the same resource.
    * subResources: array with property paths to subResources of the reference which also need to be updated.
    * onlyEnlargePeriod: boolean (default is false). If true the period of the referencing is enlarged if the period of the given resource is enlarged, the period will never be shortened.
    * onlyShortenPeriod: boolean (default is false). If true the period of the referencing is shortened if the period of the given resource is shortened, the period will never be enlarged.
    * parameters: optional parameters to filter on the references.
    * filter: function that filters out certain resources in memory
    * options: an options object that will be passed on as a parameter to the sriClient.getAll function.
If an error occurs when hanling a periodic reference to the given resource, a DateError is thrown with two properties, a message and the periodic.

## address-utils ##

This is a library with utility functions for address objects as specified in the sri api.

#### usage ####
```javascript
const addressUtils = require('@kathondvla/sri-client/address-utils');
```

#### interface ####

* **printAddress(address):** returns the address as a string in the format {street} {houseNumber} {mailboxNumber}, {zipCode} {subCity}
* **isSameHouseNumberAndMailbox(a, b):** returns true if sri address a and sri address b have the same mailboxNumber and houseNumber. The match is case insensitive and ingores white spaces and underscores.
* **isSameStreet(a, b):** returns true if sri address a and sri address b are the same streets. This means a match on  the street name in the same city. If both addresses have a streetHref a match is done based on this reference because it is a reference to the same street, independent of how it is spelled. Otherwise A match on street name is case insensitive and takes into account that parts of the name are abbreviated with a dot. For example 'F. Lintsstraat' matches with 'Frederik lintsstraat'.
* **addSubCityHref(sriAddress, api) [async]:** adds a subCityHref reference to the sriAddress. api is an instance of an sri-client library (can be both the ng-sri-client or the node-sri-client)
* **addStreetHref(sriAddress, api) [async]:** adds a streetHref reference to the sriAddress. api is an instance of an sri-client library (can be both the ng-sri-client or the node-sri-client)

### Questions ###

Mail to matthias.snellings@katholiekonderwijs.vlaanderen, gunther.claes@katholiekonderwijs.vlaanderen.

[sri-documentation]: https://github.com/dimitrydhondt/sri
[sri4node-project]: https://github.com/katholiek-onderwijs-vlaanderen/sri4node
[npm-requestretry]: https://www.npmjs.com/package/requestretry
[npm-requestretry-strategy]: https://www.npmjs.com/package/requestretry#how-to-define-your-own-retry-strategy
[npm-requestretry-delaystrategey]: https://www.npmjs.com/package/requestretry#how-to-define-your-own-delay-strategy
[npm-request]: https://www.npmjs.com/package/request
[fetch-cache-options]: https://developer.mozilla.org/en-US/docs/Web/API/Request/cache