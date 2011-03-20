# formaline for nodeJS 

> __formaline__ is a new (node.js) module for handling simple form posts and for fast parsing of file uploads
>  *(multipart/form-data and x-www-urlencoded)*, 
> it is ready for using with connect middleware.  

### Installation
     
with npm:
    $ npm install formaline

with git:
    $ git clone git://github.com/rootslab/formaline.git

>if you want to use nodeJS, only for testing purpose, together with Apache, a simple way to do this is to enable apache *mod-proxy* and add this lines to your apache virtualhost:

    ProxyPass /test/ http://localhost:3000/test/
    ProxyPassReverse /test/ http://localhost:3000/test/

>change the path and the port with yours. 

### Features

> - Works!
> - Real-time parsing of file uploads.
> - It is possible to create instances via configuration object.
> - Useful configuration parameters ( like listeners, maxBytes, auto remove of incomplete files.. ).
> - Fluid exceptions handling.
> - Many events for total control of parsing flow. 
> - Very Fast and Simple Parser (see parser-benchmarks).
> - It is possible to preserve or auto-remove incomplete files upload, due to exceeding of a max bytes limit. 
> - It easily integrates with connect middleware.

 etc..

### Simple Usage

    var formaline = require('formaline'),
        form = new formaline({});           // <-- empty config object
    ...
    form.on( 'filereceived', function( filename, filedir, filetype, filesize, filefield ){ .. }  ) //add listener for an event
    ...
    form.parse( req, res, next );
    
    //compact usage -> new formaline({}).parse(req,res,next);
    


### Advanced Usage

    var formaline = require('formaline');
    
    // build a config object -->
    
    var config = { 
        
            /*
             temporary upload directory for file uploads
             for every upload request a subdirectory is created that contains receiving files 
             default is /tmp/ -->
            */
            
        tmpUploadDir: '/var/www/upload/',
            
            /*
             boolean: default is false; when true, it emits 'dataprogress' every chunk 
             integer chunk factor: emits 'dataprogress' event every k chunks starting from first chunk ( 1+(0*k) 1+(1*k),1+(2*k),1+(3*k) ),
             minimum chunk factor value is 2 -->
            */
            
        emitDataProgress: !true, //true, false, 3, 10, 100.. (every k chunks)
            
            /*
             max bytes allowed, this is the max bytes writed to disk before stopping 
             this is also true for serialzed fields not only for files upload  -->
            */
            
        maxBytes: 3949000, //bytes ex.: 1024*1024*1024 , 512
        
            /*
             default false, bypass headers value, continue to write to disk  
             until maxBytes bytes are writed. 
             if true -> stop receiving data, when headers Content-Length exceeds maxBytes
            */
            
        blockOnReqHeaderContentLength: !true,
        
            /*
             remove file not completed due to maxBytes, 
             if true, formaline emit 'fileremoved' event, 
             otherwise return a path array of incomplete files when 'end' event is emitted 
            */
            
        removeIncompleteFiles: true,
        
            /*
             enable various logging levels
             it is possible to switch on/off one or more levels at the same time
             debug: 'off' turn off logging,to see parser stats enable 2nd level
            */
            
        logging: 'debug:on,1:on,2:on,3:off' //string ex.: 'debug:on,1:off,2:on,3:off'
            
            /*
             it is possible to specify here a configuration object for listeners
             or adding them in normal way, with 'addListener' or 'on' functions
             
             events:
                - headersexception, filepathexception, exception: indicates a closed request caused by a 'fatal' exception
                - warning: indicates a value/operation not ammitted (it doesn't block data receiving)  
                - fileremoved: indicates that a file was removed because it exceeded max allowed bytes 
                - dataprogress: emitted on every (k) chunk(s) received   
            */
            
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
                ...
            },
            'fileremoved': function ( filename, filedir, filetype, filesize, filefield ) {
                ...
            },
            'dataprogress': function ( bytesReceived, chunksReceived ) {
                ...
            },
            'end': function ( incompleteFiles, response, next ) {
                response.writeHead(200, {'content-type': 'text/plain'});
                response.end();
                //next();
            }
        }
    };
        
    /*
        create a formaline instance with configuration object, then parse request
    */
    
    new formaline( config ).parse( req, res, next );
    
      // or
      //     var form = new formaline(config); 
      //     form.parse( req, res, next);
    
    

 **See Also :**


