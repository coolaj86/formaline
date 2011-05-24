/*!
 * formaline
 * Copyright(c) 2011 Guglielmo Ferri <44gatti@gmail.com>
 * MIT Licensed
 */

/**
 * Library version 0.4.4
 */

exports.version = '0.4.4';

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
    this.emitDataProgress = false;
    this.uploadThreshold = 1024 * 1024 * 1024; // bytes
    this.checkContentLength = false;
    this.removeIncompleteFiles = true;
    this.holdFilesExtensions = false;
    this.sha1sum = true; 
    this.listeners = {};
    this.logging = 'debug:off,1:on,2:on,3:off';
    this.getSessionID = null; // not undefined!! apply function doesn't work on undefined values

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
    this.currentChunksReceived = 0; // only for checking last chunk in dataProgress
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
    this.incompleteFilesCollection = { list: [] };
    this.startTime = 0;
    this.endTime = 0;
    this.req = null;
    this.res = null;
    this.sid = null;
    
};


formaline.prototype.__proto__ = emitter.prototype;


fproto = formaline.prototype;


fproto.emitEvent = function( etype, obj, logLevel ){
    this.logger( logLevel, '\n formaline, event: "' + etype + '" --> \n' , obj );
    if( etype === 'end' ){
          this.emit( 'end', obj, this.res, this.next ); 
    }else if( ( etype.indexOf('warning') > - 1 ) || ( etype.indexOf('exception') > - 1 ) ){
        // exception event
        obj.type = etype;
        this.emit( 'exception', obj );
        if( obj.fatal === true ) {
            this.emit( 'end', { stats: {}, incomplete: [] }, this.res, this.next );
        }
    }else{
        this.emit( etype, obj );
    }
};


