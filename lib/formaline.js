/*!
 * formaline
 * Copyright(c) 2011 Guglielmo Ferri <44gatti@gmail.com>
 * MIT Licensed
 */

/**
 * Library version 0.5.2
 */

exports.version = '0.5.2';

var fs = require( 'fs' ),
    crypto = require( 'crypto' ),
    emitter = require( 'events' ).EventEmitter,
    querystring = require( 'querystring' ),
    path = require( 'path' ),
    ext = require( './extensions' ),
    parser  = require( './quickSearch' );

var setDebuggingLevel = function( dstring ){
    var p, dlevels = querystring.parse( "debug:off,1:on,2:on,3:on", ',', ':' ); // debug:'on' print always : 0 level
    if( dstring ){
        try{
          p = querystring.parse( dstring, ',', ':' );
          dlevels = p;
        }catch( err ){
            console.log( 'formaline.setDebuggingLevel(): config string parse error ->', err.message );
        }
    }
    return function(){
        var args = Array.prototype.slice.call( arguments ), // convert to array
            level = args [ 0 ];
        if( dlevels.debug === 'off' ){ return; }
        if( typeof level === 'number' ){
            if( ( level === 0 ) || ( dlevels[ level ] === 'on' )){
                return console.log.apply( this, args.slice( 1, args.length ) );
            }
        }else{
            return console.log.apply( this, args );
        }
    };
};


var formaline = function ( config ){
    emitter.call( this, [] );
    
    //config default params
    this.uploadRootDir = '/tmp/';
    this.emitProgress = false;
    this.uploadThreshold = 1024 * 1024 * 1024; // bytes
    this.checkContentLength = false;
    this.removeIncompleteFiles = true;
    this.holdFilesExtensions = false;
    this.sha1sum = true;
    this.listeners = {};
    this.logging = 'debug:off,1:on,2:on,3:off';
    this.getSessionID = null; // not undefined!! apply function doesn't work on undefined values
    this.requestTimeOut = 120000; // default for socket timeout
    this.resumeRequestOnError = true; 
     
    if( config && ( typeof config === 'object' )){
        var me = this;
        apply( this, config );
        ( function(){
            var e, l = me.listeners;
            for ( e in l ) {
                if ( typeof l[ e ] === 'function' ) {
                    me.on( e, l[ e ] );
                } // else{ me.on( p, emptyFn ); }
            }
        } )();
    }
    
    // moved here for don't accidentally overwrite them with apply() ->
    this.logger = setDebuggingLevel( this.logging );
    this.chunksReceived = 0;
    this.currentChunksReceived = 0; // only for checking last chunk for data progress
    this.bytesReceived = 0;
    this.endResults = null;
    this.fileStream = null;
    this.fileSize = 0;
    this.parserOverallTime = 0;
    this.req = null;
    this.boundString = '';
    this.boundBuffer = null;
    this.qsBuffer = '';
    this.chopped = false;
    this.bytesWrittenToDisk = 0;
    this.completedFiles = [];
    this.incompleteFiles = [];
    this.incompleteFilesCollection = { list: [] };
    this.receivedFilesCollection = { list:[] };  // object properties are unique (sha1 sum filename)
    this.receivedFieldsCollection = { list:[] }; 
    this.startTime = 0;
    this.endTime = 0;
    this.req = null;
    this.res = null;
    this.sid = null;
    this.requestTimeOut = ( this.requestTimeOut <= 100 ) ? 100 : this.requestTimeOut; // normalize timeout value, minimum value is 100 millisecs
};


formaline.prototype.__proto__ = emitter.prototype;


fproto = formaline.prototype;


