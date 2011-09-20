 0.6.4 / 2011-09-20
===================
 
 * + Dummy version -> Corrected 'require' statements

  0.6.3 / 2011-09-15
===================
 
 * + resolved a bug in the simple example ( connect 1.7.1 )
 * + better require
 
 0.6.2 / 2011-08-15
===================
 
 * + resolved bug in parseUrlEncodedData method ( request hangs on multiple chunks )
 * + better handling for empty / already completed requests
 * + minified code for adding request handlers
 * + cleaned some code

 0.6.1 / 2011-08-05
===================
 
 * + better parser performances than previous versions ( average ~15% , less method calls )
 * + new quickParser class / file
 * + better variable declaration in formaline.js
 
 0.6.0 / 2011-08-04
===================
 
 * + now formaline module is totally async
 * + added async directory creation / checking
 * + added 'mkDirSync' config param
 * + better JSON.stringify styling

  0.5.9 / 2011-08-02
===================
 
 * + added file progression event 'fileprogress', for monitoring the current file upload progress
 * + added data payload to 'fileprogress' event, now is possible to move the data stream elsewhere, while the file is being uploaded
 * + added console.log colors

 0.5.8 / 2011-07-28
===================
 * + added charset=UTF-8 meta to simpleUpload example
 * + added initialConfig property
 * - removed extensions.js and createDelegate Function
 * + moved apply to formaline.js
 * + added new recording file for headers, recording files and log files have been renamed ( .json, .bin, .log )
 * + cleaned code
 * + moved files unlinking to a private method
 * + moved internal config params to JSON objects ( defaultCfg and privateCfg ) 
 * + better style for logfile, added timestamp..
 * + added 4th debug level for logging 'progress' event 
 * + added correct json response object ( incomplete files list ), when the request is timed out or aborted 
 * + corrected some doc bugs

 0.5.7 / 2011-06-11
===================

 * + resolved index bug, that leads to incorrect file writing in particular situations
 
 0.5.6 / 2011-06-10
===================

 * + resolved 'chopped headers' bug
 * + now it is possible to have multiple logs / records in the same upload directory 
 * + changed 'new Date().getTime()' to 'Date.now()'
 
 0.5.5 / 2011-06-08
===================

 * + added better logging
 * + it is possible to switch ( on /off ) console logging
 * + it is possible to log messages to a file in the current upload directory ( *.log )
 * + it is possible to record the last client request ( multipart/form-data & urlencoded ) to a file in the current upload directory ( *.req )
 * + corrected minor code bugs ( JSLINT )

 0.5.4 / 2011-06-07
===================

 * + corrected 'rbytes' property of incomplete files to 'size'
 * + added new config param 'maxFileSize'
 * + added new config param 'serialzedFieldThreshold' for limiting the parsing of url encoded fields 
 * + corrected the file checksum value, now default value is 'null' when 'sha1sum' config param  is false, or if the file is incomplete
 * + resolved some bugs for the creation of the list of incomplete files 
 

 0.5.3 / 2011-06-03
===================

 * + all json responses now contain files/fields values grouped by field name
 * + moved 'field' event to 'load'
 * + changed 'datasha1sum' file property name to 'sha1checksum'
 * + better html for example

 0.5.2 / 2011-06-03
====================

 * + Renamed 'exception' event name to 'error'
 * + Removed the trailing string 'exception' from event names
 * + Renamed 'abortedexception' ( 'aborted' ) to 'abort'
 * + Renamed 'end' to 'loadend'
 * + Renamed 'dataprogress' to 'progress'
 * + Added 'loadstart' event
 * + Changed 3rd level logging , now it doesn't log filestream data
 * + Added startTime and endTime to 'loadend' stats
 * + Added 'load' event
 * + Moved 'warning' and 'fileremoved' to 'message' event subtype
 * + Changed all JSON response to same structure

 0.5.1 / 2011-06-02
===================

 * + Resolved bug for lastModifiedDate. I have added a more accurate value for this property for files received in only one chunk of data
 * + Resolved incorrect event value for closeConnection
 * + Resolved bug for 'abortexception' and 'timeoutexception'

 0.5.0 / 2011-06-01
===================

 * + I have changed file's attributes for being consistent with the W3C FILE API 
 * + Changed files received and files removed to array structure in json response object
 * + changed json.completed to json.files 

 0.4.9 / 2011-06-01
===================

 * + added config param 'resumeRequestOnFatalException'
 * + added 'mtime' ( last modified date ) attribute to files
 * + better fatal exception handling

 0.4.8 / 2011-05-31
