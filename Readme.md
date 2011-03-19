# formaline

 formaline is a new (node.js) module for handling simple form posts and for fast parsing of file uploads,
 it is ready (I think) for integration with connect.js  

## Installation
     
with npm:
    $ npm install formaline

with git:
    $ git clone git://github.com/rootslab/formaline.git

for using node and apache together, a way is to enable apache *mod-proxy* and add this lines to your apache virtualhost:

    ProxyPass /test/ http://localhost:3000/test/
    ProxyPassReverse /test/ http://localhost:3000/test/

change the path and the port with yours

## Features

 - Works!
 - It is possible to create instances via configuration object
 - Useful configuration parameters ( like listeners, maxBytes, auto remove of incomplete files.. )
 - Fluid exceptions handling
 - Many events for total control of parsing flow 
 - Very Fast and Simple Parser (see parser-benchmarks)
 - It is possible to preserve or auto-remove incomplete files upload, due to exceeding of max bytes limit 
 - It is possible to easily integrate with connect.js

 etc..


##A note about Parsing Data Rate vs Network Bandwidth
 

Overall parsing data-rate depends on many factors, it is generally possible to reach 700 MB/s and more ( searching a basic ~60 bytes boundary string, like Firefox uses ) with a *real* data Buffer totally loaded in RAM, but in my opinion, this parsing test emulates more a network with an high-level bandwidth and low-level latency, than a real case. 

Unfortunately, sending data over the cloud is sometime a long-time task, the data is chunked, and the chunk size may change because of underneath TCP flow control ( typically >~ 40K, <~ 1024K ). Now, the point is that the parser is called for every chunk of data received, the total delay of calling the method becomes more perceptible with a lot of chunks. 

In the world of fairies, a super-fast Booyer-Moore parser reaches an order of time complexity of : 
    O((data length)/(pattern length)) 

In the world ruled by Murphy Laws, the time complexity becomes to look something like:
    O(dlength/plength) * (number of chunks) * (delay of calling the parser method)
When the number of chunks increases, calling the parser is not a light job if it implies to call closures, read a long switch statement or a long chain of if(..){..} else {..}. 

That's the reason why I decide to write a simple and fast implementation of the QuickSearch algorithm for my parser, instead of building a complex state-machine; I have used only high performance for-cycles, and simple char lookup tables (255 bytes Buffer). 

The limit in this implementation is that it doesn't support a boundary length over 254 bytes, for now it doesn't seem a real problem, all major browsers I have tested, are using a boundary totally made of ASCII chars, and of ~60bytes in length.


## Usage

*module usage:*

    var formaline = require('formaline');

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
            'filereceived': function ( filename, filedir, ctype, filesize, formfield ) {
                ...
            },
            'fileremoved': function ( filename, filedir, ctype, filesize, formfield ) {
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


 - examples directory for seeing formaline in action. 
 - parser-benchmarks directory for testing algorithm parsing speed (wow). 
 

## About File Creation 
 
When a file is founded in the data stream:
 
 - this is directly writed to disk chunk per chunk, until end of file is reached.
 - a directory with random numeric name is created, as child of root dir specified via configuration object (default is /tmp/); 
   that assures no file name collisions for every different post.
 - when two files with the same name are uploaded through the same form post action, the file that causes the collision is renamed with a prefix equal to current time in millis; 
   for example: two files with the same name *hello.jpg*, the first one is received and writed to disk with its original name, 
   the second one is received but its name causes a collision and it is writed to disk but with a name something like *1300465416185_hello.jpg*. 
   It assures that the first file is not overwritten.
 - when a file reaches the max bytes allowed:
   - if removeIncompleteFiles = true : it is auto removed and a event 'fileremoved' is emitted with this params -> filename, filedir, ctype, filesize, formfield
   - else it is kept in the filesystem, and a list of files, in the form of an array of paths, are passed to callback specified for 'end' event.
 - when a file is totally received a 'filereceived' is emitted with these params -> filename, filedir, ctype, filesize, formfield
 
 in progress..

## About Parser  

 in progress..

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
