/*!
 * formaline
 * Copyright(c) 2011 Guglielmo Ferri <44gatti@gmail.com>
 * MIT Licensed
 */

/**
 * Library version 0.3.0
 */

exports.version = '0.3.0';

var fs = require('fs'),
    crypto = require('crypto'),
    emitter = require('events').EventEmitter,
    querystring = require('querystring'),
    path = require('path'),
    ext = require('./extensions'),
    parser  = require('./quickSearch');

var setDebuggingLevel = function(dstring){
    var p, dlevels = querystring.parse("debug:off,1:on,2:on,3:on", ',',':');//debug:'on' print always : 0 level and level not
    if(dstring){
        try{
          p = querystring.parse( dstring, ',', ':' );
          dlevels = p;
        }catch(err){
            console.log( 'formaline.setDebuggingLevel(): config string parse error ->', err.message );
        }
    }
    return function(){
        var args = Array.prototype.slice.call(arguments),//convert to array
            level = args[0];
        if( dlevels.debug === 'off' ){ return; }
        if( typeof level === 'number' ){
            if( ( level === 0 ) || ( dlevels[level] === 'on' )){
                return console.log.apply(this,args.slice(1,args.length));
            }
        }else{
            return console.log.apply(this,args);
        }
    };
};


var formaline = function (config){
    emitter.call(this,[]);
    
    //config default params
    this.uploadRootDir = '/tmp/';
    this.emitDataProgress = null;
    this.uploadThreshold = 1024*1024*1024; //bytes
    this.checkContentLength = false;
    this.removeIncompleteFiles = true;
    this.holdFilesExtensions = false;
    //this.emitEndAfterExceptions = true; //TODO always end with graceful response
    this.sha1sum = true; 
    this.listeners = {};
    this.logging = null;

    if(config && (typeof config === 'object')){
        var me = this;
        apply( this, config );
        (function(){
            var e, l = me.listeners;
            for (e in l) {
                if (typeof l[e] === 'function') {
                    me.on(e,l[e]);
                }//else{
                    //me.on(p,emptyFn);
                //}
            }
        })();
    }
    // moved here for don't overwrite them with apply() ->
    this.logger = setDebuggingLevel(this.logging);
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
    
    this.logParserStats = function(){
        this.logger(2, '\n (°)--/PARSER_STATS/ '); 
        this.logger(2, '  |                       ');
        this.logger(2, '  |- chunks received      :',this.chunksReceived);
        this.logger(2, '  |- data parsed          :', ( this.bytesReceived / ( 1024 * 1024 ) ).toFixed(4), 'MBytes' );
        this.logger(2, '  |- overall parsing time :', this.parserOverallTime / 1000,'secs'); 
        this.logger(2, '  |- average data rate    :', ( ( this.bytesReceived / ( 1024 * 1024 ) ) / ( this.parserOverallTime / 1000 )).toFixed(1), 'MBytes/sec' );
        this.logger(2, '  |- average chunk size   :', ( ( this.bytesReceived / 1024 ) / this.chunksReceived ).toFixed(3), 'KBytes' );
        this.logger(2, '  |- average chunk rate   :', ( ( this.chunksReceived ) / ( this.parserOverallTime / 1000 ) ).toFixed(1), 'chunk/sec' );
    };
    this.logOverallResults = function(updateEndTime){
        if( updateEndTime === true ){
            this.endTime = new Date().getTime();
        }
        this.logger(2, '\n (°)--/OVERALL_RESULTS/ ');
        this.logger(2, '  |                        ');
        this.logger(2, '  |- data received        :', ( this.bytesReceived / ( 1024 * 1024 ) ).toFixed(2), 'MBytes' );
        this.logger(2, '  |- data written to disk :', ( this.bytesWrittenToDisk  / ( 1024 * 1024 ) ).toFixed(2), 'MBytes' );
        this.logger(2, '  |- bytes allowed        :', ( this.uploadThreshold / ( 1024 * 1024 ) ).toFixed(2), 'MBytes');
        this.logger(2, '  |- overall time         :', ( ( this.endTime - this.startTime ) / 1000 ), 'secs' );
        this.logger(2, '  |- completed files      :', this.completedFiles.length );
        this.logger(2, '  |- partial files        :', this.incompleteFilesCollection.list.length,'\n' );

    };
    this.resetAttributes = function(){
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
     };
};

