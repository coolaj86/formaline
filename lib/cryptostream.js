/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true*/
(function () {
  "use strict";
  
  var crypto = require('crypto')
    , EventEmitter = require('events').EventEmitter
    , util = require('util')
    ;

  function CryptoStream(algorithm) {
    var me = this
      ;

    if (!(this instanceof CryptoStream)) {
      return new CryptoStream(algorithm);
    }
    
    EventEmitter.call(this);
    this._hash = crypto.createHash(algorithm);
    this.on('pipe', function (rs) {
      rs.on('data', function (data) {
        me.write(data);
      });
    });
  }

  util.inherits(CryptoStream, EventEmitter);

  CryptoStream.prototype.write = function (chunk) {
    this._hash.update(chunk);
    return true;
  };
  CryptoStream.prototype.digest = function (str) {
    return this._hash.digest(str);
  };
  CryptoStream.prototype.end = function (bytes, enc) {
    if (bytes) {
      this.write(bytes, enc);
    }
    this.emit('end');
  };

  CryptoStream.create = function (algorithm) {
    return new CryptoStream(algorithm);
  };

  module.exports = CryptoStream;
}());