fproto.emitEvent = function( type, obj, logLevel ){
    //var etype = ( type === 'abortedexception' ) ? type.replace( 'edexception', '' ) : type.replace( 'exception', '' ); // transform error type string
    var etype = ( type === 'aborted' ) ? type.replace( 'aborted', 'abort' ) : type.replace( 'exception', '' ); // transform error type string
    this.logger( logLevel, '\n formaline, event: "' + etype + '" --> \n' , obj );
    if( type.indexOf( 'exception' ) > - 1 ){
        // exception event
        obj.type = etype;
        this.emit( 'error', obj );
        if( obj.fatal === true ){
              if( this.req && this.resumeRequestOnError ){ 
                // on fatal exceptions resuming request and removing 'data' event listener 
                this.req.removeAllListeners( 'data' ); 
                this.req.resume();
            }else{
                // TODO add current completed / incomplete files 
                this.emit( 'loadend', { stats: {}, incomplete: [], files: [] }, this.res, this.next );
            }
        }
    }else if( type === 'loadend' ){
          this.emit( 'loadend', obj, this.res, this.next );
    }else{
        this.emit( etype, obj );
        if( ( etype === 'abort' ) || ( etype === 'timeout' ) ){
            obj =  { stats: {}, incomplete: [], files: [] }; //TODO add current completed / incomplete files 
            this.logger( 2, '\n formaline, event: "' + 'loadend' + '" --> \n' , obj );
            this.emit( 'loadend', obj, this.res, this.next );
        }
    }
};


