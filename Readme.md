# Formaline for NodeJS 

> __formaline__ is a new ([nodejs](http://nodejs.org/)) module for handling forms ( **HTTP POST** ) and for fast parsing of file uploads, 
> it is also ready to use with [connect middleware](https://github.com/senchalabs/connect).  



 Installation
--------------
     
with npm:
    $ npm install formaline

with git:
    $ git clone git://github.com/rootslab/formaline.git

>if you want to use nodeJS, only for testing purpose, together with Apache, a simple way to do this is to enable apache *mod-proxy* and add this lines to your apache virtualhost:


    ProxyPass /test/ http://localhost:3000/test/
    ProxyPassReverse /test/ http://localhost:3000/test/


>change the path and the port with yours. 



 Features
----------

> - Real-time parsing of file uploads, also supports the "multiple" attribute, for HTML5 capable browsers .
> - It is possible to create module instances with a configuration object.
> - some useful configuration parameters ( listeners, uploadThreshold, logging .. ).
> - exceptions handling is fluid.
> - Many events for control of the module execution. 
> - Very Fast and Simple Parser (see parser-benchmarks).
> - It is possible to preserve or remove uploaded files if they are not completed, due to exceeding of the upload total threshold. 
> - It easily integrates with connect middleware.
> - Works!
> - etc..




 Simple Usage
--------------

    var formaline = require('formaline'),
        form = new formaline( { } );           // <-- empty config object
   
   *add events listener:*

    ...
    form.on( 'filereceived', function( filename, origfilename, filedir, filetype, filesize, filefield ){ .. }  )  
    ...
 
  ** the listed params ( filename, filedir, .. ) are already attached to the function callback!** 
  
  > for example, if I write an anonymous function myListener:
  
     ...
     var myListener = function( ){ console.log( arguments ); }
     ..
     form.on( 'filereceived', myListener ); <-- myListener get filename, origname, etc.. as arguments
     ..
   

>  see **Event & Listeners** section for a complete list of callbacks signatures!
      
    

   *then, parse request:*    


    form.parse( req, res, next ); // next is a callback  function( .. ){ .. }
    

 Configuration Options
-----------------------

You could create a formaline instance with some configuration options : 

> - **'uploadRootDir'** : ( *string* ) the default root directory for files uploads is '/tmp/'.
>   - it is the root directory for file uploads, must already exist! ( formaline will try to use '/tmp/', otherwise it  throws an exception )
>   - a new sub-directory with a random name is created for every upload request.

> - **'uploadThreshold'** : ( *integer* ) default value is 1024 * 1024 * 1024 bytes (1GB).
>   - it indicates the upload threshold in bytes for file uploads (multipart/form-data) before of stopping  writing to disk,
>   - it also limits data received with serialized fields (x-www-urlencoded). 
  
> - **'holdFilesExtensions'** : ( *boolean* ) default value is true.
>   - it indicates to maintain the  extensions of uploaded files ( like .jpg, .text, etc.. )

> - **'checkContentLength'** : ( *boolean* ) the default value is false.
>   - formaline doesn't stop if ( Content-Length > uploadThreshold ), It will try to receive all data for request, and write to disk the bytes received, until it reaches the upload threshold. 
>   - if value is set to true, if  the header Content-Length exceeds uploadThreshold, It stops receiving data,

> - **'removeIncompleteFiles'** : ( *boolean* ) the default value is  true.
>   - if true, formaline auto-removes files not completed because of exceeded upload threshold limit, then it emits a 'fileremoved' event, 
>   - if false, no event is emitted, but the incomplete files list is passed to the 'end' listener in the form of an array of paths. 


> - **'logging'** : ( *string* ) the default value is 'debug:off,1:on,2:on,3:on'.
>   - it enables various logging levels, it is possible to switch on or  off one or more level at the same time. 
>   - debug: 'off' turns off logging, to see parser stats you have to enable the 2nd level.
      
> - **'emitDataProgress'** : ( *boolean or integer > 1* ) the default value is false.
>    - when it is true, it emits a 'dataprogress' event on every chunk. If you need to change the emitting factor ,( you could specify an integer > 1 ). 
>    - If you set it for example to  an integer k,  'dataprogress' is emitted every k data chunks received, starting from the first. ( it emits events on indexes: *1 + ( 0 * k )*, *1 + ( 1 * k )*, *1 + ( 2 * k )*, *1 + ( 3 * k )*, etc..           
            
> - **'listeners'** : ( *config object* ) It is possible to specify here a configuration object for listeners or adding them in normal way, with 'addListener' / 'on' . 
>    - **See below**




           
 Events & Listeners
--------

#### Type of events:
 
 

> - *'fatal' exceptions* : headersexception, pathexception, exception (the data transmission is interrupted). 
> - *informational* : filereceived, field, dataprogress, end 
> - *warning* : fileremoved, warning 

 
#### Listeners are called with following listed arguments, they are already attached to the callbacks : 


> - **'warning'**: `function( msg ){ ... }`,
 
> - **'headersexception'**: `function ( isUpload, errmsg, res, next ) { .. }`,
 
> - **'exception'**: `function ( isUpload, errmsg, res, next ) { .. }`,
 
> - **'pathexception'**: `function ( path, errmsg, res, next ) { .. }`,
 
> - **'field'**: `function ( fname, fvalue ) { .. }`,
 
> - **'filereceived'**: `function ( filename, origfilename, filedir, filetype, filesize, filefield ) { .. }`,
 
> - **'fileremoved'**: `function ( filename, origfilename, filedir, filetype, filesize, filefield ) { .. }`,
 
> - **'dataprogress'**: `function ( bytesReceived, chunksReceived ) { .. }`,
 
> - **'end'**: `function ( incompleteFiles, stats, response, next ) { .. }`
 
 



  Advanced Usage
------------------


*require the module:*


    var formaline = require('formaline');
    

*build a config object:*

    
    var config = { 
    
        uploadRootDir:    '/var/www/upload/',
            
        checkContentLength:   false,
            
        uploadThreshold:    3949000,  
          
        removeIncompleteFiles:    true,
            
        emitDataProgress:    false, 
            
        logging:    'debug:on,1:on,2:on,3:off'
            
        listeners: {
                
            'warning': function(msg){
                ...
            },
            'headersexception': function ( isUpload, errmsg, res, next ) {
                ...
                next();               
            },
            'exception': function ( isUpload, errmsg, res, next ) {
                ...
                next();
            },
            'pathexception': function ( path, errmsg, res, next ) {
                ...
                next();
            },
            'field': function ( fname, fvalue ) { 
                ...
            },
            'filereceived': function ( filename, origfilename, filedir, filetype, filesize, filefield ) { 
                ... 
            },
            'fileremoved': function ( filename, origfilename, filedir, filetype, filesize, filefield ) { 
                ...
            },
            'dataprogress': function ( bytesReceived, chunksReceived ) {
                ...
            },
            'end': function ( incompleteFiles, stats, res, next ) {
                ...
                res.writeHead(200, {'content-type': 'text/plain'});
                res.end();
                //next();
            }
            
        }//end listener config
    };
        

*create an instance with config, then parses the request:*
   

    new formaline( config ).parse( req, res, next );
    

  *or*


    var form = new formaline(config); 
    form.parse( req, res, next);
    
    

 **See Also :**


> - [examples](https://github.com/rootslab/formaline/tree/master/examples) 
> - [parser-benchmarks](https://github.com/rootslab/formaline/tree/master/parser-benchmarks), for parser speed tests (data-rate) 
 

  File Uploads 
-----------------
 
 
When a file is found in the data stream:
 
 - this is directly written to disk, chunk per chunk, until the end of file is reached.

 - a directory with a random integer name is created in the path of upload directory (default is /tmp/), for example:  */tmp/123456789098/*,
   it assures no collisions on file names, for every upload.
   
- the file name is cleaned of weird chars, then converted to an hash string with SHA1.
- when two files with the same name are uploaded through the same post action, the resulting string (calculated with SHA1) is the same, for not causing a collision, the SHA1 string is regenerated with adding a seed in the file name (current time in millis);
  
   >In this way, It assures us that the first file will not overwritten.

 - when a file reaches the upload threshold allowed:
   > - if *removeIncompleteFiles === true*, the file is auto-removed and a **'fileremoved'** event is emitted; 
   > - if *removeIncompleteFiles === false*, the file is kept in the filesystem, **'end'** event is emitted, an array with paths ( which lists incomplete files ) is passed to 'end' callback.

 - when a file is totally received, a **'filereceived'** event  is emitted. 

 - the **filereceived** and **fileremoved** events are emitted together with these parameters attached: *filename*, *origfilename*, *filedir*, *filetype*, *filesize*, *filefield*.
 
 
 Parser & Performance
----------------------

###A Note about Parsing Data Rate vs Network Throughput
---------------------------------------------------------------------------------------

Overall parsing data-rate depends on many factors, it is generally possible to reach __700 MB/s and more__  if you search a basic of ~60 bytes string ( like Firefox uses ), with a *real* Buffer totally loaded in RAM, but in my opinion, this parsing test  only emulates  an high Throughput network with only one chunk for all data , not  a real case. 

Unfortunately, sending data over the cloud is sometime a long-time task, the data is chopped in many chunks, and the **chunk size may change because of (underneath) TCP flow control ( typically the chunk size is ~ 8K to ~ 1024K )**. Now, the point is that the parser is called for every chunk of data received, the total delay of calling the method becomes more perceptible with a lot of chunks. 

I try to explain me:

>__ In the world of Fairies, using a super-fast Booyer-Moore parser :__
 
>  - the data received is not chopped, 
>  - there is a low repetition of pattern strings in the received data, ( this gets the result of n/m comparisons )
> - network throughput == network bandwidth (wow),
 
 reaches a time complexity (in the best case) of : 

     O( ( data chunk length ) / ( pattern length ) ) * O( time to do a single comparison ) 
      or  for simplicity  
     O( n / m ) * O(t) 
   
 O(t) is considered to be a constant value, but it still has a non zero value. 
 (for the purists, O stands for Theta, Complexity). 

> Anyway, I set T = (average time to execute the parser on a single chunk ) then :  
    
    T = ( average number of comparisons ) * ( average time to do a single comparison ) ~= ( n / m ) * ( t )


>__In real world, Murphy Laws assures that the best case doesn't exists:__ :O 
 
>  - data is chopped,
>  - in some cases (a very large CSV file) there is a big number of comparisons  between chars ( it decreases the data rate ), however for optimism and for simplicity, I'll take the  previous calculated time complexity O(n/m) for good, and then also the time T, altough it's not totally correct .   
>  - network throughput < network bandwidth,
>  - the time 't' to do a single comparison, depends on how the comparison is implemented,

 **the average time will becomes something like**:
   
>    ( average time to execute the parser on a single chunk ) *  ( average number of data chunks ) * ( average number of parser calls per data chunk * average delay time of a single call )  

  or for simplify it, a number like:

>   ( T ) * ( k ) * ( c * d )  ~= ( n / m ) * ( t ) * ( k ) * ( c * d )  

When k, the number of data chunks, increases, the value  ( k ) * ( c * d ) becomes a considerable weigth in terms of time consumption; I think it's obvious that, for the system, calls 10^4 times a function , is an heavy job compared to call it only 1 time. 

`A single GB of data transferred, with a data chunk size of 40K, is typically splitted (on average) in ~ 26000 chunks!`

 
**However, in a general case**: 
 
 - we can do very little about reducing the time delay (**d**) of parser calls, and for reducing the number (**k**) of chunks ( or manually increasing their size ), these thinks don't totally depend on us. 
 - we could minimize the number **'c'**  of parser calls to a single call for every chunk, or  **c = 1**.
 - we could still minimize the time **'t'** to do a single char comparison , it obviously reduces the overall execution time.

**For these reasons**: 
 
 - I have tried to don't use long *switch( .. ){ .. }* statements or a long chain of *if(..){..} else {..}*,
 - **instead of building a complex state-machine**, I have written a simple implementation of QuickSearch algorithm, using only high performance for-cycles,
 - for minimizing the time 't' to do a single comparison, **I have used two simple char lookup tables**, 255 bytes long, implemented with nodeJS Buffers. (one for boundary pattern string to match, one for CRLFCRLF sequence). 

The only limit in this implementation is that it doesn't support a boundary length more than 254 bytes, **for now it doesn't seem a real problem with all major browsers I have tested**, they are all using a boundary totally made of ASCII chars, typically ~60bytes in length.


 Future Releases
-----------------

 - add some other server-side security checks, and write about it .
 - some code performance modifications in quickSearch.js and formaline.js .
 - some code cleaning in formaline.js for some variables .
 - give choice to changing the parser with a custom one .
 - check some weird boundary string types .
 - Restify?
 - change createDelegate with (ecmascript5) bind function ?
 - be happy?  


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
