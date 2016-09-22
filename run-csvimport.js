"use strict";
var CSVParser = require("./src/CSVParser");
const fs = require('fs');

/**
 * Starts the worker process
 */

var startCSVImport = function() {
    "use strict";
    try {
        var csvp = new CSVParser();

        var file;
        var projectId;
        process.argv.forEach(function (val, index, array) {
            console.log(index+":"+val);
            if (index === 2) {
                projectId = val;
            }
        });
        console.log("Running for project id: " + projectId);

        var project;
        fs.readFile(projectId + ".json", function read(err, data) {
            if (err) {
                throw err;
            }
            project = JSON.parse(data);

            console.log("Project is:");
            console.log(project);
            csvp.run(projectId + "_tiles.csv", projectId, project, process);
            // Invoke the next step here however you l

        });
    }catch(err) {
        console.log("ah");
        console.log(err);
    }

};

startCSVImport();