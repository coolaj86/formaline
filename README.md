## Formaline v2.x

Formaline extends [PoorForm](http://github.com/coolaj86/poor-form) to create a very developer-friendly form parser, and still easy to get at the guts.

If you don't think Formaline is light-weight enough for you, you're crazy.
Also, you'd probably really like [PoorForm](http://github.com/coolaj86/poor-form).

The **[Formaline v0.x](https://github.com/rootslab/formaline/tree/v0.x)** [documentation](https://github.com/rootslab/formaline/blob/v0.x/Readme.md) is available on the v0.x branch. v0.6.4 seems to be the best version. It never made it to v1.0.0.

## API

  * [`Formaline.create(request, options)`](#formalinecreaterequest-options)
  * [`Formaline#on('progress', fn)`](#formalineonprogress-function--)
  * [`Formaline#on('field', fn)`](#formalineonfield-function-name-decodedvalue-)
  * [`Formaline#on('file', fn)`](#formalineonfile-function-name-formfilestream-headers-)
    * [`FormFile#name`](#formfile)
    * [`FormFile#size`](#formfile)
    * [`FormFile#type`](#formfile)
    * [`FormFile#lastModifiedDate`](#formfile)
    * [`FormFile#path`](#formfile)
    * [`FormFile#headers`](#formfile)
    * [`FormFile#<hashtype>`](#formfile) (md5, sha1, sha512, etc)
  * [`Formaline#on('end', fn)`](#formalineonend-function-fields-files-)

### Formaline.create(request, options)

Returns an instance of `PoorForm` with a few extra events tacked on as described above.

Like PoorForm, it returns null if either it's not a multi-part form or the form has already been parsed.

#### Options

    {
        tmpDir: null || pathString || os.tmpDir()
      , hashes: ["md5", "sha1", ...] || []
      , arrayFields: [fieldNameString] || null
    }

##### tmpDir

Set `tmpDir` to `null` if you plan to manage the file streams from the `file` event on your own
(i.e. you want to store them in S3 or whatever and never let them hit the fs).
Also, in almost all cases `tmpDir` should be on the same partition as the final destination,
so change it if the system's default tmp is a different partition than your destination.

##### hashes

An array of hashes that should be performed on each file (fields are excluded).
The hash will be attached to the file before the `end` event.

##### arrayFields

When `end` fires it hands back a map for both `fields` and `files`,
all of which are assumed to be arrays by default (as per the HTTP spec).

However, if `arrayFields` is an array of field names (or an empty array),
two special things happen:

  1. All of the fields listed will always return an array, even if it's empty

    I.E. The user created an album, but uploaded 0 photos.

  2. All fields and files not listed in `arrayFields` will be treated as single values
     (if the field is encountered multiple times, only the first value is kept)

    I.E. If `username` is given twice, only the first value is kept.

#### Example

```javascript
(function () {
  "use strict";

  var Formaline = require('formaline')
    ;

  // Using Connect, for example
  app.use(function (req, res, next) {
    var form = Formaline.create(req, {
            tmpDir: '/mnt/my-app-data/tmp'
          , hashes: ['md5']
          , arrayFields: ['photos']
        })
      , fieldsMap
      , filesMap
      ;

    if (!form) {
      console.log("Either this was already parsed or it isn't a multi-part form");
      next();
      return;
    }

    // form.on('field', ...)
    // ...
  });
}());
```

### Formaline#on('progress', function () {})

Fires after `Formaline#loaded` is updated so you can compare that against `Formaline#total`.

```javascript
form.on('progress', function () {
  var ratio = poorForm.loaded / poorForm.total
    , percent = Math.round(ratio * 100)
    ;

  console.log(percent + '% complete (' + poorForm.loaded + ' bytes)');
  // might be 0 because poorForm.total is Infinity when Content-Length is undefined
  // I.E. Transfer-Encoding: chunked
})
```

### Formaline#on('field', function (name, decodedValue) {})

Provides the form name and decoded string
abstracted from PoorForm's `fieldstart`, `fielddata`, and `fieldend` events
(remember than a field's data is occasionally chunked across two `fielddata` events).

```javascript
form.on('field', function (key, value) {
  // both key and value have been run through `str = decodeURIComponent(str)`
  fieldsMap[key] = value;
  console.log(key, value);
})
```

### Formaline#on('file', function (name, formFileStream, headers) {})

Provides the form name (not filename) as well as a FormFile stream (described below, has the filename),
and all associated headers (generally not needed).

Remember: If you specify `options.tmpDir = null`,
you are entirely responsible for writing the file to disk, GridStore, S3, the toilet, or wherever.

```javascript
form.on('file', function (key, formFile) {
  // for example, we want to save to amazon s3 using knox
  var s3 = require('knox').createClient({ key: '<api-key>', secret: '<secret>', bucket: '<foo>'})
    , s3req
    , metadata
    ;

  // and let's say we have a field called `metadata` containing a hash with metadata
  // such as `lastModifiedDate` and `size` for every file to be uploaded
  if (!fieldMaps.metadata) {
    console.error('sad day, no metadata');
  } else {
    metadata = JSON.parse(fieldMaps.metadata[formFile.name]);
  }

  s3req = s3.put('/test/file.bin', {
      'Content-Length': metadata.size
    , 'Content-Type': 'application/octet-stream'
  });
  formFile.pipe(s3);

  formFile.on('end', function () {
    // formFile is an instance of EventEmitter, but it `JSON.stringify()`s as you would expect.
    // Also note that some of the properties are added just before the `end` event fires.
    formFile.lastModifiedDate = metadata.lastModifiedDate;
    if (!formFile.sha1 === metadata.sha1) {
      console.error("Oh No! The sha1 sums don't match!");
    }
    console.log(key, JSON.stringify(formFile));
  });

  s3.on('response', function(res){
    if (200 == res.statusCode) {
      console.log('saved to %s', req.url);
    } else {
      console.error("fell on hard times, didn't save %s", req.url);
    }
  });
})
```

#### FormFile

A simple EventEmitter FileStream (pausable, resumable, etc)
abstracted from PoorForm's `fieldstart`, `fielddata`, and `fieldend` events.

  * `name` is taken from the `filename` in the `Content-Disposition` 
  * `fieldname` is the actual name of the field
  * `size` is the current byte size of the file, which changes until the `end` event is called
  * `type` is the `contentType`
  * `lastModifiedDate` is updated each time a chunk is written to the file
  * `path` is the current file path (either in `/tmp` or a path you specified)
  * `headers` is the array of MIME headers associated with the form
  * `md5`, `sha1`, `sha256`, `sha512`, etc are attached as per the `options.hashes` array

### Formaline#on('end', function (fields, files) {})

Congratulations. You've reached the end of the form.

  * `fields` is a map of arrays of Strings `{ "anyFieldName": ["decodedStringValue"] }`
  * `files` is a map of arrays of FormFiles `{ "anyFileName": [aFormFile, anOtherFormFile] }`
  * `options.arrayFields` changes the behavior such that only the listed fields are arrays and all others are singular

```javascript
form.on('end', function (fields, files) {
  // Normally the values for each key of fields and files would be arrays
  // However, I specified `arrayFields`, which means that those names not listed are not arrays
  console.log(fields.username);
  console.log(fields.password);

  // this is an array because it would be by default if I ha
  files.photos.forEach(function (formFile) {
    // JSON.stringify ignores the non-enumerable properties of the underlying EventEmitter
    console.log(JSON.stringify(formFile));
  });

  console.log('uploads complete');
});
```

NOTE:
I put a lot of thought (too much, in fact) into how to represent fields and files in a way which is both consistent and easy to use.

It makes sense to separate `fields` from `files`.
Treating all fields as files would have unneccesary overhead in parsing.
What you're likely to do with a field (store it in a database as metadata)
is different from what you'll do with a file (store it in a file system).

The hybrid approach of mapping pure arrays makes it simple to ignore (and or error check)
duplicate fields that should have been singular without the confusion of other common methodologies
(see below).

Using maps where `username` and `categories` are sometimes treated as single-value fields
(i.e. if only one `category` is selected in the browser UI)
but sometimes treated as arrays
(i.e. a developer accidentally sends two `username` form parts)
is inconsistent and likely to cause wierd breakage in your app.

Using pure arrays where you have to `.forEach`
and handle the fields in a `switch` is ugly / cumbersome.

Another workaround is to require php-style field naming conventions such as `categories[]` and `username`, but PHP is &lt;insert-profanity-here&gt; and self-respecting individuals have a hard time taking anything that started with PHP seriously, even though it's atually not a terribly profane solution.
The downside to this solution is that it requires parsing field names.

## Future Enhancements (TODO)

The following are abbreviated security concerns for a form handler with generous and reasonable defaults

  * `error` - abstract `req.on('error')` and `poorForm.on('error', fn)` as to handle malformed requests
  * `maxHeaderSize` - default 256 Bytes - prevent memory attacks
  * `maxUniqueFieldNames` - default 1000 - prevent hash collision attacks
  * `maxFieldSize` - default 4KB - prevent memory attacks
  * `maxFieldTotalSize` - default 1MB - prevent memory attacks
  * `maxFileSize` - default 4 GiB - prevent storage attacks
  * `maxUploadSize` - default 16 GiB - prevent memory / storage attacks
  * `removeIncomplete` - default true - ignore unless creating a resumable upload service