fproto.parse = function( req, res, next ){
    
    this.startTime = new Date().getTime();
    this.req = req;
    this.res = res;    
    this.next = ( next && ( typeof next === 'function' ) ) ? next : emptyFn;  
  
    var hs = req.headers,
        bytes2Receive = 0,
        clength = hs[ 'content-length' ],
        ctype = hs[ 'content-type' ],
        isUpload =  ( ctype && ( ~ctype.indexOf( 'multipart/form-data' ) ) ) ? true : false ,
        isUrlEncoded = ( ctype && ( ~ctype.indexOf( 'urlencoded' ) ) ) ? true : false ,
        
        /** INNER METHODS **/
        
        getProgressEmitter = ( function( headerContentLength ){
            var dProgress = this.emitDataProgress,
                bytesExpected = headerContentLength,
                ratio = ( bytesExpected && ( bytesExpected > 1 ) ) ? function( bytes ){ return ( bytes / bytesExpected ).toFixed( 8 ); } : dummyFn( -1 );
            if( dProgress === true ){
                return function( isEnd ){
                    this.emitEvent( 'dataprogress', { bytes: this.bytesReceived, chunks: this.chunksReceived, ratio: ratio( this.bytesReceived) }, 3 );
                };
            }else if( typeof dProgress === 'number' ){
                dProgress = parseInt( dProgress, 10 );
                if( dProgress < 2 ){ dProgress = 2; }
                    return function( isEnd) {
                        if( ( ( this.chunksReceived % dProgress ) === 1 ) || isEnd ){ // mod 1 is for first chunk
                           this.emitEvent( 'dataprogress', { bytes: this.bytesReceived, chunks: this.chunksReceived, ratio: ratio( this.bytesReceived) }, 3 );
                        }
                    };
            }else{
                return emptyFn;
            }
        } ).bind( this ),
    
        validatePostSize = ( function( expected, isUpload ){
            var jsonPostWarn = { isupload: true, msg: '', fatal: false };
            this.logger( 1, '\n formaline, Parsed req.headers[ content-length ]: ' + expected + ' bytes' );
            if( expected > this.uploadThreshold ){ // check Max Upload Size in bytes
                if( this.checkContentLength === true ){
                    return false;
                }
                jsonPostWarn.msg = 'invalid content-length header, bytes to receive: ' + expected  + ', bytes allowed: ' + this.uploadThreshold;
                this.emitEvent( 'warning', jsonPostWarn, 1 );
            }
            return true;
        } ).bind( this ),
        
        retrieveSessionIdentifier = ( function(){ 
            var jsonSessWarn = { isupload: true, msg: '', fatal: false };
            try{
                if( typeof this.getSessionID === 'function' ){
                     var sessionID = this.getSessionID( this.req );
                    if( typeof sessionID !== 'string' ){
                        jsonSessWarn.msg = 'unable to retrieve session identifier, function this.getSessionID( req ) does not return a String!' ;
                        this.emitEvent( 'warning', jsonSessWarn, 1 );    
                    }else{
                        //TODO security, escaping chars and check sessionId length
                        //TODO add logging
                        return sessionID;
                    }
                }else{
                    jsonSessWarn.msg = 'unable to retrieve session identifier, configuration parameter this.getSessionID must be a function!' ;
                    this.emitEvent( 'warning', jsonSessWarn, 1 );
                }  
              }catch( serr ){
                  JsonSessWarn.msg = 'unable to retrieve session identifier: ' + serr.stack ;      
                  return null;
              }
              return null; // sid doesn't exists
        } ).bind( this ),
        
        getUploadSubDirectoryName = ( function(){
            // is session id String exists returns it
            // otherwise returns a random number name
            return ( this.sid ) ? ( this.sid ) : ( parseInt( new Date().getTime() * ( 1 + Math.random() ) * 10 * 32, 10 ) );
        } ).bind( this );
        
        /** END INNER METHODS **/
        
    if( ( req ) && ( typeof req === 'object' ) && ( req.body === undefined ) && ( req.method === 'POST' || req.method === 'PUT' )  && ( hs ) ){
    
        this.sid = retrieveSessionIdentifier();
        var jsonFatalErr = { isupload: isUpload, msg:'', fatal: true },
            jsonWarnError = { isupload: isUpload, msg:'', fatal: true };
        
        try{ 
            //try to create a sub-directory of upload root directory
            this.uploadRootDir = this.uploadRootDir + getUploadSubDirectoryName() + '/';
            //if session upload dir already exists don't create it!!!
            //TODO TODO TODO move all to async way
            if( ( this.sid ) && ( ! path.existsSync( this.uploadRootDir ) ) ){
                fs.mkdirSync( this.uploadRootDir, '0750' );
            }else{
                fs.mkdirSync( this.uploadRootDir, '0750' );
            }
        }catch( dirErr ){
            this.uploadRootDir = '/tmp/' + getUploadSubDirectoryName() + '/';
            jsonWarnError.msg = 'default directory creation exception: ' + this.uploadRootDir + ', ' + dirErr.message ;
            this.emitEvent( 'warning', jsonWarnError, 1 );
            try{
                fs.mkdirSync( this.uploadRootDir, '0750' ); 
            }catch( ierr ){
                jsonFatalErr.msg = 'directory creation exception: '+ this.uploadRootDir + ', ' + ierr.message;
                this.emitEvent( 'pathexception', jsonFatalErr, 0 );
                return;
            }
        }
  
        this.dataProgress = getProgressEmitter( clength );      
        
        try{
            this.boundString = ctype.match( /boundary=([^;]+)/mi )[ 1 ];
        }catch( berr ){ 
            if( isUpload ){
                // TODO TODO 
                // if boundary is not defined and type is multipart/form-data, 
                // it could be a custom, not standard compliant, XHR request 
                // this.emitException( 'headersexception', isUpload , 'req.headers[..]: the multipart/form-data request is not HTTP-compliant, boundary string wasn\'t found..', 0, true );
                return;
            }
        }
        
        this.logger( 1, '\nRequest Headers:' );
        
        if( clength ){ 
            try{
                bytes2Receive = parseInt( clength, 10 );
            }catch(parseIntError){
               jsonFatalErr.msg = 'req.headers[ content-length ]: '+ parseIntError + ', length value:' + clength;
               this.emitEvent( 'headersexception', jsonFatalErr, 0);
                return;
            }
            if( ! validatePostSize( bytes2Receive, isUpload ) ){
                jsonFatalErr.msg = 'req.headers[ content-length ] exceeds max allowable: ' + bytes2Receive + ' > ' + this.uploadThreshold;
                this.emitEvent( 'headersexception', jsonFatalErr, 0);
                return;
            }
        }else{
            jsonFatalErr.msg =  'req.headers[ content-length ] not found: Parse Length Error';
            this.emitEvent( 'headersexception', jsonFatalErr, 0);
            return;
        }
        if( ctype ){   
            this.logger( 1, ' formaline, Parsed req.headers[ content-type ]: ' + ctype );
            if( isUpload ){
                //multipart form data
                //this.logger( 1, 'formaline, Parsed boundary pattern: ' + this.boundString + ', length: ' + this.boundString.length + ' chars\n' );
                this.boundBuffer = new Buffer( '--' + this.boundString );
                this.req.addListener( 'data', this.parseMultipartData.bind( this ) );
                this.req.addListener( 'end', this.sendResponseToMultipart.bind( this, clength ) );
            }else if( isUrlEncoded ){ 
                //seralized fields 
                this.req.addListener( 'data', this.parseUrlEncodedData.bind( this ) );
                this.req.addListener( 'end', this.sendResponseToUrlEncoded.bind( this, clength ) );
            }else{
                jsonFatalErr.msg = 'req.headers[ content-type ] --> ' + ctype + ' handler for this kind of request is not defined';
                this.emitEvent( 'headersexception', jsonFatalErr, 0);
                return;
            }
        }else{
            jsonFatalErr.msg = 'req.headers[ content-type ] not found: Parse Type Error';
            this.emitEvent( 'headersexception', jsonFatalErr, 0);
            return;
        }
    }else{
        jsonFatalErr.msg = 'req.headers[..] not found, or HTTP method not handled';
        this.emitEvent( 'headersexception', jsonFatalErr, 0);
        return;
    }

};//end parse



