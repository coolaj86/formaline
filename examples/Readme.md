### Basic Example

> *require connect middleware, but for basic usage you could comment out it in the code.*

>Generic Usage:


     $ node examples/testapp.js


>point your browser to:

> - **http://nodeServerIp/test/**   *or try* [localhost](http://localhost:3000/test/)        
> - **http://nodeServerIp:3000/test/**  *or try* [localhost](http://localhost:3000/test/) 

>or use curl

    curl -i -F name=test -F myfile1="@psyco.jpg" -F myfile2="@fearandloathing.jpg" http://yourserver/test/upload
    

