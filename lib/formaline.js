/*!
 * formaline
 * Copyright(c) 2011 Guglielmo Ferri <44gatti@gmail.com>
 * MIT Licensed
 */

/**
 * Library version 0.4.2
 */

exports.version = '0.4.2';

var fs = require( 'fs' ),
    crypto = require( 'crypto' ),
    emitter = require( 'events' ).EventEmitter,
    querystring = require( 'querystring' ),
    path = require( 'path' ),
    ext = require( './extensions' ),
    parser  = require( './quickSearch' );

var setDebuggingLevel = function( dstring ){
    var p, dlevels = querystring.parse( "debug:off,1:on,2:on,3:on", ',', ':' ); // debug:'on' print always : 0 level
    if(dstring){
        try{
          p = querystring.parse( dstring, ',', ':' );
          dlevels = p;
        }catch(err){
            console.log( 'formaline.setDebuggingLevel(): config string parse error ->', err.message );
        }
    }
    return function(){
        var args = Array.prototype.slice.call( arguments ), // convert to array
            level = args [ 0 ];
        if( dlevels.debug === 'off' ){ return; }
        if( typeof level === 'number' ){
            if( ( level === 0 ) || ( dlevels[ level ] === 'on' )){
                return console.log.apply( this,args.slice( 1, args.length ) );
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
    this.emitDataProgress = null;
    this.uploadThreshold = 1024 * 1024 * 1024; // bytes
    this.checkContentLength = false;
    this.removeIncompleteFiles = true;
    this.holdFilesExtensions = false;
    this.sha1sum = true; 
    this.listeners = {};
    this.logging = null;

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
    this.currentChunksReceived = 0;//only for checking last chunk in dataProgress
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
    
    this.emitException = function( type, isUpload, msg, logLevel, endResponse ){
        this.logger( logLevel, '\nformaline, '+ msg );
        this.emit( 'exception', type, isUpload, 'formaline, ' + msg, ( endResponse === true ) );//, res, this.next );
        if( endResponse === true ) {
           this.emit( 'end', [], {}, this.res, this.next );
        }
    };
    
};

formaline.prototype.__proto__ = emitter.prototype;

FPROTO = formaline.prototype;

FPROTO.parse = function( req, res, next ){
    
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
                     this.emit( 'dataprogress', this.bytesReceived, this.chunksReceived, ratio( this.bytesReceived ) );//every chunks 
                 };
            }else if( typeof dProgress === 'number' ){
                dProgress = parseInt( dProgress, 10 );
                if( dProgress < 2 ){ dProgress = 2; }
                    return function( isEnd) {
                        if( ( ( this.chunksReceived % dProgress ) === 1 ) || isEnd ){// mod 1 is for first chunk
                            this.emit( 'dataprogress', this.bytesReceived, this.chunksReceived, ratio( this.bytesReceived ) );//every dProgress chunks 
                        }
                    };
            }else{
                return emptyFn;
            }
        } ).bind( this ),
    
        validatePostSize = ( function( expected, isUpload ){
            if( expected > this.uploadThreshold ){ // check Max Upload Size in bytes
                if( this.checkContentLength === true ){
                    return false;
                }
                this.emitException( 'warning', isUpload, 'Warning: invalid content length, bytes to receive: ' + expected  + ', bytes allowed: ' + this.uploadThreshold, 1 );
            }else{
                 this.logger( 0, '\nformaline, req.headers[content-length] -->', expected, 'bytes' );
            }
            return true;
        } ).bind( this );
        
        /** END INNER METHODS **/
        
    if( ( req ) && ( typeof req === 'object' ) && ( req.body === undefined ) && ( req.method === 'POST' || req.method === 'PUT' )  && ( hs ) ){
        //this.req = req;
        //this.res = res;
        try{ 
            //try to create a sub-directory of upload root directory
            this.uploadRootDir = this.uploadRootDir + parseInt( new Date().getTime() * ( 1 + Math.random()) * 10 * 32, 10 ) + '/';
            fs.mkdirSync( this.uploadRootDir, '0750' );
        }catch( dirErr ){
            this.uploadRootDir = '/tmp/' + parseInt( new Date().getTime() * ( 1 + Math.random() ) * 10 * 32, 10 ) + '/';
            this.emitException( 'warning', isUpload, 'Warning: default directory creation exception -> ' + this.uploadRootDir + ', ' + dirErr.message, 0 );
            try{
                fs.mkdirSync( this.uploadRootDir, '0750' ); 
            }catch( ierr ){
                this.emitException( 'pathexception', isUpload, 'directory creation exception: '+ this.uploadRootDir + ', ' + ierr.message, 0, true );
                return;
            }
        }
        
        this.dataProgress = getProgressEmitter( clength );      
        
        try{
            this.boundString = ctype.match( /boundary=([^;]+)/mi )[ 1 ];
        }catch( berr ){ 
            if( isUpload ){
                //if boundary is not defined and type is multipart/form-data, 
                //it could be a custom, not standard compliant, XHR request 
                //TODO not compatible with library versions  >= 0.4.0
                //this.handleCustomXHR( hs );
                this.emitException( 'headersexception', isUpload , 'req.headers[..]: multipart/form-data request is not HTTP-compliant, boundary string is not found..', 0, true );
                return;
            }
        }
        
        this.logger( 1, '\nRequest Headers:' );
        
        if( clength ){ 
            try{
                bytes2Receive = parseInt( clength, 10 );
            }catch(parseIntError){
                this.emitException( 'headersexception', isUpload , 'req.headers[content-length]: '+ parseIntError + ', length value:' + clength, 0, true );
                return;
            }
            if( ! validatePostSize( bytes2Receive, isUpload ) ){
                this.emitException( 'headersexception', isUpload, 'req.headers[content-length] exceeds max allowable: ' + bytes2Receive + ' > ' + this.uploadThreshold, 0, true );
                return;
            }
        }else{
            this.emitException( 'headersexception', isUpload , 'req.headers[content-length] not found: Parse Length Error', 0, true );
            return;
        }
        if( ctype ){   
            this.logger( 0, 'formaline, req.headers[content-type] --> ', ctype );
            if( isUpload ){
                //multipart form data
                this.logger( 1, ' boundary pattern: ' + this.boundString, '\n boundary pattern length: ' + this.boundString.length + ' chars\n' );
                this.boundBuffer = new Buffer( '--' + this.boundString );
                this.req.addListener( 'data', this.parseMultipartData.bind( this ) );
                this.req.addListener( 'end', this.sendResponseToMultipart.bind( this, clength ) );
            }else if( isUrlEncoded ){ 
                //seralized fields 
                this.req.addListener( 'data', this.parseUrlEncodedData.bind( this ) );
                this.req.addListener( 'end', this.sendResponseToUrlEncoded.bind( this, clength ) );
            }else{
                this.emitException( 'headersexception', isUpload, 'req.headers[content-type] --> ' + ctype + ' handler for this kind of request is not defined', 0, true );
                return;
            }
        }else{
            this.emitException( 'headersexception', isUpload, 'req.headers[content-type] not found: Parse Type Error', 0, true );
            return;
        }
    }else{
        this.emitException( 'headersexception', isUpload, 'req.headers[..] not found, or HTTP method not handled ', 0, true );
        return;
    }

};//end parse



