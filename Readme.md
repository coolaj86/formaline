# Formaline for NodeJS 

> __formaline__ is a new ([nodejs](http://nodejs.org/)) module for handling **HTTP** form **POST**s and for fast parsing of file uploads, 
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

> - Real-time parsing of file uploads, also supports HTML5 multiple files.
> - It is possible to create instances via configuration object.
> - Useful configuration parameters ( listeners, uploadThreshold, logging .. ).
> - Fluid exceptions handling.
> - Many events for total control of parsing flow. 
> - Very Fast and Simple Parser (see parser-benchmarks).
> - It is possible to preserve or auto-remove incomplete files upload, due to exceeding of a max bytes limit. 
> - It easily integrates with connect middleware.
> - Works!
> - etc..




 Simple Usage
--------------

    var formaline = require('formaline'),
        form = new formaline( { } );           // <-- empty config object
   
   *add events listener:*

    ...
    form.on( 'filereceived', function( filename, filedir, filetype, filesize, filefield ){ .. }  ) 
    ...
    

   *parse request:*    


    form.parse( req, res, next ); // next is a callback  function( .. ){ .. }
    

 Configuration Options
-----------------------

You could create a formaline instance with some configuration options : 

> - **'uploadRootDir'** : ( *string* ) default root dir is '/tmp/'.
>  - it is the root directory for file uploads, it must already exists!
>  - a new sub-directory with a random name is created for every upload request.

> - **'uploadThreshold'** : ( *integer* ) default value is integer 1024*1024*1024 bytes (1GB).
>   - it indicates the max total bytes allowed for file uploads (multipart/form-data) before stopping, it also limits data received with serialzed fields (x-www-urlencoded). 

> - **'emitDataProgress'** : ( *boolean or integer > 1* ) default value is boolean false.
>    - when true, it emits 'dataprogress' on every chunk. If you need to change emitting factor ,( you could specify an integer > 1 ). 
>    - If you set it, for example, to an integer k, 'dataprogress' is emitted every k data chunks received, starting from the first. ( emits on indexes: *1 + ( 0 * k )*, *1 + ( 1 * k )*, *1 + ( 2 * k )*, *1 + ( 3 * k )*, etc.. );  


> - **'checkContentLength'** : ( *boolean* ) default value is false.
>   - formaline don't stop if ( Content-Length > uploadThreshold ), It will try to receive all data for request, but will write only uploadThreshold bytes to disk. 
>   - if true, formaline stops to receive data, because headers Content-Length exceeds uploadThreshold.

> - **'removeIncompleteFiles'** : ( *boolean* ) default value is boolean true.
>   - if true, formaline auto-removes files not completed since of uploadThreshold limit, then it emits 'fileremoved' event, 
>   - if false, no event is emitted, but the incomplete files list are passed to 'end' listeners in the form of an array of paths 


> - **'logging'** : ( *string* ) default is 'debug:off,1:on,2:on,3:on'.
>   - enable various logging levels, it is possible to switch 'on' / 'off' one or more level at the same time. 
>   - debug: 'off' turn off logging, to see parser stats enable 2nd level.
            
> - **'listeners'** : ( *config object* ). It is possible to specify here a configuration object for listeners or adding them in normal way, with 'addListener' or 'on' functions. *See below*



           
 Events
--------

#### Type of events:
 
 
> - *'fatal' exceptions* : headersexception, filepathexception, exception (the data transmission is interrupted). 
> - *informational* : filereceived, field, dataprogress, end 
> - *warning* : fileremoved, warning 

 
 
#### Listeners callbacks with params: 


> - **'warning'**: `function( msg ){ ... }`,
 
> - **'headersexception'**: `function ( isUpload, errmsg, res, next ) { .. }`,
 
> - **'exception'**: `function ( isUpload, errmsg, res, next ) { .. }`,
 
> - **'filepathexception'**: `function ( path, errmsg, res, next ) { .. }`,
 
> - **'field'**: `function ( fname, fvalue ) { .. }`,
 
> - **'filereceived'**: `function ( filename, filedir, filetype, filesize, filefield ) { .. }`,
 
> - **'fileremoved'**: `function ( filename, filedir, filetype, filesize, filefield ) { .. }`,
 
> - **'dataprogress'**: `function ( bytesReceived, chunksReceived ) { .. }`,
 
> - **'end'**: `function ( incompleteFiles, response, next ) { .. }`
 
 



  Advanced Usage
------------------


*require the module:*


    var formaline = require('formaline');
    

*build a config object:*

    
    var config = { 
        
        uploadRootDir: '/var/www/upload/',
          
        emitDataProgress: !true, 
            
        uploadThreshold: 3949000,  
            
        checkContentLength: !true,
        
        removeIncompleteFiles: true,
        
        logging: 'debug:on,1:on,2:on,3:off'

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
            'filepathexception': function ( path, errmsg, res, next ) {
                ...
                next();
            },
            'field': function ( fname, fvalue ) { 
                ...
            },
            'filereceived': function ( filename, filedir, filetype, filesize, filefield ) { 
            .. 
            },
            'fileremoved': function ( filename, filedir, filetype, filesize, filefield ) { 
                ...
            },
            'dataprogress': function ( bytesReceived, chunksReceived ) {
                ...
            },
            'end': function ( incompleteFiles, response, next ) {
                ...
                response.writeHead(200, {'content-type': 'text/plain'});
                response.end();
                //next();
            }
            
        }//end listener config
    };
        

*create an instance with config, then parse request:*
   

    new formaline( config ).parse( req, res, next );
    

  *or*


    var form = new formaline(config); 
    form.parse( req, res, next);
    
    

 **See Also :**


> - [examples](https://github.com/rootslab/formaline/tree/master/examples) 
> - [parser-benchmarks](https://github.com/rootslab/formaline/tree/master/parser-benchmarks), for parser speed tests (data-rate) 
 

 File Creation 
---------------
 
When a file is founded in the data stream:
 
 - this is directly writed to disk chunk per chunk, until end of file is reached.

 - a directory with a random integer name is created in the upload path directory (default is /tmp/), for example:  */tmp/123456789098/*,
   it assures no file name collisions for every different post.

 - when two files with the same name are uploaded through the same form post action, the file that causes the collision is renamed with a prefix equal to current time in millis; 
   >**for example**: 
   >we are uploading two files with same name, like *hello.jpg*, the first one is received and writed to disk with its original name, 
   >the second one is received but its name causes a collision, then it is also writed to disk, but with a name something like *1300465416185_hello.jpg*. 
   >It assures that the first file is not overwritten.

 - when a file reaches the max bytes allowed:
   > - if *removeIncompleteFiles === true*, the file is auto-removed and a **'fileremoved'** event is emitted; 
   > - if *removeIncompleteFiles === false*, the file is kept in the filesystem, **'end'** event is emitted and an array of  paths ( that lists incomplete files ), is passed to callback.

 - when a file is totally received, a **'filereceived'** event  is emitted. 

 - the **filereceived** and **fileremoved** events are emiited together with this params: *filename*, *filedir*, *filetype*, *filesize*, *filefield*.

 Parser
--------

###A Note about Parsing Data Rate vs Network Throughput
---------------------------------------------------------------------------------------

Overall parsing data-rate depends on many factors, it is generally possible to reach __700 MB/s and more__ ( searching a basic ~60 bytes boundary string, like Firefox uses ) with a *real* data Buffer totally loaded in RAM, but in my opinion, this parsing test emulates more a network with an high-level Throughput, than a real case. 

Unfortunately, sending data over the cloud is sometime a long-time task, the data is chunked, and the **chunk size may change because of underneath TCP flow control ( typically chunk size is ~ 8K to ~ 1024K )**. Now, the point is that the parser is called for every chunk of data received, the total delay of calling the method becomes more perceptible with a lot of chunks. 

I try to explain me:

>__In the world of Fairies, using a super-fast Booyer-Moore parser :__
 
>  - data is not chunked, 
>  - there is a low pattern repetition in data received, ( this get the result of n/m comparison )
> - network throughput == network bandwidth (wow),
 
 reaches a time complexity (in the best case) of : 

    O( ( data chunk length ) / ( pattern length ) ) * ( time to do a single comparison ) = T
      or  for simplicity  
     O( n / m ) * t = T

(for the purists, O stands for Theta). 

>__In real world, Murphy Laws assures that the best case doesn't exists:__ :O 
 
>  - data is chunked,
>  - in some cases (very large CSV file) there is a big number of char comparisons ( it decreases the parser data rate ), however, for optimism and simplicity, we use previous time result T = O( n / m ) * t. 
>  - network throughput < network bandwidth,
>  - time 't' to do a single comparison, depends on how the comparison is implemented,

 the time complexity becomes to look something like:

    ( T ) *  ( number of chunks ) * ( average number of parser calls per chunk * average delay time of a single call )  
      or
    ( T ) * ( k * d ) => ( O( n / m ) * t ) * ( c * k * d ) 

When the number k of chunks increases, the value  ( c *  k * d ) becomes to have a considerable weigth in terms of time consumption; I think it's obvious that, for the system, calling a function 10^4 times, is an heavier job than calling it only 1 time. 

`A single GB of data transferred, with a http chunk size of 40K, is typically splitted (on average) in ~ 26000 chunks!`

However, in a general case, 
 
 - we can do very little about reducing time delay of calling the parser and  the number of chunks ( increasing their size ), it doesn't totally depend on us. 
 - we could minimize the number of parser calls **'c'**, a single call for every chunk, c = 1.
 - we could minimize the time **'t'** to do a single char comparison , it obviously reduces the overall execution time.

For this reasons: 
 
 - I try to not use long *switch( .. ){ .. }* statements or a long chain of *if(..){..} else {..}*,
 - instead of building a complex state-machine, I have writed a simple implementation of QuickSearch algorithm, using only high performance for-cycles,
 - for miminizing the time 't' to do a comparison, I have used two simple char lookup tables, 255 bytes long, implemented with nodeJS Buffers. (one for boundary pattern to match, one for CRLFCRLF sequence). 

The only limit in this implementation is that it doesn't support a boundary length more than 254 bytes, **for now it doesn't seem a real problem with all major browsers I have tested**, they are all using a boundary totally made of ASCII chars, typically ~60bytes in length.



 Future Releases
-----------------

 - some code performance modifications in quickSearch.js and formaline.js
 - emit 'logging' events
 - some code variables cleaning in formaline.js
 - change the core parser with a custom one.
 - add some other server-side security checks, and write about it.
 - check some weird boundary types.
 - Restify?
 - switch createDelegate to ecmascript5 bind..
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