fproto.parseUrlEncodedData = function( chunk ){ 
    this.qsBuffer += chunk.toString( 'utf8' );
};                


fproto.sendResponseToUrlEncoded = function(){
    var fields = querystring.parse( this.qsBuffer, '&', '=' );
    for( var f in fields ){
        this.emitEvent( 'field', { name: f, value: fields[ f ] }, 2 );
    }
    this.emitEvent( 'end', { stats: {}, incomplete: [] }, 2 );
};
            

fproto.parseMultipartData = function( chunk ){
    this.req.pause();
    var bb = this.boundBuffer,
        bblength = bb.length,
        chunkLength = chunk.length,                        
        stime =  new Date(),
        results = parser.quickSearch( bb, chunk ),
        etime = new Date(),
        resultsLength = results.length,
        emsg = '',
        jsonMultiPartErr = { isupload: true, msg: '', fatal: true }
        escapeChars = /[\\\[\]\(\)\{\}\/\\\|\!\:\=\?\*\+\^\$\<\>\%\:\,\:\`\s\t\r\n]/g;
        fileDataChunk = null;
               
    this.parserOverallTime += ( etime - stime );    
    this.bytesReceived += chunk.length;
    this.chunksReceived++;
    this.dataProgress();

    /** INNER METHODS**/
    
    var writeToFileStream = ( function( dataPayload, cfg ){  
            try{
                if( dataPayload ){
                    this.fileStream.write( dataPayload );
                    ( this.sha1sum ) ? this.fileStream.sha1sum.update( dataPayload ) : null;
                    this.fileSize += dataPayload.length;
                    this.bytesWrittenToDisk += dataPayload.length;
                }else{
                    if( cfg && cfg.fpath ){
                        this.fileStream = new fs.WriteStream( cfg.fpath );
                        apply( this.fileStream, cfg, true );
                        this.logger( 3, '\nformaline, WriteStream (file) created --> ', this.fileStream );
                    }
                }
            }catch( fserr ){
                emsg = 'writing file stream : ' + this.fileStream + ', err: ' + fserr.message ;
                emsg +=  '\n error stack:\n  ' + fserr.stack;
                jsonMultiPartErr.msg = emsg;
                this.emitEvent( 'streamexception', jsonMultiPartErr, 0); 
                return;
            }
        } ).bind( this ),
    
        copyBuffer = ( function( sourceBuffer, targetBuffer, tStart, dStart, dEnd ){
            try{
                sourceBuffer.copy( targetBuffer, tStart, dStart, dEnd );
            }catch( berr ){
                emsg = 'copying buffer data file: ' + berr.message;
                emsg += '\nboundary length:' + bblength + '\nchunk length:' + sourceBuffer.length;
                emsg += '\nresult:' + result + '\n results length:' + resultsLength + '\n buffer start index:' + ( 0 ) + '\n buffer data end index: ' + ( targetBuffer.length - 1 ) + '\n target buffer length: ' + targetBuffer.length;
                emsg +=  '\n error stack:\n  ' + berr.stack;
                jsonMultiPartErr.msg = emsg;
                this.emitEvent( 'bufferexception', jsonMultiPartErr, 0);
                return; 
            }
        } ).bind( this ),
        
        addToIncompleteList = ( function( file ){
            var incomplete = this.incompleteFilesCollection,
                jsonWarnIncomplete = { isupload: true, msg:'', fatal: false } ; 
            if( incomplete.list.indexOf( file.path ) < 0 ){
                incomplete.list.push( file.path );
                incomplete[ path.basename( file.path ) ] = {
                    origname: file.origname,
                    dir: path.dirname( file.path ),
                    type: file.ctype,
                    rbytes: this.fileSize,
                    field: file.fieldname
                };
                jsonWarnIncomplete.msg = 'upload threshold exceeded, file incomplete: ' + path.basename( file.path ) ;
                this.emitEvent( 'warning', jsonWarnIncomplete, 1 );
            }
        } ).bind( this ),
        
        addToCompletedList = ( function( file ){
            this.completedFiles.push( file.path );
            var filedatasha1sum = ( ( this.sha1sum ) ? file.sha1sum.digest( 'hex' ) : undefined );
            this.emitEvent( 'filereceived', { 
                sha1name:  path.basename( file.path ), 
                origname: file.origname, 
                path: path.dirname( file.path ), 
                type: file.ctype, 
                size: this.fileSize, 
                fieldname: file.fieldname, 
                datasha1sum: filedatasha1sum    
            }, 2 );
        } ).bind( this ),
        
        closeFileStream = ( function( file ){
            file.end();
            this.logger( 3, '\nformaline, closed file stream -->', file.path, '\n' );
        } ).bind( this ),
        
        resetFileStream = ( function(){
            this.fileStream = null;
        } ).bind( this ),
        
        generateHashFileName = ( function( fname ){
            return ( crypto.createHash( 'sha1' ).update( fname ).digest( 'hex' ) + ( ( this.holdFilesExtensions ) ? path.extname( fname ) : '' ) );
        } ).bind( this );
    
    /** END INNER METHODS**/


    this.logger( 3, '\nformaline, data chunk was received! --> { ' );
    this.logger( 3, ' #: ' + this.chunksReceived + ',\n bytes: ' + chunk.length + ',\n parser results: \n', results,'\n }' );

    if( this.bytesReceived <= this.uploadThreshold ){ // is size allowed? 
        if( this.fileStream ){
            if( this.chopped ){ // file data is chopped? && fileStream exists?
                if( resultsLength === 0 ){ // chunk is only data payload
                    this.logger( 3, '  <-- this chunk contains only data.. bytes written to disk: ' + this.bytesWrittenToDisk );
                    writeToFileStream( chunk );
                }else{ 
                    // chunk contains other boundaries, the first result is the end of previous data chunk
                    this.logger( 3, '<-- this chunk contains data and fields.. bytes written to disk: ' + this.bytesWrittenToDisk + '\n' );
                    
                    fileDataChunk = new Buffer( results[ 0 ].start - 2 ); // last two chars are CRLF
                    if( ( fileDataChunk.length > 0 ) && ( this.bytesWrittenToDisk + fileDataChunk.length < this.uploadThreshold ) ){
                        copyBuffer( chunk, fileDataChunk, 0, 0, fileDataChunk.length - 1 );
                        writeToFileStream( fileDataChunk );
                    }
                    
                    closeFileStream( this.fileStream );
                    addToCompletedList( this.fileStream );
                    resetFileStream( this.fileStream );
                }
            }else{
                addToIncompleteList( this.fileStream );
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
            
                                    
        if( rfinish > rstart + bblength + 2 ){ // check the creation of heads buffer (indexes) 
            copyBuffer( chunk, heads, 0, rstart + bblength + 2,  ( rfinish > chunk.length - 1 ) ? ( chunk.length - 1 ) : rfinish );
        }                 
        
        headers = heads.toString();
        fieldName = headers.match( /name="([^\"]+)"/mi );

        if( fieldName ){
            var fileName = headers.match( /filename="([^\"]+)"/mi ),
                contentType  = headers.match( /Content-Type:([^;]+)/mi ),
                fieldCtype = ( contentType && contentType[ 1 ] ) ? contentType[ 1 ] : 'application/octet-stream',
                jsonWarnFileExists = { isupload: true, msg: '', fatal: false };

            if( fileName ) { // file field
                var escapedFilename = fileName[ 1 ].replace( escapeChars, '' ),
                    sha1filename = generateHashFileName( escapedFilename ), // this.generateHashFileName( escapedFilename ),
                    filepath = this.uploadRootDir + sha1filename;                                    
                
                // TODO emitting also field event ? I think not.      
                // this.logger( 2,'\nformaline, file field --> field name: ' + fieldName[ 1 ] + ', original filename: ' + escapedFilename + ', new (sha1sum) filename: ' + sha1filename + ', content-type: ' + fieldCtype );

                if( this.completedFiles.indexOf( filepath ) > -1 ){ 
                    filepath = this.uploadRootDir + generateHashFileName( ( new Date().getTime() ) + '_' + escapedFilename  );
                    jsonWarnFileExists.msg = 'this (sha1sum) filename already exists in the data stream: ' + sha1filename + ', orig filename: ' + escapedFilename + ', new (sha1sum) filename: ' + path.basename( filepath );
                    this.emitEvent( 'warning', jsonWarnFileExists, 1 );
                }
                //create new fileStream
                writeToFileStream( null, {
                    fpath: filepath,
                    ctype: fieldCtype,
                    fieldname: fieldName[ 1 ],
                    origname: escapedFilename,
                    sha1sum: ( this.sha1sum ) ? crypto.createHash( 'sha1' ) : null
                });        
                
                if( i === resultsLength - 1 ) { // last result
                    if( rfinish < chunkLength - 2 ){ // - "--", there is no boundary at the end of chunk, it is chopped data
                        this.logger( 3, '   -->', results[ i ], '<-- last data field is chopped' );
                        this.chopped = true;
                        if( this.fileStream ){
                            if( this.bytesReceived <= this.uploadThreshold ){
                                if( chunkLength >= rfinish + 4 ){
                                    fileDataChunk = new Buffer( chunkLength - ( rfinish + 4  ) ); 
                                    copyBuffer( chunk, fileDataChunk, 0, rfinish + 4, chunkLength );                                        
                                    writeToFileStream( fileDataChunk );
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
                            copyBuffer( chunk, fileDataChunk, 0, results[ i ].finish + 4 , results[ i + 1 ].start - 2 ); 
                            writeToFileStream( fileDataChunk );
                        }else{
                            addToIncompleteList( this.fileStream );
                        }

                        if( ( this.fileSize >= 0 ) && ( this.incompleteFilesCollection.list.indexOf( this.fileStream.path ) < 0 ) ){
                            addToCompletedList( this.fileStream );
                        }
                        closeFileStream( this.fileStream ); //TODO move upper ? check others 
                        resetFileStream();
                    }
                }    
            }else{ // normal field
                if( i < resultsLength - 1 ){
                    fileDataChunk = new Buffer( results[ i + 1 ].start - 2   - ( results[ i ].finish + 4 ) ); // + 4 ( CRLFCRLF )
                    copyBuffer( chunk, fileDataChunk, 0, results[ i ].finish + 4 , results[ i + 1 ].start - 2 ); 
                    this.emitEvent( 'field', { name: fieldName[ 1 ], value: fileDataChunk.toString() }, 2 );
                }
            }
        } // end if(fieldname)         
    } // end for
    this.req.resume();
};


/* SEND RESPONSE */


fproto.sendResponseToMultipart =  function( nbytes ){                 
    this.endTime = new Date().getTime();
    
    var logParserStats = ( function(){
            this.logger( 1, '\n (°)--/PARSER_STATS/ ' ); 
            this.logger( 1, '  |                       ' );
            this.logger( 1, '  |- chunks received      :', this.chunksReceived ) ;
            this.logger( 1, '  |- data parsed          :', ( this.bytesReceived / ( 1024 * 1024 ) ).toFixed( 4 ), 'MBytes' );
            this.logger( 1, '  |- overall parsing time :', this.parserOverallTime / 1000,'secs'); 
            this.logger( 1, '  |- average data rate    :', ( ( this.bytesReceived / ( 1024 * 1024 ) ) / ( this.parserOverallTime / 1000 )).toFixed( 1 ), 'MBytes/sec' );
            this.logger( 1, '  |- average chunk size   :', ( ( this.bytesReceived / 1024 ) / this.chunksReceived ).toFixed( 3 ), 'KBytes' );
            this.logger( 1, '  |- average chunk rate   :', ( ( this.chunksReceived ) / ( this.parserOverallTime / 1000 ) ).toFixed( 1 ), 'chunk/sec' );
        } ).bind( this ),
    
        logOverallResults = ( function( updateEndTime ){
            if( updateEndTime === true ){
                this.endTime = new Date().getTime();
            }
            this.logger( 1, '\n (°)--/POST_OVERALL_RESULTS/ ');
            this.logger( 1, '  |                        ');
            this.logger( 1, '  |- data received        :', ( this.bytesReceived / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes' );
            this.logger( 1, '  |- data written to disk :', ( this.bytesWrittenToDisk  / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes' );
            this.logger( 1, '  |- bytes allowed        :', ( this.uploadThreshold / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes');
            this.logger( 1, '  |- overall time         :', ( ( this.endTime - this.startTime ) / 1000 ), 'secs' );
            this.logger( 1, '  |- completed files      :', this.completedFiles.length );
            this.logger( 1, '  |- partial files        :', this.incompleteFilesCollection.list.length,'\n' );
        
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
        } ).bind( this ),
        
        sendResponse = ( function( json ){
            logParserStats();
            logOverallResults();
            this.emitEvent( 'end', json, 2 );
            resetAttributes();
        } ).bind( this );  
    
    this.endResults = {
        bytesReceived : this.bytesReceived,
        bytesWrittenToDisk: this.bytesWrittenToDisk,
        chunksReceived : this.chunksReceived,
        overallSecs: ( this.endTime - this.startTime ) / 1000,
        filesCompleted: this.completedFiles.length,
        filesRemoved: this.incompleteFilesCollection.list.length
    };
                    
    if( this.removeIncompleteFiles === false ){
        sendResponse( { stats: this.endResults, incomplete: this.incompleteFilesCollection.list } );
    }else{
        if( this.incompleteFilesCollection.list.length === 0 ){
            // incomplete files are already removed, previously it emits exception and fileremoved events 
            sendResponse( { stats: this.endResults, incomplete: [] } );
        }else{
            for( var i = 0, ufile = this.incompleteFilesCollection.list, len = ufile.length, currfile = ufile[ 0 ]; i < len; i++, currfile = ufile[ i ] ){
                fs.unlink( currfile, (function( err, cfile, i, len ){
                    if( err ){
                        var jsonWarnUnlink = { isupload: true, msg: '', fatal: false };
                        jsonWarnUnlink.msg = 'file unlink exception:' + cfile + ', directory: ' + this.uploadRootDir; 
                        this.emitEvent( 'warning', jsonWarnUnlink, 1 );
                    }else{
                        var ifile = this.incompleteFilesCollection[ path.basename( cfile ) ];
                        this.emitEvent( 'fileremoved', { 
                            sha1name:  path.basename( cfile ), 
                            origname: ifile.origname, 
                            path: ifile.dir, 
                            type: ifile.type, 
                            size: ifile.rbytes, 
                            fieldname: ifile.field, 
                            datasha1sum: 'not calculated'    
                        }, 2 );
                    }
                    if( i === len - 1){
                        // incomplete files are already removed, previously it emits exception and fileremoved events 
                        sendResponse( { stats: this.endResults, incomplete: [] } );
                    }
                }).createDelegate( this, [ currfile, i, len ], true ) );
            }//end for
        }
    }
};//end sendResponse     


exports.formaline = formaline;
exports.parse = formaline;