FPROTO.parseUrlEncodedData = function( chunk ){ 
    this.qsBuffer += chunk.toString( 'utf8' );
};                


FPROTO.sendResponseToUrlEncoded = function(){
    var fields = querystring.parse( this.qsBuffer, '&', '=' );
    for( var f in fields ){
        this.emit( 'field', f, fields[ f ] );
    }
    this.emit( 'end', [], this.endResults, this.res, this.next ); //TODO augment endResults
};
            

FPROTO.parseMultipartData = function( chunk ){
    this.req.pause();
    var bb = this.boundBuffer,
        bblength = bb.length,
        chunkLength = chunk.length,                        
        stime =  new Date(),
        results = parser.quickSearch( bb, chunk ),
        etime = new Date(),
        resultsLength = results.length,
        emsg = '',
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
                        this.fileStream = new fs.WriteStream( cfg.fpath ); // ,{ flags: 'w', encoding: null, mode: 0666 });
                        apply( this.fileStream, cfg, true );
                        this.logger( 3, '\nformaline, file stream created --> ', this.fileStream );
                    }
                }
            }catch( fserr ){
                emsg = 'exception writing file stream : ' + this.fileStream + ', err: ' + fserr.message ;
                emsg +=  '\n error stack:\n  ' + fserr.stack;
                this.emitException( 'streamexception', true, emsg, 0, true );
                return;
            }
        } ).bind( this ),
    
        copyBuffer = ( function( sourceBuffer, targetBuffer, tStart, dStart, dEnd ){
            try{
                sourceBuffer.copy( targetBuffer, tStart, dStart, dEnd );
            }catch( berr ){
                emsg = 'exception copying buffer data file: ' + berr.message;
                emsg += '\nboundary length:' + bblength + '\nchunk length:' + sourceBuffer.length;
                emsg += '\nresult:' + result + '\n results length:' + resultsLength + '\n buffer start index:' + ( 0 ) + '\n buffer data end index: ' + ( targetBuffer.length - 1 ) + '\n target buffer length: ' + targetBuffer.length;
                emsg +=  '\n error stack:\n  ' + berr.stack;
                this.emitException( 'bufferexception', true, emsg, 0, true );
                return; 
            }
        } ).bind( this ),
        
        addToIncompleteList = ( function( file ){
            var incomplete = this.incompleteFilesCollection ; 
            if( incomplete.list.indexOf( file.path ) < 0 ){
                incomplete.list.push( file.path );
                incomplete[ path.basename( file.path ) ] = {
                    origname: file.origname,
                    dir: path.dirname( file.path ),
                    type: file.ctype,
                    rbytes: this.fileSize,
                    field: file.fieldname
                };
                this.emitException( 'warning', this.uploadRootDir, 'Warning: max upload size exceeded, file incomplete -> ' + path.basename( file.path ), 0 );
            }
        } ).bind( this ),
        
        addToCompletedList = ( function( file ){
            this.completedFiles.push( file.path );
            this.emit( 'filereceived', path.basename( file.path ), file.origname, path.dirname( file.path ), file.ctype, this.fileSize, file.fieldname, ( ( this.sha1sum ) ? file.sha1sum.digest( 'hex' ) : undefined ) );
        } ).bind( this ),
        
        closeFileStream = ( function( file ){
            file.end();
            this.logger( 3, '\n -> closed file stream -->', file.path, '\n' );
        } ).bind( this ),
        
        resetFileStream = ( function(){
            this.fileStream = null;
        } ).bind( this ),
        
        generateHashFileName = ( function( fname ){
            return ( crypto.createHash( 'sha1' ).update( fname ).digest( 'hex' ) + ( ( this.holdFilesExtensions ) ? path.extname( fname ) : '' ) );
        } ).bind( this );
    
    /** END INNER METHODS**/


    this.logger( 3, '\nreceiving data -->' );
    this.logger( 3, 'chunk size:', chunk.length, '\n--> quickSearch parser results:\n', results );

    if( this.bytesReceived <= this.uploadThreshold ){ // is size allowed? 
        if( this.fileStream ){
            if( this.chopped ){ // file data is chopped? && fileStream exists?
                if( resultsLength === 0 ){ // chunk is only data payload
                    this.logger( 3, '<-- this chunk contains only data..\nbytes written to disk: ' + this.bytesWrittenToDisk + ',\ chunks received: ' + this.chunksReceived );
                    writeToFileStream( chunk );
                }else{ 
                    //chunk contains other boundaries, the first result is the end of previous data chunk
                    this.logger( 3, '<-- this chunk contains data and fields..\n' );
                    
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
                fieldCtype = ( contentType && contentType[ 1 ] ) ? contentType[ 1 ] : 'application/octet-stream';

            if( fileName ) { // file field
                var escapedFilename = fileName[ 1 ].replace( escapeChars, '' ),
                    sha1filename = generateHashFileName( escapedFilename ), // this.generateHashFileName( escapedFilename ),
                    filepath = this.uploadRootDir + sha1filename;                                    
                       
                //this.logger( 2,' ->field: ' + fieldName[ 1 ] + ', orig filename: ' + escapedFilename + ', (sha1sum) filename: ' + sha1filename + ', content-type: ' + fieldCtype, 'file extension:', fileExt );
                if( this.completedFiles.indexOf( filepath ) > -1 ){ 
                    filepath = this.uploadRootDir + generateHashFileName( ( new Date().getTime() ) + '_' + escapedFilename  );
                    this.emitException( 'warning', true, ' Warning: this (sha1sum) filename already exists -> ' + sha1filename + ', orig filename: ' + escapedFilename + ', new (sha1sum) filename: ' + path.basename( filepath ), 1 );
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
                        this.logger( 3, '   -->', results[ i ], '<-- last field is chopped' );
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
                        resetFileStream();
                    }
                }    
            }else{ // normal field
                if( i < resultsLength - 1 ){
                    fileDataChunk = new Buffer( results[ i + 1 ].start - 2   - ( results[ i ].finish + 4 ) ); // + 4 ( CRLFCRLF )
                    copyBuffer( chunk, fileDataChunk, 0, results[ i ].finish + 4 , results[ i + 1 ].start - 2 ); 
                    
                    this.logger( 3,' -> field:', fieldName[ 1 ] + ', content-type: ' + fieldCtype , 'data: *', fileDataChunk.toString(), '*' );
                    this.emit( 'field', fieldName[ 1 ], fileDataChunk.toString() );
                }
            }
        } // end if(fieldname)         
    } // end for
    this.req.resume();
};


