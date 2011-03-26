
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
  * + added the parameter stats object  as an argument of 'end' event listeners. ( it contains: chunks received, bytes received, bytes written to disk )

0.2.4 / 2011-03-xx
==================

 * + added overall statistics output when 'end' event is emitted -> overallSecs, filesCompleted, filesRemoved
 * + moved logger functions to formaline instance attributes
 * + Restyle stats
 * + Cleaned some code