fproto.parse = function( req, res, next ){
    
    this.startTime = new Date().getTime();
    this.req = req;
    this.res = res;    
    this.next = ( next && ( typeof next === 'function' ) ) ? next : emptyFn;
    
    this.req.socket.setTimeout( this.requestTimeOut );
  
    var hs = req.headers,
        bytes2Receive = 0,
        clength = hs[ 'content-length' ],
        ctype = hs[ 'content-type' ],
        isUpload =  ( ctype && ( ~ctype.indexOf( 'multipart/form-data' ) ) ) ? true : false ,
        isUrlEncoded = ( ctype && ( ~ctype.indexOf( 'urlencoded' ) ) ) ? true : false ,
        
        /** INNER METHODS **/
        
        getProgressEmitter = ( function( headerContentLength ){
            var dProgress = this.emitProgress,
                bytesExpected = headerContentLength,
                ratio = ( bytesExpected && ( bytesExpected > 1 ) ) ? function( bytes ){ return ( bytes / bytesExpected ).toFixed( 8 ); } : dummyFn( -1 );
            if( dProgress === true ){
                return function( isEnd ){
                    this.emitEvent( 'progress', { bytes: this.bytesReceived, chunks: this.chunksReceived, ratio: ratio( this.bytesReceived) }, 3 );
                };
            }else if( typeof dProgress === 'number' ){
                dProgress = parseInt( dProgress, 10 );
                if( dProgress < 2 ){ dProgress = 2; }
                    return function( isEnd ) {
                        if( ( ( this.chunksReceived % dProgress ) === 1 ) || isEnd ){ // mod 1 is for first chunk
                           this.emitEvent( 'progress', { bytes: this.bytesReceived, chunks: this.chunksReceived, ratio: ratio( this.bytesReceived) }, 3 );
                        }
                    };
            }else{
                return emptyFn;
            }
        } ).bind( this ),
    
        validatePostSize = ( function( expected, isUpload ){
            var jsonPostWarn = { type: 'warning', isupload: true, msg: '' };
            this.logger( 1, '\n formaline, req.headers[ content-length ]: ' + expected + ' bytes' );
            if( expected > this.uploadThreshold ){ 
                if( this.checkContentLength === true ){
                    return false;
                }
                jsonPostWarn.msg = 'invalid content-length header, bytes to receive: ' + expected  + ', bytes allowed: ' + this.uploadThreshold;
                this.emitEvent( 'message', jsonPostWarn, 1 );
            }
            return true;
        } ).bind( this ),
        
        retrieveSessionIdentifier = ( function(){ 
            var jsonSessWarn = { type: 'warning', isupload: true, msg: '' };
            try{
                if( typeof this.getSessionID === 'function' ){
                     var sessionID = this.getSessionID( this.req );
                    if( typeof sessionID !== 'string' ){
                        jsonSessWarn.msg = 'unable to retrieve session identifier, function this.getSessionID( req ) does not return a String!' ;
                        this.emitEvent( 'message', jsonSessWarn, 1 );
                    }else{
                        //TODO security checks, escaping chars, sessionID string length?
                        this.logger( 2, '\nformaline, a session ID string was found: "' + sessionID + '"' );
                        return sessionID;
                    }
                }else{
                    jsonSessWarn.msg = 'unable to retrieve session identifier, configuration parameter this.getSessionID must be a function!' ;
                    this.emitEvent( 'message', jsonSessWarn, 1 );
                }  
              }catch( serr ){
                  JsonSessWarn.msg = 'unable to retrieve session identifier: ' + serr.stack ;      
                  return null;
              }
              return null; // sid doesn't exist
        } ).bind( this ),
        
        getUploadSubDirectoryName = ( function(){
            // is session id String exists returns it
            // otherwise returns a random number name
            return ( this.sid ) ? ( this.sid ) : ( parseInt( new Date().getTime() * ( 1 + Math.random() ) * 10 * 32, 10 ) );
        } ).bind( this );
        
        /** END INNER METHODS **/
        
    if( ( req ) && ( typeof req === 'object' ) && ( req.body === undefined ) && ( req.method === 'POST' || req.method === 'PUT' )  && ( hs ) ){
    
        var jsonFatalErr = { isupload: isUpload, msg:'', fatal: true },
            jsonWarnErr = { type: 'warning', isupload: isUpload, msg:'' };
        
        this.sid = retrieveSessionIdentifier(); 

        // TODO move dir checking and creation to async way
        if( path.existsSync( this.uploadRootDir ) ){
            this.logger( 3, '\nformaline, upload root dir exists: "' + this.uploadRootDir + '"' );
            this.uploadRootDir = this.uploadRootDir + getUploadSubDirectoryName() + '/'; 
        }else{ 
            // uploadRootDir doesn't exist
            if( this.uploadRootDir === '/tmp/' ){
                // exception
                jsonFatalErr.msg = 'default upload root directory: "'+ this.uploadRootDir + '" does not exist ! ';
                this.emitEvent( 'pathexception', jsonFatalErr, 0 );
                return;
            }else{ 
                // try default root directory '/tmp/'
                jsonWarnErr.msg = 'upload root directory specified: "' + this.uploadRootDir + '" does not exist ! ';
                this.emitEvent( 'message', jsonWarnErr, 1 );
                if( path.existsSync( '/tmp/' ) ){
                    jsonWarnErr.msg = 'switched to default root directory for uploads: "' + '/tmp/' + '"';
                    this.emitEvent( 'message', jsonWarnErr, 1 );
                    this.uploadRootDir = '/tmp/' + getUploadSubDirectoryName() + '/';
                }else{
                    // exception
                    jsonFatalErr.msg = 'default upload root directory: "'+ '/tmp/' + '" does not exist ! ';
                    this.emitEvent( 'pathexception', jsonFatalErr, 0 );
                    return;
                }
                
            }
        }
        
        if( !path.existsSync( this.uploadRootDir ) ){ // if subdirectory doesn't already exist, create it
             try{
                 fs.mkdirSync( this.uploadRootDir, '0750' );
             }catch( dirErr ){
                 jsonFatalErr.msg = 'directory creation exception: "' + this.uploadRootDir + '", ' + dirErr.message;
                 this.emitEvent( 'mkdirexception', jsonFatalErr, 0 );
                 return;
             }
        }else{
            // subdir already exists !
            this.logger( 3, '\nformaline, upload subdirectory already exists: "' + this.uploadRootDir + '"' );
        }
       
        this.progress = getProgressEmitter( clength );      
        
        if( isUpload ){ 
            try{
                this.boundString = ctype.match( /boundary=([^;]+)/mi )[ 1 ];
            }catch( berr ){ 
                // if boundary is not defined and type is multipart/form-data, 
                // it could be a custom, not standard compliant, XHR request 
                // TODO re-add customXHR
                jsonFatalErr.msg = 'req.headers[..]: the multipart/form-data request is not HTTP-compliant, boundary string wasn\'t found..';
                this.emitEvent( 'headersexception', jsonFatalErr, 0 );
                return;
            }
        }
        
        this.logger( 1, '\n formaline, parsing HTTP request headers..' );
        
        if( clength ){ 
            try{
                bytes2Receive = parseInt( clength, 10 );
            }catch(parseIntError){
               jsonFatalErr.msg = 'req.headers[ content-length ]: '+ parseIntError + ', length value:' + clength;
               this.emitEvent( 'headersexception', jsonFatalErr, 0 );
               return;
            }
            if( ! validatePostSize( bytes2Receive, isUpload ) ){
                jsonFatalErr.msg = 'req.headers[ content-length ] exceeds max allowable: ' + bytes2Receive + ' > ' + this.uploadThreshold;
                this.emitEvent( 'headersexception', jsonFatalErr, 0 );
                return;
            }
        }else{
            jsonFatalErr.msg =  'req.headers[ content-length ] not found: Parse Length Error';
            this.emitEvent( 'headersexception', jsonFatalErr, 0 );
            return;
        }
        if( ctype ){
            this.logger( 1, ' formaline, req.headers[ content-type ]: ' + ctype );
            if( isUpload ){
                // multipart form data
                this.boundBuffer = new Buffer( '--' + this.boundString );
                this.req.addListener( 'close', this.closeConnection.createDelegate( this, true, true ) );
                this.req.addListener( 'data', this.parseMultipartData.bind( this ) );
                this.req.addListener( 'end', this.sendResponseToMultipart.bind( this, clength ) );
            }else if( isUrlEncoded ){ 
                // seralized fields
                this.req.addListener( 'close', this.closeConnection.createDelegate( this, false, true ) );
                this.req.addListener( 'data', this.parseUrlEncodedData.bind( this ) );
                this.req.addListener( 'end', this.sendResponseToUrlEncoded.bind( this, clength ) );
            }else{
                jsonFatalErr.msg = 'req.headers[ content-type ] --> ' + ctype + ' handler for this kind of request is not defined';
                this.emitEvent( 'headersexception', jsonFatalErr, 0 );
                return;
            }
        }else{
            jsonFatalErr.msg = 'req.headers[ content-type ] not found: Parse Type Error';
            this.emitEvent( 'headersexception', jsonFatalErr, 0 );
            return;
        }
    }else{
        jsonFatalErr.msg = 'req.headers[..] not found, or HTTP method not handled';
        this.emitEvent( 'headersexception', jsonFatalErr, 0 );
        return;
    }

}; // end parse


