

var http = require( 'http' ),
    formaline = require( '../../lib/formaline' ).formaline,
    connect = require( 'connect' ),
    server,
    log = console.log,
    dir =  '/tmp/';
    getHtmlForm = function( req, res, next ) {
        if (req.url === '/test/') {
        log( ' -> req url :', req.url );
        res.writeHead( 200, { 'content-type': 'text/html' } );
        res.end( '<html><head></head><body>\
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
    handleFormRequest = function( req, res, next ){
        var receivedFields = {},
            form = null,
            config = {
                
                    // default is false -->
                holdFilesExtensions : true,
                
                    // specify a path, with at least a trailing slash
                    // default is /tmp/ -->
                uploadRootDir: dir,
                
                    // retrieve session ID for creating unique upload directory for authenticated users
                    // the upload directory gets its name from the returned session identifier,
                    // and will remain the same across multiple posts ( for the authenticated user with this session identifier )
                    // this function have to return the request property that holds session id 
                    // the returned session id param, must contain a String, not a function or an object 
                    // the function takes http request as a parameter at run-time 
                getSessionID: function( req ){ 
                    return ( ( req.sessionID ) || ( req.sid ) || ( ( req.session && req.session.id ) ? req.session.id : null ) );
                },
                
                    // default is 120000 milliseconds ( default nodeJS timeout for connection requests )
                    // the client connection is closed after the specified milliseconds ( minimum is 100 millisecs )
                requestTimeOut : 5000, // 5 secs
                
                    // default is true
                    // when a fatal exception was thrown, the client request is resumed instead of immediately emitting 'loadend' event
                    // if false, the client request will be never resumed, the 'loadend' event will be emitted and the module doesn't handle the request anymore  
                resumeRequestOnError: true,
                
                    // default is false
                    // return sha1 digests for files received?
                    // turn off for better perfomances
                sha1sum: false,
                
                    // default is false, or integer chunk factor, 
                    // every n chunk emits a dataprogress event:  1 + ( 0 * n ) 1 + ( 1 * n ), 1 + ( 2 * n ), 1 + ( 3 * n ), 
                    // minimum factor value is 2 
                emitProgress: !false, // 3, 10, 100
                
                    // max bytes allowed for file uploads ( multipart/form-data ), it is a writing threshold, this is the max size of bytes written to disk before stopping
                uploadThreshold:  1024 * 1024 * 1024 ,// bytes
                
                    // max bytes allowed for serialized fields, it limits the parsing of data received with serialized fields ( x-www-urlencoded ) 
                    // when it was exceeded, no data was returned 
                serialzedFieldThreshold: 1024 * 1024 * 1024,
               
                    // max bytes allowed for a single file
                maxFileSize: 1024 * 1024 * 1024, // bytes, default 1GB
                
                    // default is false, bypass content-length header value ( it must be present, otherwise an 'error'->'header' will be emitted ), 
                    // also if it exceeds max allowable bytes; the module continues to write to disk until |uploadThreshold| bytes are written. 
                    // if true ->  when headers content length exceeds uploadThreshold, module stops to receive data
                checkContentLength: false,
                    
                    // default is false
                    // remove file not completed due to uploadThreshold, 
                    // if true formaline emit fileremoved event, 
                    // otherwise return a path array of incomplete files 
                removeIncompleteFiles : !false,
                
                    // default is 'debug:on,1:on,2:on,3:off,console:on,file:off,record:off';
                    // enable various logging levels
                    // it is possible to switch on/off one or more levels at the same time
                    // debug: 'off' turn off logging
                    // file: 'on' --> create a log file in the current upload directory with the same name and .log extension
                    // console: 'off' --> disable console log output 
                    // record: 'on' --> record binary data from client request
                logging: 'debug:on,1:on,2:on,3:on,4:off,console:on,file:on,record:on', // <-- turn off 2nd level to see only warnings, and parser overall results
                
                    // listeners
                listeners: {
                    'message':function( json ){
                    },
                    'error': function( json ){ // json:{ type: '..', isupload: true/false , msg: '..', fatal: true/false }
                    },
                    'abort': function( json ) {   
                    },
                    'timeout': function( json ) {   
                    },
                    'loadstart': function( json ){
                    },
                    'progress': function( json ) {                              
                    },
                    'load': function( json ){
                    },
                    'loadend': function( json, res, next ) {
                        log( '\nPost Done.. ' );
                        // log( '\n JSON -> \n', json, '\n' );
                        res.writeHead( 200, { 'content-type': 'text/plain' } );
                        res.write( '-> ' + new Date() + '\n' );
                        res.write( '-> request processed! \n' );   
                        res.write( '\n-> stats -> ' + JSON.stringify( json.stats ) + '\n' );
                        res.write( '\n-> upload dir: ' + form.uploadRootDir + ' \n' );
                        res.write( '-> upload threshold : ' + ( form.uploadThreshold ) + ' bytes \n' );
                        res.write( '-> maxFileSize: ' + form.maxFileSize + ' bytes \n' );
                        res.write( '-> serialzedFieldThreshold: ' + form.serialzedFieldThreshold + ' bytes \n' );
                        res.write( '-> checkContentLength: ' + form.checkContentLength + '\n' );
                        res.write( '-> holdFilesExtensions: ' + form.holdFilesExtensions + '\n' );
                        res.write( '-> sha1sum: ' + form.sha1sum + '\n');
                        res.write( '-> removeIncompleteFiles: ' + form.removeIncompleteFiles + '\n' );
                        res.write( '-> emitProgress: ' + form.emitProgress + '\n' );
                        res.write( '-> resumeRequestOnError: ' + form.resumeRequestOnError + '\n' );
                        res.write( '-> request timeout: ' + form.requestTimeOut + ' millisecs\n' );
                        res.write( '-> logging: "' + form.logging + '"\n' );
                                                
                        res.write( '\n-> fields received: [ { .. } , { .. } ] \n   ****************\n' + JSON.stringify( json.fields ) + '\n' );
                        res.write( '\n-> files written: [ { .. } , { .. } ] \n   **************\n ' + JSON.stringify( json.files ) + '\n' );
                        if( form.removeIncompleteFiles ){
                            res.write( '\n-> partially written ( removed ): [ { .. } , { .. } ] \n   *****************\n'+ JSON.stringify( json.incomplete ) + '\n' );
                        }else{
                            if( json.incomplete.length !== 0 ){
                                res.write( '\n-> partially written ( not removed ): \n   *****************\n' + JSON.stringify( json.incomplete ) + '\n' );
                            }
                        }
                        res.end();
                        next(); // test callback 
                    }
                }
            };//end config obj
                            
        if ( ( req.url === '/test/upload' ) || ( req.url === '/test/post' ) ){
            log( ' -> req url :', req.url );
            form = new formaline( config ) ;
            form.parse( req, res, next );
      
        } else {
            log( ' -> req url 404 error :', req.url );    
            res.writeHead( 404, { 'content-type': 'text/plain' } );
            res.end( '404' );
        }
};

server = connect( getHtmlForm , handleFormRequest, function(){ form = null; console.log( '\nHi!, I\'m the next() callback function!' ); } );

server.listen( 3000 );

log(  '\n -> ' + new Date() );
log( ' -> listening on http://localhost:3000/' );
log( ' -> upload directory is:', dir );


