
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