formaline.prototype.__proto__ = emitter.prototype;

fproto = formaline.prototype;

fproto.parse = function( req, res, next ){
    
    this.startTime = new Date().getTime();
    
    this.next = ( next && (typeof next === 'function')) ? next : emptyFn;//try to add connect layer compatibility

    if( req && ( typeof req === 'object' ) && ( req.body === undefined ) && ( req.method === 'POST' || req.method === 'PUT' ) && 
       ( req.headers ) && ( req.headers['content-type'] ) && ( ~req.headers['content-type'].indexOf('multipart/form-data' ) || ~req.headers['content-type'].indexOf('urlencoded' ) ) ){
        this.req = req;
        this.res = res;

        //this.req.setEncoding('utf8');

        try{ //try to create a sub-directory of root upload directory
            this.uploadRootDir = this.uploadRootDir + parseInt( new Date().getTime() * (1 + Math.random()) * 10 * 32, 10 ) + '/';
            fs.mkdirSync( this.uploadRootDir, '0750' );//'0755');
        }catch( oerr ){
            this.logger(0,'\nformaline, mkDir Warning-->', this.uploadRootDir, ' msg: '+oerr.message);
            this.uploadRootDir = '/tmp/' + parseInt( new Date().getTime() * (1 + Math.random()) * 10 * 32, 10 ) + '/';
            this.emit('warning',oerr.message);
            try{
                fs.mkdirSync( this.uploadRootDir, '0750' );//'0755'); 
            }catch( ierr ){
                this.logger(0,'\nformaline, default mkDir Error-->',this.uploadRootDir,' msg:',ierr.message);
                this.emit('pathexception', this.uploadRootDir, ierr.message, this.res, this.next);
                this.emit( 'end', [], {}, res, next); //TODO
                return;
            }
        }
        
        this.dataProgress = ( function( headerContentLength ){
            var dProgress = this.emitDataProgress,
                bytesExpected = headerContentLength,
                ratio = ( bytesExpected && ( bytesExpected > 1 ) ) ? function(bytes){ return ( bytes / bytesExpected ).toFixed(8); } : dummyFn(-1);
            if( dProgress === true ){
                return function(isEnd){    
                    this.emit( 'dataprogress', this.bytesReceived, this.chunksReceived, ratio(this.bytesReceived) );//every chunks 
                };
            }else if( typeof dProgress === 'number'){
                dProgress = parseInt(dProgress,10);
                if( dProgress < 2 ){ dProgress = 2; }
                return function( isEnd) {
                    if( ( ( this.chunksReceived % dProgress ) === 1 ) || isEnd ){// mod 1 is for first chunk
                        this.emit( 'dataprogress', this.bytesReceived, this.chunksReceived, ratio(this.bytesReceived) );//every dProgress chunks 
                    }
                };
            }else{
                return emptyFn;
            }
        }).bind( this, req.headers['content-length'] )();
        
        this.handleXHR2 =  function( headers ){
            //TODO add dataProgress
            if( headers && headers['x-file-size']){
                if( headers['x-file-size'] > this.uploadThreshold ) {
                    if( this.checkContentLength === true ) {
                        this.emit( 'headersexception', ( headers['content-type'].indexOf('multipart/form-data' ) !== -1 ) ? true : false , 'formaline, req.headers[content-length] exceeds max allowable: ' + headers['x-file-size'] + ' > ' + this.uploadThreshold, this.res, this.next );
                        this.emit( 'end', [], {}, res, next);
                        return;
                    }else{
                      //warning
                      this.logger( 1, '\nformaline, req.headers[content-length] --> Content Length Warning, bytes to receive:', headers['x-file-size'], 'max allowed:', this.uploadThreshold );
                      this.emit('warning', 'Content Length Warning, bytes to receive: ' + headers['x-file-size'] + ', allowed: ' + this.uploadThreshold );
                    }
                }
            }
            if( headers && headers['x-file-name'] ){                              
                var escapeChars = /[\\[\](\)\{\}\/\\\|\!\:\=\?\*\+\^\$\@\""\<\>\%\\:\,\;\:\`\s\t\r\n]/g,
                    fileName =  headers['x-file-name'],
                    escapedFilename = fileName.replace( escapeChars, ''),
                    fileExt = path.extname(escapedFilename),
                    hext = this.holdFilesExtensions,
                    sha1filename = crypto.createHash('sha1').update(escapedFilename).digest('hex') + ( (hext) ? fileExt : '' ),
                    filepath = this.uploadRootDir + sha1filename;
                try{
                    this.fileStream = new fs.WriteStream( filepath );//,{ flags: 'w', encoding: null, mode: 0666 });
                }catch(fserr){
                    this.emit('exception', true, 'formaline exception creating filestream, path: '+filepath+', err: '+fserr.message, this.res, this.next);
                    this.logger(0,'\nformaline, exception -->', fserr);
                    this.emit( 'end', [], {}, this.res, this.next); // TODO
                    return; 
                }
                this.fileStream.ctype = headers['x-file-type'] || "application/octet-stream";
                this.fileStream.fieldname = headers['x-file-field'] || ''; //TODO fieldname ? add  x-file-field header
                this.fileStream.origname = escapedFilename;
                this.fileStream.path = filepath;
                this.fileStream.sha1sum = ( this.sha1sum ) ? crypto.createHash('sha1') : null;
                
                req.addListener('data',(function(chunk){
                    if( this.bytesReceived <= this.uploadThreshold ){
                        this.req.pause();//Pause req event (data,end..)
                        this.bytesReceived += chunk.length;
                        this.fileSize += chunk.length; // single file, bytes received for request is the file size in bytes
                        this.chunksReceived++;
                        // console.log( this.bytesReceived, this.chunksReceived );
                        try{
                            this.fileStream.write(chunk);
                        }catch(fserr){
                            this.emit('exception', true, 'formaline, exception writing chunk to filestream: '+fserr.message, this.res, this.next);
                            this.logger(0,'\nformaline logger, exception writing chunk to filestream -->', fserr,', fileStream: '+this.fileStream);
                            this.emit( 'end', [], {}, this.res, this.next); // TODO
                            return; 
                        }
                        this.bytesWrittenToDisk += chunk.length;
                        this.req.resume();
                      ( this.sha1sum ) ? this.fileStream.sha1sum.update(chunk) : null;
                    }else{
                        if( this.fileStream && (this.incompleteFilesCollection.list.indexOf(this.fileStream.path) < 0) ){
                            this.incompleteFilesCollection.list.push(this.fileStream.path);
                            this.incompleteFilesCollection[path.basename(this.fileStream.path)] = {
                                origname: this.fileStream.origname,
                                dir: path.dirname(this.fileStream.path),
                                type: this.fileStream.ctype,
                                rbytes: this.fileSize,
                                field: this.fileStream.fieldname
                            };
                            this.emit('warning','formaline, maxUploadsize exceeded, file incomplete -->'+path.basename(this.fileStream.path)+', original file name: '+this.fileStream.origname);
                        }
                    }
              }).bind(this) );
              
              req.addListener('end',(function(chunk){
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
                      this.completedFiles.push(this.fileStream.path);
                      this.emit( 'filereceived', path.basename( this.fileStream.path ), this.fileStream.origname, path.dirname(this.fileStream.path), this.fileStream.ctype, this.fileSize, this.fileStream.fieldname,( ( this.sha1sum ) ? this.fileStream.sha1sum.digest('hex') : undefined ) );
                      this.fileStream.end();
                      this.emit( 'end', [], this.endResults, res, next);
                      //this.logParserStats();
                      this.logOverallResults(true);
                      this.resetAttributes();
                  }else{
                      if( this.removeIncompleteFiles === false ){
                          this.emit( 'end', this.incompleteFilesCollection.list, this.endResults, res, next); 
                      }else{
                      
                          fs.unlink( this.incompleteFilesCollection.list[0], (function( err, cfile){
                                    if( err ){
                                        this.logger(0,'\nformaline, exception -->', err);
                                        this.emit('warning','formaline, exception file unlink error: '+cfile+' --> '+err.message );
                                    }else{
                                        this.logger(0,'\nformaline, incomplete file removed -->', cfile);
                                        var ifile = this.incompleteFilesCollection[path.basename(cfile)];
                                        this.emit( 'fileremoved', path.basename(cfile), ifile.origname, ifile.dir, ifile.type, ifile.rbytes, ifile.field );
                                    }
                                    this.emit('end', [], this.endResults,this.res, this.next);//incomplete files are already removed, previously it emits exception and fileremoved events 
                                    //this.logParserStats();
                                    this.logOverallResults(true);
                                    this.resetAttributes();
                                    this.incompleteFilesCollection = { list: [] };

                                    
                                }).createDelegate( this, [ this.incompleteFilesCollection.list[0] ],true) );
                      }
                  }
                  return;
              }).bind(this) );
            
            }else{
                this.emit('headersexception',true ,'formaline, req.headers[] X-File-Name are not defined', this.res, this.next);
                this.logger(0,'\nformaline, req.headers[] --> boundary string and X-File-Name not found .. ');
                this.emit( 'end', [], {}, res, next); // TODO
                return;
            }
        };// end handleXHR2
        
        var hs = req.headers,
            clength = hs['content-length'],
            ctype = hs['content-type'],
            bytes2Receive = 0;
               
        try{
            this.boundString = ctype.match(/boundary=([^;]+)/mi)[1];
        }catch(err){
            //if boundary is not defined, it could be an XHR request
            this.handleXHR2(hs);
            return;
        }
        
        if( clength ){
            try{
                bytes2Receive = parseInt(clength,10);
                if( bytes2Receive > this.uploadThreshold ){//check Max Upload Size in bytes
                    if(this.checkContentLength === true){
                        this.emit('headersexception',(ctype.indexOf('multipart/form-data' )!== -1) ? true : false ,'formaline, req.headers[content-length] exceeds max allowable: '+bytes2Receive+' > '+this.uploadThreshold, this.res, this.next);
                        this.emit( 'end', [], {}, res, next); // TODO
                        return;
                    }
                    //warning
                    this.logger(1,'\nformaline, req.headers[content-length] --> Content Length Warning, bytes to receive:',bytes2Receive,'max allowed:',this.uploadThreshold);
                    this.emit('warning', 'Content Length Warning, bytes to receive: '+bytes2Receive+', allowed: '+this.uploadThreshold);
                }else{
                    this.logger(0,'\nformaline, req.headers[content-length] --> ', bytes2Receive);
                }
            }catch(error){
                //error
                this.emit('headersexception',(ctype.indexOf('multipart/form-data' )!== -1) ? true : false ,'formaline, req.headers[content-length] parse error -> value is: ',clength, this.res, this.next);
                this.logger(0,'\nformaline, req.headers[content-length] --> Parse Length Exception', error);
                this.emit( 'end', [], {}, res, next); // TODO
                return;
            }
        }else{
            //error
            this.emit('headersexception',(ctype.indexOf('multipart/form-data' )!== -1) ? true : false ,'formaline, req.headers[content-length] not defined', this.res, this.next);
            this.logger(0,'\nformaline, req.headers[content-length] --> Parse Length Error');
            this.emit( 'end', [], {}, res, next); // TODO
            return;
        }

        if( ctype ){
            this.logger(0,'\nformaline, req.headers[content-type] --> ', ctype);
            if( ~ctype.indexOf('multipart/form-data') ){
                
                this.boundBuffer = new Buffer( '--' + this.boundString );
                this.logger(1,'\nboundary pattern:'+this.boundString);
                this.logger(1,'\nboundary length:'+this.boundString.length);
                
                req.addListener('data',(function(chunk){
                    this.req.pause();//Pause req event (data,end..)
                    var bb = this.boundBuffer,
                        bblength = bb.length,
                        chunkLength = chunk.length,                        
                        stime =  new Date(),
                        results = parser.quickSearch( bb, chunk ),
                        etime = new Date(),
                        resultsLength = results.length;
                    
                    this.parserOverallTime += ( etime - stime );    
                    this.bytesReceived += chunk.length;
                    this.chunksReceived++;
                   
                    this.dataProgress();//emit DataProgress

                    this.logger(3,'\nreceiving data-->');
                    this.logger(3,'chunk size:',chunk.length,'\n--> quickSearch results:\n',results);

                    if( this.bytesReceived <= this.uploadThreshold ){// is size allowed? 
                        if( this.chopped && this.fileStream ){// file data is chopped? && fileStream exists?
                            if( resultsLength === 0 ){//chunk is only data payload
                                //write to file? 
                                try{
                                    this.fileStream.write(chunk);
                                }catch(fserr){
                                    this.emit('exception', true, 'formaline, exception writing chunk to filestream: '+fserr.message, this.res, this.next);
                                    this.logger(0,'\nformaline logger, exception writing chunk to filestream -->', fserr,', fileStream: '+this.fileStream);
                                    this.emit( 'end', [], {}, this.res, this.next); // TODO
                                    return; 
                                }
                                ( this.sha1sum ) ? this.fileStream.sha1sum.update(chunk) : null; 
                                this.fileSize += chunk.length;
                                this.bytesWrittenToDisk += chunk.length;
                                this.logger(3,'<--this chunk contains only data..\n');
                            }else{ //chunk contains other boundaries, the first result is the end of previous data chunk
                                var rstart = results[0].start;
                                var fileData = new Buffer( rstart - 2 );   //last two chars are CRLF
                                if( ( this.bytesWrittenToDisk + fileData.length < this.uploadThreshold ) ){
                                    try{
                                        chunk.copy(fileData,0, 0, rstart - 2 );
                                        this.fileStream.write(fileData);
                                        ( this.sha1sum ) ? this.fileStream.sha1sum.update(fileData) : null;
                                    }catch(err){
                                        this.emit('exception','formaline, exception copying buffer data file : '+this.fileStream.path+' --> '+err.message, true, this.res, this.next);
                                        this.logger(0,'\nformaline, exception -->', err);
                                        this.emit( 'end', [], {}, this.res, this.next); // TODO
                                        return; 
                                    }
                                    this.fileSize += fileData.length;
                                    this.bytesWrittenToDisk += fileData.length;
                                }
                                this.fileStream.end();
                                this.completedFiles.push(this.fileStream.path);
                                this.emit( 'filereceived', path.basename( this.fileStream.path ), this.fileStream.origname, path.dirname(this.fileStream.path), this.fileStream.ctype, this.fileSize, this.fileStream.fieldname,( ( this.sha1sum ) ? this.fileStream.sha1sum.digest('hex') : undefined ) );
                                this.logger(3,'<-- this chunk contains data and fields..\n');
                            }
                        }
                    }else{
                          if( this.fileStream && (this.incompleteFilesCollection.list.indexOf(this.fileStream.path) < 0) ){
                            this.incompleteFilesCollection.list.push(this.fileStream.path);
                            this.incompleteFilesCollection[path.basename(this.fileStream.path)] = {
                                origname: this.fileStream.origname,
                                dir: path.dirname(this.fileStream.path),
                                type: this.fileStream.ctype,
                                rbytes: this.fileSize,
                                field: this.fileStream.fieldname
                            };
                            this.emit('warning','formaline, maxUploadsize exceeded, file incomplete -->'+path.basename(this.fileStream.path)+', original file name: '+this.fileStream.origname);
                        }
                    }
                    
                    for( var i = 0; i < resultsLength; i++ ){
                        var result = results[i],
                            rfinish = result.finish,
                            rstart = result.start,
                            fileData = null,
                            heads = new Buffer( ( rfinish ) - ( rstart + bblength + 2 ) );//only the headers
                        
                        //TODO remove duplicated variables, check the creation of heads buffer (indexes)
                        chunk.copy(heads, 0, rstart + bblength + 2, rfinish );
                        
                        var headers = heads.toString(),
                            fieldName = headers.match(/name="([^\"]+)"/mi);

                        if(fieldName){
                           
                            var fileName = headers.match(/filename="([^;]+)"/mi),
                                contentType  = headers.match(/Content-Type:([^;]+)/mi);

                            if(fileName){//file field
                                var escapeChars = /[\\[\](\)\{\}\/\\\|\!\:\=\?\*\+\^\$\@\""\<\>\%\\:\,\;\:\`\s\t\r\n]/g,
                                    escapedFilename = fileName[1].replace( escapeChars, ''),
                                    fileExt = path.extname(escapedFilename),
                                    hext = this.holdFilesExtensions,
                                    sha1filename = crypto.createHash('sha1').update(escapedFilename).digest('hex') + ( (hext) ? fileExt : '' ),
                                    filepath = this.uploadRootDir + sha1filename;

                                   
                                    
                                this.logger(2,'   ->field: '+fieldName[1]+', orig filename: '+escapedFilename+',  (sha1sum) filename: '+sha1filename+', content-type: '+contentType[1],'file extension:',fileExt);
                                
                                if( this.completedFiles.indexOf(filepath) < 0 ){ //file with the same name already exists
                                    try{
                                        this.fileStream = new fs.WriteStream( filepath );//,{ flags: 'w', encoding: null, mode: 0666 });
                                    }catch(fserr){
                                        this.emit('exception', true, 'formaline exception creating filestream, path: '+filepath+', err: '+fserr.message, this.res, this.next);
                                        this.logger(0,'\nformaline, exception -->', fserr);
                                        this.emit( 'end', [], {}, this.res, this.next); // TODO
                                        return; 
                                    }
                                }else{
                                    var newSha1 = crypto.createHash('sha1').update((new Date().getTime())+'_'+escapedFilename).digest('hex')+( (hext) ? fileExt : '' );
                                    filepath = this.uploadRootDir + newSha1;
                                    this.fileStream = new fs.WriteStream( filepath );
                                    this.emit('warning','formaline, this (sha1sum) filename already exists: '+sha1filename+', orig filename: '+escapedFilename+', new (sha1sum) filename: '+newSha1);
                                    this.logger(3,'\n -> this (sha1sum) filename already exists: '+sha1filename+', orig filename: '+escapedFilename+', new sha1 filename: '+newSha1);
                                }
                                // TODO
                                this.fileStream.ctype = contentType[1];
                                this.fileStream.fieldname = fieldName[1];
                                this.fileStream.origname = escapedFilename;
                                this.fileStream.sha1sum = ( this.sha1sum ) ? crypto.createHash('sha1') : null;
                                
                                this.fileSize = 0;//reset fileSize
                                //chunkLength - "--", if matched boundary is not at the end of chunk, the last result field is chopped -->
                                if( i === resultsLength - 1 ) {//last result
                                    if( rfinish < chunkLength - 2 ){ //there is no boundary at the end of chunk, it is data
                                        this.logger(3,'   -->', results[i], '<-- last field is chopped');
                                        this.chopped = true;
                                        //var fileData = new Buffer( chunkLength - ( rfinish + 4  ) );
                                        if(this.fileStream){
                                            if( this.bytesReceived <= this.uploadThreshold ){
                                                try{
                                                    var fileData = new Buffer( chunkLength - ( rfinish + 4  ) ); 
                                                    chunk.copy(fileData, 0,  rfinish + 4 ,chunkLength );
                                                    this.fileStream.write(fileData);
                                                    ( this.sha1sum ) ? this.fileStream.sha1sum.update(fileData) : null;
                                                }catch(err){
                                                    this.emit('exception', true, 'formaline, exception, copying buffer datafile : '+this.fileStream.path+' --> '+err.message, this.res, this.next);
                                                    this.logger(0,'\nformaline, exception -->', err);
                                                    this.emit( 'end', [], {}, res, next); // TODO
                                                    return; 
                                                }
                                                this.fileSize += fileData.length; 
                                                this.bytesWrittenToDisk += fileData.length;                                           
                                            }else{
                                                if( this.incompleteFilesCollection.list.indexOf(this.fileStream.path) < 0 ){
                                                    this.incompleteFilesCollection.list.push(this.fileStream.path);
                                                    this.incompleteFilesCollection[path.basename(this.fileStream.path)] = {
                                                        origname: this.fileStream.origname,
                                                        dir: path.dirname(this.fileStream.path),
                                                        type: this.fileStream.ctype,
                                                        rbytes: this.fileSize,
                                                        field: this.fileStream.fieldname
                                                    };
                                                    this.emit('warning','formaline, maxUploadsize exceeded, file incomplete -->'+path.basename(this.fileStream.path));
                                                }
                                            }    
                                        }
                                    }
                                }else{
                                    if(this.fileStream){
                                        var fileData = new Buffer( results[i+1].start - 2   - ( results[i].finish + 4 )  );//+ CRLFCRLF
                                        if( this.bytesWrittenToDisk + fileData.length < this.uploadThreshold ){      
                                            try{
                                                chunk.copy(fileData, 0, results[i].finish + 4 , results[i+1].start - 2 ); 
                                                this.fileStream.write(fileData);
                                                ( this.sha1sum ) ? this.fileStream.sha1sum.update(fileData) : null;
                                            }catch(err){
                                                this.emit('exception', true, 'formaline,exception, copying buffer datafile : '+this.fileStream.path+' --> '+err.message, this.res, this.next);
                                                this.logger(0,'\nformaline, exception -->', err);
                                                return; 
                                            }
                                            this.fileSize += fileData.length;
                                            this.bytesWrittenToDisk += fileData.length;
                                        }else{
                                            if( this.incompleteFilesCollection.list.indexOf(this.fileStream.path) < 0 ){
                                                this.incompleteFilesCollection.list.push(this.fileStream.path);
                                                this.incompleteFilesCollection[path.basename(this.fileStream.path)] = {
                                                    origname: this.fileStream.origname,
                                                    dir: path.dirname(this.fileStream.path),
                                                    type: this.fileStream.ctype,
                                                    rbytes: this.fileSize,
                                                    field: this.fileStream.fieldname
                                                }
                                                this.emit('warning','formaline, maxUploadsize exceeded, file incomplete -->'+path.basename(this.fileStream.path));
                                            }
                                        }
                                        //emit fileSize = 0 when file size exceeds maxUploadSize, or empty file
                                        if( ( this.fileSize > 0 ) && (this.incompleteFilesCollection.list.indexOf(this.fileStream.path) < 0 ) ){
                                            this.completedFiles.push(this.fileStream.path);
                                            this.emit( 'filereceived', path.basename( this.fileStream.path ), this.fileStream.origname, path.dirname( this.fileStream.path ), contentType[1], this.fileSize, this.fileStream.fieldname,( ( this.sha1sum ) ? this.fileStream.sha1sum.digest('hex') : undefined ) );
                                        }
                                        this.fileStream.end();
                                    }
                                    this.logger(3,'\n   ->created file stream -->',this.fileStream.path,'\n');
                                }
                            }else{//normal field
                                if( i < resultsLength - 1 ){
                                    try{
                                        var fileData = new Buffer( results[i+1].start - 2   - ( results[i].finish + 4 )  );//+ CRLFCRLF
                                        chunk.copy(fileData, 0, results[i].finish + 4 , results[i+1 ].start - 2 ); 
                                    }catch(err){
                                        this.emit('exception', true, 'formaline, exception, field: '+fieldName[1]+' --> '+err.message, this.res, this.next);
                                        this.logger(0,'\nformaline, exception -->', err);
                                        this.emit( 'end', [], {}, res, next); // TODO
                                        return;
                                    }
                                    this.logger(3,'   ->field:',fieldName[1]+',',(contentType) ? 'content-type: '+contentType[1]+',' : 'no type,','data: *',fileData.toString(),'*');//is many times null for field                                   
                                    this.emit('field',fieldName[1],fileData.toString());
                                }
                            }   
                        }
                    }//end for
                    
                    req.resume();
                   
                }).createDelegate(this,[],true));
                
                req.addListener( 'end', (function(nbytes){  
                    
                    this.endTime = new Date().getTime();

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
                        this.logParserStats();
                        this.logOverallResults();
                        this.resetAttributes();
                    }else{
                        if( this.incompleteFilesCollection.list.length === 0 ){
                            this.emit('end', [], this.endResults, this.res, this.next );//incomplete files are already removed, previously it emits exception and fileremoved events 
                            this.logParserStats();
                            this.logOverallResults();
                            this.resetAttributes();
                        } else {
                            for( var i = 0, ufile = this.incompleteFilesCollection.list, len = ufile.length, currfile = ufile[0]; i < len; i++, currfile = ufile[i] ){
                                fs.unlink( currfile, (function( err, cfile, i, len){
                                    if( err ){
                                        this.logger(0,'\nformaline, exception -->', err);
                                        this.emit('warning','formaline, exception file unlink error: '+cfile+' --> '+err.message );
                                    }else{
                                        this.logger(0,'\nformaline, incomplete file removed -->', cfile);
                                        var ifile = this.incompleteFilesCollection[path.basename(cfile)];
                                        this.emit( 'fileremoved', path.basename(cfile), ifile.origname, ifile.dir, ifile.type, ifile.rbytes, ifile.field );
                                    }
                                    if( i === len - 1){
                                        this.logParserStats();
                                        this.logOverallResults(true);
                                        this.resetAttributes();
                                        this.incompleteFilesCollection = { list: [] };
                                        this.emit('end', [], this.endResults,this.res, this.next);//incomplete files are already removed, previously it emits exception and fileremoved events 
                                    }
                                }).createDelegate( this, [ currfile, i, len ],true) );
                            }
                        }
                    }
                    
                }).createDelegate(this,[clength],true));
                
            }else if(~ctype.indexOf('urlencoded')){//serialized form
                //check if size of data exceeds uploadThreshold
                if( bytes2Receive > this.uploadThreshold ){
                    if(this.checkContentLength === true ){
                        this.emit('headersexception', false,'formaline, req.headers[content-length] exceeds max allowable: '+bytes2Receive+' > '+this.uploadThreshold, this.res, this.next);
                        this.emit( 'end', [], {}, this.res, this.next); // TODO
                        return;
                    } else {
                        //warning
                        this.logger(1,'\nformaline, req.headers[content-length] --> Content Length Warning, bytes to receive:',bytes2Receive,'max allowed:',this.uploadThreshold);
                        this.emit('warning', 'formaline, Content Length Warning, bytes to receive: '+bytes2Receive+', allowed: '+this.uploadThreshold);
                    }
                } 
                    
                req.addListener('data', (function(chunk){
                    this.qsBuffer += chunk.toString('utf8');
                }).createDelegate(this,[],true));
                
                req.addListener( 'end', (function(){
                    var fields = querystring.parse( this.qsBuffer, '&', '=' );
                    for( var f in fields ){
                        this.emit('field',f,fields[f]);
                    }
                    this.emit( 'end', [], this.endResults, this.res, this.next);
                }).createDelegate( this, [], true ));
            
            }else{
                //error
                this.emit('headersexception',false ,'formaline, req.headers[content-type] --> '+ctype+' handler is not defined', this.res, this.next);
                this.logger(0,'\nformaline, req.headers[content-type] -->',ctype,' handler is not defined ');
                this.emit( 'end', [], {}, res, next);//TODO
                return;
            }
        }else{
            //error
            this.emit('headersexception',false ,'formaline, req.headers[content-type] is not defined', this.res, this.next);
            this.logger(0,'\nformaline, req.headers[content-type] --> Parse Type Error');
            this.emit( 'end', [], {}, res, next);//TODO
            return;
        }
    }else{
        //error
        this.emit('headersexception',false ,'formaline, req.headers are not defined', this.res, this.next);
        this.logger(0,'\nformaline, req.headers[..] --> no headers Error');
        this.emit( 'end', [], {}, res, next);//TODO
        return;
    }

};//end parse

exports.formaline = formaline;
exports.parse = formaline;
