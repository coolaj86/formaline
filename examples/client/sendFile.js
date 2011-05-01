/** Basic upload manager for single or multiple files ( Chrome 10, Firefox 4, Safari 4 Compatible)
 * based on script by Andrea Giammarchi WebReflection [webreflection.blogspot.com]
 * @license Mit Style License
 */

var sendFile = 1024*1024*1024; // maximum allowed file size
                        // should be smaller or equal to the size accepted in the server for each file

// function to upload a single file via handler
sendFile = (function(toString, maxSize){
    var isFunction = function(Function){return  toString.call(Function) === "[object Function]";},
        split = "onabort.onerror.onloadstart.onprogress".split("."),
        len = split.length;
    return function(handler){
        if(maxSize && maxSize < handler.file.fileSize){
            if(isFunction(handler.onerror)){
                handler.onerror();
            }
            return;
        }
        //var xhr = new XMLHttpRequest,
        //    upload = xhr.upload;

        for(var xhr = new XMLHttpRequest, upload = xhr.upload, i = 0; i < len; i++ ){
            upload[split[i]] = ( function(event){
                return function(rpe){
                    if(isFunction(handler[event])){
                        handler[event].call(handler, rpe, xhr);
                    }
                };
            })(split[i]);
        }
        upload.onload = function(rpe){
            if(handler.onreadystatechange === false){
                if(isFunction(handler.onload)){
                    handler.onload(rpe, xhr);
                }
            } else {
                setTimeout(function(){
                    if(xhr.readyState === 4){
                        if(isFunction(handler.onload)){
                            handler.onload(rpe, xhr);
                        }
                    }else{
                        setTimeout(arguments.callee, 15);
                    }                
                }, 15);
            }
        };

        xhr.open("post", handler.url || "?upload=true", true);
        xhr.setRequestHeader("If-Modified-Since", "Mon, 26 Jul 1997 05:00:00 GMT");
        xhr.setRequestHeader("Cache-Control", "no-cache");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.setRequestHeader("X-File-Name", handler.file.fileName);
        xhr.setRequestHeader("X-File-Size", handler.file.fileSize);
        xhr.setRequestHeader("X-File-Type", handler.file.type);        
        xhr.setRequestHeader("Content-Type", "multipart/form-data");
        xhr.send(handler.file);
        return  handler;
    };
})(Object.prototype.toString, sendFile);

// function to upload multiple files via handler
function sendMultipleFiles(handler){
    var len = handler.files.length,
        i = 0,
        onload = handler.onload;

    handler.current = 0;
    handler.total = 0;
    handler.sent = 0;
    while(handler.current < len){
        handler.total += handler.files[handler.current++].fileSize;
    }
    handler.current = 0;
    if(len){
        handler.file = handler.files[handler.current];
        sendFile(handler).onload = function(rpe, xhr){
            if(++handler.current < len){
                handler.sent += handler.files[handler.current - 1].fileSize;
                handler.file = handler.files[handler.current];
                sendFile(handler).onload = arguments.callee;
                handler.onfileload(rpe, xhr, handler.files[handler.current - 1],false);
                //handler.onload(rpe, xhr);
            } else if(onload) {
                handler.onload = onload;
                handler.onfileload(rpe,xhr,handler.file,true);
                handler.onload(rpe, xhr);
            }
        };
    }
    return  handler;
}

