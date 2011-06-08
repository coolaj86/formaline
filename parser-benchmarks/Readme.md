### Basic Example


**This is a parser performance benchmark! the module performances depend on many factors, network throughput, number of data chunks, chunk size, load, etc.. ( See *Parser Section* in the [Readme](https://github.com/rootslab/formaline/blob/master/Readme.md) )** .

> default example:

> - uses a fixed boundary string of 57 bytes (ascii), 
> - builds a data buffer of 700MB in RAM,  
> - uses a sort of redundancy factor for boundary string presence into the data (gapFactor), actually it is a simple distance factor  between boundary strings. The bigger the value, the lesser are occurrences of boundary string into the text buffer. 
  
> **check if you have enough memory free!**
 
 
 **Generic Usage**:


```bash    
  $ node parser-benchmarks/QS-benchmark-test.js
```


>**typical results on a Linux VM, with ~ 4000 files of 180K in size**: ~ 600 MB/s

>     ->	Min Gap Factor: 2
>     ->	Max Gap Factor: 5 
>     ->	Current Gap Factor: 3

>     ->	pattern: ---------------------------2046863043300497616870820724

>     ->	max pattern length: 254 bytes
>     ->	pattern length: 57 bytes
>     ->	pattern gap: 185193 bytes (distance in bytes of boundary occurrences)
>     ->	plength / pgap: 0.0003077870113881194 

>     ->	buffer size in MB: 700.0999994277954
>     ->	buffer creation time: 8.26 secs

>     ->	total matches: 3965
>     ->	step cycles: 12676085
>     ->	inner cycles: 234335
>     ->	data bytes: 734108057
>     ->	pattern bytes: 57
>     ->	matching time: 1.195 secs
>     ->	average parsing speed: 599.9183258695084 MB/s




 **Semi Custom Usage**:


```bash
    // use --> $ node parser-benchmarks/QS-benchmark-test.js [NumberOfMegaBytes] [GapFactor] [patternString]
    $ node parser-benchmarks/QS-benchmark-test.js 700 4
```


>**typical results on a Linux VM, with 70 files of ~ 10M in size**: ~ 667 MB/s

>     ->	Min Gap Factor: 2
>     ->	Max Gap Factor: 5 
>     ->	Current Gap Factor: 4

>     ->	pattern: ---------------------------2046863043300497616870820724

>     ->	max pattern length: 254 bytes
>     ->	pattern length: 57 bytes
>     ->	pattern gap: 10556001 bytes (distance in bytes of boundary occurrences)
>     ->	plength / pgap: 0.0000053997721296161305 

>     ->	buffer size in MB: 700
>     ->	buffer creation time:  8.292 secs

>     ->	total matches: 70
>     ->	step cycles: 12670166
>     ->	inner cycles: 10301
>     ->	data bytes: 734003200
>     ->	pattern bytes: 57
>     ->	matching time: 1.075 secs
>     ->	average parsing speed: 666.7906976744187 MB/s


> **long pattern boundaries (max 254 ascii chars) means best results** .

> in progress..
