onload = function(){

            function size(bytes){   // simple function to show a friendly size
                var i = 0;
                while(1023 < bytes){
                    bytes /= 1024;
                    ++i;
                };
                return  i ? bytes.toFixed(2) + ["", " Kb", " Mb", " Gb", " Tb"][i] : bytes + " bytes";
            };

            // create elements
            var field = document.body.appendChild(document.createElement("input")),
                br = document.body.appendChild(document.createElement("br")),
                br1 = document.body.appendChild(document.createElement("br")),
                input = document.body.appendChild(document.createElement("input")),
                br2 = document.body.appendChild(document.createElement("br")),
                br3 = document.body.appendChild(document.createElement("br")),                 
                bar = document.body.appendChild(document.createElement("div")).appendChild(document.createElement("span")),
                div = document.body.appendChild(document.createElement("div"));
            
            field.setAttribute( "type", "text" );
            field.setAttribute( "name", "myfield" );
            field.setAttribute( "name", "myfield" );                        
            // set input type as file
            input.setAttribute("type", "file");
            
            // enable multiple selection (note: it does not work with direct input.multiple = true assignment)
            input.setAttribute("multiple", "true");
            
            // auto upload on files change
            input.addEventListener("change", function(){
                
                // disable the input
                input.setAttribute("disabled", "true");
                
                sendMultipleFiles({
                
                    url: '/test/upload',
                    // list of files to upload
                    files:input.files,
                    
                    // clear the container 
                    onloadstart:function(){
                        div.innerHTML = "Init upload ... ";
                        bar.style.width = "0px";
                    },
                    
                    // do something during upload ...
                    onprogress:function(rpe, xhr){ //chunk
                        //console.log(this.file.fileName);
                        div.innerHTML = [
                        " ",
                            "Uploading: " + this.file.fileName,
                            "Sent: " + size(rpe.loaded) + " of " + size(rpe.total)                            
                            //"Total Sent: " + size(this.sent + rpe.loaded) + " of " + size(this.total)
                        ].join("<br />");
                        bar.style.width = ( rpe.loaded * 200 / rpe.total >> 0) + "px";//(((this.sent + rpe.loaded) * 200 / this.total) >> 0) + "px";
                    },
                    onfileload:function(rpe, xhr, file, end){
                        //console.log('rpe:',rpe);
                        //console.log('xhr:',xhr);
                        //console.log('file:',file);
                        
                        bar.style.width = "200px";//(((this.sent + rpe.loaded) * 200 / this.total) >> 0) + "px";
                        var bdy = document.getElementsByTagName("body")[0], // body element
                            newDiv = document.createElement("div"),
                            newDiv2 = document.createElement("div"),
                            newBarContainer = document.createElement("div");
                            //.appendChild(document.createElement("span"));
                            newBarContainer.className = 'progress';
                        var newBar = newBarContainer.appendChild(document.createElement("span"));
                        
                        /**/

                        div.innerHTML = [
                            "Uploading: " + file.fileName,
                            "Sent: " + size(file.fileSize) + " of " + size(file.fileSize),//+ size(rpe.loaded) + " of " + size(rpe.total),
                            "----------------------------------------"
                        ].join("<br/>");
                        /**/
                        if(end){
                            div.appendChild(newDiv);
                            newDiv.innerHTML = [
                                "<br/> Server Response: " + xhr.responseText.replace( /\n/g, '<br/>' ),
                                "----------------------------------------"
                            ].join("<br />")+"<br />";
                            newDiv2.innerHTML = "<br/>**************************<br/> Total Sent: " +size(this.total) + " of " + size(this.total)+"<br/>**************************<br/>";// + size(this.sent + rpe.loaded) + " of " + size(this.total)+"<br/>**************************<br/>";
                            bdy.appendChild(newDiv2);
                        }else{
                          bdy.appendChild(newBarContainer);
                          div.appendChild(newDiv);
                          newDiv.innerHTML = [
                              "<br/> Server Response: " + xhr.responseText.replace( /\n/g, '<br/>' ),
                              "----------------------------------------"
                          ].join("<br />")+"<br />";
                          bdy.appendChild(newDiv2);
                          div = newDiv2;
                          bar = newBar;
                        }
                        
                    },
                    // fired when last file has been uploaded
                    onload:function(rpe, xhr){
                        //bar.style.width = "200px";
                        // enable the input again
                        //input.removeAttribute("disabled");
                    },
                    
                    // if something is wrong ... (from native instance or because of size)
                    onerror:function(){
                        div.innerHTML = "The file " + this.file.fileName + " is too big [" + size(this.file.fileSize) + "]";
                        // enable the input again
                        //input.removeAttribute("disabled");
                    }
                });
            }, false);
            
            bar.parentNode.className = "progress";
};
