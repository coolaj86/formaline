/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true unused:true undef:true*/
(function () {
  "use strict";

  var os = require('os')
    , PoorForm = require('poor-form')
    , Stream = require('stream')
    , util = require('util')
    , cryptostream = require('./cryptostream')
    , fs = require('fs')
    , path = require('path')
    , alphanum = '0123456789abcdefghijklmnopqrstuvwxyz'
    ;

  function randomString(length, chars) {
      var result = ''
        , i
        ;

      for (i = 0; i < length; i += 1) {
        result += chars[Math.round(Math.random() * (chars.length - 1))];
      }

      return result;
  }

  os.tmpDir = os.tmpDir || function () {
    return process.env.TMP || process.env.TMP || '/tmp';
  };

  function startHashing(file, hashes) {
    //file._hashes = {};
    hashes.forEach(function (algo) {
      var cs = cryptostream.create(algo)
        ;

      //file._hashes[algo] = cs;
      file.pipe(cs);
      cs.on('end', function () {
        file[algo] = cs.digest('hex');
      });
    });
  }
  /*
  function stopHashing(file) {
    Object.keys(file._hashes, function (algo) {
      var cs = file._hashes[algo]
        ;

      if (!file[algo]) {
        //file.partial = true;
        file[algo] = cs.digest('hex');
      }
    });
  }
  */

  function FormFile(req, headers) {
    if (!(this instanceof FormFile)) {
      return new FormFile(req, headers);
    }

    // make _events private from JSON.stringify
    Object.defineProperty(this, '_events', {
        enumerable: false
      , writable: true
    });
    Stream.call(this);

    // W3C File API
    this.size = 0;
    this.type = headers.type;
    this.name = headers.filename;
    this.lastModifiedDate = null;

    //this._req = req;
    Object.defineProperty(this, '_req', {
        value: req
      , enumerable: false
    });
    this.headers = headers;
    this.fieldname = headers.name;
    this.length = null; // alias of size
    // TODO headers should subtract filename, name, type

    // NodeJS Stream API
    Object.defineProperty(this, 'readable', {
        value: true
      , enumerable: false
    });
    Object.defineProperty(this, 'writable', {
        value: false
      , enumerable: false
    });
  }
  util.inherits(FormFile, Stream);
  FormFile.prototype.pause = function () {
    this._req.pause();
  };
  FormFile.prototype.resume = function () {
    this._req.resume();
  };
  /*
  FormFile.prototype.pipe = function () {

  };
  */
  FormFile.create = function (req, headers) {
    return new FormFile(req, headers);
  };

  function Formaline() {
  }
  Formaline.create = function (req, options) {
    var poorForm = PoorForm.create(req)
      , fieldsArr = []
      , filesArr = []
      , fieldsMap = {}
      , filesMap = {}
      , curFile
      , curField
      ;

    if (!poorForm) {
      return null;
    }

    options = options || {};
    options.expectedFiles = options.expectedFiles || [];
    options.hashes = options.hashes || [];
    options.arrayFields = options.arrayFields || null;

    // either not defined or undefined
    if ('undefined' === typeof options.path) {
      options.path = os.tmpDir();
    }

    function emitProgress() {
      poorForm.emit('progress');
    }
    req.on('data', emitProgress);

    process.nextTick(function () {
      if (poorForm.listeners('progress').length > 0) {
        return;
      }
      req.removeListener('data', emitProgress);
    });

    poorForm.on('fieldstart', function (headers) {
      if (headers.filename) {
        // probably a file

        filesMap[headers.name] = filesMap[headers.name] || [];

        curField = null;
        curFile = new FormFile(req, headers);

        filesMap[headers.name].push(curFile);
        filesArr.push(curFile);

        if (options.hashes.length) {
          startHashing(curFile, options.hashes);
        }
        poorForm.emit('file', headers.name /*form name, not file name*/, curFile);
        if (null !== options.path) {
          curFile.path = path.join(options.path, randomString(64, alphanum));
          curFile.pipe(fs.createWriteStream(curFile.path));
        }
      } else {
        // probably a field, but maybe a file without a filename

        fieldsMap[headers.name] = fieldsMap[headers.name] || [];

        curFile = null;
        curField = {
            name: decodeURIComponent(headers.name)
          , value: ""
        };

        fieldsArr.push(curField);
      }
    });

    poorForm.on('fielddata', function (chunk) {
      if (curFile) {
        curFile.size += chunk.length;
        curFile.length = curFile.size;
        curFile.lastModifiedDate = new Date();
        curFile.emit('data', chunk);
      } else {
        curField.value += chunk;
      }
    });

    poorForm.on('fieldend', function () {
      if (curFile) {
        curFile.emit('end');
        curFile = null;
      } else {
        curField.value = decodeURIComponent(curField.value);
        fieldsMap[curField.name].push(curField.value);
        poorForm.emit('field', curField.name, curField.value);
        curField = null;
      }
    });

    poorForm.on('formend', function () {
      var arrayFields = options.arrayFields
        ;

      // It is useful for resumableness to know the sum of the uploaded chunk
      // and the sum can be resumed without recalc server side
      if (curFile) {
        curFile.emit('end');
        // which name? incomplete, complete, partial
        curFile.incomplete = true;
        // TODO unless options.keepIncomplete, fs.unlink
      }
      //filesArr.forEach(stopHashing);

      if (!arrayFields) {
        poorForm.emit('end', fieldsMap, filesMap);
        return;
      }

      // make sure that any non-submitted fields are empty arrays
      arrayFields.forEach(function (key) {
        fieldsMap[key] = fieldsMap[key] || [];
        filesMap[key] = filesMap[key] || [];
      });

      // change remaining fields from arrays to single values
      Object.keys(fieldsMap).forEach(function (key) {
        if (-1 === arrayFields.indexOf(key)) {
          fieldsMap[key] = fieldsMap[key][0];
        }
      });
      Object.keys(filesMap).forEach(function (key) {
        if (-1 === arrayFields.indexOf(key)) {
          filesMap[key] = filesMap[key][0];
        }
      });

      poorForm.emit('end', fieldsMap, filesMap);
    });

    // TODO better error abstraction (i.e. emit formend)
    req.on('error', function (err) {
      poorForm.emit('error', err);
    });

    return poorForm;
  };

  module.exports.Formaline = Formaline;
  module.exports.GoodForm = Formaline;
  // Make it easy to get at the guts
  module.exports.PoorForm = PoorForm;
  module.exports.QuickParser = PoorForm.QuickParser;
}());
