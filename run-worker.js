"use strict";
var ProjectWorker = require("./src/ProjectWorker");

/**
 * Starts the worker process
 */

var startProjectManager = function() {
    "use strict";

    // set the project workers
    var p = new ProjectWorker();
    try {
        p.run();
    }catch(error ) {
        console.log(error);
    }


    console.log("aye");
};

startProjectManager();