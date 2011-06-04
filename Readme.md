# Formaline, an Upload Module for NodeJS 

> __formaline__ is a low-level ([nodeJS](http://nodejs.org/)) module for handling form requests ( **HTTP POSTs / PUTs** ) and for fast parsing of file uploads, 
> it is also ready to use with [connect middleware](https://github.com/senchalabs/connect).  

> **Current Version: 0.5.3, compatible with nodeJS >= v0.4.8**

> **This version implements [W3C XHR2](http://www.w3.org/TR/XMLHttpRequest2/#events) event API, [W3C FILE API](http://www.w3.org/TR/FileAPI/), and many other features. Check the Readme for new modifications .**   

> **See [History.md](https://github.com/rootslab/formaline/blob/master/History.md) ( v0.5.2 - v0.5.3 ) for Changelog .**


 Installation
--------------

    
with npm:

``` bash
 $ npm install formaline
```

with git:

``` bash
 $ git clone git://github.com/rootslab/formaline.git
```

>if you want to use nodeJS, only for testing purpose, together with Apache, a simple way to do this is to enable apache *mod-proxy* and add this lines to your apache virtualhost:


    ProxyPass /test/ http://localhost:3000/test/
    ProxyPassReverse /test/ http://localhost:3000/test/


>change the path and the port with yours. 



Features
----------

> - **Very Fast and Simple Parser**, this module is fast ( with sha1 checksum disabled ) as formidable one ( see **[parser-benchmarks](https://github.com/rootslab/formaline/tree/master/parser-benchmarks)** directory ) .
> - **Real-time parsing of file uploads, also supports the "multiple" attribute, for HTML5 capable browsers** .
> - **It works with HTML5-powered AJAX multiple file uploads** .
> - **It is Possible to create module instances with a configuration object, with some useful parameters** ( listeners, uploadThreshold, logging .. ) .
> - **Session support. Multiple uploads ( POSTs ) from the same authenticated user, are put in the same directory, its name is picked from the Session Identifier value for the user** .
> - **Returns data in JSON format** ( see listeners signatures ) .
> - **It is also possible to return the SHA1 data checksum of received files, disabling sha1sum improves dramatically performances !!** .
> - **Where needed, the response object contain most of the attributes names as the** **[W3C FILE API](http://www.w3.org/TR/FileAPI/)** ( i.e. for 'load' listener, the json contains properties like :  *name*, *type*, *size*, *lastModifiedDate* ) .
> - **It supports the same event API as [W3C XHR2](http://www.w3.org/TR/XMLHttpRequest2/#events), 'loadstart', 'progress', 'load', 'loadend', 'abort', 'timeout'** .
> - **Multiple error types** .
> - **Tested against malicious / bad headers and not-HTTP-compliant multipart/form-data requests** .
> - **It supports duplicate names for fields** .
> - **It Handles filename collisions** ( the filenames are translated to a 40 hex string builded with SHA1 ) .
> - **It is possible to preserve or auto-remove uploaded files if they are not completed, due to exceeding of the upload total threshold** .
> - **It is possible to track the progress ratio ( also chunks and bytes ) of data received** .
> - **It easily integrates with connect middleware** .
> - **It Works !**


 Client-Side
--------------

> **formaline is succesfully tested** ( *for now* ) **against**  : 
  
>  - **browsers like**:
  
>     - **Firefox 3+**, **Chrome 9+**, **Safari 4+**, **Opera 10+** and **IE5.5+** ..

>     - **Links2**, **Lynx**
  
  
>  - **some different kinds of client-side POSTs**: 

>     - [curl](https://github.com/rootslab/formaline/tree/master/examples) ( command-line tool )
 
>     - [HTML form](https://github.com/rootslab/formaline/tree/master/examples) 
 
>     - [HTML form with iframe](https://github.com/rootslab/formaline/tree/master/examples)
  
>     - [swfUploader 2+](http://swfupload.org/) ( flash uploader )
 
>     - AJAX POSTS ( [XHR](http://www.w3.org/TR/XMLHttpRequest/) )
 
>     - HTML5-powered AJAX POSTS ( [XHR2](http://www.w3.org/TR/XMLHttpRequest2/)  )
  
>  *( multiple files selection is available only for HTML5 capable browsers )*

> **the library is capable of handling the receiving of multiple files, that were uploaded with a single or multiple POSTs, indipendently of what kind of client code was used .** 
 

 Simple Usage
--------------

>``` javascript
>   
> var formaline = require('formaline'),
>     form = new formaline( { } ); // <-- empty config object
>```

 **add event listener:**

>``` javascript
>   ..
>   form.on( 'load', function( json ){ .. }  )  
>   ..
>   /* or */ 
>   var myListener = function( ){ console.log( arguments ); }
>   ..
>   form.on( 'load', myListener ); // <-- myListener function gets a json data object as argument
>   ..
>   /* then parse request */
>   form.parse( req, res, next ); // <-- next is your callback function( .. ){ .. }
>   ..
>   
>```


  see **Event & Listeners** section for a complete list of callbacks signatures!
      


 Configuration Options
-----------------------

**You could create a formaline instance also with some configuration options:** 

> - **'uploadRootDir'** : ( *string* ) **default** root directory for files uploads is **'/tmp/'** .
>   - specify a path, with at least a trailing slash .
>   - it is the root directory for file uploads, must already exist! ( **if it doesn't exist, formaline will try to use '/tmp/', otherwise it throws a fatal error** )
>   - **without session support**, a new sub-directory with a random name is created for every upload request .
>   - **with session support**, the upload directory gets its name from the returned session identifier, and will remain the same across multiple posts ( *see below* ) .

> - **'requestTimeOut'** : ( *integer* ) **default** value is **120000** millisecs ( 120 secs ).
>   - it indicates the maximum value, after that the 'timeoutexception' event will be emitted and the client's request will be aborted .
>   - minimum value is 100 millisecs .

> - **'resumeRequestOnError'** : ( *boolean* ) **default** value is true
>   - when a fatal error occurs in the module, the client request is resumed instead of immediately emitting **'loadend'** event .
>   - if false, the client request will be never resumed, the 'loadend' event will be emitted and the module doesn't handle the request anymore . 

> - **'getSessionID'** : ( *function( **req** ){ .. }* ) **default** value is **null** .
>   -  here you can specify a function that is used for retrieving a session identifier from the current request; then, that ID will be used for creating a unique upload directory for every authenticated user .
>   -  the function have to return the request property that holds session id, **the returned value must contain a String, not a function or an object**.
>   -  the function takes req ( http request ) as a parameter at run-time .

> - **'uploadThreshold'** : ( *integer* ) **default** value is **1024 * 1024 * 1024** bytes ( 1 GB ).
>   - it indicates the upload threshold in bytes for the data written to disk ( multipart/form-data ) .
>   - it also limits data received with serialized fields ( x-www-urlencoded ) . 
  
> - **'holdFilesExtensions'** : ( *boolean* ) **default** value is **true** .
>   - it indicates to maintain or not, the extensions of uploaded files ( like .jpg, .txt, etc.. ) .

> - **'checkContentLength'** : ( *boolean* ) **default** value is **false** .
>   - formaline, for default, doesn't stop if it finds that the header **Content-Length > uploadThreshold**, it will try to receive all data for request, and will write to disk the bytes received, until they reaches the upload threshold . 
>   - if value is set to true, if the header Content-Length exceeds uploadThreshold, **It stops before receiving data payload** .

> - **'removeIncompleteFiles'** : ( *boolean* ) **default** value is **true**.
>   - if true, formaline auto-removes files not completed because of exceeded upload threshold limit, then it emits a **'message'** event with sub-type: **'fileremoved'**, 
>   - if false, no **'message'** event is emitted, but the **'loadend'** listener will be receive a json object containing the list of incomplete files. 

> - **'sha1sum'** : ( *boolean* ) **default** value is **false**.
>   - it is possible to check the file data integrity calculating the sha1 checksum ( 40 hex string ) 
>   - it is calculated iteratively when file data is received
>   - obviuosly, enabling this feature degrades performances

> - **'logging'** : ( *string* ) **default** value is **'debug:off,1:on,2:on,3:on'** ( debug is off ).
>   - it enables various logging levels, it is possible to switch on or  off one or more level at the same time. 
>   - debug: **'off'** turns off logging, to see parser stats you have to enable the 2nd level.
      
> - **'emitProgress'** : ( *boolean or integer > 1* ) **default** value is **false**.
>    - when it is true, it emits a 'progress' event on every chunk. If you need to change the emitting factor ,( you could specify an integer > 1 ). 
>    - If you set it for example to  an integer k,  'progress' is emitted every k data chunks received, starting from the first. ( it emits events on indexes: *1 + ( 0 * k )*, *1 + ( 1 * k )*, *1 + ( 2 * k )*, *1 + ( 3 * k )*, etc..           
         
> - **'listeners'** : ( *config object* ) It is possible to specify here a configuration object for listeners or adding them in normal way, with 'addListener' / 'on' . 
>    - **See below**



           
 Events & Listeners
--------------------

#### Error Events: 

> - **'module errors'**: the request was paused, the module interrupts writing data to disk. If resumeRequestOnError === false, then the 'loadend' event is immediately emitted, otherwise the request will be resumed, but no data will be written to disk . 
>
>     - **'error'**, there are different kinds of module errors, sub-types are:
>
>         - **'headers'**     ->  bad headers
>         - **'path'**        ->  bad dir path
>         - **'buffer'**      ->  error copying buffer 
>         - **'stream'**      ->  error writing to file stream
>         - **'mkdir'**       ->  error creating directory


> - **connection errors**: the 'loadend' event is immediately emitted, independently from resumeRequestOnError value .
>
>     - **'timeout'**     ->  the client request timeout was reached
>
>     - **'abort'**       ->  the request was aborted ( for example, when a user have stopped an upload )
>



#### Informational Events :

> - **'message'**, need attention, subtypes:
>     - **'warning'**
>     - **'fileremoved'**

> - **'loadstart'**, start parsing request

> - **'load'**, loaded some data 

> - **'progress'**, request progression

> - **loadend**, request end 
 
 
###Listeners Signatures 


**All Listeners functions are called at run-time with a response object argument in JSON format**: 


> - **'message'**: `function ( json  ) { .. }`,

``` javascript     
    json = {
          type: 'warning' | 'fileremoved',  // <-- ERROR EVENT TYPE
          msg: 'blah, blah..',              // <-- DEBUG MESSAGE   
          isupload: true | false            // <-- IS IT AN UPLOAD ?
      }
``` 

> - **'error'**: `function ( json ) { .. }`, 

 ``` javascript     
     json = { 
          type: 'headers' | 'path' | 'buffer' | 'stream' | 'mkdir',   // <-- ERROR EVENT TYPE
          msg: 'blah, blah..',      // <-- DEBUG MESSAGE      
          isupload: true | false,   // <-- IS IT AN UPLOAD ?
          isfatal: true             // <--  MEANS THAT THE MODULE HAS STOPPED WRITING THE RECEIVED DATA TO DISK
      }
``` 

> - **'abort'**, **'timeout'**: `function ( json ) { .. }`,

``` javascript     
    json = {
        msg: 'blah, blah..',        // <-- DEBUG MESSAGE
        isupload: true | false,     // <-- IS IT AN UPLOAD ?
        isfatal: true               // <-- MEANS THAT THE MODULE HAS STOPPED WRITING THE RECEIVED DATA TO DISK
    }
``` 


> - **'loadstart'**: `function ( json ) { .. }`,

``` javascript     
    json = { 
        time: 1307017842684,    // <-- MILLISECS  
    }
``` 

> - **'load'**: `function ( json ) { .. }`,

``` javascript
    // if a field was received --> 
    json = { 
        name:   'field1',   // <-- FIELD NAME
        value:  'value1'    // <-- FIELD VALUE IS A STRING
    }
    
    // if a file was received --> 
    json = {                
        name: 'field1',  // <-- FIELD NAME
        value: {            // <-- FIELD VALUE IS A FILE JSON OBJECT
            name: '..',             // <-- FILE ORIGINAL NAME
            path: '..',             // <-- FILE PATH, CONTAINS ALSO FILENAME AS 40 HEX (SHA1) HASH STRING 
            type: '..',             // <-- MIME TYPE
            size: 270,              // <-- BYTES
            lastModifiedDate: '..', // <-- FILE MTIME
            sha1cheksum: '..'       // <-- 40 HEX SHA1 STRING  ( IT IS THE (SHA1) RESULTING CHECKSUM OF THE FILE'S DATA )
        }
    }
      
``` 
 
> - **'progress'**: `function ( json ) { .. }`,

``` javascript     
    json = { 
        bytes: 8900,   // <-- BYTES RECEIVED
        chunks: 2,     // <-- CHUNKS RECEIVED
        ratio: 0.3     // <-- RATIO COMPLETION
    }
``` 

> - **'loadend'**: `function ( json, res, next ) { .. }`

``` javascript     
    json = {          
        /*
        an array containing all completed files
        */
        files: [    
            {
              name: 'filefield1',
              value: [    // <-- THIS ARRAY COULD CONTAIN MULTIPLE OR SINGLE FILE(S) UPLOADED FROM THE THE SAME FIELD 'FILEFIELD1'
                  {       // <-- PROPERTIES ARE THE SAME OF 'LOAD' JSON OBJECTS
                    name: 'filename1',  // <-- FIELD NAME
                    value: {            // <-- FIELD VALUE IS A FILE JSON OBJECT
                        name: '..',             // <-- FILE ORIGINAL NAME
                        path: '..',             // <-- FILE PATH, CONTAINS ALSO FILENAME AS 40 HEX (SHA1) HASH STRING 
                        type: '..',             // <-- MIME TYPE
                        size: 270,              // <-- BYTES
                        lastModifiedDate: '..', // <-- FILE MTIME
                        sha1cheksum: '..'       // <-- 40 HEX SHA1 STRING ( IT IS THE (SHA1) RESULTING CHECKSUM OF THE FILE'S DATA )
                    }
                  },          
                  {..},
                  ..
              ]  
            }, 
            { .. },
            ..
        ],
        /* 
        an array containing the list of files, 
        that did not were totally written to disk 
        due to exceeding upload threshold
        */
        incomplete: [   // <-- PROPERTIES ARE THE SAME OF PREVIOUS 'FILES' ARRAY 
            { 
            ..          // <-- SHA1 CHECKSUM IS NOT CALCULATED FOR PARTIAL WRITTEN/RECEIVED FILES .
            }, 
            { .. },
        ],          
        /*
        an array containing the list of received fields
        */
        fields: [
            {
              name: 'field1',
              value: [    // <-- AN ARRAY CONTAINING MULTIPLE VALUES FROM FIELDS WITH THE SAME NAME 'FIELD1'
                  'string1',
                  'string2',
                  ..
              ]
            },
            { 
              name: 'field2', 
              value: [ 'string3' ]  // <-- AN ARRAY CONTAINING SINGLE VALUE FROM A FIELD WITH UNIQUE NAME 'FIELD2'
            },
            ..
        ],
        /* 
        some numbers
        */
        stats: {
            startTime: 1307019846426,
            endTime: 1307019846578,
            overallSecs: 0.152,
            bytesReceived: 341917,
            bytesWrittenToDisk: 337775,
            chunksReceived: 10,
            filesCompleted: 25,
            filesRemoved: 0 
        },   
    };   
``` 




 


  Advanced Usage
------------------


> **require the module**:

``` javascript
  
 var formaline = require('formaline');


```    

> **build a config object**:

``` javascript  
    
 var config = { 
        
     logging: 'debug:on,1:on,2:on,3:off'
    
     uploadRootDir: '/var/www/upload/',
     
     getSessionID: function( req ){ // for example -->
         return ( ( req.sessionID ) || ( req.sid ) || ( ( req.session && req.session.id ) ? req.session.id : null ) );
     },

     requestTimeOut : 5000, // 5 secs
     
     resumeRequestOnError: true,
     
     holdFilesExtensions: true,
     
     checkContentLength: false,
            
     uploadThreshold: 3949000,  
          
     removeIncompleteFiles: true,
            
     emitprogress: false, 
        
     sha1sum: true,
            
     listeners: {
              
         'message':function( json ){ // json:{ type: '..', isupload: true/false , msg: '..' }
            ..
         },
         'error': function( json ){ // json:{ type: '', isupload: true/false , msg: '..', fatal: true }
            ..
         },
         'abort': function( json ) {   
            ..
         },
         'timeout': function( json ) {   
            ..
         },
         'loadstart': function( json ){
            ..
         },
         'progress': function( json ) {                              
            ..
         },
         'load': function( json ){
            ..
         },
         'loadend': function( json, res, next ) {
            ...
            res.writeHead(200, { 'content-type': 'text/plain' } );
            res.end();
            next();
         }
     }//end listener config
 };
        
```  

> **create an instance with config, then parse the request**:
   
``` javascript  
 var form = new formaline( config ); 
 form.parse( req, res, next );
 ```   
 *or directly*
 
 ``` javascript  

 new formaline( config ).parse( req, res, next );

```   
    

 **See Also :**


> - [examples](https://github.com/rootslab/formaline/tree/master/examples) 

 

  File Uploads 
-----------------
 
 
- **When a file is found in the data stream**:
 
> - **default behaviour** : 
>
>     - **for every different POST was created a subdirectory**:
>
>          - under the upload root directory, default is /tmp/ .
>          - with a random number name ( for example: */tmp/123456789098/* ) .
>
>     - the file name is cleaned of weird chars, then converted to an hash string with SHA1.
>
>     - when two files, with the same name, 
>       are uploaded through :
>
>          - **Same** POST action, then the resulting string (calculated with SHA1) is the same, for not causing a collision, the SHA1 string is regenerated, adding a seed in the file name (current time in millis); in this way, it assures us that the first file will not overwritten .
>          
>          - **Different** POSTs actions, there is no collision between filenames, because they are written into different directories


> - **with session support** : 
>
>     - **for an authenticated user the upload subdirectory name will remain the same across multiple POSTs** . 
>
>     - the user session identifier is used for generating directory name . 
>
>     - when two files, with the same name, 
>       are uploaded through :
>
>          - the **Same** POST action, ( as default behaviour, see above )
>
>          - **Different** POSTs actions, the generated ( SHA1 ) files names will be the same, and the file is overwritten by the new one ( because are uploaded in the same upload directory ).   


>     - the data stream is written to disk in the file, until:
>
>          - is reached end of the file's data .
>
>          - is reached the maximum data threshold for uploads .


- **When the remaining data for the file are exceeding the upload threshold**:

>  - if removeIncompleteFile is:
>
>     - true ( default ), the file is auto-removed and a **'message'->'fileremoved'** event is emitted . 
>
>     - otherwise, the file is kept partial in the filesystem, no event is emitted .


- **When all the data for a file is totally received**:

>  - *'load'* event is emitted**. 


When the mime type is not recognized by the file extension, the default value for file **type** will be **'application/octet-stream'** .
 
 
 Parser Implementation & Performance
--------------------------------------

###A Note about Parsing Data Rate vs Network Throughput
-------------------------------------------------------

Overall parsing data-rate depends on many factors, it is generally possible to reach a ( parsing ) data rate of __700 MB/s and more__  with a *real* Buffer totally loaded in RAM ( searching a basic ~60 bytes string, like Firefox uses; **see  [parser-benchmarks](https://github.com/rootslab/formaline/tree/master/parser-benchmarks)** ), but in my opinion, **this parsing test only emulates an high Throughput network with only one chunk for all data, therefore not a real case**. 

Unfortunately, sending data over the cloud is sometime a long-time task, the data is chopped in many chunks, and the **chunk size may change because of (underneath) TCP flow control ( typically the chunk size is between ~ 4K and ~ 64K )**. Now, the point is that the parser is called for every chunk of data received, the total delay of calling it becomes more perceptible with a lot of chunks. 

I try to explain me:

( using a super-fast [Boyer-Moore](http://www-igm.univ-mlv.fr/~lecroq/string/node14.html#SECTION00140) parser )

>__In the world of Fairies :__
 
>  - the data received is not chopped, 
>  - there is a low repetition of pattern strings in the received data, ( this gets the result of n/m comparisons )
> - network throughput == network bandwidth ( **wow **),
 
 reaches a time complexity (in the best case) of :   

     O( ( data chunk length ) / ( pattern length ) ) * O( time to do a single comparison ) 
      or, for simplicity  
     O( n / m ) * O(t) = O( n / m )
   
> **t** is considered to be a constant value. It doesn't add anything in terms of complexity, but it still is a non zero value.  

(for the purists, O stands for Theta, Complexity).

> Anyway, I set T = (average time to execute the parser on a single chunk ) then :  
    
    T = ( average number of comparisons ) * ( average time to do a single comparison ) ~= ( n / m ) * ( t )


>__In real world, Murphy Laws assures that the best case doesn't exists:__ :O 
 
>  - data is chopped,
>  - in some cases (a very large CSV file) there is a big number of comparisons  between chars ( it decreases the data rate ), however for optimism and for simplicity, I'll take the  previous calculated time complexity O(n/m) for good, and then also the time T, altough it's not totally correct .   
>  - network throughput < network bandwidth,
>  - **the time 't' to do a single comparison, depends on how the comparison is implemented**

 **the average time will becomes something like**:
   
>    ( average time to execute the parser on a single chunk ) *  ( average number of data chunks ) * ( average number of parser calls per data chunk * average delay time of a single call )  

  or for simplify it, a number like:

>   ( T ) * ( k ) * ( c * d )  ~= ( n / m ) * ( t ) * ( k ) * ( c * d )  

When k, the number of data chunks, increases, the value  ( k ) * ( c * d ) becomes a considerable weigth in terms of time consumption; I think it's obvious that, for the system, call 10^4 times a function , is an heavy job compared to call it only 1 time. 

`A single GB of data transferred, with a data chunk size of 40K, is typically splitted (on average) in ~ 26000 chunks!`

 
**However, in a general case**: 
 
 - we can do very little about reducing the time delay (**d**) of parser calls, and for reducing the number (**k**) of chunks ( or manually increasing their size ), these thinks don't totally depend on us. 
 - we could minimize the number **'c'**  of parser calls to a single call for every chunk, or  **c = 1**.
 - we could still minimize the time **'t'** to do a single char comparison , it obviously reduces the overall execution time.

**For these reasons**: 

 - **instead of building a complex state-machine**, I have written a simple implementation of the [QuickSearch](http://www-igm.univ-mlv.fr/~lecroq/string/node19.html#SECTION00190) algorithm, using only high performance for-cycles.

 - I have tried to don't use long *switch( .. ){ .. }* statements or a long chain of *if(..){..} else {..}*,

 - for minimizing the time 't' to do a single comparison, **I have used two simple char lookup tables**, 255 bytes long, implemented with nodeJS Buffers. (one for boundary pattern string to match, one for CRLFCRLF sequence). 

The only limit in this implementation is that it doesn't support a boundary length more than 254 bytes, **it doesn't seem to be a real problem with all major browsers I have tested**, they are all using a boundary totally made of ASCII chars, typically ~60bytes in length. -->

> [RFC2046](http://www.ietf.org/rfc/rfc2049.txt) *(page19)* excerpt:

**Boundary delimiters must not appear within the encapsulated material, and must be no longer than 70 characters, not counting the two leading hyphens.**

Links
-----

- **HTTP 1.1**: [RFC2616](http://www.ietf.org/rfc/rfc2616.txt)
   - 19.4 Differences Between HTTP Entities and RFC 2045 Entities.
   - 19.4.1 MIME-Version *( .. HTTP is not a MIME-compliant protocol .. )*
   - 19.4.5 No Content-Transfer-Encoding *( .. HTTP does not use the Content-Transfer-Encoding (CTE) field of RFC 2045.. )*

- **(MIME) Part Two: Media Types**: [RFC2046](http://www.ietf.org/rfc/rfc2046.txt)
   - 5.1.1 Common Syntax
 
Other
---------

> **Special thanks to** :

>  - [dvv](https://github.com/dvv)

>  - [coolaj86](https://github.com/coolaj86)

>  - [desm](https://github.com/desm)

>  - [mrxot87](https://github.com/mrxot87)

> **for Italian GitHubbers** -> [LinkedIn NodeJS Group](http://www.linkedin.com/groups/nodeJS-Italia-3853987)

 Future Releases
-----------------
 
 - add transaction identifiers
 - add others examples with AJAX, writing about tested client-side uploader .
 - add a readable stream from files while they are uploaded .
 - add some other server-side security checks, and write about it .  
 - give choice to changing the parser with a custom one .
 - more performance modifications in quickSearch.js .
 - find and test some weird boundary string types .
 - add some unit tests .
 - Restify ?



## License 

(The MIT License)

Copyright (c) 2011 Guglielmo Ferri &lt;44gatti@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
