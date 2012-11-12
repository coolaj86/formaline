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
                hashes: ['md5', 'sha1']
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

        form.on('field', function (key, value) {
          console.log(key, value);
        });

        form.on('file', function (key, file) {
          console.log(key, file);
        });

        form.on('end', function (fields, files) {
          console.log(fields);
          console.log(files);

          // TODO this should, of course, use forEachAsync
          Object.keys(files).forEach(function (key) {
            var arr = files[key]
              ;

            arr.forEach(function (file) {
              fs.unlink(file.path);
            });
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
