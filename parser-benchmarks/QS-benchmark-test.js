/*!
 * formaline QuickSearch semi-interactive benchmarks
 * Copyright(c) 2011 Guglielmo Ferri <44gatti@gmail.com>
 * MIT Licensed
 */

var log = console.log;

var emitter = require('events').EventEmitter;



var lookupTable = function(p){
    var b = new Buffer(255),
        m = p.length,
        called = 0,
        cmatches = 0;
    for( var i = 0; i <= 255 ; b[i] = 0x00, i++ );
    for( var j = 0; j < m ; b[p[j]] = m - j, j++ );
    return {
        containsChar: function(c){
            return (b[(new Buffer(c))[0]] & 1);
        },
        getShift: function(ncode){
            return ( b[ncode] || m + 1);// if 0 return max shift, max m = 254
        },
        contains: function(ncode){
            return ( b[ncode] & 1);
        },
        getRawBuffer: function(){
            return b;
        }
    };
};


var quickSearch = function(p,t,cback){
    var n = t.length,
        m = p.length,
        pmatches = 0,
        cyc = 0,//outer cycles
        ycy = 0,//inner cycles
        end = null,
        stats = {},
        beg = new Date(),
        lkt =  lookupTable(p),
        lkb = lkt.getRawBuffer();
        var result = {};
        var arr = new Array();
        
    for( var j=0, ok=1, z=0, x=p[0], y=t[0], pos=0, i=m, c=t[i]; j<=n-m; i=j+m, c=t[i], z=0, pmatches+=ok, ok=1, pos=j, x=p[0], y=t[pos], cyc++ ){
        for(; z<m; z++, pos++, x=p[z], y=t[pos], ycy++ ){        
            if( x === y ){ continue; }
            else{ ok = 0; break; }
        }
        if( ok ){ 
 
            var hs = crlfcrlfMatch( t, j + m + 2 );// +2 is for  CRLF boundary\r\n
            result = { 
                    start: j , 
                    finish: hs || m
            };
            arr.push(result);
            
        }
        j +=  lkb[c] || m + 1;
    }//end for
    end = new Date();
    stats = {
        millis : end - beg,
        tbytes : n,
        pbytes: m,
        matches: pmatches,
        steps: cyc,
        cycles: ycy,
        results: arr
    };
    if(cback && ( typeof cback === 'function') ){ cback(stats); }
};

var crlfcrlfMatch = function(t,l){ //stop at first match obviously.. l is start index
    var p = new Buffer([13,10,13,10]), //4 bytes CRLFCRLF
        m = p.length,
        n = t.length,
        s = l || 0,
        ok = 1,
        cyc = 0,//outer cycles
        ycy = 0,//inner cycles
        lkt = lookupTable(p),
        lkb = lkt.getRawBuffer();
    for( var j=s, z=0, x=p[0], pos=j, y=t[pos], i=m, c=t[i]; j<=n-m; i=j+m, c=t[i], z=0, ok = 1, pos=j, x=p[0], y=t[pos], cyc++ ){
        //log(z,pos,x,y,x===y);   //matching sequence good for testing
        for(; z<m; z++, pos++, x=p[z], y=t[pos], ycy++ ){ 
            //log(z,pos,x,'-'+y+'-',x===y);   //matching sequence good for testing
            if( x === y ){ continue; }
            else{ ok = 0; break; }   
        }
        if( ok ){ 
            //log('matched CRLFCRLF at:', j );
            //log('   stripe:',t[j-5],t[j-4],t[j-3],t[j-2],t[j-1],'-',t[j],'-',t[j+1],t[j+2],t[j+3],t[j+4],t[j+5],t[j+6]);//,' j:',j);
            break;
        }
        //log('CRLFCRLF --> j:',j,'c:',c,'jump:',lkb[c] || m + 1);
        j +=  lkb[c] || m + 1;
    }//end for   

    return  j ;  
};

var buildBuffer = function(p,MBsize,gapFactor){
    var s = new Date(),
        len = p.length,
        gap = Math.pow(len,(gapFactor && gapFactor>1 ) ? gapFactor : 3),//power od len
        //gap = parseInt(Math.log(len)*Math.log(len)*Math.log(len)*Math.log(len),10),
        mb =  1024 * 1024,
        size = MBsize || 700.1, // megabytes
        tSize = parseInt( size * mb, 10 ),
        logp = Math.log(len), //log bt
        logt = Math.log(tSize),//log a
        logr = logt / logp,
        maxLenPower = parseInt(logr,10); // maxLenPower = max power of len after which the 2nd pattern writed is out of buffer bound  
        log('\n ->\tMin Gap Factor: 2\n ->\tMax Gap Factor:',maxLenPower,'\n ->\tCurrent Gap Factor:', (gapFactor) ? gapFactor : 3 ); 
        
    for( var i = 0,  c = 1, t = new Buffer( tSize ); i + len < tSize; i += len  ){
        if( (i % (gap) ) === 0 ){
            t.write(p.toString()+'\r\nContent-Disposition: form-data\r\nLorem Ipsum et Dolor sit amet, Quisquisce\r\n\r\n',i);
        }else{
            t[i] = i % 255;
        } 

    }
    var mtime = new Date() - s;
    log('\n ->\tpattern:',p.toString());
    log(' ->\tmax pattern length: 254 bytes');
    log(' ->\tpattern length:',len,'bytes');
    log(' ->\tpattern gap:',gap,'bytes (distance in bytes of boundary occurrences)');
    log(' ->\tplength / pgap:',len/gap,'\n');
    

    log(' ->\tbuffer size in MB:',t.length/1024/1024);
    log(' ->\tbuffer creation time:',mtime/1000,'secs\n'); 
    return t;
};

var printStats = function( stats ){
    //log( 'results:', stats.results );        
    log( ' ->\ttotal matches:', stats.matches );
    log( ' ->\tstep cycles: '+stats.steps+'\n ->\tinner cycles: '+stats.cycles+'\n ->\ttext bytes: '+stats.tbytes+'\n ->\tpattern bytes: '+stats.pbytes );
    log( ' ->\tmatching time:', ( stats.millis )/1000,'secs' );
    log( ' ->\taverage parsing speed:',(stats.tbytes/stats.millis) / 1024, 'MB/s\n' );    
};


var bsize, 
    gapfactor,
    pattern = '---------------------------2046863043300497616870820724\r\n';

process.argv.forEach(function (val, index, array) {
    (index===2) ? (bsize = parseInt(val,10))  : null; 
    (index===3) ? (gapfactor = parseInt(val,10))  : null;
    (index===4) ? (pattern = ((val.length > 1) && (val.length < 255) ) ? ('--'+val+'\r\n') : pattern ) : null;  
});


var p = new Buffer( pattern ),// max 254 chars due to single byte use
    t = buildBuffer( p, bsize, gapfactor ); 

quickSearch( p, t, printStats );



