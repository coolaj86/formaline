

var http = require('http'),
    formaline = require('../lib/formaline').formaline,
    connect = require('connect'),
    server;
    
var getHtmlForm = function(req, res,next) {
  if (req.url === '/test/') {
    log( ' -> req url :', req.url );
    res.writeHead(200, {'content-type': 'text/html'});
    res.end('<html><head></head><body>\
             <b>Multiple File Upload:</b><br/><br/>\
             <form action="/test/upload" enctype="multipart/form-data" method="post">\
             <input type="text" name="demotitle1"><br>\
             <input type="file" name="multiplefield1" multiple="multiple"><br>\
             <input type="text" name="demotitle2"><br>\
             <input type="file" name="multiplefield2" multiple="multiple"><br>\
             <input type="text" name="demotitle3"><br>\
             <input type="file" name="multiplefield3" multiple="multiple"><br>\
             <input type="submit" value="Upload">\
             </form><br/>\
             <b>Simple Post:</b><br/><br/>\
             <form action="/test/post" method="post">\
             <input type="text" name="simplefield1"><br>\
             <input type="text" name="simplefield2"><br>\
             <input type="text" name="simplefield3"><br>\
             <input type="submit" value="Submit">\
             </form><br/>\
             <b>Iframe Multiple File Upload:</b><br/><br/>\
             <form action="/test/upload" method="post" enctype="multipart/form-data" target="iframe">\
             <input type="file" name="file" multiple  src="" frameborder="1" />\
             <input type="submit" />\
             </form>\
             <iframe name="iframe" width="100%" height="400px"></iframe>\
             </form>\
             </body></html>'
    );
  } else {
    next();
  }
};
var log = console.log,
    dir =  '/tmp/';


    
var handleFormRequest = function( req, res, next ){
    var receivedFiles = {},
        removedFiles = {},
        receivedFields = {},
        form = null,
        config = {
        
            //default is true -->
        holdFilesExtensions : true,
        
            //default is /tmp/ -->
        uploadRootDir: dir,
        
            //default is false
            //return sha1 digests for files received?  -->
        sha1sum: true,
        
            // default is false, or integer chunk factor, 
            // every n chunk emit event 1+(0*n) 1+(1*n),1+(2*n),1+(3*n), 
            // minimum factor value is 2 -->
        emitDataProgress: false,//false,true,3,10,100
        
            // max bytes allowed, this is the max bytes written to disk before stop to write 
            // this is also true for serialzed fields not only for files upload  -->
        uploadThreshold: 1024*1024*1024,//bytes ex.: 1024*1024*1024, 512
        
            //default false, bypass headers value, continue to write to disk 
            //until uploadThreshold bytes are written. 
            //if true -> stop receiving data, when headers content length exceeds uploadThreshold
        checkContentLength: false,
        
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
                'warning': function( msg ){
                    log('\n warning  -->',msg);
                },
                'headersexception': function( isUpload, errmsg, res, next){
                    log('\n headersexception  -->',errmsg);
                    next();               
                },
                'exception': function( isUpload, errmsg, res, next){
                    log('\n exception --> ',errmsg);
                    next();
                },
                'pathexception': function( path, errmsg, res, next){//there is a file upload
                    log('\n pathexception -->',path,'msg:',errmsg+'\n');        
                    next();
                },
                'field': function( fname, fvalue ){
                    receivedFields[fname] = fvalue;
                    log('\n field--> ',fname,fvalue);
                },
                'filereceived': function( sha1filename, origfilename, filedir, filetype, filesize, filefield, filesha1sum ) {
                    receivedFiles[sha1filename] = { path: filedir, origName: origfilename, type: filetype, size: filesize, field: filefield, sha1sum: filesha1sum  };
                    log('\n filereceived -->  sha1name: '+sha1filename+', original name: '+origfilename+', path: '+filedir+', type: '+filetype+', bytes: '+filesize+', field: '+filefield+'\n');
                },
                'fileremoved': function( sha1filename, origfilename, filedir, filetype, filesize, filefield ) {
                    log('\n fileremoved -->  sha1name: '+sha1filename+', original name: '+origfilename+', path: '+filedir+', type: '+filetype+', bytes received: '+filesize+', field: '+filefield+'\n');
                    removedFiles[sha1filename] = { path: filedir, origName: origfilename, type: filetype, filesize: filesize, field: filefield };
                    //log(' updated list of files removed: ',removedFiles);

                },
                'dataprogress': function( bytesReceived, chunksReceived, ratio ) {
                    log('\n dataprogress --> bytes:', bytesReceived,'chunks:', chunksReceived,' ratio:',  ratio  );
                },
                'end': function( incompleteFiles, stats, res, next) {
                        log( '\n-> Post Done' );
                        res.writeHead( 200, { 'content-type': 'text/plain' } );
                        res.write( '-> request processed! \n');

                        res.write( '\n-> upload root dir: ' + form.uploadRootDir + ' \n');
                        res.write( '-> upload threshold : ' + ( form.uploadThreshold ) + ' bytes \n');
                        res.write( '-> checkContentLength: ' + form.checkContentLength + '\n');
                        res.write( '-> holdFilesExtensions: ' + form.holdFilesExtensions + '\n');
                        res.write( '-> sha1sum: ' + form.sha1sum + '\n');
                        res.write( '-> removeIncompleteFiles: ' + form.removeIncompleteFiles + '\n');
                        res.write( '-> emitDataProgress: ' + form.emitDataProgress + '\n');
                        
                        res.write( '\n-> fields received: \n   ****************\n' + JSON.stringify(receivedFields) + '\n');
                        res.write( '\n-> files received: ( { sha1name: {..} }, { .. } )\n   ***************\n ' + JSON.stringify(receivedFiles) + '\n');
                        if( form.removeIncompleteFiles ){
                            res.write( '\n-> files removed: ( { sha1name: {..} }, { .. } )\n   **************\n' + JSON.stringify(removedFiles) + '\n');
                        }else{
                            if( incompleteFiles.length !== 0 ){
                                res.write( '-> incomplete files (not removed) : ' + incompleteFiles + '\n');
                            }
                        }
                        res.write( '\n-> stats -> ' + JSON.stringify(stats) + '\n');
                        receivedFiles = {};
                        removedFiles = {};
                        receivedFields = {};
                        res.end();
                        //next();//test
                }
            }
    };//end config obj
                        
    if ( (req.url === '/test/upload') || (req.url === '/test/post') ){
        log( ' -> req url :', req.url );
        form = new formaline(config);
        form.parse(req,res,next);
  
    } else {
        log( ' -> req url 404 error :', req.url );    
        res.writeHead(404, {'content-type': 'text/plain'});
        res.end('404');
    }

};

server = connect( getHtmlForm , handleFormRequest, function(){console.log('\nHi!, I\'m next() function!');} );

server.listen(3000);

log('\nlistening on http://localhost:3000/');
log(' -> upload directory is:',dir);


