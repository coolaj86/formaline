/*!
 * formaline
 * Copyright(c) 2011 Guglielmo Ferri <44gatti@gmail.com>
 * MIT Licensed
 */

/**
 * Library version 0.2.3
 */

exports.version = '0.2.3';

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
    this.req = null;
    this.boundString = '';
    this.boundBuffer = null;
    this.qsBuffer = '';
    this.chopped = false;
    this.chunksReceived = 0;
    this.currentChunksReceived = 0;//only for checking last chunk in dataProgress
    this.bytesReceived = 0;
    this.fileStream = null;
    this.fileSize = 0;
    this.totalMillis = 0;
    this.uploadRootDir = '/tmp/';
    this.emitDataProgress = null;
    this.uploadThreshold = 1024*1024*1024; //bytes
    this.bytesWrittenToDisk = 0;
    this.checkContentLength = false;//block receiving data when ContentLength exceeds uploadThreshold ?
    this.completedFiles = [];
    this.incompleteFilesCollection = { list: [] };
    this.endResults = null;
    this.removeIncompleteFiles = !false;
    this.holdFilesExtensions = !true;

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
    this.logger = setDebuggingLevel(this.logging);
};

formaline.prototype.__proto__ = emitter.prototype;

fproto = formaline.prototype;

fproto.parse = function( req, res, next ){
    this.next = ( next && (typeof next === 'function')) ? next : emptyFn;//try to add connect layer compatibility
    
    if( req && ( typeof req === 'object' ) && ( req.body === undefined ) && ( req.method === 'POST' || req.method === 'PUT' ) && 
        ( ~req.headers['content-type'].indexOf('multipart/form-data' ) || ~req.headers['content-type'].indexOf('urlencoded' ) ) ){
        this.req = req;
        this.res = res;

        //this.req.setEncoding('utf8');

        try{ //check upload dir Existence
            this.uploadRootDir = this.uploadRootDir+parseInt(new Date().getTime()*Math.random()*32,10)+'/';
            fs.mkdirSync(this.uploadRootDir,'0755');
        }catch(oerr){
            this.logger(0,'\nformaline.parse(req,res) mkDir Warning-->', this.uploadRootDir, ' msg: '+oerr.message);
            this.uploadRootDir = '/tmp/'+parseInt(new Date().getTime()*Math.random()*10*32,10)+'/';
            this.emit('warning',oerr.message);
            try{
                fs.mkdirSync(this.uploadRootDir,'0755'); 
            }catch(ierr){
                this.logger(0,'\nformaline.parse(req,res) default mkDir Error-->',this.uploadRootDir,' msg:',ierr.message);
                this.emit('pathexception', this.uploadRootDir, ierr.message, this.res, this.next);
                return;
            }
        }
        
        this.dataProgress = (function(){
            var dProgress = this.emitDataProgress;
            if( dProgress === true ){
                return function(isEnd){    
                    this.emit('dataprogress',this.bytesReceived,this.chunksReceived);//every chunks 
                };
            }else if( typeof dProgress === 'number'){
                dProgress = parseInt(dProgress,10);
                if( dProgress < 2 ){ dProgress = 2; }
                return function(isEnd){
                    if( ( ( this.chunksReceived % dProgress ) === 1 ) || isEnd ){// mod 1 is for first chunk
                        this.emit('dataprogress',this.bytesReceived,this.chunksReceived);//every dProgress chunks 
                    }
                };
            }else{
                return emptyFn;
            }
        }).createDelegate(this,[],true)();
        
        var hs = req.headers,
            clength = hs['content-length'],
            ctype = hs['content-type'],
            bytes2Receive = 0;
               
        
        if( clength ){
            try{
                bytes2Receive = parseInt(clength,10);
                if( bytes2Receive > this.uploadThreshold ){//check Max Upload Size in bytes
                    if(this.checkContentLength === true){
                        this.emit('headersexception',(ctype.indexOf('multipart/form-data' )!== -1) ? true : false ,'formaline.parse(req,res) req.headers[content-length] exceeds max allowable: '+bytes2Receive+' > '+this.uploadThreshold, this.res, this.next);
                        return;
                    }
                    //warning
                    this.logger(1,'\nformaline.parse(req,res) req.headers[content-length] --> Content Length Warning, bytes to receive:',bytes2Receive,'max allowed:',this.uploadThreshold);
                    this.emit('warning', 'Content Length Warning, bytes to receive: '+bytes2Receive+', allowed: '+this.uploadThreshold);
                }else{
                    this.logger(0,'\nformaline.parse(req,res) req.headers[content-length] --> ', bytes2Receive);
                }
            }catch(err){
                //error
                this.emit('headersexception',(ctype.indexOf('multipart/form-data' )!== -1) ? true : false ,'formaline.parse(req,res) req.headers[content-length] parse error -> value is: ',clength, this.res, this.next);
                this.logger(0,'\nformaline.parse(req,res) req.headers[content-length] --> Parse Length Exception', err);
                return;
            }
        }else{
            //error
            this.emit('headersexception',(ctype.indexOf('multipart/form-data' )!== -1) ? true : false ,'formaline.parse(req,res) req.headers[content-length] not defined', this.res, this.next);
            this.logger(0,'\nformaline.parse(req,res) req.headers[content-length] --> Parse Length Error');
            return;
        }

        if( ctype ){
            this.logger(0,'\nformaline.parse(req,res) req.headers[content-type] --> ', ctype);
            if( ~ctype.indexOf('multipart/form-data') ){
                
                this.boundString = ctype.match(/boundary=([^;]+)/mi)[1];
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
                    
                    this.totalMillis += ( etime - stime );    
                    this.bytesReceived += chunk.length;
                    this.chunksReceived++;
                   
                    this.dataProgress();//emit DataProgress

                    this.logger(3,'\nreceiving data-->');
                    this.logger(3,'chunk size:',chunk.length,'\n--> quickSearch results:\n',results);

                    if( this.bytesReceived <= this.uploadThreshold ){// is size allowed? 
                        if( this.chopped && this.fileStream ){// file data is chopped? && fileStream exists?
                            if( resultsLength === 0 ){//chunk is only data payload
                                //write to file? 
                                this.fileStream.write(chunk);    
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
                                    }catch(err){
                                        this.emit(true,'exception','formaline.parse(req,res) exception, copying buffer data file : '+this.fileStream.path+' --> '+err.message,this.res, this.res, this.next);
                                        this.logger(0,'\nformaline.parse(req,res) exception -->', err);
                                        return; 
                                    }
                                    this.fileSize += fileData.length;
                                    this.bytesWrittenToDisk += fileData.length;
                                }
                                this.fileStream.end();
                                this.completedFiles.push(this.fileStream.path);
                                this.emit( 'filereceived', path.basename( this.fileStream.path ), this.fileStream.origname, path.dirname(this.fileStream.path), this.fileStream.ctype, this.fileSize, this.fileStream.fieldname );
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
                            }
                            this.emit('warning','formaline.parse(req,res)  maxUploadsize exceeded, file incomplete -->'+path.basename(this.fileStream.path));

                        }
                    }
                    
                    for( var i = 0; i < resultsLength; i++ ){
                        /**/
                        var result = results[i],
                            rfinish = result.finish,
                            rstart = result.start,
                            fileData = null,
                            heads = new Buffer( ( rfinish ) - ( rstart + bblength + 2) );//only the headers
                        
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
                                    kext = this.holdFilesExtensions,
                                    sha1filename = crypto.createHash('sha1').update(escapedFilename).digest('hex') + ( (kext) ? fileExt : '' ),
                                    filepath = this.uploadRootDir + sha1filename;
                                    //var filepath = this.uploadRootDir + escapedFilename;
                                   
                                    
                                this.logger(2,'   ->field: '+fieldName[1]+', orig filename: '+escapedFilename+', sha1 filename: '+sha1filename+', content-type: '+contentType[1],'file extension:',fileExt);
                                
                                if( this.completedFiles.indexOf(filepath) < 0 ){ //file with the same name already exists
                                    this.fileStream = new fs.WriteStream( filepath );//,{ flags: 'w', encoding: null, mode: 0666 });
                                }else{
                                    //filepath = this.uploadRootDir +(new Date().getTime())+'_'+escapedFilename;
                                    var newSha1 = crypto.createHash('sha1').update((new Date().getTime())+'_'+escapedFilename).digest('hex')+( (kext) ? fileExt : '' );
                                    filepath = this.uploadRootDir + newSha1;
                                    this.logger(2,'\n -> this sha1 file name already exists: '+sha1filename+', orig filename: '+escapedFilename+', new sha1 filename: '+newSha1);
                                    this.fileStream = new fs.WriteStream( filepath );
                                }
                                this.fileStream.ctype = contentType[1];//hack TODO
                                this.fileStream.fieldname = fieldName[1];//hack TODO
                                this.fileStream.origname = escapedFilename;//hack TODO
                                
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
                                                }catch(err){
                                                    this.emit(true,'exception','formaline.parse(req,res) exception, copying buffer datafile : '+this.fileStream.path+' --> '+err.message, this.res, this.next);
                                                    this.logger(0,'\nformaline.parse(req,res) exception -->', err);
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
                                                    this.emit('warning','formaline.parse(req,res) maxUploadsize exceeded, file incomplete -->'+path.basename(this.fileStream.path));
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
                                            }catch(err){
                                                this.emit(true,'exception','formaline.parse(req,res) exception, copying buffer datafile : '+this.fileStream.path+' --> '+err.message, this.res, this.next);
                                                this.logger(0,'\nformaline.parse(req,res) exception -->', err);
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
                                                this.emit('warning','formaline.parse(req,res) maxUploadsize exceeded, file incomplete -->'+path.basename(this.fileStream.path));
                                            }
                                        }
                                        //emit fileSize = 0 when file size exceeds maxUploadSize, or empty file
                                        if( ( this.fileSize > 0 ) && (this.incompleteFilesCollection.list.indexOf(this.fileStream.path) < 0 ) ){
                                            this.completedFiles.push(this.fileStream.path);
                                            this.emit( 'filereceived', path.basename( this.fileStream.path ), this.fileStream.origname, path.dirname( this.fileStream.path ), contentType[1], this.fileSize, this.fileStream.fieldname );
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
                                        this.emit(true,'exception','formaline.parse(req,res) exception, field: '+fieldName[1]+' --> '+err.message, this.res, this.next);
                                        this.logger(0,'\nformaline.parse(req,res) exception -->', err);
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
                    
                    this.logger(2,'\n[]------------PARSER STATS-------------[]\n chunks received:',this.chunksReceived);
                    this.logger(2, ' parsed:', (this.bytesReceived/(1024*1024)).toFixed(4), 'MB in', ( this.totalMillis / 1000 ), 'secs' );
                    this.logger(2, ' average data rate:', (( this.bytesReceived/(1024*1024) ) / ( this.totalMillis / 1000 )).toFixed(1), 'MB/sec' );
                    this.logger(2, ' average chunk size:', ((this.bytesReceived/1024)/this.chunksReceived ).toFixed(3), 'KBytes' );
                    this.logger(2, ' average chunk rate:', (( this.chunksReceived ) / ( this.totalMillis / 1000 )).toFixed(1), 'chunk/sec' );
                    this.logger(2,'[]-------------------------------------[]\n');
                    
                   
                    this.endResults = {
                        bytesReceived : this.bytesReceived,
                        bytesWrittenToDisk: this.bytesWrittenToDisk,
                        chunksReceived : this.chunksReceived
                    };
                                            
                    if( this.removeIncompleteFiles === false ){
                        this.emit( 'end', this.incompleteFilesCollection.list, this.endResults, this.res, this.next );
                    }else{
                        if( this.incompleteFilesCollection.list.length === 0 ){
                            this.emit('end', [], this.endResults, this.res, this.next );//incomplete files are already removed, previously it emits exception and fileremoved events 
                        } else {
                            for( var i = 0, ufile = this.incompleteFilesCollection.list, len = ufile.length, currfile = ufile[0]; i < len; i++, currfile = ufile[i] ){
                                fs.unlink( currfile, (function( err, cfile, i, len){
                                    if( err ){
                                        this.logger(0,'\nformaline.parse(req,res) exception -->', err);
                                        this.emit('warning','formaline.parse(req,res) exception, file unlink error: '+cfile+' --> '+err.message );
                                    }else{
                                        this.logger(0,'\nformaline.parse(req,res) incomplete file removed -->', cfile);
                                        var ifile = this.incompleteFilesCollection[path.basename(cfile)];
                                        this.emit( 'fileremoved', path.basename(cfile), ifile.origname, ifile.dir, ifile.type, ifile.rbytes, ifile.field );
                                    }
                                    if( i === len - 1){
                                        this.incompleteFilesCollection = { list: [] };
                                        
                                        this.emit('end', [], this.endResults,this.res, this.next);//incomplete files are already removed, previously it emits exception and fileremoved events 
                                    }
                                }).createDelegate(this,[currfile,i,len],true));
                            }
                        }
                    }
                    this.chunksReceived = 0;
                    this.bytesReceived = 0;
                    this.bytesWrittenToDisk = 0;
                    
                    this.fileStream = null;
                    this.boundString = null;
                    this.boundBuffer = null;
                    this.uploadRootDir = '';
                    this.uploadThreshold = 0;
                    
                    this.totalMillis = 0;
                    this.chopped = false;
                    this.fileSize = 0;
                    //this.incompleteFilesCollection = { list: [] }; //TODO
                    
                }).createDelegate(this,[clength],true));
                
            }else if(~ctype.indexOf('urlencoded')){//serialized form
                //check if size of data exceeds uploadThreshold
                if( bytes2Receive > this.uploadThreshold ){
                    if(this.checkContentLength === true ){
                        this.emit('headersexception', false,'formaline.parse(req,res) req.headers[content-length] exceeds max allowable: '+bytes2Receive+' > '+this.uploadThreshold, this.res, this.next);
                        return;
                    } else {
                        //warning
                        this.logger(1,'\nformaline.parse(req,res) req.headers[content-length] --> Content Length Warning, bytes to receive:',bytes2Receive,'max allowed:',this.uploadThreshold);
                        this.emit('warning', 'formaline.parse(req,res), Content Length Warning, bytes to receive: '+bytes2Receive+', allowed: '+this.uploadThreshold);
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
                this.emit('headersexception',false ,'formaline.parse(req,res) req.headers[content-type] --> '+ctype+' handler is not defined', this.res, this.next);
                this.logger(0,'\nformaline.parse(req,res) req.headers[content-type] -->',ctype,' handler is not defined ');
                return;
            }
        }else{
            //error
            this.emit('headersexception',false ,'formaline.parse(req,res) req.headers[content-type] is not defined', this.res, this.next);
            this.logger(0,'\nformaline.parse(req,res) req.headers[content-type] --> Parse Type Error');
            return;
        }
    }else{
        //error
        this.emit('headersexception',false ,'formaline.parse(req,res) req.headers are not defined', this.res, this.next);
        this.logger(0,'\nformaline.parse(req,res) req.headers[..] --> no headers Error');
        return;
    }

};//end parse

exports.formaline = formaline;
exports.parse = formaline;




