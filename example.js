/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true*/
(function () {
  "use strict";

  var connect = require('connect')
    , GoodForm = require('./good-form').GoodForm
    , UUID = require('node-uuid')
    , app
    , server
    ;

  app = connect.createServer()
    .use(function (req, res, next) {
        var form = GoodForm.create(req)
          , fields = {}
          , files = []
          ;

        if (!form) {
          console.log("Either this was already parsed or it isn't a multi-part form");
          console.log(req.headers['content-type']);
          next();
          return;
        }

        form.on('progress', function (bytes) {
          //form.total;
        });

        form.on('field', function (key, value, headers) {
          // TODO php-style keyname[] ?
          if (fields.hasOwnProperty(key)) {
            if (!Array.isArray(fields[key])) {
              fields[key] = [fields[key], value];
            } else {
              fields[key].push(value);
            }
          }
        });

        form.on('file', function (key, file, headers) {
          // GoodForm will call req.pause() and req.resume()
          form.createPipe(file, '/tmp/' + UUID.v4());
        });

        form.on('end', function () {
          console.log(fields);
          console.log(files);
          res.end(JSON.stringify({ "success": true }, null, '  '));
        });
      })
    ;

  app.listen(process.argv[2] || 3000);
}());
