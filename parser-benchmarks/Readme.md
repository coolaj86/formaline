### Basic Example


> default example:
 
> - uses a fixed boundary of 57 bytes, 
> - builds a data buffer of 700MB,  
> - uses a sort of redundancy factor for pattern in data (gapFactor), it is a distance between patterns. Bigger value implies lesser pattern matches. 
  
> **check if you have enough memory free!**
 
 
> **Generic Usage**:

    
    
>     $ node parser-benchmarks/QS-benchmark-test.js



> or



>     $ node parser-benchmarks/QS-benchmark-test.js [NumberOfMegaBytes] [GapFactor] [patternString]


>**typical results**:

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
>     ->	text bytes: 734108057
>     ->	pattern bytes: 57
>     ->	matching time: 1.195 secs
>     ->	average parsing speed: 599.9183258695084 MB/s

> long pattern boundaries (max 254 ascii chars) means best results. 


> in progress..
