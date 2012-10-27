/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true unused:true undef:true*/
/*!
 * formaline parser, an implementation of QuickSearch algorithm
 * http://www-igm.univ-mlv.fr/~lecroq/string/node19.html#SECTION00190
 * Copyright(c) 2011 Guglielmo Ferri <44gatti@gmail.com>
 * MIT Licensed
 *
 *   data stream structure-->
 *
 *   (--)------boundary\r\n <-- ascii  
 *   headers\r\n\r\n
 *   data\r\n
 *   (--)------boundary\r\n <-- ascii
 *   ....
 *   ....
 *   (--)------boundary(--)\r\n
 *   
 */
exports.QuickParser = ( function () {
    "use strict";
    var //log = console.log,
        lookupTable = function ( p ) {
          var b = new Buffer( 255 )
            , m = p.length
            , i = 255
            , j = 0
            , c = m + 1
            ;

            for( ; i >= 0 ; b[ i ] = 0x00, i-- );
            for( ; c > 0; b[ p[ j++ ] ] = --c );
            return b;
        },
        nrnr = new Buffer( [ 13, 10, 13, 10 ] ),
        lknr = lookupTable( nrnr ),
        crlfcrlfMatch = function ( t, l ) { // stop at first match obviously.. l is start index
            var m = 4
                , n = t.length
                , j = l || 0
                , z = 0
                , x = nrnr[ 0 ]
                , pos = j
                , y = t[ pos ]
                , i = m
                , c = t[ i ]
                , ok
                ;
            for ( ; j <= n - m; i = j + m, c = t[ i ], z = 0, ok = 1, pos = j, x = nrnr[ 0 ], y = t[ pos ] ) {
                for ( ; z < m; z++, pos++, x = nrnr[ z ], y = t[ pos ] ) {
                    if ( x === y ) { continue; }
                    else { ok = 0; break; }
                }
                if ( ok ) {
                    // log('matched CRLFCRLF at:', j );
                    break;
                }
                j += lknr[ c] || m + 1;
            }
            return j; // j is the first char index of the crlfcrlf sequence
        },
        QuickParser = function ( p ) {
            var me = this;
            me.p = p;
            me.lkb = lookupTable( p );
            me.len = p.length;
        },
        qpproto = QuickParser.prototype;

    qpproto.parse = function ( t ) {
        var me = this
          , p = me.p
          , m = me.len
          , lkb = me.lkb
          , n = t.length
          , result = {}
          , arr = []
            // for loop vars
          , j = 0
          , ok = 1
          , z = 0
          , x = p[ 0 ]
          , pos = 0
          , y = t[ pos ]
          , i = m
          , c = t[ i ]
          , pmatches = 0
            // inner for loop vars
          , hs
          ;
        // Every Boundary has two "--" than normal  --(--Axc43434) end with --(--Axc43434)--
        for ( ; j <= n - m; i = j + m, c = t[ i ], z = 0, pmatches += ok, ok = 1, pos = j, x = p[ 0 ], y = t[ pos ] ) { 
            for ( ; z < m ; z++, pos++, x = p[ z ], y = t[ pos ] ) {
                 //log( '    z:', z, 'pos:', pos, 'x:', x, 'y:', y, x === y ); // matching sequence good for testing
                if ( x === y ) {
                    // log( z, pos, x, y, x === y ); // matching sequence good for testing
                    continue;
                }
                else { ok = 0; break; }
            }
            if ( ok ) { 
                // log( 'matched BOUNDARY at:',j );
                // log( '   stripe:',t[j-5],t[j-4],t[j-3],t[j-2],t[j-1],'-',t[j],'-',t[j+1],t[j+2],t[j+3],t[j+4],t[j+5],t[j+6]);//,' j:',j );
                hs = crlfcrlfMatch( t, j + m + 2 ); // +2 is for  CRLF boundary\r\n
                    result = {
                            start : j , 
                            finish : hs || m
                    };
                arr.push( result );
            }
            // log( 'QUICK --> j:', j, 'c:', c, 'jump:', lkb[ c ] || m + 1 );
            j += lkb[c] || m + 1;
        }
        // log( 'QS-->', result, arr );
        return arr;
    };
    return QuickParser;
} )();