/* SEND RESPONSE */


FPROTO.sendResponseToMultipart =  function( nbytes ){                 
    this.endTime = new Date().getTime();
    
    var logParserStats = ( function(){
            this.logger( 2, '\n (°)--/PARSER_STATS/ ' ); 
            this.logger( 2, '  |                       ' );
            this.logger( 2, '  |- chunks received      :', this.chunksReceived ) ;
            this.logger( 2, '  |- data parsed          :', ( this.bytesReceived / ( 1024 * 1024 ) ).toFixed( 4 ), 'MBytes' );
            this.logger( 2, '  |- overall parsing time :', this.parserOverallTime / 1000,'secs'); 
            this.logger( 2, '  |- average data rate    :', ( ( this.bytesReceived / ( 1024 * 1024 ) ) / ( this.parserOverallTime / 1000 )).toFixed( 1 ), 'MBytes/sec' );
            this.logger( 2, '  |- average chunk size   :', ( ( this.bytesReceived / 1024 ) / this.chunksReceived ).toFixed( 3 ), 'KBytes' );
            this.logger( 2, '  |- average chunk rate   :', ( ( this.chunksReceived ) / ( this.parserOverallTime / 1000 ) ).toFixed( 1 ), 'chunk/sec' );
        } ).bind( this ),
    
        logOverallResults = ( function( updateEndTime ){
            if( updateEndTime === true ){
                this.endTime = new Date().getTime();
            }
            this.logger( 2, '\n (°)--/POST_OVERALL_RESULTS/ ');
            this.logger( 2, '  |                        ');
            this.logger( 2, '  |- data received        :', ( this.bytesReceived / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes' );
            this.logger( 2, '  |- data written to disk :', ( this.bytesWrittenToDisk  / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes' );
            this.logger( 2, '  |- bytes allowed        :', ( this.uploadThreshold / ( 1024 * 1024 ) ).toFixed( 6 ), 'MBytes');
            this.logger( 2, '  |- overall time         :', ( ( this.endTime - this.startTime ) / 1000 ), 'secs' );
            this.logger( 2, '  |- completed files      :', this.completedFiles.length );
            this.logger( 2, '  |- partial files        :', this.incompleteFilesCollection.list.length,'\n' );
        
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
            //this.incompleteFilesCollection = { list: [] }; //TODO
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
        this.emit( 'end', this.incompleteFilesCollection.list, this.endResults, this.res, this.next );
        logParserStats();
        logOverallResults();
        resetAttributes();
    }else{
        if( this.incompleteFilesCollection.list.length === 0 ){
            this.emit( 'end', [], this.endResults, this.res, this.next );//incomplete files are already removed, previously it emits exception and fileremoved events 
            logParserStats();
            logOverallResults();
            resetAttributes();
        }else{
            for( var i = 0, ufile = this.incompleteFilesCollection.list, len = ufile.length, currfile = ufile[ 0 ]; i < len; i++, currfile = ufile[ i ] ){
                fs.unlink( currfile, (function( err, cfile, i, len ){
                    if( err ){
                        this.emitException( 'warning', isUpload, 'Warning: file unlink exception -> ' + cfile+', directory -> ' + this.uploadRootDir, 0 );
                    }else{
                         this.logger( 0, '\nformaline, incomplete file removed -->', cfile );
                         var ifile = this.incompleteFilesCollection[ path.basename( cfile ) ];
                         this.emit( 'fileremoved', path.basename( cfile ), ifile.origname, ifile.dir, ifile.type, ifile.rbytes, ifile.field );
                    }
                    if( i === len - 1){
                        logParserStats();
                        logOverallResults( true );
                        resetAttributes();
                        this.incompleteFilesCollection = { list: [] };
                        this.emit( 'end', [], this.endResults, this.res, this.next );//incomplete files are already removed, previously it emits exception and fileremoved events 
                    }
                }).createDelegate( this, [ currfile, i, len ], true ) );
            }//end for
        }
    }
};//end sendResponse     



//TODO TODO TODO 
//NOT COMPATIBLE WITH formaline >= 0.4.0
//NEED TO CLEAN AND CHANGE CODE FOR NEW LISTENERS SIGNATURE

// THIS IS A CUSTOM AJAX (XHR2) HANDLER, GOOD FOR TESTING, AND FOR ME ;)
// THIS METHOD IS NEVER CALLED FOR HTTP-COMPLIANT UPLOAD REQUESTS 
// IT IS CALLED ONLY WHEN AREN'T FOUND ANY BOUNDARY STRINGS IN (CUSTOMIZED) AJAX REQUEST
// THEREFORE IT DOESN'T MAKE USE OF QUICKPARSER
// FOR NOW, ANY FILE IS PUTTED INTO A SEPARATE DIRECTORY ( 1 REQUEST => 1 FILE )
         
// TODO TODO
// Add drain (all queued data written) handler to resume receiving request data
// this.fileStream.addListener("drain", (function() {
//    this.logger(3,'\nformaline, drain event! '); 
// }).bind(this));
                            


FPROTO.handleCustomXHR =  function( headers ){
            //TODO add dataProgress?
            if( headers && headers[ 'x-file-size' ] ){
                if( headers[ 'x-file-size' ] > this.uploadThreshold ) {
                    if( this.checkContentLength === true ) {
                        this.emit( 'headersexception', ( headers[ 'content-type' ].indexOf( 'multipart/form-data' ) !== -1 ) ? true : false , 'formaline, req.headers[content-length] exceeds max allowable: ' + headers[ 'x-file-size' ] + ' > ' + this.uploadThreshold, this.res, this.next );
                        this.emit( 'end', [], {}, this.res, this.next );
                        return;
                    }else{
                      //warning
                      this.logger( 1, '\nformaline, req.headers[content-length] --> Content Length Warning, bytes to receive:', headers['x-file-size'], 'max allowed:', this.uploadThreshold );
                      this.emit('warning', 'Content Length Warning, bytes to receive: ' + headers['x-file-size'] + ', allowed: ' + this.uploadThreshold );
                    }
                }
            }
            if( headers && headers[ 'x-file-name' ] ){                              
                //permits ; in filenames ? TODO
                //var escapeChars = /[\\[\](\)\{\}\/\\\|\!\:\=\?\*\+\^\$\@\""\<\>\%\\:\,\;\:\`\s\t\r\n]/g,
                var escapeChars = /[\\[\]\(\)\{\}\/\\\|\!\:\=\?\*\+\^\$\@\"\<\>\%\\:\,\:\`\s\t\r\n]/g,
                    fileName =  headers[ 'x-file-name' ],
                    escapedFilename = fileName.replace( escapeChars, '' ),
                    fileExt = path.extname( escapedFilename ),
                    hext = this.holdFilesExtensions,
                    sha1filename = crypto.createHash( 'sha1' ).update( escapedFilename ).digest( 'hex' ) + ( ( hext ) ? fileExt : '' ),
                    filepath = this.uploadRootDir + sha1filename;
                try{
                    this.fileStream = new fs.WriteStream( filepath );//,{ flags: 'w', encoding: null, mode: 0666 });
                }catch( fserr ){
                    this.emit( 'exception', true, 'formaline exception creating filestream, path: ' + filepath + ', err: ' + fserr.message, this.res, this.next );
                    this.logger( 0, '\nformaline, filestream exception -->', fserr, '\nfileStream:', this.fileStream, '\nerror.stack:', fserr.stack );
                    this.emit( 'end', [], {}, this.res, this.next ); // TODO
                    return; 
                }
                this.fileStream.ctype = headers[ 'x-file-type' ] || "application/octet-stream";
                this.fileStream.fieldname = headers[ 'x-file-fieldname' ] || 'isEmpty'; //TODO fieldname ? add  x-file-field header
                this.fileStream.origname = escapedFilename;
                this.fileStream.path = filepath;
                this.fileStream.sha1sum = ( this.sha1sum ) ? crypto.createHash( 'sha1' ) : null;
                
                this.req.addListener( 'data', ( function( chunk ){
                    if( this.bytesReceived <= this.uploadThreshold ){
                        this.req.pause();//Pause req event (data,end..)
                        this.bytesReceived += chunk.length;
                        this.fileSize += chunk.length; // single file, bytes received for request is the file size in bytes
                        this.chunksReceived++;
                        // console.log( this.bytesReceived, this.chunksReceived );
                        try{
                            this.fileStream.write( chunk );
                        }catch( fserr ){
                            this.emit( 'exception', true, 'formaline, exception writing chunk to filestream: ' + fserr.message, this.res, this.next );
                            this.logger( 0, '\nformaline logger, exception writing chunk to filestream -->', fserr, '\nfileStream: ', this.fileStream, '\nerror.stack:', fserr.stack );
                            this.emit( 'end', [], {}, this.res, this.next ); // TODO
                            return; 
                        }
                        this.bytesWrittenToDisk += chunk.length;
                        this.req.resume();
                      ( this.sha1sum ) ? this.fileStream.sha1sum.update( chunk ) : null;
                    }else{
                        if( this.fileStream && ( this.incompleteFilesCollection.list.indexOf( this.fileStream.path ) < 0 ) ){
                            this.incompleteFilesCollection.list.push( this.fileStream.path );
                            this.incompleteFilesCollection[ path.basename( this.fileStream.path ) ] = {
                                origname: this.fileStream.origname,
                                dir: path.dirname( this.fileStream.path ),
                                type: this.fileStream.ctype,
                                rbytes: this.fileSize,
                                field: this.fileStream.fieldname
                            };
                            this.emit( 'warning', 'formaline, maxUploadsize exceeded, file incomplete -->' + path.basename( this.fileStream.path ) + ', original file name: ' + this.fileStream.origname );
                        }
                    }
              }).bind(this) ); //end addListener 'data'
              
              this.req.addListener('end',(function(chunk){
                  this.endTime = new Date().getTime();
                  this.endResults = {
                      bytesReceived : this.bytesReceived,
                      bytesWrittenToDisk: this.bytesWrittenToDisk,
                      chunksReceived : this.chunksReceived,
                      overallSecs: ( this.endTime - this.startTime ) / 1000,
                      filesCompleted: this.completedFiles.length,
                      filesRemoved: this.incompleteFilesCollection.list.length
                  };
                  
                  if( this.incompleteFilesCollection.list.length < 1 ){    
                      this.completedFiles.push( this.fileStream.path );
                      this.emit( 'filereceived', path.basename( this.fileStream.path ), this.fileStream.origname, path.dirname( this.fileStream.path ), this.fileStream.ctype, this.fileSize, this.fileStream.fieldname, ( ( this.sha1sum ) ? this.fileStream.sha1sum.digest( 'hex' ) : undefined ) );
                      this.fileStream.end();
                      this.endResults.filesCompleted = this.completedFiles.length;
                      this.emit( 'end', [], this.endResults, this.res, this.next );
                      //this.logParserStats();
                      this.logOverallResults( true );
                      this.resetAttributes();
                  }else{
                      if( this.removeIncompleteFiles === false ){
                          this.emit( 'end', this.incompleteFilesCollection.list, this.endResults, this.res, this.next); 
                      }else{
                      
                          fs.unlink( this.incompleteFilesCollection.list[ 0 ], (function( err, cfile ){
                                    if( err ){
                                        this.logger( 0, '\nformaline, file unlink exception -->', err);
                                        this.emit( 'warning', 'formaline, file unlink exception : '+cfile+' --> '+err.message );
                                    }else{
                                        this.logger( 0, '\nformaline, incomplete file removed -->', cfile );
                                        var ifile = this.incompleteFilesCollection[path.basename( cfile ) ];
                                        this.emit( 'fileremoved', path.basename( cfile ), ifile.origname, ifile.dir, ifile.type, ifile.rbytes, ifile.field );
                                        this.endResults.filesRemoved = this.incompleteFilesCollection.list.length;
                                    }
                                    this.emit( 'end', [], this.endResults, this.res, this.next );//incomplete files are already removed, previously it emits exception and fileremoved events 
                                    //this.logParserStats();
                                    this.logOverallResults(true);
                                    this.resetAttributes();
                                    this.incompleteFilesCollection = { list: [] };

                                    
                                }).createDelegate( this, [ this.incompleteFilesCollection.list[ 0 ] ],true) );
                      }
                  }
                  return;
              }).bind( this ) );
            
            }else{
                this.emit( 'headersexception', true , 'formaline, req.headers[] X-File-Name are not defined', this.res, this.next );
                this.logger( 0 , '\nformaline, req.headers[] --> boundary string and X-File-Name not found .. ' );
                this.emit( 'end', [], {}, this.res, this.next ); // TODO
                return;
            }
};// end handleXHR


exports.formaline = formaline;
exports.parse = formaline;
