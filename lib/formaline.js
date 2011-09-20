/*!
 * formaline
 * Copyright(c) 2011 Guglielmo Ferri <44gatti@gmail.com>
 * MIT Licensed
 */

/**
 * Library version 0.6.4
 */

exports.version = '0.6.4';

var fs = require( 'fs' ),
    crypto = require( 'crypto' ),
    emitter = require( 'events' ).EventEmitter,
    querystring = require( 'querystring' ),
    path = require( 'path' ),
    parser  = require( './quickParser' ),
    emptyFn = function () {},
    dummyFn = function () { 
        return ( function () { return this[ 0 ]; } ).bind( arguments ); 
    },
    apply = function ( obj, config, force ) {
        if ( obj && config && typeof config == 'object' ) {
            for ( var param in config ) {
                if ( ( typeof obj[ param ] !== 'undefined' ) || ( force ) ) { // apply only if property already exists in constructor or force    
                    obj [ param ] = config[ param ];
                }
            }
        }
        return obj;
    },
    setDebuggingLevel = function ( dstring, form ) {
        var p = '', 
            dlevels = querystring.parse( "debug:off,1:on,2:on,3:off,4,off,file:off,console:on,record:off", ',', ':' ),
            rlog, hlog, fpath, rpath, hpath, recordRequest,
            flog, fileLogging,
            cc = {
                black  : '\033[0;30m', dgray   : '\033[1;30m',
                lgray  : '\033[0;37m', white   : '\033[1;37m',
                blue   : '\033[0;34m', lblue   : '\033[1;34m',
                green  : '\033[0;32m', lgreen  : '\033[1;32m',
                cyan   : '\033[0;36m', lcyan   : '\033[1;36m',
                red    : '\033[0;31m', lred    : '\033[1;31m',
                purple : '\033[0;35m', lpurple : '\033[1;35m',
                brown  : '\033[0;33m', yellow  : '\033[1;33m',
                nc     : '\033[0m'
            },
            dc =  { 0 : 'white', 1 : 'cyan', 2 : 'yellow', 3 : 'purple', 4 : 'dgray' };
            flog = rlog = hlog = fpath = rpath = hpath = null;
            filelogging = recordRequest = false;  
        if( dstring ){
            try{
              p = querystring.parse( dstring, ',', ':' );
              dlevels = p;
              filelogging = ( dlevels[ 'file' ] === 'on' );
              recordRequest = ( dlevels[ 'record' ] === 'on' );
            } catch ( err ) {
                console.log( 'formaline.setDebuggingLevel(): config string parse error ->', err.message );
            }
        }
        if ( filelogging || recordRequest ) {
            form.on( 'startlogging', function ( req ) {
                var fname = path.basename( form.uploadRootDir ).replace( '/', '' ),
                    ok = ( dlevels[ 3 ] === 'on' ) && ( dlevels.debug === 'on' );
                if ( filelogging ) {
                    fpath = form.uploadRootDir + form.startTime + '.' + fname + '.req.debug.log';
                    flog = new fs.WriteStream( fpath );

                }
                if ( recordRequest ) {
                    rpath = form.uploadRootDir + form.startTime + '.' + fname + '.req.payload.bin';
                    hpath = form.uploadRootDir + form.startTime + '.' + fname + '.req.headers.json';
                    rlog = new fs.WriteStream( rpath );
                    hlog = new fs.WriteStream( hpath );
                    hlog.end( JSON.stringify( form.req.headers, null, 4 ) );
                    
                    req.on( 'data', function ( chunk ) {
                        rlog.write( chunk );
                    } );
                    if ( req.complete || form.firstChunk !== null ) {
                        rlog.write( form.firstChunk );
                    }
                }
            } );
            form.on( 'stoplogging', function ( req ) {
                if ( filelogging ) {
                    if ( flog ) { 
                        flog.end();
                        flog.destroySoon();
                    }
                    flog = fpath = null;
                }
                if ( recordRequest ) {
                    if ( rlog ) { 
                        rlog.end();
                        rlog.destroySoon();
                    }
                    rpath = rlog = hlog = null;
                }
            } );
        }
        return function () {
            if ( dlevels.debug === 'off' ) { return; }
            var args = Array.prototype.slice.call( arguments ), // convert to array
                level = args [ 0 ],
                date = null; // req = form.req, client = req.client;
            if ( typeof level === 'number' ) {
                if ( ( level === 0 ) || ( dlevels[ level ] === 'on' ) ) {
                    if ( filelogging && flog ) {
                        args.slice( 1, args.length ).forEach( function ( v, i, a ) {
                            date = ( i=== 0 ) ? ( '[ ' + new Date().toISOString() + ' ]: ' ) : '' ; // + ' ] - [ ' + client.remoteAddress + ':' + client.remotePort + ' ] -> [ ' + req.headers.host+ ' ]: ' ) : '';
                            if ( typeof v === 'object' ){
                                flog.write( ( date + JSON.stringify( v ) ).replace( /\u001b\[(\d;)*\d+m/g, '' ) );
                            } else {
                                flog.write( ( date + v ).replace( /\u001b\[(\d;)*\d+m/g, '' ) );
                            }
                            if ( i === a.length - 1 ) {
                                flog.write('\n'); 
                            } 
                        } );
                    }
                    if ( dlevels[ 'console' ] === 'on' ) {
                        var sargs = args.slice( 1, args.length );
                        sargs.unshift( cc[ dc[ level ] ] );
                        sargs.push( '\033[0m' );
                        return console.log.apply( this, sargs );
                    }
                }
            } else {
                if ( dlevels[ 'console' ] === 'on' ) {
                    return console.log.apply( this, args );
                }
            }
        };
    },
    formaline = function ( config ) {
        emitter.call( this, [] );
        var me = this,
            initialConfig = {},
            //config default params
            defaultCfg = { 
                uploadRootDir : '/tmp/',
                emitFileProgress : false,
                emitProgress : false,
                uploadThreshold : 1024 * 1024 * 1024, // bytes
                maxFileSize : 1024 * 1024 * 1024,
                checkContentLength : false,
                removeIncompleteFiles : false,
                holdFilesExtensions : false,
                serialzedFieldThreshold : 1024 * 1024 * 1024,
                sha1sum : false,
                listeners : {},
                logging : 'debug:off,1:on,2:on,3:off,4:off,file:off,console:on,record:off',
                getSessionID : null, // <> undefined!! apply function doesn't work on undefined values
                requestTimeOut : 120000, // default for socket timeout
                resumeRequestOnError : true,
                mkDirSync : false
            },
            privateCfg = {
                chunksReceived : 0,
                bytesReceived : 0,
                endResults : null,
                fileStream : null,
                fileSize : 0,
                parserOverallTime : 0,
                boundString : '',
                boundBuffer : null,
                qsBuffer : '',
                chopped : false,
                bytesWrittenToDisk : 0,
                completedFiles : [],
                incompleteFiles : [],
                incompleteFilesCollection : { list : [], hash : {} },
                receivedFilesCollection : { list : [], hash : {} },
                receivedFieldsCollection : { list : [], hash : {} },
                maxSizeExceeded : false,
                startTime : 0,
                endTime : 0,
                req : null,
                res : null,
                sid : null,
                firstChunk : null, // needed for ASYNC
                choppedHeadersPrefix : null,
                qkp : null // quick parser instance
            };
            
        if( config && ( typeof config === 'object' ) ) {
            apply( apply( initialConfig, defaultCfg, true ), config, true );
            apply( me, apply( apply( defaultCfg, config ), privateCfg, true ), true );
            ( function () {
                var e, l = me.listeners;
                for ( e in l ) {
                    if ( typeof l[ e ] === 'function' ) {
                        me.on( e, l[ e ] );
                    } // else{ me.on( p, emptyFn ); }
                }
            } )();
        } else {
            apply( initialConfig, defaultCfg, true );
            apply( me, apply( defaultCfg, privateCfg, true ) , true );
        }
        me.logger = setDebuggingLevel( me.logging, me );
        me.requestTimeOut = ( me.requestTimeOut <= 100 ) ? 100 : me.requestTimeOut;
        me.initialConfig = initialConfig;
    };

formaline.prototype.__proto__ = emitter.prototype;


fproto = formaline.prototype;


fproto.emitEvent = function ( type, obj, logLevel, payload ) {
    var me = this,
        err = ( type.indexOf( 'exception' ) > - 1 ) ? true : false,
        etype = ( type === 'aborted' ) ? 'abort' : type;
    me.logger( logLevel, '\033[1;33mformaline, event \033[0m\033[7;3' + ( ( err || ( ( etype === 'abort' ) || ( etype === 'timeout' ) ) ) ? '1' : '2' ) + 'm"' + etype + '" --> \033[0m\033[0;33m', JSON.stringify( obj ), '\033[0m' );
    if ( err ) {
        // exception event
        obj.type = type.replace( 'exception', '' );
        me.emit( 'error', obj );
        if ( obj.fatal === true ) {
              if ( me.req && me.resumeRequestOnError ) {
                // on fatal exceptions resuming request and removing all 'data' event listeners 
                me.req.removeAllListeners( 'data' );
                me.req.resume();
            } else {
                // TODO add current completed / incomplete files
                me.emit( 'loadend', { stats : {}, incomplete : [], files : [] }, me.res, me.next );
            }
        }
    } else if ( type === 'loadend' ) {
          me.emit( 'stoplogging' );
          me.emit( 'loadend', obj, me.res, me.next );
    } else {
        if ( payload ) {
            me.emit( etype, obj, payload );
        } else {
            me.emit( etype, obj );
        }
    }

};


fproto.parse = function ( req, res, next ) {
    var me = this;
    me.startTime = Date.now();
    me.req = req;
    me.res = res;
    me.next = ( next && ( typeof next === 'function' ) ) ? next : emptyFn;
    
    me.req.socket.setTimeout( me.requestTimeOut );
    
    // needed for ASYNC
    me.firstChunk = null;
    req.on( 'data', function ( chunk ) { 
        me.firstChunk = chunk; 
        req.pause();
    } );

    var hs = req.headers,
        bytes2Receive = 0,
        clength = hs[ 'content-length' ],
        ctype = hs[ 'content-type' ],
        isUpload =  ( ctype && ( ~ctype.indexOf( 'multipart/form-data' ) ) ) ? true : false ,
        isUrlEncoded = ( ctype && ( ~ctype.indexOf( 'urlencoded' ) ) ) ? true : false ,
        jsonFatalErr = { isupload : isUpload, msg : '', fatal : true },
        jsonWarnErr = { type : 'warning', isupload : isUpload, msg : '' },
        jsonWarnEmptyRequest = { type : 'warning', isupload : isUpload, msg : 'Failed to parse request data . Request was empty or already completed .' },
        
        /** INNER METHODS **/
        
        getProgressEmitter = function ( headerContentLength ) {
            var dProgress = me.emitProgress,
                bytesExpected = headerContentLength,
                ratio = ( bytesExpected && ( bytesExpected > 1 ) ) ? function ( bytes ) { var b = bytes / bytesExpected; return ( ( b <= 1 ) ? b : 1 ).toFixed( 8 ); } : dummyFn( -1 );
            if ( dProgress === true ) {
                return function ( isEnd ) {
                    me.emitEvent( 'progress', { bytes: me.bytesReceived, chunks: me.chunksReceived, ratio: ratio( me.bytesReceived) }, 4 );
                };
            } else if ( typeof dProgress === 'number' ) {
                dProgress = parseInt( dProgress, 10 );
                if ( dProgress < 2 ){ dProgress = 2; }
                    return function ( isEnd ) {
                        if ( ( ( me.chunksReceived % dProgress ) === 1 ) || isEnd ) { // mod 1 is for first chunk
                           me.emitEvent( 'progress', { bytes : me.bytesReceived, chunks : me.chunksReceived, ratio : ratio( me.bytesReceived ) }, 4 );
                        }
                    };
            } else {
                return emptyFn;
            }
        },
    
        validatePostSize = function ( expected, isUpload ) {
            var jsonPostWarn = { type : 'warning', isupload : isUpload, msg : '' };
            if ( expected > me.uploadThreshold ) { 
                if ( me.checkContentLength === true ) {
                    return false;
                }
                jsonPostWarn.msg = 'invalid content-length header, bytes to receive : ' + expected  + ', bytes allowed : ' + me.uploadThreshold;
                me.emitEvent( 'message', jsonPostWarn, 1 );
            }
            return true;
        },
        
        retrieveSessionIdentifier = function () { 
            var jsonSessWarn = { type : 'warning', isupload : isUpload, msg : '' };
            try {
                if ( typeof me.getSessionID === 'function' ) {
                    var sessionID = me.getSessionID( me.req );
                    if ( typeof sessionID !== 'string' ) {
                        jsonSessWarn.msg = 'unable to retrieve session identifier, function getSessionID( req ) does not return a String!' ;
                        me.emitEvent( 'message', jsonSessWarn, 1 );
                    } else {
                        //TODO security checks, escaping chars, sessionID string length?
                        me.logger( 2, 'formaline, a session ID string was found : \033[7;33m"' + sessionID + '"\033[0m' );
                        return sessionID;
                    }
                } else {
                    jsonSessWarn.msg = 'unable to retrieve session identifier, configuration parameter me.getSessionID must be a function!' ;
                    me.emitEvent( 'message', jsonSessWarn, 1 );
                }  
              } catch ( serr ) {
                  jsonSessWarn.msg = 'unable to retrieve session identifier : ' + serr.stack ;      
                  return null;
              }
              return null; // sid doesn't exist
        },
        
        getUploadSubDirectoryName = function () {
            // if session id exists, returns it
            // otherwise returns a random number name
            return ( me.sid ) ? ( me.sid ) : ( parseInt( Date.now() * ( 1 + Math.random() ) * 10 * 32, 10 ) );
        },
        
        createUploadDir = function ( cback ) {
            var mkSubDir = function ( exists ) {
                if ( ! exists ) {
                    fs.mkdir( me.uploadRootDir, '0750', function ( dirErr ) {
                        if ( dirErr ){
                            jsonFatalErr.path = me.uploadRootDir;
                            jsonFatalErr.msg = 'directory creation exception : "' + me.uploadRootDir + '", ' + dirErr.message;
                            me.emitEvent( 'mkdirexception', jsonFatalErr, 0 );
                            return;
                        } else {
                           ( typeof cback === 'function' ) ? cback() : startParsing();
                        }
                    } );
                } else {
                    // subdir already exists !
                    me.logger( 3, 'formaline, upload subdirectory already exists : "' + me.uploadRootDir + '"' );
                    ( typeof cback === 'function' ) ? cback() : startParsing();
                }
            };
            path.exists( me.uploadRootDir, function ( exists ) {
                if ( exists ) {
                    me.logger( 3, 'formaline, upload root dir exists: "' + me.uploadRootDir + '"' );
                    me.uploadRootDir = me.uploadRootDir + getUploadSubDirectoryName() + '/' ;
                    path.exists( me.uploadRootDir, mkSubDir );
                } else {
                    // uploadRootDir doesn't exist
                    if ( me.uploadRootDir === '/tmp/' ) {
                        // exception
                        jsonFatalErr.path = me.uploadRootDir;
                        jsonFatalErr.msg = 'default upload root directory : "'+ me.uploadRootDir + '" does not exist ! ';
                        me.emitEvent( 'pathexception', jsonFatalErr, 0 );
                        return;
                    } else {
                        // try default root directory '/tmp/'
                        jsonWarnErr.msg = 'upload root directory specified : "' + me.uploadRootDir + '" does not exist ! ';
                        me.emitEvent( 'message', jsonWarnErr, 1 );
                        path.exists( '/tmp/', function ( exists ) {
                            if ( exists ) {
                                jsonWarnErr.msg = 'switched to default root directory for uploads : "' + '/tmp/' + '"';
                                me.emitEvent( 'message', jsonWarnErr, 1 );
                                me.uploadRootDir = '/tmp/' + getUploadSubDirectoryName() + '/';
                                path.exists( me.uploadRootDir, mkSubDir );
                            } else {
                                // exception
                                jsonFatalErr.msg = 'default upload root directory : "'+ '/tmp/' + '" does not exist ! ';
                                me.emitEvent( 'pathexception', jsonFatalErr, 0 );
                                return;
                            }
                        } );
                    }
                }
                } );
        },

        createUploadDirSync = function ( cback ) {
            if ( path.existsSync( me.uploadRootDir ) ) {
                me.logger( 3, 'formaline, upload root dir exists : "' + me.uploadRootDir + '"' );
                me.uploadRootDir = me.uploadRootDir + getUploadSubDirectoryName() + '/'; 
            } else { 
                // uploadRootDir doesn't exist
                if ( me.uploadRootDir === '/tmp/' ) {
                    // exception
                    jsonFatalErr.msg = 'default upload root directory : "'+ me.uploadRootDir + '" does not exist ! ';
                    me.emitEvent( 'pathexception', jsonFatalErr, 0 );
                    return;
                } else {
                    // try default root directory '/tmp/'
                    jsonWarnErr.msg = 'upload root directory specified : "' + me.uploadRootDir + '" does not exist ! ';
                    me.emitEvent( 'message', jsonWarnErr, 1 );
                    if ( path.existsSync( '/tmp/' ) ) {
                        jsonWarnErr.msg = 'switched to default root directory for uploads : "' + '/tmp/' + '"';
                        me.emitEvent( 'message', jsonWarnErr, 1 );
                        me.uploadRootDir = '/tmp/' + getUploadSubDirectoryName() + '/';
                    } else {
                        // exception
                        jsonFatalErr.msg = 'default upload root directory : "'+ '/tmp/' + '" does not exist ! ';
                        me.emitEvent( 'pathexception', jsonFatalErr, 0 );
                        return;
                    }
                }
            }
            if ( ! path.existsSync( me.uploadRootDir ) ) { // if subdirectory doesn't already exist, create it
                 try {
                     fs.mkdirSync( me.uploadRootDir, '0750' );
                 } catch ( dirErr ) {
                     jsonFatalErr.msg = 'directory creation exception : "' + me.uploadRootDir + '", ' + dirErr.message;
                     me.emitEvent( 'mkdirexception', jsonFatalErr, 0 );
                     return;
                 }
            } else {
                // subdir already exists !
                me.logger( 3, 'formaline, upload subdirectory already exists : "' + me.uploadRootDir + '"' );
            }
            ( typeof cback === 'function' ) ? cback() : startParsing();
        },
        
        startParsing = function () {
            req.removeAllListeners( 'data' ); // not move from here!
            me.emit( 'startlogging', req ); 
            me.progress = getProgressEmitter( clength );
            if ( isUpload ) { 
                try {
                    me.boundString = ctype.match( /boundary=([^;]+)/mi )[ 1 ];
                } catch ( berr ) { 
                    // if boundary isn't defined and type is multipart/form-data, 
                    // it could be a custom, not standard compliant, XHR request
                    jsonFatalErr.msg = 'req.headers[..]: the multipart/form-data request is not HTTP-compliant, boundary string wasn\'t found..';
                    me.emitEvent( 'headersexception', jsonFatalErr, 0 );
                    return;
                }
            }
            me.logger( 1, '\033[7;36mformaline, HTTP Request Headers\033[0m\033[1;35m : ' + JSON.stringify( me.req.headers, null, 4 ) + '\033[0m');
            if ( clength ) {
                try {
                    bytes2Receive = parseInt( clength, 10 );
                } catch ( parseIntError ) {
                   jsonFatalErr.msg = 'req.headers[ content-length ]: '+ parseIntError + ', length value:' + clength;
                   me.emitEvent( 'headersexception', jsonFatalErr, 0 );
                   return;
                }
                if ( ! validatePostSize( bytes2Receive, isUpload ) ) {
                    jsonFatalErr.msg = 'req.headers[ content-length ] exceeds max allowable : ' + bytes2Receive + ' > ' + me.uploadThreshold;
                    me.emitEvent( 'headersexception', jsonFatalErr, 0 );
                    return;
                }
            } else {
                jsonFatalErr.msg =  'req.headers[ content-length ] not found : Parse Length Error';
                me.emitEvent( 'headersexception', jsonFatalErr, 0 );
                return;
            }
            if ( ctype ) {
                ( function () {
                    onClose = me.closeConnection.bind( me );
                    if ( isUpload ) {
                        // multipart form data
                        me.boundBuffer = new Buffer( '--' + me.boundString );
                        onData = me.parseMultipartData.bind( me );
                        onEnd = me.sendResponseToMultipart.bind( me );
                    } else if ( isUrlEncoded ) {
                        // seralized fields
                        onData = me.parseUrlEncodedData.bind( me );
                        onEnd = me.sendResponseToUrlEncoded.bind( me );
                    } else {
                        jsonFatalErr.msg = 'req.headers[ content-type ] --> ' + ctype + ' handler for this kind of request is not defined';
                        me.emitEvent( 'headersexception', jsonFatalErr, 0 );
                        return;
                    }
                    req.on( 'close', onClose );
                    req.on( 'data', onData );
                    req.on( 'end', onEnd );
                    if ( req.complete ) {
                        if ( me.firstChunk !== null ) { 
                            onData( me.firstChunk, onEnd );
                        } else { 
                            // empty or completed request !
                            // notify it  and send response
                            me.emitEvent( 'message', jsonWarnEmptyRequest, 1 );
                            onEnd();
                        }
                     } else {
                        if ( me.firstChunk !== null ) {
                           onData( me.firstChunk );
                           me.firstChunk = null;
                        }
                     }
                } ) ();
            } else {
                jsonFatalErr.msg = 'req.headers[ content-type ] not found : Parse Type Error';
                me.emitEvent( 'headersexception', jsonFatalErr, 0 );
                return;
            }
        };
        
    /** END INNER METHODS **/
        
    if ( ( req ) && ( typeof req === 'object' ) && ( req.body === undefined ) && ( req.method === 'POST' || req.method === 'PUT' )  && ( hs ) ) {
        me.sid = retrieveSessionIdentifier();
        if( me.mkDirSync ) {
            me.logger( 1, '\033[7;36mformaline, You have choosen to create and check directories in the sync way.\033[0m');
            createUploadDirSync(); // the default callback is startParsing
        } else {
            createUploadDir(); // the default callback is startParsing
        }
    } else {
        jsonFatalErr.msg = 'req.headers[..] not found, or HTTP method not handled';
        me.emitEvent( 'headersexception', jsonFatalErr, 0 );
        return;
    }
}; // end parse


fproto.closeConnection = function( cerr ){
    if ( cerr ) {
        var me = this,
            file = me.fileStream,
            jsonConnectionErr = { isupload : ( file ) ? true : false, msg : '', fatal : true },
            emsg = 'connection event: ' + '"' + cerr.code + '" : ' + cerr.message + ( ( cerr.code === 'timeout' ) ? ( ', max millisecs : ' + me.requestTimeOut ) : '' );
            emsg += ', error stack: ' + cerr.stack;
        jsonConnectionErr.msg = emsg;
        
        me.req.removeAllListeners( 'data' );
        
        if ( file ) {
            var jsonWarnIncomplete = { type : 'warning', isupload : true, msg : '' };
            
            if( me.incompleteFiles.indexOf( file.path ) < 0 ){
                var jsonIncompleteFile = {
                    name : file.fieldname,
                    value : {
                        name : file.origname,
                        path : file.path,
                        type : file.ctype,
                        size : me.fileSize,
                        lastModifiedDate : file.mtime,
                        sha1checksum : null
                    }
                };
                me.incompleteFilesCollection[ path.basename( file.path ) ] = jsonIncompleteFile; 
                        
                me.incompleteFiles.push( file.path );
                me.incompleteFilesCollection.list.push( jsonIncompleteFile );

                if( typeof me.incompleteFilesCollection.hash[ file.fieldname ] !== 'object' ){
                    me.incompleteFilesCollection.hash[ file.fieldname ] = [];
                }
                me.incompleteFilesCollection.hash[ file.fieldname ].push( jsonIncompleteFile.value );
                      
                jsonWarnIncomplete.msg = 'request aborted ot timed out, last file is incomplete: ' + path.basename( file.path ) ;
                me.emitEvent( 'message', jsonWarnIncomplete, 1 );
            }
            if ( ( cerr.code === 'aborted' ) || ( cerr.code === 'timeout' ) ) {
                me.emitEvent( cerr.code , jsonConnectionErr, 0 ); 
                me.sendResponseToMultipart( ( me.req.headers ) ? me.req.headers[ 'content-length' ] : 0 );
            }
        } else {
            if ( ( cerr.code === 'aborted' ) || ( cerr.code === 'timeout' ) ) {
              me.emitEvent( cerr.code , jsonConnectionErr, 0 ); 
              me.sendResponseToUrlEncoded();
            }
        }
    }
};


fproto.parseUrlEncodedData = function( chunk, cback ){
    var me = this,
        stime =  Date.now();
    me.req.resume();
    me.bytesReceived += chunk.length;
    if( ++me.chunksReceived === 1 ){
        me.emitEvent( 'loadstart', { time : stime }, 2 );
    }
    me.logger( 3, 'formaline, ( application/x-www-form-urlencoded ) chunk --> ' + JSON.stringify( { index : me.chunksReceived, bytes : chunk.length, received : me.bytesReceived } ) );
    if ( me.bytesReceived <= me.serialzedFieldThreshold ) { 
        me.qsBuffer += chunk.toString( 'utf8' );
    } else {
        if ( ! me.maxSizeExceeded ) {
            me.maxSizeExceeded = true;
            var jsonWarnIncomplete = { type : 'warning', isupload : false, msg : '' };
            jsonWarnIncomplete.msg = 'the max upload data threshold for serialzed fields was exceeded, bytes allowed : ' + me.serialzedFieldThreshold  +', received : ' + me.bytesReceived;
            me.emitEvent( 'message', jsonWarnIncomplete, 1 );
        }
    }
    ( typeof cback === 'function' ) ? cback() : emptyFn;
};


fproto.sendResponseToUrlEncoded = function () {
    var me = this,
        fields = querystring.parse( me.qsBuffer, '&', '=' );
    me.endTime = Date.now();
    
    if ( me.qsBuffer && me.qsBuffer.length > 0 ) {
        for ( var f in fields ) {
            var jsonFieldReceived = { name: f, value: ( typeof fields[ f ] === 'object' ) ? fields[ f ] : [ fields[ f ] ] };
            me.receivedFieldsCollection.list.push( jsonFieldReceived );
            me.emitEvent( 'load', jsonFieldReceived, 2 );
        }
    }
    me.endResults = {
        startTime : me.startTime,
        endTime : me.endTime,
        overallSecs : ( me.endTime - me.startTime ) / 1000,
        bytesReceived : me.bytesReceived,
        chunksReceived : me.chunksReceived,
        fieldsParsed :  me.receivedFieldsCollection.list.length
    };
    me.bytesReceived = me.chunksReceived = 0;
    me.maxSizeExceeded = false;
    me.emitEvent( 'loadend', { stats : me.endResults, incomplete : [], files : [], fields : me.receivedFieldsCollection.list }, 2 ); 
};
            

fproto.parseMultipartData = function ( chunk, cback ) {
    var me = this,
        bb = me.boundBuffer,
        bblength = bb.length,
        emsg = '',
        jsonMultiPartErr = { isupload : true, msg : '', fatal : true },
        escapeChars = /[\\\[\]\(\)\{\}\/\\\|\!\:\=\?\*\+\^\$\<\>\%\:\,\`\s\t\r\n]/g, // TODO check
        fileDataChunk = null,
        wok = false,
        cok = false,
        results = null,
        resultsLength = 0,
        stime = null,
        etime = null,
         // for chopped headers
        hchunk = null,
        cprefix = me.choppedHeadersPrefix,
        cprefixLen = ( cprefix ) ? cprefix.length : null,
        chunkLength = chunk.length,
        // parser
        qkp = me.qkp;
    
    me.req.pause();
    me.logger( 3, '\033[0;32mformaline, new data chunk received, request paused ..\033[0m ' );
    
    // only one parser instance
    me.qkp = ( qkp ) ? ( qkp ) : new parser.quickParser( me.boundBuffer );
    qkp = me.qkp;
    
    if ( cprefix ) {
        me.logger( 3, 'chopped headers: '+ cprefix );
        hchunk = new Buffer( chunkLength + cprefixLen );
        cprefix.copy( hchunk, 0, 0 );
        chunk.copy( hchunk, cprefixLen, 0 );
        chunk = hchunk;
    }
    
    stime =  Date.now();
    results = qkp.parse( chunk );
    etime = Date.now();
    resultsLength = results.length;
    
    me.parserOverallTime += ( etime - stime );    
    me.bytesReceived += chunkLength;
    me.choppedHeadersPrefix = null;
    
    if( ++me.chunksReceived === 1 ){
        me.emitEvent( 'loadstart', { time : stime }, 2 );
    }
    
    me.progress();
    
    /** INNER METHODS**/
    
    var writeToFileStream = function ( dataPayload, cfg ) {
            try {
                if ( dataPayload ) {
                    me.fileStream.write( dataPayload );
                    me.fileStream.mtime = new Date(); // it is quite accurate when file data were received in only one chunk
                    me.logger( 3, '\033[0;37mformaline, new data were written to this file stream  --> \033[0;34m', me.fileStream.path, '\033[0m' );
                    ( me.sha1sum ) ? me.fileStream.sha1sum.update( dataPayload ) : null;
                    me.fileSize += dataPayload.length;
                    me.bytesWrittenToDisk += dataPayload.length;
                    if ( me.emitFileProgress ) {
                        var file = me.fileStream, 
                            jsonFileProgression = {
                                name : file.fieldname,
                                value : { 
                                    name : file.origname, 
                                    path : file.path,
                                    type : file.ctype, 
                                    size : me.fileSize,
                                    lastModifiedDate : file.mtime,
                                    sha1checksum : null
                                }
                            };
                        me.emitEvent( 'fileprogress', jsonFileProgression, 4, dataPayload );
                    }
                } else {
                    if ( cfg && cfg.path ) {
                        me.fileStream = new fs.WriteStream( cfg.path );
                        me.fileSize = 0;
                        apply( me.fileStream, cfg, true );
                        fs.watchFile( cfg.path, function ( curr, prev ) {
                            if ( me.fileStream ) {
                                me.fileStream.mtime = curr.mtime;
                            }
                        } );
                        me.logger( 3, '\033[7;37mformaline, a new file stream was created --> \033[0;34m', me.fileStream.path, '\033[0m' );
                    } else {
                        // TODO add cfg error for path
                    }
                }  
            } catch ( fserr ) {
                emsg = 'writing file stream : ' + me.fileStream + ', err: ' + fserr.message ;
                emsg +=  ', error stack: ' + fserr.stack;
                jsonMultiPartErr.msg = emsg;
                me.emitEvent( 'streamexception', jsonMultiPartErr, 0 );
                return false;
            }
            return true;
        },
    
        copyBuffer = function ( sourceBuffer, targetBuffer, tStart, dStart, dEnd ) {
            try {
                sourceBuffer.copy( targetBuffer, tStart, dStart, dEnd );
            } catch ( berr ) {
                emsg = 'copying buffer data file: ' + berr.message;
                emsg += 'boundary length:' + bblength + '\nchunk length:' + sourceBuffer.length;
                emsg += 'result:' + result + '\n results length:' + resultsLength + '\n buffer start index:' + ( 0 ) + '\n buffer end index: ' + ( targetBuffer.length - 1 ) + '\n target buffer length: ' + targetBuffer.length;
                emsg +=  ', error stack: ' + berr.stack;
                jsonMultiPartErr.msg = emsg;
                me.emitEvent( 'bufferexception', jsonMultiPartErr, 0 );
                return false; 
            }
            return true;
        },
        
        addToIncompleteList = function( file ){
            var jsonWarnIncomplete = { type : 'warning', isupload : true, msg : '' };
            if ( me.incompleteFiles.indexOf( file.path ) < 0 ) {
                var jsonIncompleteFile = {
                    name : file.fieldname,
                    value : {
                        name : file.origname,
                        path : file.path,
                        type : file.ctype,
                        size : me.fileSize,
                        lastModifiedDate : file.mtime,
                        sha1checksum : null
                    }
                };
                me.incompleteFilesCollection[ path.basename( file.path ) ] = jsonIncompleteFile; 
                
                me.incompleteFiles.push( file.path );
                me.incompleteFilesCollection.list.push( jsonIncompleteFile );

                if ( typeof me.incompleteFilesCollection.hash[ file.fieldname ] !== 'object' ) {
                    me.incompleteFilesCollection.hash[ file.fieldname ] = [];
                }
                me.incompleteFilesCollection.hash[ file.fieldname ].push( jsonIncompleteFile.value );
                
                jsonWarnIncomplete.msg = 'the upload threshold or the max file size was exceeded, file incomplete: ' + path.basename( file.path ) ;
                me.emitEvent( 'message', jsonWarnIncomplete, 1 );
            }
        },
        
        addToCompletedList = function ( file ) {
            var filedatasha1sum = ( ( me.sha1sum ) ? file.sha1sum.digest( 'hex' ) : undefined ),
                jsonReceivedFile = {
                    name : file.fieldname,
                    value : { 
                        name : file.origname, 
                        path : file.path,
                        type : file.ctype, 
                        size : me.fileSize,
                        lastModifiedDate : file.mtime,
                        sha1checksum : ( filedatasha1sum ) ? filedatasha1sum : null                   
                    }
                };
            me.completedFiles.push( file.path );
            me.receivedFilesCollection.list.push( jsonReceivedFile );
            
            if ( typeof me.receivedFilesCollection.hash[ file.fieldname ] !== 'object' ) {
                me.receivedFilesCollection.hash[ file.fieldname ] = [];
            }
            me.receivedFilesCollection.hash[ file.fieldname ].push( jsonReceivedFile.value );
            
            me.emitEvent( 'load', jsonReceivedFile, 2 );
        },

        closeFileStream = function ( fstream ) {
            me.maxSizeExceeded = false;
            fstream.end();
            fs.unwatchFile( fstream.path );
            me.logger( 3, 'formaline, this file stream was closed -->', fstream.path );
        },
        
        resetFileStream = function () {
            me.fileStream = null;
        },
        
        generateHashFileName = function ( fname ) {
            return ( crypto.createHash( 'sha1' ).update( fname ).digest( 'hex' ) + ( ( me.holdFilesExtensions ) ? path.extname( fname ) : '' ) );
        },
        
        checkSize = function ( buffer ) {
            if ( ( me.maxSizeExceeded ) || ( me.maxFileSize < me.fileSize + buffer.length ) ) {
                if ( !me.maxSizeExceeded ) {
                    me.maxSizeExceeded = true;
                }
                return false;
            }
            return true;
        };
    
    /** END INNER METHODS**/

    me.logger( 3, 'formaline, ( multipart/form-data ) chunk --> ' + JSON.stringify( { index :  me.chunksReceived, bytes : chunk.length,  results : results } ) );
   

    if ( me.bytesReceived <= me.uploadThreshold ) { // is size allowed? 
        if ( me.fileStream ) {
            if ( me.chopped ) { // fileStream exists, file data is chopped
                if ( resultsLength === 0 ) { // chunk is only data payload
                    me.logger( 3, 'formaline, <-- this chunk contains only data.. bytes written to disk: ' + me.bytesWrittenToDisk );
                     if ( checkSize( chunk ) ) {
                        wok = writeToFileStream( chunk );
                        if ( ! wok ) {
                            // TODO
                            addToIncompleteList( me.fileStream );    
                            return; 
                        }
                    }
                } else {
                    // chunk contains other boundaries, the first result.start value is the end ( - crlf ) of previous data chunk
                    me.logger( 3, 'formaline, <-- this chunk contains data and fields.. current bytes written to disk: ' + me.bytesWrittenToDisk );
                    fileDataChunk = new Buffer( results[ 0 ].start - 2 ); // last two chars are CRLF                  
                    if ( ! checkSize( fileDataChunk ) ) {
                        addToIncompleteList( me.fileStream );
                    } else {
                        if ( ( fileDataChunk.length > 0 ) && ( me.bytesWrittenToDisk + fileDataChunk.length < me.uploadThreshold ) ) {
                            me.logger( 3, 'formaline, <-- data part from the previous chopped file, bytes: ' + fileDataChunk.length + ', result[ 0 ] <> 0 :', results[ 0 ] );
                            cok = copyBuffer( chunk, fileDataChunk, 0, 0, results[ 0 ].start - 2 );
                            
                            wok = writeToFileStream( fileDataChunk );
                            if ( ! wok || ! cok ) {
                                // TODO
                                addToIncompleteList( me.fileStream );    
                                return; 
                            }
                        }
                        addToCompletedList( me.fileStream );                
                    }                    
                    closeFileStream( me.fileStream );
                    resetFileStream( me.fileStream );
                }
            } else {
                closeFileStream( me.fileStream );
                addToIncompleteList( me.fileStream );
                resetFileStream( me.fileStream );
            }
        } else {
          // TODO fileStream error
        }
    } else {
        if ( !me.maxSizeExceeded ) {
            me.maxSizeExceeded = true;
            if ( me.fileStream ) {
                addToIncompleteList( me.fileStream );
            }
        }
    }
    me.logger( 3, 'formaline, parser results length --> ' + resultsLength + ', chunk #: ' + me.chunksReceived );
    for ( var i = 0; i < resultsLength; i++ ) {
        var result = results[ i ],
            rfinish = result.finish,
            rstart = result.start,
            headers = null,
            heads = new Buffer( ( rfinish ) - ( rstart + bblength + 2 ) ), // only the headers
            hbsize = ( ( rfinish + 4 ) < ( chunk.length ) ? ( rfinish + 4 ) : ( chunk.length ) ),
            hbuffer = new Buffer( hbsize - rstart ),
            hok = false,
            tbuff = null,
            crlfcrlf = '\r\n\r\n',
            fieldName = null,
            contentType = null,
            fieldCtype = null,
            jsonWarnFileExists = { type : 'warning', isupload : true, msg : '' },
            endBoundary = '--' + me.boundString + '--',
            fileName = null,
            escapedFilename = null,
            sha1filename = null,
            filepath = null,
            fileseed = null;
            
        me.logger( 3, 'formaline, parsing headers, result #' + i, ': ', result, ', chunk #: ' + me.chunksReceived );     
                                    
        if ( rfinish > rstart + bblength + 2 ) {
            cok = copyBuffer( chunk, heads, 0, rstart + bblength + 2,  ( rfinish > chunk.length - 1 ) ? ( chunk.length - 1 ) : rfinish ); 
            if ( ! cok ){ 
                // TODO
                return; 
            }
        } else {
            me.logger( 3, 'formaline, seems that the end of request was reached, end payload index: ' + rfinish + ', start payload index: ' + ( rstart + bblength + 2 ) );
        } 

        chunk.copy( hbuffer, 0, rstart, hbsize );
        hok = ( hbuffer.toString().match( crlfcrlf ) !== null );
        
        me.logger( 3, 'formaline, chunk #' + me.chunksReceived + ', cycle: ' + i + ', results[' + i + ']:', results[i], ' -> interval: ( ' + rfinish +', ' + chunk.length + ' ), crlfcrlf: ' + ( ( hok ) ? 'ok' : 'not found' ) );   
        me.logger( 3, '\033[0;36mformaline, headers received (*..*) -> \n\033[0;34m*' + hbuffer.toString() + '*\033[0m' );
        
        if ( ! hok ) { // the last result contains chopped headers
            tbuff = new Buffer( chunk.length - rstart );
            chunk.copy( tbuff, 0, rstart );
            if ( tbuff.toString().indexOf( endBoundary ) === -1 ) {
                // headers are chopped in two different chunks
                me.logger( 3, ' <-- no field name was found.. headers are chopped between two chunks: *' + tbuff.toString() + '*' );
                me.choppedHeadersPrefix = tbuff;
                continue;
            } else {
                me.logger( 3, '\033[7;31mformaline, <-- end of the request reached\033[0m' );
                break;
            }
        }
        
        headers = heads.toString(); // TODO move heads here, minify code
        fieldName = headers.match( /name="([^\"]+)"/mi );
        
        if ( fieldName ) {
            fileName = headers.match( /filename="([^\"]+)"/mi );
            contentType  = headers.match( /Content-Type: ([^;]+)/mi ); // check space after header
            fieldCtype = ( contentType && contentType[ 1 ] ) ? contentType[ 1 ] : 'application/octet-stream';
            
            me.logger( 3, 'formaline, a field name was parsed --> : ', fieldName[ 1 ] ); // , '\n' );
            
            if ( fileName ) { // file field
                
                escapedFilename = fileName[ 1 ].replace( escapeChars, '' );
                sha1filename = generateHashFileName( escapedFilename );
                filepath = me.uploadRootDir + sha1filename;
                fileseed = '';
                
                me.logger( 3, 'formaline, a file name was parsed --> : ', fileName[ 1 ] );
                
                if ( ( me.completedFiles.indexOf( filepath ) > -1 )  || ( me.incompleteFiles.indexOf( filepath ) > -1 ) ) { 
                    fileseed = Date.now();
                    filepath = me.uploadRootDir + generateHashFileName( fileseed + '_' + escapedFilename );
                    jsonWarnFileExists.msg = 'this (sha1) file name already exists --> ' + sha1filename + ', ( filename: ' + escapedFilename + ', fieldname: ' + fieldName[ 1 ] + ' )';
                    me.emitEvent( 'message', jsonWarnFileExists, 1 );
                }
                // create new fileStream
                wok = writeToFileStream( null, {
                    path : filepath,
                    ctype : fieldCtype,
                    fieldname : fieldName[ 1 ],
                    origname : escapedFilename,
                    sha1sum : ( me.sha1sum ) ? crypto.createHash( 'sha1' ) : null,
                    mtime : '',
                    seed : fileseed
                });
                if ( ! wok ) {
                    // TODO
                    return; 
                }
                
                if ( i === resultsLength - 1 ) { // last result
                    if ( rfinish < chunkLength - 2 ) { // - "--", there is no boundary at the end of chunk, it is chopped data
                        me.logger( 3, 'formaline, last data result -->', results[ i ], '<-- is chopped' );
                        me.chopped = true;
                        if ( me.fileStream ) {
                            if ( me.bytesReceived <= me.uploadThreshold ) {
                                if ( chunkLength >= rfinish + 4 ) {
                                    fileDataChunk = new Buffer( chunkLength - ( rfinish + 4  ) );
                                    if ( !checkSize( fileDataChunk ) ) {
                                        addToIncompleteList( me.fileStream );
                                    } else {           
                                        cok = copyBuffer( chunk, fileDataChunk, 0, rfinish + 4, chunkLength );                 
                                        wok = writeToFileStream( fileDataChunk );
                                        if ( ! wok || ! cok ) { 
                                            // TODO
                                            addToIncompleteList( me.fileStream );    
                                            return; 
                                        }
                                    }
                                }
                            } else {
                                addToIncompleteList( me.fileStream );
                            }
                        }
                    }
                } else {
                    if ( me.fileStream ) {
                        fileDataChunk = new Buffer( results[ i + 1 ].start - 2 - ( results[ i ].finish + 4 ) ); // + 4 ( CRLFCRLF ) 
                        if ( !checkSize( fileDataChunk) ) {
                            addToIncompleteList( me.fileStream );
                        } else {
                            if ( me.bytesWrittenToDisk + fileDataChunk.length < me.uploadThreshold ) {
                                cok = copyBuffer( chunk, fileDataChunk, 0, results[ i ].finish + 4 , results[ i + 1 ].start - 2 );
                                wok = writeToFileStream( fileDataChunk );
                                if ( ! wok || ! cok ) {
                                    // TODO
                                    addToIncompleteList( me.fileStream );    
                                    return;
                                }
                            } else {
                                addToIncompleteList( me.fileStream );
                            }
                            if ( ( me.fileSize >= 0 ) && ( me.incompleteFiles.indexOf( me.fileStream.path ) < 0 ) ) {
                                addToCompletedList( me.fileStream );
                            }
                        }
                        closeFileStream( me.fileStream );
                        resetFileStream();
                    }
                }
            } else { // normal field
                if ( i < resultsLength - 1 ) {
                    fileDataChunk = new Buffer( results[ i + 1 ].start - 2   - ( results[ i ].finish + 4 ) ); // + 4 ( CRLFCRLF )
                    cok = copyBuffer( chunk, fileDataChunk, 0, results[ i ].finish + 4 , results[ i + 1 ].start - 2 );
                    if ( ! cok ) { return; }
                    var jsonFieldReceived = { 
                        name : fieldName[ 1 ], 
                        value : fileDataChunk.toString() 
                    };
                    me.receivedFieldsCollection.list.push( jsonFieldReceived );
                    if ( typeof me.receivedFieldsCollection.hash[ fieldName[ 1 ] ] !== 'object' ) {
                        me.receivedFieldsCollection.hash[ fieldName[ 1 ] ] = [];
                    }
                    me.receivedFieldsCollection.hash[ fieldName[ 1 ] ].push( jsonFieldReceived.value );

                    me.emitEvent( 'load', jsonFieldReceived, 2 );
                }
            }
        } // end if
    } // end for
    me.logger( 3, '\033[0;32mformaline, resuming request ..\033[0m' ); // TODO remove from last call ?
    me.req.resume();
    
    ( typeof cback === 'function' ) ? cback() : emptyFn ;
};


fproto.sendResponseToMultipart = function () {
    var me = this;
    me.endTime = Date.now();
    var logParserStats = function () {
            me.logger( 1, '<------------------------------------------------>' );
            me.logger( 1, ' (°)--/PARSER_STATS/ ' );
            me.logger( 1, '  |                          ' );
            me.logger( 1, '  |- overall parsing time    :', ( me.parserOverallTime / 1000 ).toFixed( 4 ), 'secs ' );            
            me.logger( 1, '  |- chunks received         :', me.chunksReceived ) ;
            me.logger( 1, '  |- average chunk rate      :', ( ( me.chunksReceived ) / ( me.parserOverallTime / 1000 ) ).toFixed( 1 ), 'chunk/sec' );
            me.logger( 1, '  |- average chunk size      :', ( ( me.bytesReceived / 1024 ) / me.chunksReceived ).toFixed( 3 ), 'KBytes' );            
            me.logger( 1, '  |- data parsed             :', ( me.bytesReceived / ( 1024 * 1024 ) ).toFixed( 4 ), 'MBytes' );
            me.logger( 1, '  |- average data rate       :', ( ( me.bytesReceived / ( 1024 * 1024 ) ) / ( me.parserOverallTime / 1000 ) ).toFixed( 1 ), 'MBytes/sec' );
            me.logger( 1, '  |' );
            
        },
    
        logOverallResults = function ( updateEndTime ) {
            if( updateEndTime === true ){
                me.endTime = Date.now();
            }
            me.logger( 1, ' (°)--/POST_OVERALL_RESULTS/ ');
            me.logger( 1, '  |                          ');
            me.logger( 1, '  |- overall time            :', ( ( me.endTime - me.startTime ) / 1000 ), 'secs' );
            me.logger( 1, '  |- bytes allowed           :', ( me.uploadThreshold / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes');            
            me.logger( 1, '  |- data received           :', ( me.bytesReceived / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes' );
            me.logger( 1, '  |- data written to disk    :', ( me.bytesWrittenToDisk  / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes' );
            me.logger( 1, '  |- average throughput      :', ( me.bytesReceived / ( 131.072 ) / ( me.endTime - me.startTime ) ) .toFixed( 3 ), 'Mbit/s' );
            me.logger( 1, '  |- completed files         :', me.completedFiles.length );
            me.logger( 1, '  |- ' + ( ( me.removeIncompleteFiles ) ? 'removed files           :' : 'partially written files :' ), me.incompleteFiles.length );
            me.logger( 1, '<------------------------------------------------>\n' );

        },
    
        resetAttributes = function () {
            me.chunksReceived = 0;
            me.bytesReceived = 0;
            me.bytesWrittenToDisk = 0;
            me.fileStream = null;
            me.boundString = null;
            me.boundBuffer = null;
            me.uploadRootDir = '';
            me.uploadThreshold = 0;
            me.maxFileSize = 0;
            me.parserOverallTime = 0;
            me.chopped = false;
            me.fileSize = 0;
            me.incompleteFilesCollection = { list : [] };
            me.receivedFilesCollection = { list : [] };
            me.receivedFieldsCollection = { list : [] };
        },
        
        sendResponse = function( json ) {
                logParserStats();
                logOverallResults();
                me.emitEvent( 'loadend', json, 2 );
                resetAttributes();
        },
        
        groupResultsByFieldName = function ( hash ) {
            var arr = [];
            for ( var h in hash ){
                arr.push( { name : h, value : hash[ h ] } );
            }
            return arr;
        }, 
        
        removeFile = function ( file, last ) {
            fs.unlink( file, function ( err ) {
                if ( err ) {
                    var jsonWarnUnlink = { type : 'warning', isupload : true, msg : '' };
                        jsonWarnUnlink.msg = 'file unlink exception:' + file + ', directory: ' + me.uploadRootDir;
                    me.emitEvent( 'message', jsonWarnUnlink, 1 );
                } else {
                    var ifile = me.incompleteFilesCollection[ path.basename( file ) ],
                        fvalue = ifile.value,
                        jsonFileRemoved = { type : 'fileremoved', isupload : true, msg : 'a file was removed, json: ' };
                        jsonFileRemoved.msg += JSON.stringify( {
                            name : ifile.name,
                            value : {
                                name : fvalue.name,
                                path : file,
                                type : fvalue.type,
                                size : fvalue.rbytes,
                                lastModifiedDate : fvalue.mtime || '',
                                sha1checksum : 'not calculated'
                            }
                        } );
                    me.emitEvent( 'message', jsonFileRemoved, 1 );
                }
                if ( last ) {
                    sendResponse( { 
                        stats : me.endResults, 
                        incomplete : groupResultsByFieldName( me.incompleteFilesCollection.hash ),
                        files : groupResultsByFieldName( me.receivedFilesCollection.hash ),
                        fields : me.receivedFieldsCollection.list
                    } );
                }
            } );
        };
    
    me.endResults = {
        startTime : me.startTime,
        endTime : me.endTime,
        overallSecs : ( me.endTime - me.startTime ) / 1000,
        bytesReceived : me.bytesReceived,
        bytesWrittenToDisk : me.bytesWrittenToDisk,
        chunksReceived : me.chunksReceived,
        filesCompleted : me.completedFiles.length
    };
    
    ( me.removeIncompleteFiles ) ? me.endResults.removedFiles = me.incompleteFilesCollection.list.length : ( me.endResults.partialFiles = me.incompleteFilesCollection.list.length );
    
    if ( me.removeIncompleteFiles === false ) {
        sendResponse( {
            files : groupResultsByFieldName( me.receivedFilesCollection.hash ),
            incomplete : groupResultsByFieldName( me.incompleteFilesCollection.hash ),
            fields : me.receivedFieldsCollection.hash,
            stats : me.endResults
        } );
    } else {
        if ( me.incompleteFilesCollection.list.length === 0 ) {
            sendResponse( {
                stats : me.endResults,
                incomplete : [],
                files : groupResultsByFieldName( me.receivedFilesCollection.hash ),
                fields : me.receivedFieldsCollection.hash
            } );
        } else {
            for ( var i = 0,  ufile = me.incompleteFilesCollection.list, len = ufile.length, currfile = ufile[ 0 ].value.path; i < len; i++, currfile = ( ufile[i] ) ? ( ufile[ i ].value.path  ) : null ) {
                removeFile( currfile, i === len - 1 );
            }
        }
    }
}; // end sendResponseToMultipart


exports.formaline = formaline;
// exports.parse = formaline;
