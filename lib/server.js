/**
 * Main server.
 * Handles a very simple kind of dependency injection, to be refactored to some service
 * registry ting. 
 * 
 */
 
    var mod_connect         = require('connect')
    , mod_sys               = require('sys')
    , mod_path              = require('path')
    , mod_resourceservice   = null
    , mod_resourcemanager   = null
    , mod_tagmanager        = require('./tagmanager.js')
    , mod_cache             = require('./cache.js')
    , mod_socketio          = require('./socketio.js')   
    , mod_modules           = null
    , mod_fs                = require('fs')
    , cache                 = null
    , redisclient           = null
    , logger                = require('./logger.js').getLogger('Server')

if (process.argv.length < 3) {
    logger.error('usage: server <configfile>');
    process.exit();
}

// [TBD] handle arguments properly
// [TBD] dynamic config service 
var config = null;
logger.info('reading config from ' + process.argv[2]); 
mod_fs.readFile(process.argv[2], function (err, data) {
    if (err) {
        logger.error('error reading configuration');
        process.exit();
    }
    config = JSON.parse(data);
    logger.info('config loaded');
    mod_cache.configure(config);
    mod_resourcemanager = require('./resourcemanager.js')(config, mod_cache);
    mod_resourceservice = require('./resourceservice.js')(config, mod_resourcemanager, mod_cache);
    mod_tagmanager.setTagList(config.taglib);
    mod_modules = require('./modules.js')(mod_tagmanager, mod_resourcemanager);

    if (config.remoteControl) {
        redisclient = require('./redisclient.js');
        redisclient.init(mod_tagmanager);
    }

    createServer(config);
});

function createServer(config) {
    var server = mod_connect.createServer(
        mod_connect.favicon()
        , mod_connect.router(function (app) {
                app.get(/^\/modules\/([^\.]*)\/(.*\.js)$/,          mod_modules.handleScriptRequest);
                app.get(/^\/modules\/([^\.]*)\/(.*\.html)$/,        mod_modules.handleViewRequest);            
                app.get(/^\/modules\/([^\.]*)\/controller\/(.*)$/,  mod_modules.handleControllerRequest);
                app.get(/^\/resources(.*)$/,                        mod_resourceservice.handleRequest);
                //app.get(/instances\/(.*)/,                          mod_instances.handleInstanceRequest);
            }
        )
        , mod_connect.static(config.server.documentRoot)        
        , mod_connect.logger()            
    );
    
    //var io = require('socket.io').listen(server);
    //mod_socketio.init(io);
    server.listen(config.server.port);
}

// process.on('SIGINT', function () {
//  process.exit();
// });