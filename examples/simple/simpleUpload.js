var http = require( 'http' ),
    formaline = require( '../../index' ),
    connect = require( 'connect' ),
    fs = require( 'fs' ),
    server,
    log = console.log,
    dir =  '/tmp/';
    getHtmlForm = function ( req, res, next ) {
        if ( req.url === '/test/' ) {
        log( ' -> req url :', req.url );
        res.writeHead( 200, { 'content-type' : 'text/html' } );
        res.end( '<html><head>\
                 <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/> \
                 </head><body>\
                 <style type="text/css">\
                 label,input { display: block; width: 236px; float: left; margin: 2px 4px 4px 4px; }\
                 label { text-align: center; width: 110px; color: #444; background-color: #f0f0f0; border: 1px solid #a0a0a0; padding: 1px; font-size: 14px; }\
                 form { margin-bottom: 10px; border: 1px solid #b0b0b0; padding: 16px; height: 200px;}\
                 form#mufile{ width: 380px; } form#simple{ width: 380px; } form#mframe{ width: 380px; }\
                 br { clear: left;}\
                 </style>\
                 <br/>\
                 <b>Simple Url Encoded Post:</b><br/><br/>\
                 <form id="simple" action="/test/post" method="post">\
                 <label for="sfield1">simplefield1</label> <input type="text" name="simplefield1" id="sfield1"/><br/>\
                 <label for="sfield2">simplefield2</label> <input type="text" name="simplefield2" id="sfield2"/><br/>\
                 <label for="sfield3">simplefield2</label> <input type="text" name="simplefield2" id="sfield3"/><br/>\
                 <label for="sfield4">simplefield3</label> <input type="text" name="simplefield3" id="sfield4"/><br/>\
                 <label for="sfield5">simplefield3</label> <input type="text" name="simplefield3" id="sfield5"/><br/>\
                 <label for="sfield6">simplefield3</label> <input type="text" name="simplefield3" id="sfield6"/><br/>\
                 <input type="submit" value="Submit" id="submit1">\
                 </form><br/>\
                 <b>Multiple File Upload:</b><br/><br/>\
                 <form id="mufile" action="/test/upload" enctype="multipart/form-data" method="post">\
                 <label for="id1">demotitle1</label> <input type="text" name="demotitle1" id="id1"/><br/>\
                 <label for="id2">multiplefield1</label> <input type="file" name="multiplefield1" multiple="multiple" id="id2"><br/>\
                 <label for="id3">demotitle2</label> <input type="text" name="demotitle2" id="id3"><br/>\
                 <label for="id4">multiplefield2</label> <input type="file" name="multiplefield2" multiple="multiple" id="id4"><br/>\
                 <label for="id5">demotitle3</label> <input type="text" name="demotitle3" id="id5"><br/>\
                 <label for="id6">multiplefield2</label> <input type="file" name="multiplefield3" multiple="multiple" id="id6"><br/>\
                 <input type="submit" value="Upload" id="upload1"/>\
                 </form><br/>\
                 <b>Iframe Multiple File Upload:</b><br/><br/>\
                 <form id="mframe" action="/test/upload" method="post" enctype="multipart/form-data" target="iframe" >\
                 <label for="ffield1">iframefield1</label> <input type="text" name="iframefield1" id="ffield1"/><br/>\
                 <label for="ffield2">iframefile1</label> <input type="file" name="iframefile1" multiple  src="" frameborder="1" id="ffield2"/><br/>\
                 <label for="ffield3">iframefield2</label> <input type="text" name="iframefield2" id="ffield3"/><br/>\
                 <label for="ffield4">iframefile2</label> <input type="file" name="iframefile2" multiple  src="" frameborder="1" id="ffield4"/><br/>\
                 <label for="ffield5">iframefield2</label> <input type="text" name="iframefield2" id="ffield5"/><br/>\
                 <label for="ffield6">iframefile2</label> <input type="file" name="iframefile2" multiple  src="" frameborder="1" id="ffield6"/><br/>\
                 <input type="submit" value="Upload" id="upload2"/>\
                 </form>\
                 <iframe name="iframe" width="100%" height="600px"></iframe>\
                 </form>\
                 </body></html>'
            );
        } else {
            next();
        }
    },
    handleFormRequest = function ( req, res, next ) {
        var receivedFields = {},
            form = null,
            currFile = null,
            config = {
                
                    // default is false -->

                holdFilesExtensions : !false,
                
                    // specify a path, with at least a trailing slash
                    // default is /tmp/ -->
                uploadRootDir : dir,
                
                    // default is false
                    // to create and check directories existence in the sync way
                mkDirSync : false,
                
                    // retrieve session ID for creating unique upload directory for authenticated users
                    // the upload directory gets its name from the returned session identifier,
                    // and will remain the same across multiple posts ( for the authenticated user with this session identifier )
                    // this function have to return the request property that holds session id 
                    // the returned session id param, must contain a String, not a function or an object 
                    // the function takes http request as a parameter at run-time 
                
                getSessionID : function ( req ) {
                    return ( ( req.sessionID ) || ( req.sid ) || ( ( req.session && req.session.id ) ? req.session.id : null ) );
                },
                
                    // default is 120000 milliseconds ( default nodeJS timeout for connection requests )
                    // the client connection is closed after the specified milliseconds ( minimum is 100 millisecs )
                requestTimeOut : 5000, // 5 secs
                
                    // default is true
                    // when a fatal exception was thrown, the client request is resumed instead of immediately emitting 'loadend' event
                    // if false, the client request will be never resumed, the 'loadend' event will be emitted and the module doesn't handle the request anymore  
                resumeRequestOnError : true,
                
                    // default is false
                    // return sha1 digests for files received?
                    // turn off for better perfomances
                sha1sum : false,
                
                    // switch on/off 'fileprogress' event
                    // default is false
                    // it serves to monitor the progress of the file upload
                    // and also to move the data to another stream, while the file is being uploaded 
                emitFileProgress : false,
                    
                    // switch on/off 'progress' event
                    // default is false, or integer chunk factor, 
                    // every n chunk emits a dataprogress event:  1 + ( 0 * n ) 1 + ( 1 * n ), 1 + ( 2 * n ), 1 + ( 3 * n ), 
                    // minimum factor value is 2 
                emitProgress : false, // 3, 10, 100
                
                    // max bytes allowed for file uploads ( multipart/form-data ), it is a writing threshold, this is the max size of bytes written to disk before stopping
                uploadThreshold : 1024 * 1024 * 1024 ,// bytes
                
                    // max bytes allowed for serialized fields, it limits the parsing of data received with serialized fields ( x-www-urlencoded ) 
                    // when it was exceeded, no data was returned 
                serialzedFieldThreshold : 1024 * 1024 * 1024,
               
                    // max bytes allowed for a single file
                maxFileSize : 1024 * 1024 * 1024, // bytes, default 1GB
                
                    // default is false, bypass content-length header value ( it must be present, otherwise an 'error'->'header' will be emitted ), 
                    // also if it exceeds max allowable bytes; the module continues to write to disk until |uploadThreshold| bytes are written. 
                    // if true ->  when headers content length exceeds uploadThreshold, module stops to receive data
                checkContentLength : false,
                    
                    // default is false
                    // remove file not completed due to uploadThreshold, 
                    // if true formaline emit fileremoved event, 
                    // otherwise return a path array of incomplete files 
                removeIncompleteFiles : false,
                
                    // default is 'debug:off,1:on,2:on,3:off,4:off,console:on,file:off,record:off';
                    // enable various logging levels
                    // it is possible to switch on/off one or more levels at the same time
                    // debug: 'off' turn off logging
                    // file: 'on' --> create a log file in the current upload directory with the same name and .log extension
                    // console: 'off' --> disable console log output 
                    // record: 'on' --> record binary data from client request
                    // See the Readme!
                logging : 'debug:on,1:on,2:off,3:off,4:off,console:on,file:off,record:off', // <-- turn off 2nd level to see only warnings, and parser overall results
                
                    // listeners
                listeners : {
                    'message' : function ( json ) {
                    },
                    'error' : function ( json ) { // json:{ type: '..', isupload: true/false , msg: '..', fatal: true/false }
                    },
                    'abort' : function ( json ) {   
                    },
                    'timeout' : function ( json ) {   
                    },
                    'loadstart' : function ( json ){
                    },
                    'fileprogress' : function ( json, payload ) { 
                        // json is the same for 'load' event ( when a file was received, see Readme ) , 
                        // 'payload' is a binary Buffer
                        // you can direct the data payload to another stream, while the file is being uploaded
                        /** /
                        if( currFile === null ) {
                          currFile = new fs.WriteStream( json.value.path + '*' );
                        }
                        currFile.write( payload );
                        /**/
                    },
                    'progress' : function ( json ) {                              
                    },
                    'load' : function ( json ){
                        currFile = null;
                    },
                    'loadend' : function ( json, res, cback ) {
                        log( '\n\033[1;32mPost Done..\033[0m' );
                        // log( '\n JSON -> \n', json, '\n' );
                        res.writeHead( 200, { 'content-type' : 'text/plain' } );
                        res.write( '-> ' + new Date() + '\n' );
                        res.write( '-> request processed! \n' );   
                        res.write( '\n-> stats -> ' + JSON.stringify( json.stats, null, 4 ) + '\n' );
                        res.write( '\n Initial Configuration : ' + JSON.stringify( form.initialConfig, function ( key, value ) {
                            if ( typeof value === 'function' ) {
                                return '..';
                            } 
                            return value;
                        }, 4 ) + '\n' );

                        res.write( '\n-> fields received: [ { .. } , { .. } ] \n   ****************\n' + JSON.stringify( json.fields, null, 1 ) + '\n' );
                        res.write( '\n-> files written: [ { .. } , { .. } ] \n   **************\n ' + JSON.stringify( json.files, null, 1 ) + '\n' );
                        if ( form.removeIncompleteFiles ) {
                            res.write( '\n-> partially written ( removed ): [ { .. } , { .. } ] \n   *****************\n'+ JSON.stringify( json.incomplete, null, 1 ) + '\n' );
                        } else {
                            if ( json.incomplete.length !== 0 ) {
                                res.write( '\n-> partially written ( not removed ): \n   *****************\n' + JSON.stringify( json.incomplete, null, 1 ) + '\n' );
                            }
                        }
                        res.end();
                        try {
                            cback();
                        } catch ( err ) {
                            log( 'error', err.stack );
                        }
                    }
                }
            }; //end config obj
                            
        if ( ( req.url === '/test/upload' ) || ( req.url === '/test/post' ) ) {
            log( ' -> req url :', req.url );
            form = new formaline( config ) ;
            form.parse( req, res, hi );
        } else {
            if ( req.url === '/favicon.ico' ) { // short-circuit annoying favicon requests
                res.writeHead( 200, { 'Content-Type' : 'image/x-icon' } );
                res.end();
            } else {
                log( ' -> req url 404 error :', req.url );    
                res.writeHead( 404, { 'content-type' : 'text/plain' } );
                res.end( '404' );
            }
        }
    },
    hi = function () {
        form = null;
        console.log( '\n\033[1;33mHi!, I\'m the callback function!\033[0m' );
    };

server = connect( getHtmlForm , handleFormRequest );

server.listen( 3000 );

log();
log( ' ->\033[1m started at: \033[32m' + new Date() + '\033[0m' );
log( ' ->\033[1m listening on: \033[36mhttp://localhost:3000/\033[0m' );
log( ' ->\033[1m upload directory is: \033[31m' + dir + '\033[0m' );


