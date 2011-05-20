
//based on ExtCore createDelegate

Function.prototype.createDelegate = function(obj, args, appendArgs){
    var method = this;
    return function() {
        var callArgs = args || arguments;
        if (appendArgs === true){
            callArgs = Array.prototype.slice.call(arguments, 0);
            callArgs = callArgs.concat(args);
        }else if ( typeof appendArgs === 'number'){
            callArgs = Array.prototype.slice.call(arguments, 0); // copy arguments first
            var applyArgs = [appendArgs, 0].concat(args); // create method call params
            Array.prototype.splice.apply(callArgs, applyArgs); // splice them in
        }
        return method.apply(obj || this, callArgs);
    };
};


apply = function( obj, config, force ){
    if( obj && config && typeof config == 'object' ){
        for( var param in config ){
            if( ( typeof obj[ param ] !== 'undefined' ) || ( force ) ){ // apply only if property already exists in constructor or force    
                obj [param ] = config[ param ];
            }
        }
    }
    return obj;
};

emptyFn = function(){};
dummyFn = function(){ return ( function(){ return this[0]; } ).bind( arguments ); };

