 Parser Implementation & Performance
--------------------------------------

###A Note about Parsing Data Rate vs Network Throughput
-------------------------------------------------------

Overall parsing data-rate depends on many factors, it is generally possible to reach a ( parsing ) data rate of __700 MB/s and more__  with a *real* Buffer totally loaded in RAM ( searching a basic ~60 bytes string, like Firefox uses; **see  [parser-benchmarks](https://github.com/rootslab/formaline/tree/master/parser-benchmarks)** ), but in my opinion, **this parsing test only emulates an high Throughput network with only one chunk for all data, therefore not a real case**. 

Unfortunately, sending data over the cloud is sometime a long-time task, the data is chopped in many chunks, and the **chunk size may change because of (underneath) TCP flow control ( typically the chunk size is between ~ 4K and ~ 64K )**. Now, the point is that the parser is called for every chunk of data received, the total delay of calling it becomes more perceptible with a lot of chunks. 

I try to explain me:

( using a super-fast [Boyer-Moore](http://www-igm.univ-mlv.fr/~lecroq/string/node14.html#SECTION00140) parser )

>__In the world of Fairies :__
 
>  - the data received is not chopped, 
>  - there is a low repetition of pattern strings in the received data, ( this gets the result of n/m comparisons )
>  - network throughput == network bandwidth ( **wow**),
 
 reaches a time complexity (in the best case) of :   

     O( ( data chunk length ) / ( pattern length ) ) * O( time to do a single comparison ) 
      or, for simplicity  
     O( n / m ) * O(t) = O( n / m )
   
> **t** is considered to be a constant value. It doesn't add anything in terms of complexity, but it still is a non zero value.  

(for the purists, O stands for Theta, Complexity).

> Anyway, I set T = (average time to execute the parser on a single chunk ) then :  
    
    T = ( average number of comparisons ) * ( average time to do a single comparison ) ~= ( n / m ) * ( t )


>__In real world, Murphy Laws assures that the best case will never occur:__ :O 
 
>  - data is chopped,
>  - in some cases (a very large CSV file) there is a big number of comparisons  between chars ( it decreases the data rate ), however for optimism and for simplicity, I'll take the  previous calculated time complexity O(n/m) for good, and then also the time T, altough it's not totally correct .   
>  - network throughput < network bandwidth,
>  - **the time 't' to do a single comparison, depends on how the comparison is implemented**

 **the average time will becomes something like**:
   
>    ( average time to execute the parser on a single chunk ) *  ( average number of data chunks ) * ( average number of parser calls per data chunk * average delay time of a single call )  

  or for simplicity, a number like:

>   ( T ) * ( k ) * ( c * d )  ~= ( n / m ) * ( t ) * ( k ) * ( c * d )  

When k, the number of data chunks, increases, the value  ( k ) * ( c * d ) becomes a considerable weigth in terms of time consumption; I think it's obvious that, for the system, call 10^4 times a function , is an heavy job compared to call it only 1 time. 

`A single GB of data transferred, with a data chunk size of 40K, is typically splitted (on average) in ~ 26000 chunks!`

 
**However, in the general case**: 
 
 - we can do very little about reducing the time delay (**d**) of parser calls, and for reducing the number (**k**) of chunks ( or manually increasing their size ), these thinks don't totally depend on us. 
 - we could minimize the number **'c'**  of parser calls to a single call for every chunk, or  **c = 1**.
 - we could still minimize the time **'t'** to do a single char comparison , it obviously reduces the overall execution time.

**For these reasons**: 

 - **instead of building a complex state-machine**, I have written a simple implementation of the [QuickSearch](http://www-igm.univ-mlv.fr/~lecroq/string/node19.html#SECTION00190) algorithm, **using only high performance for-cycles**.

 - I have tried to not use long *switch( .. ){ .. }* statements or a long chain of *if(..){..} else {..}*,

 - for minimizing the time 't' to do a single comparison, **I have used two simple char lookup tables**, 255 bytes long, implemented with nodeJS Buffers. (one for boundary pattern string to match, one for CRLFCRLF sequence). 

The only limit in this implementation is that it doesn't support a boundary length more than 254 bytes, **it doesn't seem to be a real problem with all major browsers I have tested**, they are all using a boundary totally made of ASCII chars, typically ~60bytes in length. -->

> [RFC2046](http://www.ietf.org/rfc/rfc2049.txt) *(page19)* excerpt:

**Boundary delimiters must not appear within the encapsulated material, and must be no longer than 70 characters, not counting the two leading hyphens.**