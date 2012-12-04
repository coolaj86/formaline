/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true unused:true*/
(function () {
  "use strict";

  var connect = require('connect')
    , fs = require('fs')
    , Formaline = require('./').Formaline
    , app
    , server
    ;

  /*
  function hidePrivates(key, value) {
    if ('_' === key[0]) {
      return undefined;
    }
    return value;
  }
  */

  app = connect.createServer()
    .use(function (req, res, next) {
        var form = Formaline.create(req, {
                // You might want to use a hash to verify transfer integrity or deduplicate uploaded files
                hashes: ['md5', 'sha1']
                // all fields are assumed arrays by default, but when arrayFields is specified
                // only the fieldnames listed will be treated as arrays (including empty arrays)
              , arrayFields: ['avatar']
            })
          ;

        if (!form) {
          console.log("Either this was already parsed or it isn't a multi-part form");
          console.log(req.headers['content-type']);
          next();
          return;
        }

        form.on('progress', function () {
          console.log((100 * (form.loaded / form.total)).toFixed(2) + '%');
        });

        form.on('field', function (fieldname, value) {
          console.log(fieldname, value);
        });

        form.on('file', function (fieldname, file) {
          console.log(fieldname, file);
        });

        form.on('end', function (fields, files) {
          // uploading a file just to get an md5sum is pretty wasteful...
          // but oh well, we'll unlink them now
          
          console.log(fields);
          console.log(files);

          // TODO these two loops should, of course, use forEachAsync
          files.avatar.forEach(function (file) {
            fs.unlink(file.path);
          });
          Object.keys(files).forEach(function (fieldname) {
            var file = files[fieldname]
              ;
              
            if ('avatar' === fieldname) {
              // this was already handled
              return;
            }
            
            fs.unlink(file.path);
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
              "success": true
            , "result": {fields: fields, files: files}
          //}, hidePrivate, '  ') + '\n');
          }, null, '  ') + '\n');
        });
      })
    ;

  server = app.listen(process.argv[2] || 3000, function () {
    console.log('Listening...', server.address());
  });
}());
