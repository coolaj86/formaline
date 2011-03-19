

var http = require('http'),
    formaline = require('../lib/formaline').formaline,
    connect = require('connect'),
    server;
    
var getHtmlForm = function(req, res,next) {
  if (req.url === '/test/') {
    res.writeHead(200, {'content-type': 'text/html'});
    res.end('<b>Multiple File Upload:</b><br/><br/>\
             <form action="/test/upload" enctype="multipart/form-data" method="post">\
             <input type="text" name="title"><br>\
             <input type="file" name="upload" multiple="multiple"><br>\
             <input type="submit" value="Upload">\
             </form><br/>\
             <b>Simple Post:</b><br/><br/>\
             <form action="/test/post" method="post">\
             <input type="text" name="demofield1"><br>\
             <input type="text" name="demofield2"><br>\
             <input type="submit" value="Submit">\
             </form>'
    );
  } else {
    next();
  }
};
var log = console.log,
    receivedFiles,
    removedFiles,
    receivedFields,
    dir =  '/var/www/demo/upload/'; //'/tmp/';
    
var handleFormRequest = function(req,res,next){
    receivedFiles = {};
    removedFiles = {};
    receivedFields = {};                    
    if ( (req.url === '/test/upload') || (req.url === '/test/post') ){
        var config = {
        
            //default is /tmp/ -->
        tmpUploadDir: dir,
        
            // default is false, or integer chunk factor, 
            // every n chunk emit event 1+(0*n) 1+(1*n),1+(2*n),1+(3*n), 
            // minimum factor value is 2 -->
        emitDataProgress: !true,//false,true,3,10,100
        
            // max bytes allowed, this is the max bytes writed to disk before stop to write 
            // this is also true for serialzed fields not only for files upload  -->
        maxBytes: 3949000,//bytes ex.: 1024*1024*1024, 512
        
            //default false, bypass headers value, continue to write to disk 
            //until maxBytes bytes are writed. 
            //if true -> stop receiving data, when headers content length exceeds maxBytes
        blockOnReqHeaderContentLength: !true,
        
            //remove file not completed due to maxBytes, 
            //if true formaline emit fileremoved event, 
            //otherwise return a path array of incomplete files 
        removeIncompleteFiles : true,
        
            //enable various logging levels
            //it is possible to switch on/off one or more levels at the same time
            //debug: 'off' turn off logging
        logging: 'debug:on,1:on,2:on,3:off',
        
            //listeners
        listeners: {
                'warning': function(msg){
                    log('\n warning  -->',msg);
                },
                'headersexception': function(isUpload,errmsg,res,next){
                    log('\n headersexception  -->',errmsg);
                    next();               
                },
                'exception': function(isUpload,errmsg,res,next){
                    log('\n exception --> ',errmsg);
                    next();
                },
                'filepathexception': function(path,errmsg,res,next){//there is a file upload
                    log('\n filepathexception -->',path,'msg:',errmsg+'\n');        
                    next();
                },
                'field': function(fname,fvalue){
                    receivedFields[fname] = fvalue;
                    log('\n field--> ',fname,fvalue);
                },
                'filereceived': function(filename,filedir,ctype,filesize) {
                    receivedFiles[filename] = { filedir: filedir, ctype: ctype, filesize: filesize };
                    log('\n filereceived -->  name: '+filename+', path: '+filedir+', content type: '+ctype+', bytes: '+filesize+'\n');
                },
                'fileremoved': function(filename,filedir) {
                    log('\n fileremoved -->  name: '+filename+', path: '+filedir+'\n');
                    removedFiles[filename] = { filedir: filedir };
                    log('all files removed: ',removedFiles);
                },
                'dataprogress': function(bytesReceived, chunksReceived) {
                    log('\n dataprogress --> bytes:', bytesReceived,'chunks:', chunksReceived);
                },
                'end': function(incompleteFiles,response,next) {
                        log('\n-> Post Done');
                        response.writeHead(200, {'content-type': 'text/plain'});
                        response.write('-> all data received!\n');
                        response.write('\n-> upload root dir: '+config.tmpUploadDir+' \n');
                        response.write('-> max allowed bytes: '+config.maxBytes+' \n');
                        response.write('-> removeIncompleteFiles: '+config.removeIncompleteFiles+'\n');
                        response.write('-> emitDataProgress: '+config.emitDataProgress+'\n');
                        response.write('-> blockOnReqHeaderContentLength: '+config.blockOnReqHeaderContentLength+'\n');
                        response.write('\n-> fields received: '+JSON.stringify(receivedFields)+'\n');
                        response.write('-> files received: '+JSON.stringify(receivedFiles)+'\n');
                        if(config.removeIncompleteFiles ){
                            response.write('-> files removed : '+JSON.stringify(removedFiles)+'\n');
                        }else{
                            if( incompleteFiles.length !== 0 ){
                                response.write('-> incomplete files (not removed) : '+incompleteFiles+'\n');
                            }
                        }
                        receivedFiles = null;
                        removedFiles = null;
                        receivedFields = null;  
                        response.end();
                        //next();//test
                }
            }
        };
    
        new formaline(config).parse(req,res,next);
  
    } else {
        res.writeHead(404, {'content-type': 'text/plain'});
        res.end('404');
    }

};

server = connect( getHtmlForm , handleFormRequest, function(){console.log('\nSuccessfully call next() function');} );

server.listen(3000);

console.log('\nlistening on http://localhost:3000/');
console.log(' -> upload directory is:',dir);
