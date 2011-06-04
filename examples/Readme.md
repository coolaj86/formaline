### Basic Example ( simpleUpload.js )

> **this basic example doesn't make use of ajax for uploads**

> *require connect middleware, but for basic usage you could comment out it in the code.*

> *It contains 3 simple html forms ( with multiple file selection for HTML5 browsers )*

> *It uses some fields with the same name, for showing how the json objects are builded up* 

>Generic Usage:

``` bash
 $ node examples/simple/simpleUpload.js
```    

> for default you could point your browser to:

> - **http://nodeServerIp/test/**   *or try* [localhost](http://localhost:3000/test/)        
> - **http://nodeServerIp:3000/test/**  *or try* [localhost](http://localhost:3000/test/) 


>or you could use curl:

``` bash
 $ curl -i -F name=test -F myfile1="@psyco.jpg" -F myfile2="@fearandloathing.jpg" http://yourserver/test/upload or  http://yourserver:3000/test/upload
```    

>The logging level is quite verbose, remember to modify 'logging' to your needs ( for example, turning off 2nd level debugging )
