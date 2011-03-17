/*!
 * formaline parser, an implementation of QuickSearch algorithm
 * Copyright(c) 2011 Guglielmo Ferri <44gatti@gmail.com>
 * MIT Licensed
 */


var lookupTable = function(p){ 
    var b = new Buffer(255),
        m = p.length,
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


var crlfcrlfMatch = function(t,l){ //stop at first match of CRLFCRLF, obviously.. l is start index 
    var p = new Buffer([13,10,13,10]), //4 bytes CRLFCRLF
        m = p.length,
        n = t.length,
        s = l || 0,
        ok = 1,
        lkt = lookupTable(p),
        lkb = lkt.getRawBuffer();
    for( var j=s, z=0, x=p[0], pos=j, y=t[pos], i=m, c=t[i]; j<=n-m; i=j+m, c=t[i], z=0, ok = 1, pos=j, x=p[0], y=t[pos] ){
            //console.log(z,pos,x,y,x===y);   //matching sequence good for testing
        for(; z<m; z++, pos++, x=p[z], y=t[pos]){ 
            //console.log(z,pos,x,'-'+y+'-',x===y);   //matching sequence good for testing
            if( x === y ){ continue; }
            else{ ok = 0; break; }   
        }
        if( ok ){ 
            //console.log('matched CRLFCRLF at:', j );
            //console.log(' stripe:',t[j-5],t[j-4],t[j-3],t[j-2],t[j-1],'-',t[j],'-',t[j+1],t[j+2],t[j+3],t[j+4],t[j+5],t[j+6]);//,' j:',j);          
            break;
        }
        //console.log('CRLFCRLF --> j:',j,'c:',c,'jump:',lkb[c] || m + 1);
        j +=  lkb[c] || m + 1;
    }//end for   
    return  j ;  // j is the first char index of the crlfcrlf sequence
};

exports.quickSearch = function(p,t){
    var n = t.length,
        m = p.length,
        pmatches = 0,
        lkt = lookupTable(p),
        lkb = lkt.getRawBuffer();
        var result = {};
        var arr = new Array();
    //Every Boundary has two "--" than normal  --(--Axc43434) end with --(--Axc43434)--
    for( var j=0, ok=1, z=0, x=p[0], pos=0, y=t[pos], i=m, c=t[i]; j<=n-m; i=j+m, c=t[i], z=0, pmatches+=ok, ok=1, pos=j, x=p[0], y=t[pos]){ 
        for(; z<m; z++, pos++, x=p[z], y=t[pos]){        
            //console.log('    z:',z,'pos:',pos,'x:',x,'y:',y,x===y);   //matching sequence good for testing
            if( x === y ){ 
                //console.log(z,pos,x,y,x===y);   //matching sequence good for testing
                continue; 
            }
            else{ ok = 0; break; }
        }
        if( ok ){ 
            //console.log('matched BOUNDARY at:',j);
            //console.log('   stripe:',t[j-5],t[j-4],t[j-3],t[j-2],t[j-1],'-',t[j],'-',t[j+1],t[j+2],t[j+3],t[j+4],t[j+5],t[j+6]);//,' j:',j);
            var hs = crlfcrlfMatch( t, j + m + 2 );// +2 is for  CRLF boundary\r\n
            result = { 
                    start: j , 
                    finish: hs || m
            };
            arr.push(result);
        }
        //console.log('QUICK --> j:',j,'c:',c,'jump:',lkb[c] || m + 1);
        j +=  lkb[c] || m + 1;
    }//end for
    //console.log('QS-->',result,arr);
    return arr;
};


