"use strict";
var parse = require('csv-parse');
var CSVParser = require("./src/CSVParser");
const fs = require('fs');

var fileToParse = null;
var projectId = null;
var Model = require('./src/Model');

var PythonShell = require('python-shell');
var rest = require('restling');
var model = new Model();

/**
 * Starts the import process for Mapswipe.

 * 1) Get the import data from firebase
 * 2) runs the python shell on each project
 * 3) run the csv parser on each
 * 4) Geogrouping places it in Firebase
 *
 */

var importProjects = {};



/**
 * Gets the projects to import from firebase, runs some security checks, and processes them.
 */

// keeps track of the amount of python threads active so that we can launch the CSV importer after all is done.
var pythonCount = 0;
var startImport = function() {
    var highestProjectId = 0;

    "use strict";

    importProjects = {};
    pythonCount = 0;


    // set the highest project id
    rest.get('https://YOUR-DOMAIN.firebaseio.com/projects.json?shallow=true').then(function(result){
        Object.keys(result).forEach(key => {
           if(parseInt(key) > highestProjectId) {
               highestProjectId = parseInt(key);
               console.log("Highest id set to:" + key);
           }
        });

    }, function(error){
        console.log(error.message);
    });




    // runs the import
    model.getProjects().then(data => {
        try {
            var projectNameFilter = {};


            // ensure that no data is overwritten 1 more time
            Object.keys(data).forEach(function (proj) {
                if (parseInt(data[proj].id) > highestProjectId) {
                    highestProjectId = parseInt(data[proj].id);
                }
                projectNameFilter[data[proj].name] = true;
                //projectNameFilter.push(proj.name);
                console.log(projectNameFilter);
            });
        }catch(err){
            console.log(err);
        }


        // get all the projects to import
        model.getProjectsToImport().then(data2 => {

            // iterate over all the keys in the importer, add the ones to the import cache that are not yet complete
            console.log("Importing:" + Object.keys(data2).length);
            Object.keys(data2).forEach(function(proj) {
                if(data2[proj].complete === true) {
                    console.log("was complete, not doing" + proj);
                    return;
                }
                if(projectNameFilter[data2[proj].project.name] !== undefined) {
                    console.log("already found this project, not importing it" + proj);
                    return;
                }
                // assign the ID
                data2[proj].project.importKey = proj;
                importProjects[highestProjectId+100+Math.floor((Math.random() * 100) + 1)] = data2[proj]; // to avoid collisions, we add 100 and a random of 100 per project
            });

            // iterate over the import cache, fire off import events for each
            Object.keys(importProjects).forEach(key => {
                startProjectImport(key, importProjects[key]);
            })


        });
    }).catch(error => {
        console.log("error");
        console.log(error);
    });
};


/**
 * Process the python file and start an import project on a separate thread
 * @param newProjId
 * @param importObject
 */


// amount of python tasks finished

var startProjectImport = function(newProjId, importObject) {
    pythonCount++;
    console.log("starting import for project " + newProjId);

    fs.unlink(newProjId+".csv", function(error) {
        console.log('removed csv '+newProjId+'!');
    });
    fs.unlink(newProjId+".json", function(error) {
        console.log('removed csv '+newProjId+'!');
    });
    fs.unlink(newProjId+".kml", function(error) {
        fs.appendFile(newProjId+".kml", importObject.kml, (err) => {
            if (err) throw err;
            pythonCount--;
            if(pythonCount === 0) {
                startCSVImports();
            }
            console.log('The "data to append" was appended to file '+newProjId+'!');

        });
    })

}

var startCSVImports = function(offset) {

    // get


    var firstObject = null;
    Object.keys(importProjects).forEach(key => {
        if(firstObject === null) {
            firstObject = key;
            return;
        }
    })

    // starts the first csv import, needs to spawn the next
    var options = {
        args: [firstObject+".kml", 18]
    };

    console.log("Starting import with python for project:" + firstObject);

    PythonShell.run('create_csv.py', options, function (err2, results) {
        if (err2) console.log(err2.message);
        console.log('results: %j', results);
        startCSVImport(firstObject, importProjects[firstObject].project);
    });

}
var startNextImport = function(last) {

    // get


    var lastFound = false;
    var next = null;
    Object.keys(importProjects).forEach(key => {
        if(lastFound === true) {
            if(next === null) {
                next = key;
            }
        }
        if(key === last) {
            lastFound = true;
        }
    })

    if(lastFound === true && next === null) {
        // we receachd the end
        console.log("the end");
        return;
    }

    var options = {
        args: [next+".kml", 18]
    };


    console.log("Starting import with python for project:" + next);
    PythonShell.run('create_csv.py', options, function (err2, results) {
        if (err2) console.log(err2.message);
        console.log('results: %j', results);
        startCSVImport(next, importProjects[next].project);
    });

    // starts the first csv import, needs to spawn the next
}



var startCSVImport = function(projectId, project) {
    "use strict";
    try {
        var csvp = new CSVParser();

        console.log("Running for project id: " + projectId);
        console.log("Project is:");
        console.log(project);
        csvp.run(projectId + "_tiles.csv", projectId, project, startNextImport);
    }catch(err) {
        console.log("ah");
        console.log(err);
    }

};

startImport()
setTimeout(function() {
    startImport()
}, 3600000); // run every 1 hour