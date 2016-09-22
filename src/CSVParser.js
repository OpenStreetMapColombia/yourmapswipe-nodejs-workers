'use strict';

var parse = require("csv-parse");
var fs = require("fs");
var TaskCache = require('./TaskCache');
var Model = require('./Model');
var model = new Model();


class CSVParser {

    constructor() {
        this.taskCache = null;
        this.data = null;
    }

    /**
     * Run the parser on a given filePath.
     *
     * Currently, it always created groups of 3 in Y and 800 in X.
     * @param path                      The path of the CSV file to be imported
     * @param projectId                 The project id to run the importer for (The project is already created before you run the importer with a projectId)
     */

    run(path, projectId, importObj, nextFunc) {

        try {
            this.taskCache = new TaskCache();

            var skipLines = 1;
            var linesParsed = 0;
            console.log("Running importer on " + path + " for project id " + projectId);
            var inputFile = path;

            var csvData = [];
            var parent = this;
            console.log("reading:" + path);
            fs.createReadStream(path)
                .pipe(parse({delimiter: '$'}))
                .on('data', function (csvrow) {

                    if (linesParsed > skipLines) {


                        var tileX = csvrow[1];
                        var tileY = csvrow[2];
                        var tileZ = csvrow[3];

                        // start with z, then x, then y!
                        var tileId = tileZ + "-" + tileX + "-" + tileY;

                        parent.taskCache.pushTask(projectId, {
                            id: tileId,
                            url: csvrow[4],
                            taskX: tileX,
                            taskY: tileY,
                            taskZ: tileZ,
                            projectId: projectId,
                            wkt: csvrow[0]
                        });

                    }
                    linesParsed++;
                    if (linesParsed % 10000 === 0)
                        console.log("Lines parsed:" + linesParsed);
                    // push the task as it's being read
                })
                .on('end', function () {
                    console.log("Starting the sorting process....");
                    //do something wiht csvData
                    parent.taskCache.sortTasks(3, 80); // 1000 per group = 160 cards
                   /* fs.unlink(path, function () {
                        console.log("deleted csv");
                    });
                    fs.unlink(projectId + ".kml", function () {
                        console.log("deleted kml1");
                    });
                    fs.unlink(projectId + "_tiles.kml", function () {
                        console.log("deleted kml2");
                    });*/
                    console.log("setting project:" + projectId);
                    console.log(importObj);
                    model.setProject(importObj, projectId);
                    model.setImportComplete(importObj.importKey);
                    delete parent.taskCache;
                   nextFunc(projectId); // last project id to find the next


                });
        }catch(err) {
            console.log("we haz error");
            console.log(err);
        }


    }

}

module.exports=CSVParser;