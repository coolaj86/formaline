

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
             <input type="file" name="upload_a" multiple="multiple"><br>\
             <input type="file" name="upload_b" multiple="multiple"><br>\
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
    dir =  '/var/www/demo/upload/';//'/tmp/';
    
var handleFormRequest = function(req,res,next){
    receivedFiles = {};
    removedFiles = {};
    receivedFields = {};                    
    if ( (req.url === '/test/upload') || (req.url === '/test/post') ){
        var config = {
            //default is true -->
        holdFileExtensions : true,
            //default is /tmp/ -->
        uploadRootDir: dir,
        
            // default is false, or integer chunk factor, 
            // every n chunk emit event 1+(0*n) 1+(1*n),1+(2*n),1+(3*n), 
            // minimum factor value is 2 -->
        emitDataProgress: !true,//false,true,3,10,100
        
            // max bytes allowed, this is the max bytes writed to disk before stop to write 
            // this is also true for serialzed fields not only for files upload  -->
        uploadThreshold: 3949000,//bytes ex.: 1024*1024*1024, 512
        
            //default false, bypass headers value, continue to write to disk 
            //until uploadThreshold bytes are writed. 
            //if true -> stop receiving data, when headers content length exceeds uploadThreshold
        checkContentLength: !true,
        
            //remove file not completed due to uploadThreshold, 
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
                'pathexception': function(path,errmsg,res,next){//there is a file upload
                    log('\n pathexception -->',path,'msg:',errmsg+'\n');        
                    next();
                },
                'field': function(fname,fvalue){
                    receivedFields[fname] = fvalue;
                    log('\n field--> ',fname,fvalue);
                },
                'filereceived': function(filename,origfilename,filedir,filetype,filesize,filefield) {
                    receivedFiles[filename] = { path: filedir, origName: origfilename, type: filetype, size: filesize, field: filefield };
                    log('\n filereceived -->  name: '+filename+', original name: '+origfilename+', path: '+filedir+', type: '+filetype+', bytes: '+filesize+', field: '+filefield+'\n');
                },
                'fileremoved': function(filename,origfilename,filedir,filetype,filesize,filefield) {
                    log('\n fileremoved -->  name: '+filename+', original name: '+origfilename+', path: '+filedir+', type: '+filetype+', bytes received: '+filesize+', field: '+filefield+'\n');
                    removedFiles[filename] = { path: filedir, origName: origfilename, type: filetype, filesize: filesize, field: filefield };
                    log(' updated list of files removed: ',removedFiles);

                },
                'dataprogress': function(bytesReceived, chunksReceived) {
                    log('\n dataprogress --> bytes:', bytesReceived,'chunks:', chunksReceived);
                },
                'end': function(incompleteFiles,res,next) {
                        log('\n-> Post Done');
                        res.writeHead(200, {'content-type': 'text/plain'});
                        res.write('-> all data received ->'+this.bytesReceived+' bytes\n');
                        res.write('\n-> upload root dir: '+config.uploadRootDir+' \n');
                        res.write('-> bytes upload threshold : '+config.uploadThreshold+' \n');
                        res.write('-> removeIncompleteFiles: '+config.removeIncompleteFiles+'\n');
                        res.write('-> emitDataProgress: '+config.emitDataProgress+'\n');
                        res.write('-> checkContentLength: '+config.checkContentLength+'\n');
                        res.write('\n-> fields received: \n   ****************\n'+JSON.stringify(receivedFields)+'\n');
                        res.write('\n-> files received: ( hashname: {..} )\n   ***************\n '+JSON.stringify(receivedFiles)+'\n');
                        if(config.removeIncompleteFiles ){
                            res.write('\n-> files removed: ( hashname: {..} )\n   **************\n'+JSON.stringify(removedFiles)+'\n');
                        }else{
                            if( incompleteFiles.length !== 0 ){
                                res.write('-> incomplete files (not removed) : '+incompleteFiles+'\n');
                            }
                        }
                        receivedFiles = null;
                        removedFiles = null;
                        receivedFields = null;  
                        res.end();
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

log('\nlistening on http://localhost:3000/');
log(' -> upload directory is:',dir);


