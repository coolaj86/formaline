/*!
 * formaline
 * Copyright(c) 2011 Guglielmo Ferri <44gatti@gmail.com>
 * MIT Licensed
 */

/**
 * Library version 0.1.0
 */

/** 
    TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO
    - check max fileName size
    - check max limit of received data before stop receving and throw exception
    - write about server side security,
    - write about non blocking data receiving, when data exceeds maxBytes 
      and blockOnRequestHeader = false (Content-Length Header is not controlled) 
    TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO  
**/

exports.version = '0.1.0';

var fs = require('fs'),
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
    this.chunked = false;
    this.chunksReceived = 0;
    this.currentChunksReceived = 0;//only for checking last chunk in dataProgress
    this.bytesReceived = 0;
    this.fileStream = null;
    this.fileSize = 0;
    this.totalMillis = 0;
    this.tmpUploadDir = '/tmp/';
    this.emitDataProgress = null;
    this.maxBytes = 1024*1024*1024; //bytes
    this.bytesWritedToDisk = 0;
    this.blockOnReqHeaderContentLength = false;//block receiving data when ContentLength exceeds maxBytes ?
    this.completedFiles = [];
    this.incompleteFiles = [];
    this.incompleteFilesCollection = { list: [] };//TODO
    this.removeIncompleteFiles = !false;
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
            this.tmpUploadDir = this.tmpUploadDir+parseInt(new Date().getTime()*Math.random()*32,10)+'/';
            fs.mkdirSync(this.tmpUploadDir,'0755');
            //fs.mkdirSync(this.tmpUploadDir+'completed/','0755');
        }catch(oerr){
            this.logger(0,'\nformaline.parse(req,res) mkDir Warning-->', this.tmpUploadDir, ' msg: '+oerr.message);
            this.tmpUploadDir = '/tmp/'+parseInt(new Date().getTime()*Math.random()*10*32,10)+'/';
            this.emit('warning',oerr.message);
            try{
                fs.mkdirSync(this.tmpUploadDir,'0755'); 
            }catch(ierr){
                this.logger(0,'\nformaline.parse(req,res) default mkDir Error-->',this.tmpUploadDir,' msg:',ierr.message);
                this.emit('filepathexception', this.tmpUploadDir, ierr.message, this.res, this.next);
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
                if( bytes2Receive > this.maxBytes ){//check Max Upload Size in bytes
                    if(this.blockOnReqHeaderContentLength === true){
                        this.emit('headersexception',(ctype.indexOf('multipart/form-data' )!== -1) ? true : false ,'formaline.parse(req,res) req.headers[content-length] exceeds max allowable: '+bytes2Receive+' > '+this.maxBytes, this.res, this.next);
                        return;
                    }
                    //warning
                    this.logger(1,'\nformaline.parse(req,res) req.headers[content-length] --> Content Length Warning, bytes to receive:',bytes2Receive,'max allowed:',this.maxBytes);
                    this.emit('warning', 'Content Length Warning, bytes to receive: '+bytes2Receive+', allowed: '+this.maxBytes);
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

                    if( this.bytesReceived <= this.maxBytes ){// is size allowed? 
                        if( this.chunked && this.fileStream ){// file data is chunked? && fileStream exists?
                            if( resultsLength === 0 ){//chunk is only data payload
                                //write to file? 
                                this.fileStream.write(chunk);    
                                this.fileSize += chunk.length;
                                this.bytesWritedToDisk += chunk.length;
                                this.logger(3,'<--this chunk contains only data..\n');
                            }else{ //chunk contains other boundaries, the first result is the end of previous data chunk
                                var rstart = results[0].start;
                                var fileData = new Buffer( rstart - 2 );   //last two chars are CRLF
                                if( ( this.bytesWritedToDisk + fileData.length < this.maxBytes ) ){
                                    try{
                                        chunk.copy(fileData,0, 0, rstart - 2 );
                                        this.fileStream.write(fileData);
                                    }catch(err){
                                        this.emit(true,'exception','formaline.parse(req,res) exception, copying buffer data file : '+this.fileStream.path+' --> '+err.message,this.res, this.res, this.next);
                                        this.logger(0,'\nformaline.parse(req,res) exception -->', err);
                                        return; 
                                    }
                                    this.fileSize += fileData.length;
                                    this.bytesWritedToDisk += fileData.length;
                                }
                                this.fileStream.end();
                                this.completedFiles.push(this.fileStream.path);
                                this.emit('filereceived',path.basename(this.fileStream.path),path.dirname(this.fileStream.path),this.fileStream.ctype,this.fileSize);
                                this.logger(3,'<-- this chunk contains data and fields..\n');
                            }
                        }
                    }else{
                        if( this.fileStream && (this.incompleteFiles.indexOf(this.fileStream.path) < 0) ){
                            this.incompleteFiles.push(this.fileStream.path);
                            //TODO
                            this.incompleteFilesCollection.list.push(this.fileStream.path);
                            this.incompleteFilesCollection[path.basename(this.fileStream.path)] = {
                                dir: path.dirname(this.fileStream.path),
                                type: this.fileStream.ctype,
                                size: this.fileSize,
                                field: this.fileStream.fieldname
                            }
                            this.emit('warning','formaline.parse(req,res)  maxUploadsize exceeded, file incomplete -->'+path.basename(this.fileStream.path));

                        }
                    }
                    
                    for( var i = 0; i < resultsLength; i++ ){
                        var result = results[i];
                        var rfinish = result.finish;
                        var rstart = result.start;
                        var fileData = null;
                            
                        var heads = new Buffer( ( rfinish ) - ( rstart + bblength + 2) );//only the headers
                        chunk.copy(heads, 0, rstart + bblength + 2, rfinish );
                        var headers = heads.toString();
                        var fieldName = headers.match(/name="([^\"]+)"/mi);

                        if(fieldName){
                            var fileName = headers.match(/filename="([^;]+)"/mi);
                            var contentType  = headers.match(/Content-Type:([^;]+)/mi);

                            if(fileName){//file field
                                this.logger(3,'   ->field: '+fieldName[1]+', file: '+fileName[1]+', content-type: '+contentType[1]);
                                var filepath = this.tmpUploadDir + fileName[1];
                                if( this.completedFiles.indexOf(filepath) < 0 ){ //file with the same name already exists
                                    this.fileStream = new fs.WriteStream( filepath );//,{ flags: 'w', encoding: null, mode: 0666 });
                                }else{
                                    filepath = this.tmpUploadDir +(new Date().getTime())+'_'+fileName[1];
                                    this.fileStream = new fs.WriteStream( filepath );
                                }
                                this.fileStream.ctype = contentType[1];//hack TODO
                                this.fileStream.fieldname = fieldName[1];
                                this.fileSize = 0;//reset fileSize
                                //chunkLength - "--", if matched boundary is not at the end of chunk, the last result field is chunked -->
                                if( i === resultsLength - 1 ) {//last result
                                    if( rfinish < chunkLength - 2 ){ //there is no boundary at the end of chunk, it is data
                                        this.logger(3,'   -->', results[i], '<-- last field is chunked');
                                        this.chunked = true;
                                        //var fileData = new Buffer( chunkLength - ( rfinish + 4  ) );
                                        if(this.fileStream){
                                            if( this.bytesReceived <= this.maxBytes ){
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
                                                this.bytesWritedToDisk += fileData.length;                                           
                                            }else{
                                                if( this.incompleteFiles.indexOf(this.fileStream.path) < 0 ){
                                                    this.incompleteFiles.push(this.fileStream.path);
                                                    //TODO
                                                    this.incompleteFilesCollection.list.push(this.fileStream.path);
                                                    this.incompleteFilesCollection[path.basename(this.fileStream.path)] = {
                                                        dir: path.dirname(this.fileStream.path),
                                                        type: this.fileStream.ctype,
                                                        size: this.fileSize,
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
                                        if( this.bytesWritedToDisk + fileData.length < this.maxBytes ){      
                                            try{
                                                chunk.copy(fileData, 0, results[i].finish + 4 , results[i+1].start - 2 ); 
                                                this.fileStream.write(fileData);
                                            }catch(err){
                                                this.emit(true,'exception','formaline.parse(req,res) exception, copying buffer datafile : '+this.fileStream.path+' --> '+err.message, this.res, this.next);
                                                this.logger(0,'\nformaline.parse(req,res) exception -->', err);
                                                return; 
                                            }
                                            this.fileSize += fileData.length;
                                            this.bytesWritedToDisk += fileData.length;
                                        }else{
                                            if( (this.incompleteFiles.indexOf(this.fileStream.path) < 0) ){
                                                this.incompleteFiles.push(this.fileStream.path);
                                                //TODO
                                                this.incompleteFilesCollection.list.push(this.fileStream.path);
                                                this.incompleteFilesCollection[path.basename(this.fileStream.path)] = {
                                                    dir: path.dirname(this.fileStream.path),
                                                    type: this.fileStream.ctype,
                                                    size: this.fileSize,
                                                    field: this.fileStream.fieldname
                                                }
                                                this.emit('warning','formaline.parse(req,res) maxUploadsize exceeded, file incomplete -->'+path.basename(this.fileStream.path));
                                            }
                                        }
                                        //emit fileSize = 0 when file size exceeds maxUploadSize, or empty file
                                        if( ( this.fileSize > 0 ) && (this.incompleteFiles.indexOf(this.fileStream.path) < 0 ) ){
                                            this.completedFiles.push(this.fileStream.path);
                                            this.emit('filereceived',path.basename(this.fileStream.path),path.dirname(this.fileStream.path),contentType[1],this.fileSize);
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
                
                req.addListener('end',(function(nbytes){  

                    this.logger(2,'\n[]------------PARSER STATS-------------[]\n chunks received:',this.chunksReceived);
                    this.logger(2, ' parsed:', (this.bytesReceived/(1024*1024)).toFixed(4), 'MB in', ( this.totalMillis / 1000 ), 'secs' );
                    this.logger(2, ' average data rate:', (( this.bytesReceived/(1024*1024) ) / ( this.totalMillis / 1000 )).toFixed(1), 'MB/sec' );
                    this.logger(2, ' average chunk size:', ((this.bytesReceived/1024)/this.chunksReceived ).toFixed(3), 'KBytes' );
                    this.logger(2, ' average chunk rate:', (( this.chunksReceived ) / ( this.totalMillis / 1000 )).toFixed(1), 'chunk/sec' );
                    this.logger(2,'[]-------------------------------------[]\n');
                    this.chunksReceived = 0;
                    this.bytesReceived = 0;
                    this.bytesWritedToDisk = 0;
                    
                    this.fileStream = null;
                    this.boundString = null;
                    this.boundBuffer = null;
                    this.tmpUploadDir = '';
                    this.maxBytes = 0;
                    
                    this.totalMillis = 0;
                    this.chunked = false;
                    this.fileSize = 0;
                    
                    //TODO
                    console.log('incomplete files collection -->',this.incompleteFilesCollection);
                    
                    if(this.removeIncompleteFiles === false){
                        this.emit('end', this.incompleteFiles, this.res, this.next);
                    }else{
                        if( this.incompleteFiles.length === 0 ){
                            this.emit('end', [], this.res, this.next);//incomplete files are already removed, previously it emits exception and fileremoved events 
                        } else {
                            for(var i = 0, ufile = this.incompleteFiles, len = ufile.length, currfile = ufile[0]; i < len; i++, currfile = ufile[i] ){
                                fs.unlink(currfile,(function(err,cfile,i,len){
                                    if(err){
                                        this.logger(0,'\nformaline.parse(req,res) exception -->', err);
                                        this.emit('warning','formaline.parse(req,res) exception, file unlink error: '+cfile+' --> '+err.message );
                                    }else{
                                        this.logger(0,'\nformaline.parse(req,res) incomplete file removed -->', cfile); 
                                        this.emit('fileremoved',path.basename(cfile),path.dirname(cfile));
                                    }
                                    if( i === len - 1){
                                        this.emit('end', [], this.res, this.next);//incomplete files are already removed, previously it emits exception and fileremoved events 
                                    }
                                }).createDelegate(this,[currfile,i,len],true));
                            }
                        }
                        //this.emit('end', [], this.res, this.next);//incomplete files are already removed, previously it emits exception and fileremoved events 
                    }
                    this.incompleteFiles = [];
                    this.incompleteFilesCollection = { list: []}; //TODO
                    
                }).createDelegate(this,[clength],true));
                
            }else if(~ctype.indexOf('urlencoded')){//serialized form
                //check if size of data exceeds maxBytes
                if( bytes2Receive > this.maxBytes ){
                    if(this.blockOnReqHeaderContentLength === true ){
                        this.emit('headersexception', false,'formaline.parse(req,res) req.headers[content-length] exceeds max allowable: '+bytes2Receive+' > '+this.maxBytes, this.res, this.next);
                        return;
                    } else {
                        //warning
                        this.logger(1,'\nformaline.parse(req,res) req.headers[content-length] --> Content Length Warning, bytes to receive:',bytes2Receive,'max allowed:',this.maxBytes);
                        this.emit('warning', 'formaline.parse(req,res), Content Length Warning, bytes to receive: '+bytes2Receive+', allowed: '+this.maxBytes);
                    }
                } 
                    
                req.addListener('data', (function(chunk){
                    this.qsBuffer += chunk.toString('utf8');
                }).createDelegate(this,[],true));
                
                req.addListener('end', (function(){
                    var fields = querystring.parse( this.qsBuffer, '&', '=' );
                    for( var f in fields ){
                        this.emit('field',f,fields[f]);
                    }
                    this.emit('end',[],this.res, this.next);
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




