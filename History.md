
0.1.0 / 2011-03-01
==================

  * Hello World!

0.2.0 / 2011-03-19
==================

  * + added the same params to 'filereceived' and 'fileremoved' listeners callbacks
  
0.2.1 / 2011-03-21
================== 

  * + added a lot of text in Readme.md and cleaned come code
  
0.2.2 / 2011-03-24
================== 

  * + filename control checks:  special chars escaping
  * + SHA1 hashing for file names 
  * + configuration param 'holdFilesExtensions'
  * + Better English in Readme.md
  
0.2.3 / 2011-03-24
================== 

  * + added the original filename as an argument of  'filereceived' / 'fileremoved' events listeners.
  * + added 'stats' as an argument of 'end' event listeners. ( it contains: chunks received, bytes received, bytes written to disk )

0.2.4 / 2011-03-26
==================

 * + added overall statistics output when 'end' event is emitted -> overallSecs, filesCompleted, filesRemoved
 * + moved logger functions to formaline instance attributes
 * + tested with some curl weird params
 * + cleaned some code

0.2.5 / 2011-03-27
==================

 * + added sha1 digest for file data
 * - resolved a little bug in overall stats logging
 
0.2.6 / 2011-04-05
==================

 * + added code to catch more exceptions
 * + modifications to Documentation
 * + added some comments
 
 0.2.7 / 2011-04-05
===================

 * + resolved some bugs in code for exceptions
 
  0.2.8 / 2011-04-08
====================

 * + added support for multiple uploads from multiple browsers to testapp.js
 * + added link to Boyer Moore algorithm
 * + Some corrections to docs

  0.2.9 / 2011-04-29
====================

 * + send empty response after that a fatal exception was thrown ( for example, on missing or empty request headers )
 * + removed possible 0 result from Math.random, when generating random directory name

  0.3.0 / 2011-04-30
====================

 * + tested with HTML5 AJAX powered multiple file uploads
 * + added client side example with multiple custom XHR

  0.3.1 / 2011-05-04
====================
 * + This version in unstable, move to 0.3.2
 * + added upload example with iframe
 * + resolved little bug for application/x-www-form-urlencoded
 * + added some text in Readme
 
   0.3.2 / 2011-05-04
====================

 * + resolved new introduced bug for fields
 
  0.3.3 / 2011-05-05
====================

 * + resolved bug with data buffer indexes
 * + resolved bug, reset fileStream after closing it 
 * + resolved new introduced bug for my customXHR
 
   0.3.4 / 2011-05-18
=====================

 * + resolved some index bugs
 * + tested more browser streams 
 * + added some comments in Readme, and markdown changed

   0.3.5 / 2011-05-19
=====================

 * + permits ; in filenames
 * + emit 'filereceived' for empty uploaded files  
 * + added text to Readme
 
  0.4.0 / 2011-05-20
=====================

 * + code total refactoring ( -30% )

  0.4.1 / 2011-05-21
=====================

 * + changed exceptions listeners to a single entry point
 * + removed callback param from exception listener
 
   0.4.2 / 2011-05-21
=====================

 * + removed all methods from this object to inner variables with binding
 * + cleaned some code
 
