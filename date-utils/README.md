# README #

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
* **printDate(dateString):** returns the dateString of format YYYY-MM-DD to the more human readable string DD/MM/YYYY
* **printFutureForPeriodic(periodic):** returns string with information about startDate " (vanaf dd/mm/yyyy)" and endDate " (tot dd/mm/yyyy)" if they are in the future
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
* **getStartOfSchoolYearIncludingSummerGap(dateString):** returns the first of september before datestring when the month of datestring is not July or August. Otherwise, it returns the first of september after datestring. If datestring is null, the reference date for the above condictions is the current date (getNow()),
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
* **getAbolishedResources(arrayOfResources, referenceDateString):**  returns a new array with only the resources that are abolished on the referenceDateString (getNow() if dateString is null) from array,
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


Mail to matthias.snellings@katholiekonderwijs.vlaanderen.