# README #

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
* **isStreetNameMatch(a, b):** returns true if a en b which are both strings are the same street independent of how they are spelled. It takes into account that parts are abbreviated with a dot. For example 'F. Lintsstraat' matches with 'Frederik lintsstraat'.
* **addSubCityHref(sriAddress, api) [async]:** adds a subCityHref reference to the sriAddress. api is an instance of an sri-client library (can be both the ng-sri-client or the node-sri-client)
* **addStreetHref(sriAddress, api) [async]:** adds a streetHref reference to the sriAddress. api is an instance of an sri-client library (can be both the ng-sri-client or the node-sri-client)

### Questions ###

Mail to matthias.snellings@katholiekonderwijs.vlaanderen.