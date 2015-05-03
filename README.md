# About

An client for consuming SRI (Standard ROA Interface) interfaces. 
SRI is a set of standards to make RESTful interfaces.
It specifies how resources are accesses, queried, updated, deleted.
The specification can [be found here][sri-specs].
The libraries in this function always return a [Q promise][kriskowal-q].

# Installing

Installation is simple using npm :

    $ cd [your_project]
    $ npm install --save sri4node-client
    
# Usage

Start by requiring the module in your code.

    var rest = require('sri4node-client');

Then you can execute GET, PUT and DELETE commands easily :

    rest.get('https://api.vsko.be/schools').then(function(resource) {
        console.log(resource);
    });

    var api = 'https://api.lsg.org';
    var permalink = '/communities/8bf649b4-c50a-4ee9-9b02-877aa0a71849';
    rest.get(api + permalink).then(function(c) {
	c.email = 'new@email.be';
        rest.put(api + permalink, c);
    }).catch(function(error) {
        // do error handling.
    });

# Contributions

Contributions are welcome. Contact me on dimitry_dhondt@yahoo.com.

# License

The software is licensed under [LGPL license](https://www.gnu.org/licenses/lgpl.html). 

# TO DO

Development will focus on :
- Caching strategies, etc.. 

[kriskowal-q]: https://github.com/kriskowal/q
[sri-errors]: https://docs.google.com/document/d/1KY-VV_AUJXxkMYrMwVFmyN4yIqil4zx4sKeV_RJFRnU/edit#heading=h.ry6n9c1t7hl0
[sri-specs]: https://docs.google.com/document/d/1KY-VV_AUJXxkMYrMwVFmyN4yIqil4zx4sKeV_RJFRnU/pub
