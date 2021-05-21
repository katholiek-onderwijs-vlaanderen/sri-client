# README #

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
* **sleep(miliseconds):**: returns a resolved promise after X miliseconds