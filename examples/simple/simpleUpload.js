

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
                 <b>Multiple File Upload:</b><br/><br/>\
                 <form action="/test/upload" enctype="multipart/form-data" method="post">\
                 <input type="text" name="demotitle1"/><br/>\
                 <input type="file" name="multiplefield1" multiple="multiple"><br/>\
                 <input type="text" name="demotitle2"><br/>\
                 <input type="file" name="multiplefield2" multiple="multiple"><br/>\
                 <input type="text" name="demotitle3"/><br/>\
                 <input type="file" name="multiplefield3" multiple="multiple"><br/>\
                 <input type="submit" value="Upload"/>\
                 </form><br/>\
                 <b>Simple Post:</b><br/><br/>\
                 <form action="/test/post" method="post">\
                 <input type="text" name="simplefield1"/><br/>\
                 <input type="text" name="simplefield2"/><br/>\
                 <input type="text" name="simplefield2"/><br/>\
                 <input type="text" name="simplefield3"/><br/>\
                 <input type="text" name="simplefield3"/><br/>\
                 <input type="text" name="simplefield3"/><br/>\
                 <input type="submit" value="Submit">\
                 </form><br/>\
                 <b>Iframe Multiple File Upload:</b><br/><br/>\
                 <form action="/test/upload" method="post" enctype="multipart/form-data" target="iframe">\
                 <input type="text" name="iframefield1"/><br/>\
                 <input type="file" name="iframefile1" multiple  src="" frameborder="1" /><br/>\
                 <input type="text" name="iframefield"/><br/>\
                 <input type="file" name="iframefile2" multiple  src="" frameborder="1" /><br/>\
                 <input type="submit" />\
                 </form>\
                 <iframe name="iframe" width="100%" height="400px"></iframe>\
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
                
                    // default is true -->
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
                    // when a fatal exception was thrown, the client request is resumed instead of immediately emitting 'end' event
                    // if false, the client request will be never resumed, the 'end' event will be emitted and the module doesn't handle the request anymore  
                resumeRequestOnError: true,
                
                    // default is false
                    // return sha1 digests for files received?  
                sha1sum: true,
                
                    // default is false, or integer chunk factor, 
                    // every n chunk emits a dataprogress event:  1 + ( 0 * n ) 1 + ( 1 * n ), 1 + ( 2 * n ), 1 + ( 3 * n ), 
                    // minimum factor value is 2 
                emitProgress: false, // 3, 10, 100
                
                    // max bytes allowed, this is the max bytes written to disk before stop to write 
                    // this is also true for serialzed fields not only for files upload 
                uploadThreshold: 1024 * 1024 * 1024 ,//* 1024, // bytes ex.: 1024*1024*1024, 512
                
                    // default is false, bypass headers value, continue to write to disk 
                    // until uploadThreshold bytes are written. 
                    // if true -> stop receiving data, when headers content length exceeds uploadThreshold
                checkContentLength: false,
                    
                    // default is true
                    // remove file not completed due to uploadThreshold, 
                    // if true formaline emit fileremoved event, 
                    // otherwise return a path array of incomplete files 
                removeIncompleteFiles : true,
                
                    // default is 'debug:off,1:on,2:on,3:off';
                    // enable various logging levels
                    // it is possible to switch on/off one or more levels at the same time
                    // debug: 'off' turn off logging
                logging: 'debug:on,1:on,2:off,3:off', // <-- turn off 2nd level to see only warnings, and parser overall results
                
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
                        log( '\n-> Post Done' );
                        res.writeHead( 200, { 'content-type': 'text/plain' } );
                        res.write( '-> ' + new Date() + '\n' );
                        res.write( '-> request processed! \n' );   
                        res.write( '\n-> stats -> ' + JSON.stringify( json.stats ) + '\n' );
                        res.write( '\n-> upload dir: ' + form.uploadRootDir + ' \n' );
                        res.write( '-> upload threshold : ' + ( form.uploadThreshold ) + ' bytes \n' );
                        res.write( '-> checkContentLength: ' + form.checkContentLength + '\n' );
                        res.write( '-> holdFilesExtensions: ' + form.holdFilesExtensions + '\n' );
                        res.write( '-> sha1sum: ' + form.sha1sum + '\n');
                        res.write( '-> removeIncompleteFiles: ' + form.removeIncompleteFiles + '\n' );
                        res.write( '-> emitProgress: ' + form.emitProgress + '\n' );
                        res.write( '-> resumeRequestOnError: ' + form.resumeRequestOnError + '\n' );
                        res.write( '-> request timeout: ' + form.requestTimeOut + ' millisecs\n' );
                        res.write( '-> logging: "' + form.logging + '"\n' );
                                                
                        res.write( '\n-> fields received: [ { .. } , { .. } ] \n   ****************\n' + JSON.stringify( json.fields ) + '\n' );
                        res.write( '\n-> files received: [ { .. } , { .. } ] \n   ***************\n ' + JSON.stringify( json.files ) + '\n' );
                        if( form.removeIncompleteFiles ){
                            res.write( '\n-> files removed: [ { .. } , { .. } ] \n   **************\n '+ JSON.stringify( json.incomplete ) + '\n' );
                        }else{
                            if( json.incomplete.length !== 0 ){
                                res.write( '\n-> incomplete files (not removed): \n   ****************\n' + JSON.stringify( json.incomplete ) + '\n' );
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

log( '\nlistening on http://localhost:3000/' );
log( ' -> upload directory is:', dir );


