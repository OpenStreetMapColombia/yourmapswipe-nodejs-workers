'use strict';

var Worker = require('./Worker');


class ProjectWorker {

    constructor() {
        this.worker = null;
        this.data = null;
    }

    /**
     * Run the parser on a given filePath.
     *
     * Currently, it always created groups of 3 in Y and 800 in X.
     * @param path                      The path of the CSV file to be imported
     * @param projectId                 The project id to run the importer for (The project is already created before you run the importer with a projectId)
     */

    run() {
        this.worker = new Worker();
        this.worker.putResultsInDatabase();
        this.worker.run();
    }

}

module.exports=ProjectWorker;