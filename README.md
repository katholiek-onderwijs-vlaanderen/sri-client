# README #

# sri-client #

* this is the project with all kind of utilities mainly as angular services.
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
If not provided it will get them in individual request in groups of 100 permalinks in order to not make the request url too long.
For the moment this only works for the node-sri-client.

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
  * **timeout:** The number of miliseconds to wait before the request times out.
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

### Questions ###

Mail to gunther.claes@katholiekonderwijs.vlaanderen, matthias.snellings@katholiekonderwijs.vlaanderen.

[sri-documentation]: https://github.com/dimitrydhondt/sri