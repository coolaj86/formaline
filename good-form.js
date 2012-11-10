/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true unused:true undef:true*/
(function () {
  "use strict";

  var os = require('os')
    , PoorForm = require('poor-form')
    , EventEmitter = require('events').EventEmitter
    , util = require('util')
    , cryptostream = require('./cryptostream')
    , fs = require('fs')
    , path = require('path')
    , UUID = require('node-uuid')
    ;

  os.tmpDir = os.tmpDir || function () {
    return process.env.TMP || process.env.TMP || '/tmp';
  };

  function startHashing(file, hashes) {
    hashes.forEach(function (algo) {
      var cs = cryptostream.create(algo)
        ;

      file.pipe(cs);
      cs.on('end', function (digest) {
        file[algo] = digest;
      });
    });
  }
  function stopHashing(file) {
    file._hashes = undefined;
  }

  function GoodFile(req, headers) {
    if (!(this instanceof GoodFile)) {
      return new GoodFile(req, headers);
    }

    EventEmitter.call(this);

    this._req = req;

    // W3C File API
    this.size = 0;
    this.length = null; // alias of size
    this.type = headers.type;
    this.name = headers.filename;
    this.fieldname = headers.name;
    this.lastModifiedDate = null;
    this.headers = headers;
  }
  util.inherits(GoodFile, EventEmitter);
  GoodFile.prototype.pause = function () {
    this._req.pause();
  };
  GoodFile.prototype.resume = function () {
    this._req.resume();
  };
  GoodFile.create = function (req, headers) {
    return new GoodFile(req, headers);
  };

  function GoodForm() {
  }
  GoodForm.pump = function (file, pathname) {
    var tmpFile = fs.createWriteStream(pathname)
      ;

    file.pipe(tmpFile);
  };
  GoodForm.create = function (req, options) {
    var poorForm = PoorForm.create(req)
      , fieldsArr
      , filesArr
      , fieldsMap
      , filesMap
      , curFile
      , curField
      ;

    if (!poorForm) {
      return null;
    }

    options = options || {};
    options.fieldNames = options.fieldNames || [];
    options.expectedFiles = options.expectedFiles || [];
    options.hashes = options.hashes || [];

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
        curFile = new GoodFile(req, headers);

        filesMap[headers.name].push(curFile);
        filesArr.push(curFile);

        if (options.hashes.length) {
          startHashing(curFile, options.hashes);
        }
        poorForm.emit('file', headers.name /*form name, not file name*/, curFile);
        if (null !== options.path) {
          curFile.pipe(fs.createWriteStream(path.join(options.path, UUID.v4())));
        }
      } else {
        // probably a field, but maybe a file without a filename

        fieldsMap[headers.name] = fieldsMap[headers.name] || [];

        curFile = null;
        curField = {
            name: decodeURIComponent(headers.name)
          , value: ""
        };

        fieldsMap[headers.name].push(curField);
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
        poorForm.emit('field', curField.name, curField.value);
        curField = null;
      }
    });

    poorForm.on('formend', function () {
      options.fieldNames.forEach(function (key) {
        fieldsMap[key] = fieldsMap[key] || [];
        filesMap[key] = filesMap[key] || [];
      });
      filesArr.forEach(stopHashing);
      poorForm.emit('end', fieldsMap, filesMap);
    });

    // TODO better error abstraction (i.e. emit formend)
    req.on('error', function (err) {
      poorForm.emit('error', err);
    });

    return poorForm;
  };

  module.exports.GoodForm = GoodForm;
}());
