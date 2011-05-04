### Basic Example ( simpleUpload.js )

> **this basic example doesn't make use of ajax for uploads**

> *require connect middleware, but for basic usage you could comment out it in the code.*

>Generic Usage:


     $ node examples/simpleUpload.js


>you can use this simple html form, for default you could point your browser to:

> - **http://nodeServerIp/test/**   *or try* [localhost](http://localhost:3000/test/)        
> - **http://nodeServerIp:3000/test/**  *or try* [localhost](http://localhost:3000/test/) 


>or you could use curl:

    curl -i -F name=test -F myfile1="@psyco.jpg" -F myfile2="@fearandloathing.jpg" http://yourserver/test/upload or  http://yourserver:3000/test/upload
    



### Custom Example with Progress Bar ( customXHR.js )

> **this is a custom XHR2 ( AJAX ) example, is not compatible with older browser (not HTML5 or XHR2 capable ), tested with Firefox 3.6+, Safari and Chrome .**
 
> It is based on example by [Andrea Giammarchi](http://webreflection.blogspot.com/2009/03/safari-4-multiple-upload-with-progress.html) .