> - examples directory for seeing formaline in action. 
> - parser-benchmarks directory for testing algorithm parsing speed (*wow*). 
 

## File Creation 
 
When a file is founded in the data stream:
 
 - this is directly writed to disk chunk per chunk, until end of file is reached.

 - a directory with random numeric name is created, as child of root dir specified via configuration object (default is /tmp/); 
   that assures no file name collisions for every different post.

 - when two files with the same name are uploaded through the same form post action, the file that causes the collision is renamed with a prefix equal to current time in millis; 
   for example: two files with the same name *hello.jpg*, the first one is received and writed to disk with its original name, 
   the second one is received but its name causes a collision and it is writed to disk but with a name something like *1300465416185_hello.jpg*. 
   It assures that the first file is not overwritten.

 - when a file reaches the max bytes allowed:
   if removeIncompleteFiles === true : it is auto-removed and a event **'fileremoved'** event is emitted; 
   if removeIncompleteFiles === false then the file is kept in the filesystem, and when *'end'* event is launched, it is emitted  together with an array of  paths, that lists incomplete files.

 - when a file is totally received a **'filereceived'** event  is emitted. 

 - the **filereceived** and **fileremoved** events are emiited together with this params: *filename*, *filedir*, *filetype*, *filesize*, *filefield*.

## Parser

###A Note about Parsing Data Rate vs Network Bandwidth
---------------------------------------------------------------------------------------

Overall parsing data-rate depends on many factors, it is generally possible to reach __700 MB/s and more__ ( searching a basic ~60 bytes boundary string, like Firefox uses ) with a *real* data Buffer totally loaded in RAM, but in my opinion, this parsing test emulates more a network with an high-level bandwidth and low-level latency, than a real case. 

Unfortunately, sending data over the cloud is sometime a long-time task, the data is chunked, and the chunk size may change because of underneath TCP flow control ( typically >~ 40K, <~ 1024K ). Now, the point is that the parser is called for every chunk of data received, the total delay of calling the method becomes more perceptible with a lot of chunks. 

I try to explain me:

In the world of fairies, a super-fast Booyer-Moore parser in the best case (data is not chunked and there is a low pattern repetition),  reaches a time complexity of : 

    O( ( data chunk length ) / ( pattern length ) ) * ( time to do a single comparison ) = T
      or  for simplicity  
     O( n / m ) * t = T

(for the purists, O stands for Theta). 

In the world ruled by Murphy Laws, the time complexity in the best case (it exists?) becomes to look something like:

    ( T ) *  ( number of chunks ) * ( time delay of calling the parser method on chunk )  
      or
    ( T ) * ( k * d ) => ( O( n / m ) * t ) * ( k * d ) 

When the number k of chunks increases, the value  ( k * d ) becomes to have a considerable weigth in terms of time consumption; I think it's obvious that for the system calling a function 10^4 times, is an heavier job than calling it only 1 time.

However, we can do anything about reducing the number of chunks, or increase their size, it doesn't totally depend on us; on the other hand, considering that a typical parser have to do an incredible number of comparisons between chars , minimizing the time of a single comparison, obviously reduce the overall execution time.

In my parser I try to not use long *switch( .. ){ .. }* statements or a long chain of *if(..){..} else {..}*, instead of building a complex state-machine, I write a simple implementation of QuickSearch algorithm, using only high performance for-cycles, and simple char lookup tables (255 bytes nodeJS Buffer). 

The only limit in my implementation is that it doesn't support a boundary length over 254 bytes, **for now it doesn't seem a real problem with all major browsers I have tested**, they are all using a boundary totally made of ASCII chars, typically ~60bytes in length.





##TODO

 - add some other server-side security checks, and write about it
 - some code performance modifications in quickSearch.js and formaline.js
 - some code variables cleaning in formaline.js
 - change the core parser with a custom one
 - in progress..  

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