fproto.closeConnection = function( cerr, isUpload ){
    var jsonConnectionErr = { isupload: isUpload, msg: '', fatal: true },
        emsg = 'connection event: ' + '"' + cerr.code + '" : ' + cerr.message + ( ( cerr.code === 'timeout' ) ? this.requestTimeOut : '' );
        emsg += ', error stack: ' + cerr.stack;
    jsonConnectionErr.msg = emsg;
    this.emitEvent( cerr.code , jsonConnectionErr, 0 );
};


fproto.parseUrlEncodedData = function( chunk ){
    this.qsBuffer += chunk.toString( 'utf8' );
};


fproto.sendResponseToUrlEncoded = function(){ // TODO add stats for fields
    var fields = querystring.parse( this.qsBuffer, '&', '=' );
    for( var f in fields ){
        var jsonFieldReceived = { name: f, value: fields[ f ] };
        this.receivedFieldsCollection.list.push( jsonFieldReceived );
        this.emitEvent( 'field', jsonFieldReceived, 2 );
    }
    this.emitEvent( 'loadend', { stats: {}, incomplete: [], completed: [], fields: this.receivedFieldsCollection.list }, 2 ); 
};
            

fproto.parseMultipartData = function( chunk ){
    this.req.pause();
    
    var bb = this.boundBuffer,
        bblength = bb.length,
        chunkLength = chunk.length,
        emsg = '',
        jsonMultiPartErr = { isupload: true, msg: '', fatal: true },
        escapeChars = /[\\\[\]\(\)\{\}\/\\\|\!\:\=\?\*\+\^\$\<\>\%\:\,\:\`\s\t\r\n]/g,
        fileDataChunk = null,
        stime =  new Date(),
        results = parser.quickSearch( bb, chunk ),
        etime = new Date(),
        resultsLength = results.length,
        wok = false,
        cok = false;       

    this.parserOverallTime += ( etime - stime );    
    this.bytesReceived += chunk.length;
    //this.chunksReceived++;
    
    if( ++this.chunksReceived === 1 ){
        this.emitEvent( 'loadstart', { time: stime.getTime() }, 2 );
    }
    
    this.progress();
    
    /** INNER METHODS**/
    
    var writeToFileStream = ( function( dataPayload, cfg ){  
            try{
                if( dataPayload ){
                    this.fileStream.write( dataPayload );
                    this.fileStream.mtime = new Date(); // it is quite accurate when file data were received in only one chunk
                    this.logger( 3, '\nformaline, new data were written to this file stream  --> ', this.fileStream.path );
                    ( this.sha1sum ) ? this.fileStream.sha1sum.update( dataPayload ) : null;
                    this.fileSize += dataPayload.length;
                    this.bytesWrittenToDisk += dataPayload.length;
                }else{
                    if( cfg && cfg.path ){
                        this.fileStream = new fs.WriteStream( cfg.path );                        
                        apply( this.fileStream, cfg, true );
                        fs.watchFile( cfg.path, ( function ( curr, prev ) {
                            if( this.fileStream ){
                               this.fileStream.mtime = curr.mtime;
                            }
                        } ).bind( this ) );
                        this.logger( 3, '\nformaline, a new file stream was created --> ', this.fileStream.path );
                    }
                }  
            }catch( fserr ){
                emsg = 'writing file stream : ' + this.fileStream + ', err: ' + fserr.message ;
                emsg +=  ', error stack: ' + fserr.stack;
                jsonMultiPartErr.msg = emsg;
                this.emitEvent( 'streamexception', jsonMultiPartErr, 0 ); 
                return false;
            }
            return true;
        } ).bind( this ),
    
        copyBuffer = ( function( sourceBuffer, targetBuffer, tStart, dStart, dEnd ){
            try{
                sourceBuffer.copy( targetBuffer, tStart, dStart, dEnd );
            }catch( berr ){
                emsg = 'copying buffer data file: ' + berr.message;
                emsg += '\nboundary length:' + bblength + '\nchunk length:' + sourceBuffer.length;
                emsg += '\nresult:' + result + '\n results length:' + resultsLength + '\n buffer start index:' + ( 0 ) + '\n buffer data end index: ' + ( targetBuffer.length - 1 ) + '\n target buffer length: ' + targetBuffer.length;
                emsg +=  ', error stack: ' + berr.stack;
                jsonMultiPartErr.msg = emsg;
                this.emitEvent( 'bufferexception', jsonMultiPartErr, 0 );
                return false; 
            }
            return true;
        } ).bind( this ),
        
        addToIncompleteList = ( function( file ){
            var jsonWarnIncomplete = { type: 'warning', isupload: true, msg:'' };
            if( this.incompleteFiles.indexOf( file.path ) < 0 ){
                var jsonIncompleteFile = {
                    name: file.fieldname,
                    value: {
                        name: file.origname,
                        path: file.path,
                        type: file.ctype,
                        rbytes: this.fileSize,
                        lastModifiedDate: file.mtime,
                        datasha1sum: 'not calculated'
                    }
                };
                this.incompleteFilesCollection[ path.basename( file.path ) ] = jsonIncompleteFile; 
                
                this.incompleteFiles.push( file.path );
                this.incompleteFilesCollection.list.push( jsonIncompleteFile );
                jsonWarnIncomplete.msg = 'upload threshold exceeded, file incomplete: ' + path.basename( file.path ) ;
                this.emitEvent( 'message', jsonWarnIncomplete, 1 );
            }
        } ).bind( this ),
        
        addToCompletedList = ( function( file ){
            var filedatasha1sum = ( ( this.sha1sum ) ? file.sha1sum.digest( 'hex' ) : undefined ),
                jsonReceivedFile = {
                    name: file.fieldname,
                    value: { 
                        name: file.origname, 
                        path: file.path,
                        type: file.ctype, 
                        size: this.fileSize,
                        lastModifiedDate: file.mtime,
                        datasha1sum: filedatasha1sum                    
                    }
                };
            this.completedFiles.push( file.path );
            this.receivedFilesCollection.list.push( jsonReceivedFile );
            this.emitEvent( 'load', jsonReceivedFile, 2 );
        } ).bind( this ),
        
        closeFileStream = ( function( fstream ){
            fstream.end();
            fs.unwatchFile( fstream.path );
            this.logger( 3, '\nformaline, this file stream was closed -->', fstream.path, '\n' );
        } ).bind( this ),
        
        resetFileStream = ( function(){
            this.fileStream = null;
        } ).bind( this ),
        
        generateHashFileName = ( function( fname ){
            return ( crypto.createHash( 'sha1' ).update( fname ).digest( 'hex' ) + ( ( this.holdFilesExtensions ) ? path.extname( fname ) : '' ) );
        } ).bind( this );

    
    /** END INNER METHODS**/


    this.logger( 3, '\nformaline, data chunk was received! --> { ' );
    this.logger( 3, ' #: ' + this.chunksReceived + ',\n bytes: ' + chunk.length + ',\n parser results: \n', results, '\n }' );

    if( this.bytesReceived <= this.uploadThreshold ){ // is size allowed? 
        if( this.fileStream ){
            if( this.chopped ){ // fileStream exists, file data is chopped
                if( resultsLength === 0 ){ // chunk is only data payload
                    this.logger( 3, '  <-- this chunk contains only data.. bytes written to disk: ' + this.bytesWrittenToDisk );
                    wok = writeToFileStream( chunk );
                    if ( !wok ){ return; }
                }else{ 
                    // chunk contains other boundaries, the first result is the end of previous data chunk
                    this.logger( 3, '<-- this chunk contains data and fields.. bytes written to disk: ' + this.bytesWrittenToDisk + '\n' );
                    
                    fileDataChunk = new Buffer( results[ 0 ].start - 2 ); // last two chars are CRLF
                    if( ( fileDataChunk.length > 0 ) && ( this.bytesWrittenToDisk + fileDataChunk.length < this.uploadThreshold ) ){
                        cok = copyBuffer( chunk, fileDataChunk, 0, 0 );
                        wok = writeToFileStream( fileDataChunk );
                        if ( !wok || !cok ){ return; }
                    }
                    
                    closeFileStream( this.fileStream );
                    addToCompletedList( this.fileStream );
                    resetFileStream( this.fileStream );
                }
            }else{
                closeFileStream( this.fileStream );
                addToIncompleteList( this.fileStream );
                resetFileStream( this.fileStream );
            }
        }
    }
    
    for( var i = 0; i < resultsLength; i++ ){
        var result = results[ i ],
            rfinish = result.finish,
            rstart = result.start,
            heads = new Buffer( ( rfinish ) - ( rstart + bblength + 2 ) ), // only the headers
            headers = null,
            fieldName = null;
            
                                    
        if( rfinish > rstart + bblength + 2 ){
            cok = copyBuffer( chunk, heads, 0, rstart + bblength + 2,  ( rfinish > chunk.length - 1 ) ? ( chunk.length - 1 ) : rfinish );
            if ( !cok ){ return; }
        }                 
        
        headers = heads.toString();
        fieldName = headers.match( /name="([^\"]+)"/mi );

        if( fieldName ){
            var fileName = headers.match( /filename="([^\"]+)"/mi ),
                contentType  = headers.match( /Content-Type:([^;]+)/mi ),
                fieldCtype = ( contentType && contentType[ 1 ] ) ? contentType[ 1 ] : 'application/octet-stream',
                jsonWarnFileExists = { type: 'warning', isupload: true, msg: '' };

            if( fileName ) { // file field
                var escapedFilename = fileName[ 1 ].replace( escapeChars, '' ),
                    sha1filename = generateHashFileName( escapedFilename ),
                    filepath = this.uploadRootDir + sha1filename;

                if( this.completedFiles.indexOf( filepath ) > -1 ){ 
                    filepath = this.uploadRootDir + generateHashFileName( ( new Date().getTime() ) + '_' + escapedFilename  );
                    jsonWarnFileExists.msg = 'this (sha1sum) filename already exists in the data stream: ' + sha1filename + ', orig filename: ' + escapedFilename + ', new (sha1sum) filename: ' + path.basename( filepath );
                    this.emitEvent( 'message', jsonWarnFileExists, 1 );
                }
                // create new fileStream
                wok = writeToFileStream( null, {
                    path: filepath,
                    ctype: fieldCtype,
                    fieldname: fieldName[ 1 ],
                    origname: escapedFilename,
                    sha1sum: ( this.sha1sum ) ? crypto.createHash( 'sha1' ) : null,
                    mtime: ''
                });
                if ( !wok ){ return; }
                
                if( i === resultsLength - 1 ) { // last result
                    if( rfinish < chunkLength - 2 ){ // - "--", there is no boundary at the end of chunk, it is chopped data
                        this.logger( 3, '   -->', results[ i ], '<-- last data field is chopped' );
                        this.chopped = true;
                        if( this.fileStream ){
                            if( this.bytesReceived <= this.uploadThreshold ){
                                if( chunkLength >= rfinish + 4 ){
                                    fileDataChunk = new Buffer( chunkLength - ( rfinish + 4  ) ); 
                                    cok = copyBuffer( chunk, fileDataChunk, 0, rfinish + 4, chunkLength );                                        
                                    wok = writeToFileStream( fileDataChunk );
                                    if ( !wok || !cok ){ return; }
                                }
                            }else{
                                addToIncompleteList( this.fileStream );
                            }    
                        }
                    }
                }else{
                    if( this.fileStream ){
                        fileDataChunk = new Buffer( results[ i + 1 ].start - 2   - ( results[ i ].finish + 4 ) ); // + 4 ( CRLFCRLF ) 
                        if( this.bytesWrittenToDisk + fileDataChunk.length < this.uploadThreshold ){
                            cok = copyBuffer( chunk, fileDataChunk, 0, results[ i ].finish + 4 , results[ i + 1 ].start - 2 ); 
                            wok = writeToFileStream( fileDataChunk );
                            if ( !wok || !cok ){ return; }
                        }else{
                            addToIncompleteList( this.fileStream );
                        }

                        if( ( this.fileSize >= 0 ) && ( this.incompleteFiles.indexOf( this.fileStream.path ) < 0 ) ){
                            addToCompletedList( this.fileStream );
                        }
                                                                                                               
                        closeFileStream( this.fileStream ); 
                        resetFileStream();
                    }
                }    
            }else{ // normal field
                if( i < resultsLength - 1 ){
                    fileDataChunk = new Buffer( results[ i + 1 ].start - 2   - ( results[ i ].finish + 4 ) ); // + 4 ( CRLFCRLF )
                    cok = copyBuffer( chunk, fileDataChunk, 0, results[ i ].finish + 4 , results[ i + 1 ].start - 2 );
                    if ( !cok ){ return; }
                    var jsonFieldReceived = { name: fieldName[ 1 ], value: fileDataChunk.toString() };                
                    this.receivedFieldsCollection.list.push( jsonFieldReceived );
                    this.emitEvent( 'load', jsonFieldReceived, 2 );
                }
            }
        } // end if(fieldname)         
    } // end for

    this.req.resume();
};


/* SEND RESPONSE */


fproto.sendResponseToMultipart =  function( nbytes ){ 
    this.endTime = new Date().getTime();
    if( this.timeOutId != null){
        timers.clearInterval( this.timeOutId ); // block timer
    }
    var logParserStats = ( function(){
            this.logger( 1, '\n (°)--/PARSER_STATS/ ' ); 
            this.logger( 1, '  |                          ' );
            this.logger( 1, '  |- overall parsing time    :', ( this.parserOverallTime / 1000 ).toFixed( 4 ), 'secs ' );            
            this.logger( 1, '  |- chunks received         :', this.chunksReceived ) ;
            this.logger( 1, '  |- average chunk rate      :', ( ( this.chunksReceived ) / ( this.parserOverallTime / 1000 ) ).toFixed( 1 ), 'chunk/sec' );
            this.logger( 1, '  |- average chunk size      :', ( ( this.bytesReceived / 1024 ) / this.chunksReceived ).toFixed( 3 ), 'KBytes' );            
            this.logger( 1, '  |- data parsed             :', ( this.bytesReceived / ( 1024 * 1024 ) ).toFixed( 4 ), 'MBytes' );
            this.logger( 1, '  |- average data rate       :', ( ( this.bytesReceived / ( 1024 * 1024 ) ) / ( this.parserOverallTime / 1000 )).toFixed( 1 ), 'MBytes/sec' );
            
        } ).bind( this ),
    
        logOverallResults = ( function( updateEndTime ){
            if( updateEndTime === true ){
                this.endTime = new Date().getTime();
            }
            this.logger( 1, '\n (°)--/POST_OVERALL_RESULTS/ ');
            this.logger( 1, '  |                          ');
            this.logger( 1, '  |- overall time            :', ( ( this.endTime - this.startTime ) / 1000 ), 'secs' );
            this.logger( 1, '  |- bytes allowed           :', ( this.uploadThreshold / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes');            
            this.logger( 1, '  |- data received           :', ( this.bytesReceived / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes' );
            this.logger( 1, '  |- data written to disk    :', ( this.bytesWrittenToDisk  / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes' );
            this.logger( 1, '  |- completed files         :', this.completedFiles.length );
            this.logger( 1, '  |- partially written files :', this.incompleteFilesCollection.list.length + '\n' );

        } ).bind( this ),
    
        resetAttributes = ( function(){
            this.chunksReceived = 0;
            this.bytesReceived = 0;
            this.bytesWrittenToDisk = 0;
            this.fileStream = null;
            this.boundString = null;
            this.boundBuffer = null;
            this.uploadRootDir = '';
            this.uploadThreshold = 0;
            this.parserOverallTime = 0;
            this.chopped = false;
            this.fileSize = 0;
            this.incompleteFilesCollection = { list: [] };
            this.receivedFilesCollection = { list: [] };
            this.receivedFieldsCollection = { list: [] };
        } ).bind( this ),
        
        sendResponse = ( function( json ){
            logParserStats();
            logOverallResults();
            this.emitEvent( 'loadend', json, 2 );
            resetAttributes();
        } ).bind( this );  
    
    this.endResults = {
        startTime: this.startTime,
        endTime: this.endTime,
        overallSecs: ( this.endTime - this.startTime ) / 1000,
        bytesReceived : this.bytesReceived,
        bytesWrittenToDisk: this.bytesWrittenToDisk,
        chunksReceived : this.chunksReceived,
        filesCompleted: this.completedFiles.length,
        filesRemoved: this.incompleteFilesCollection.list.length
    };
                    
    if( this.removeIncompleteFiles === false ){
        sendResponse( { files: this.receivedFilesCollection.list, incomplete: this.incompleteFilesCollection.list, fields: this.receivedFieldsCollection.list, stats: this.endResults, } );
    }else{
        if( this.incompleteFilesCollection.list.length === 0 ){
            // incomplete files are already removed, previously it emits exception and fileremoved events 
            sendResponse( { stats: this.endResults, incomplete: [], files: this.receivedFilesCollection.list, fields: this.receivedFieldsCollection.list } );
        }else{
          for( var i = 0, ufile = this.incompleteFilesCollection.list, len = ufile.length, currfile = ufile[ 0 ].value.path; i < len; i++, currfile = ( ufile[i] ) ? ( ufile[ i ].value.path  ) : null ){
                fs.unlink( currfile, ( function( err, cfile, i, len ){
                    if( err ){
                        var jsonWarnUnlink = { type: 'warning', isupload: true, msg: '' };
                        jsonWarnUnlink.msg = 'file unlink exception:' + cfile + ', directory: ' + this.uploadRootDir; 
                        this.emitEvent( 'message', jsonWarnUnlink, 1 );
                    }else{
                        var ifile = this.incompleteFilesCollection[ path.basename( cfile ) ],
                            fvalue = ifile.value,
                            jsonFileRemoved = { type: 'fileremoved', isupload: true, msg: 'a file was removed, json: ' };
                            
                            jsonFileRemoved.msg += JSON.stringify({ 
                                name: ifile.name,
                                value: {
                                    name: fvalue.name,
                                    path: cfile,
                                    type: fvalue.type, 
                                    size: fvalue.rbytes,
                                    lastModifiedDate: fvalue.mtime || '',
                                    datasha1sum: 'not calculated'
                                }
                            });
                        this.emitEvent( 'message', jsonFileRemoved, 1 );
                    }
                    if( i === len - 1){
                        // incomplete files are already removed, previously it emits exception and fileremoved events 
                        sendResponse( { stats: this.endResults, incomplete: this.incompleteFilesCollection.list, files: this.receivedFilesCollection.list, fields: this.receivedFieldsCollection.list } );
                    }
                } ).createDelegate( this, [ currfile, i, len ], true ) );
            } //end for
        }
    }
}; // end sendResponse     


exports.formaline = formaline;
exports.parse = formaline;