===================

 * + added 'requestTimeOut' config parameter, now it is possible to specify a value different from default ( 120000 millisecs )
 * + added 'timeoutexception' and 'abortedexception' events
 * + added listeners for request 'close' event

 0.4.7 / 2011-05-31
===================

 * + removed a bug on the fileDataChunk index, when the file data are chopped there is an error while writing of the last chunk, obviously it has caused a bad hash calculation

 0.4.6 / 2011-05-26
===================

 * + better code for sync directory creation
 * + resolved minor bugs
 * + better code for checking boundary string 
 * + added direxception
 * + little modification to Readme

 0.4.5 / 2011-05-25
===================

 * + moved all response objects to JSON format, also for fields
 * + rewritten documentation for new listeners signatures
 * + tested session support, and added documentation

 0.4.4 / 2011-05-24
===================

 * + resolved some little configuration bugs
 * + better logging, better events emitting
 * + added config function param getSessionID, for generating upload directory name using the user session id
 * + better event emitting code, builded json objects in code
 * + changed listeners signatures for receiving only a JSON object
 * - remove customXHR example, I'll develop this for future releases
 
 0.4.3 / 2011-05-22
===================

 * + resolved some little bugs
 * + commented out customXHR2 code, now start to develop this feature
 * + merged development branch with master branch

 0.4.2 / 2011-05-21
===================

 * + removed all methods from this object to inner variables with binding
 * + cleaned some code

 0.4.1 / 2011-05-21
===================

 * + changed exceptions listeners to a single entry point
 * + removed callback param from exception listener

 0.4.0 / 2011-05-20
===================
 
 * + new development branch
 * + code total refactoring ( -30% )

 0.3.5 / 2011-05-19
===================

 * + permits ; in filenames
 * + emit 'filereceived' for empty uploaded files  
 * + added text to Readme

 0.3.4 / 2011-05-18
===================

 * + resolved some index bugs
 * + tested more browser streams 
 * + added some comments in Readme, and markdown changed

 0.3.3 / 2011-05-05
===================

 * + resolved bug with data buffer indexes
 * + resolved bug, reset fileStream after closing it 
 * + resolved new introduced bug for my customXHR

 0.3.2 / 2011-05-04
===================

 * + resolved new introduced bug for fields
 
 0.3.1 / 2011-05-04
===================

 * + This version in unstable, move to 0.3.2
 * + added upload example with iframe
 * + resolved little bug for application/x-www-form-urlencoded
 * + added some text in Readme
 
 0.3.0 / 2011-04-30
===================

 * + tested with HTML5 AJAX powered multiple file uploads
 * + added client side example with multiple custom XHR

 0.2.9 / 2011-04-29
===================

 * + send empty response after that a fatal exception was thrown ( for example, on missing or empty request headers )
 * + removed possible 0 result from Math.random, when generating random directory name


 0.2.8 / 2011-04-08
===================

 * + added support for multiple uploads from multiple browsers to testapp.js
 * + added link to Boyer Moore algorithm
 * + Some corrections to docs

 0.2.7 / 2011-04-05
===================

 * + resolved some bugs in code for exceptions


 0.2.6 / 2011-04-05
===================

 * + added code to catch more exceptions
 * + modifications to Documentation
 * + added some comments
 
 0.2.5 / 2011-03-27
===================

 * + added sha1 digest for file data
 * - resolved a little bug in overall stats logging

 0.2.4 / 2011-03-26
===================

 * + added overall statistics output when 'end' event is emitted -> overallSecs, filesCompleted, filesRemoved
 * + moved logger functions to formaline instance attributes
 * + tested with some curl weird params
 * + cleaned some code


 0.2.3 / 2011-03-24
===================

  * + added the original filename as an argument of  'filereceived' / 'fileremoved' events listeners.
  * + added 'stats' as an argument of 'end' event listeners. ( it contains: chunks received, bytes received, bytes written to disk )

 0.2.2 / 2011-03-24
===================

  * + filename control checks:  special chars escaping
  * + SHA1 hashing for file names 
  * + configuration param 'holdFilesExtensions'
  * + Better English in Readme.md
  
 0.2.1 / 2011-03-21
===================

  * + added a lot of text in Readme.md and cleaned come code
  
 0.2.0 / 2011-03-19
===================

  * + added the same params to 'filereceived' and 'fileremoved' listeners callbacks


 0.1.0 / 2011-03-01
===================

  * Hello World!
 
