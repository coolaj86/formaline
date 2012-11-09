## GoodForm

GoodForm extends PoorForm to make it a slightly better.

It doesn't include the kitchen sink, but it's got at least a drawer or two and cleanly separates the forks from the knives. Also, GoodForm is from Brooklyn.

If you don't think GoodForm is light-weight enough for you, you're crazy.
Also, you'd probably really like PoorForm.

## API

  * `GoodForm.create(request, options)`
  * `GoodForm.pump(readableStream, filepath)`
  * `GoodForm#on('progress', fn)`
  * `GoodForm#on('field', fn)`
  * `GoodForm#on('file', fn)`
    * `GoodFile#name`
    * `GoodFile#size`
    * `GoodFile#type`
    * `GoodFile#lastModifiedDate`
    * `GoodFile#path`
  * `GoodForm#on('end', fn)`
  * `GoodForm#parse()`

### GoodForm.create(request, options)

Returns an instance of `PoorForm` with a few extra events tacked on as described above.

Like PoorForm, it returns null if either it's not a multi-part form or the form has already been parsed.

#### Options

    {
        tmpDir: null || pathString || os.tmpDir() /*default*/
      , hashes: ["md5", "sha1", ...] || [] /*default*/
      , fieldNames: [fieldNameString] || [] /*default*/
      , arrayFields: [fieldNameString] || fieldNames /*default*/
    }

##### tmpDir

Set `tmpDir` to `null` if you plan to manage the file streams from the `file` event on your own
(i.e. you want to store them in S3 or whatever and never let them hit the fs).
Also, in almost all cases `tmpDir` should be on the same partition as the final destination,
so change it if the system's default tmp is a different partition than your destination.

##### hashes

An array of hashes that should be performed on each file (fields are excluded).
The hash will be attached to the file before the `end` event.

##### fieldNames

List the fields and or files you expect here and they'll be prepopulated with empty arrays if not submitted.

#### Example

```javascript
// Using Connect, for example
app.use(function (req, res, next) {
  var goodForm = GoodForm.create(req, {
          tmpDir: '/mnt/uploads/tmp'
        , hashes: ['md5']
        , fieldNames: ['username', 'password', 'photos']
        , arrayFields: ['photos']
      })
    ;

  if (!goodForm) {
    console.log("Either this was already parsed or it isn't a multi-part form");
    next();
    return;
  }

  // goodForm.on('field', ...)
  // ...
});
```

### GoodForm#on('progress', function () {})

Fires after `GoodForm#loaded` is updated so you can compare that against `GoodForm#total`.

### GoodForm#on('field', function (name, decodedValue) {})

Provides the form name and decoded string
abstracted from PoorForm's `fieldstart`, `fielddata`, and `fieldend` events
(remember than a field's data is occasionally chunked across two `fielddata` events).

### GoodForm#on('file', function (name, goodFileStream, headers) {})

Provides the form name (not filename) as well as a GoodFile stream (described below, has the filename),
and all associated headers (generally not needed).

Remember: If you specify `options.tmpDir = null`,
you are entirely responsible for writing the file to disk, GridStore, S3, the toilet, or wherever.

#### GoodFile

A simple EventEmitter FileStream (pausable, resumable, etc)
abstracted from PoorForm's `fieldstart`, `fielddata`, and `fieldend` events.

  * `name` is taken from the `filename` in the `Content-Disposition` 
  * `size` is the current byte size of the file, which changes until the `end` event is called
  * `type` is the `contentType`
  * `lastModifiedDate` is updated each time a chunk is written to the file
  * `path` is the current file path (either in '/tmp' or a path you specified)
  * `headers` is the array of MIME headers associated with the form
  * `md5`, `sha1`, `sha256`, `sha512`, etc are attached in declared in the `options.hashes` array

### `GoodForm#on('end', function (fields, files) {})`

Congratulations. You've reached the end of the form.

  * `fields` is a map of arrays of Strings `{ "anyFieldName": ["decodedStringValue"] }`
  * `files` is a map of arrays of GoodFiles `{ "anyFileName": [aGoodFile, anOtherGoodFile] }`

```javascript
form.on('end', function (fields, files) {
  fields.username = fields.username[0];
  fields.password = fields.password[0];
  console.log(fields, files);
});

NOTE:
I put a lot of thought (too much, in fact) into how to represent fields and files in a way which is both consistent and easy to use.

It makes sense to separate `fields` from `files`.
Treating all fields as files would have unneccesary overhead in parsing.
What you're likely to do with a field (store it in a database as metadata)
is different from what you'll do with a file (store it in a file system).

The hybrid approach of maping pure arrays makes it simple to ignore (and or error check)
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

```

## Future Enhancements

needs an abstracted `error` event for both `PoorForm` and `http#request`
