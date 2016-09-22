/**
 * The model is responsible for syncing the data from the cache with the remote database.
 */

'use strict';
var firebase = require('firebase');
var fs = require('fs'),
    JSONStream = require('JSONStream'),
    es = require('event-stream');
firebase.initializeApp({
    serviceAccount: "./cfg/your-service-file.json",
    databaseURL: "https://YOUR-DOMAIN.firebaseio.com"
});

var mysql      = require('mysql');

var pool  = mysql.createPool({
    connectionLimit : 20,
    host     : 'YOUR-MYSQL-HOST',
    user     : 'YOUR-MYSQL-USER',
    password : 'YOUR-MYSQL-PASS',
    database : 'mapswipe'
});


var rest = require('restling');

class Worker {


    /**
     * Constructs the model class and initializes firebase properly
     */

    constructor() {
        this.firebase = firebase;

        this.runCount = 0;
        this.db = this.firebase.database();
        this.tasks = this.db.ref("tasks");
        this.groups = this.db.ref("groups");
        this.users = this.db.ref("users");
        this.projects = this.db.ref("projects");
        this.results = this.db.ref("results");
        this.busy = false;
        this.currentInterval = null;

        // test data before

        this.lastTotalClassified = 0;
        this.lastTotalContributionsByResults = 0;

    }

    /**
     * Proceses an individual project
     *
     * Please note that this ONLY sets the percentage of how much has been completed. It does NOT count the unique contributors to a project.
     * It does this by asking Firebase for ALL the groups and their completedCount, multiplying it by the time each times the group
     * needs to be completed according to the project configurations, and seeing how many are completed.
     * @param project
     */
    processProject(project) {

        var parent = this;
        var tasks = 0;
        var totalGroups = 0;
        var completedCount = 0;

        pool.query('INSERT INTO `projects` SET ?', {
            project_id: project.id,
            objective: project.lookFor,
            name: project.name
        }, function(err, result) {
            try {
                if(err) throw err
            }catch(err2) {
                console.log(err2)
            }

        });

        pool.query('select count(distinct(user_id)) as contributors from results where project_id = '+project.id+'', function (err, result) {
            try {
                if (err) throw err
                // remove the firebase entry if the query didn't have any errors
                parent.projects.child(project.id + "").update({
                    contributors: result[0].contributors
                }).then(data => {
                    console.log("set " + result[0].contributors + " for proejct id:" + project);
                });

            } catch (err2) {
                console.log(err2)
            }

        });
        pool.query('select results.task_id as id, results.user_id, results.project_id as project, results.timestamp, results.task_x, results.task_y, results.task_z,'+
        '(select avg(result) from results where task_id = id and project_id = project) as decision,'+
        '(select count(1) from results where task_id = id and project_id = project and result = 1) as yes_count,'+
        '(select count(1) from results where task_id = id and project_id = project and result = 2) as maybe_count,'+
        ' (select count(1) from results where task_id = id and project_id = project and result = 3) as bad_imagery_count'+
        ' from results where project_id = '+project.id+' and result > 0 group by task_id', function (err, result) {
            try {
                if (err) throw err

                fs.unlink("/var/www/html/projects/"+project.id+".json", function () {
                    fs.appendFile("/var/www/html/projects/"+project.id+".json", JSON.stringify(result), (err) => {

                        console.log("users written to file!");
                    });
                });

            } catch (err2) {
                console.log(err2)
            }

        });

        /**
         * Local function to process the results from a request, who then invokes the next project to be processed.
         */
        var processResults = function () {
            if (totalGroups == 0) {
                console.log("total groups was 0 so nexting");
                parent.nextProject();
                return;
            }
            var requiredIterations = totalGroups * 3; // show each group to 3 ppl
            var percentageComplete = (completedCount / requiredIterations) * 100;
            if (percentageComplete > 0 && !isNaN(percentageComplete && !isNaN(Math.ceil(percentageComplete)))) {
                console.log("setting complete count for project id " + project.id + " to " + percentageComplete)
                parent.db.ref("projects/"+project.id).update({
                    progress: Math.ceil(percentageComplete)
                }).then(data => {
                    console.log("Set project complete count");
                })
                if(Math.ceil(percentageComplete) > 100) {
                    parent.db.ref("projects/"+project.id).update({
                        state: 2
                    }).then(data => {
                        console.log("Set project complete count");
                    })
                }
            } else {
                console.log("moving out without setting it");
            }
            parent.nextProject();
        }

        console.log("Processing project id:" + project.id);


        rest.get("https://msf-mapswipe.firebaseio.com/groups/" + project.id + ".json?shallow=true").then(function (result) {
            if(result === null || result === undefined || result.data === null || result.data === undefined) {
                parent.nextProject();
                return;
            }
            var keys = Object.keys(result.data);
            totalGroups = keys.length;
            completedCount = 0;

            var requestPoolObj = {};
            var deletionPoolObj = {};

            keys.forEach(function (k) {

                requestPoolObj["req-" + project.id + "-" + k] = {
                    url: "https://msf-mapswipe.firebaseio.com/groups/" + project.id + "/" + k + "/completedCount.json?shallow=true",
                    options: {timeout: 1000000}
                };

                deletionPoolObj["req-" + project.id + "-" + k] = {
                    url: "https://msf-mapswipe.firebaseio.com/groups/" + project.id + "/" + k + "/count.json?shallow=true",
                    options: {timeout: 1000000}
                };

            });

            rest.settleAsync(deletionPoolObj).then(function (groupResult) {

                // handle result here
                // result is {google: responseFromGoogle, api: responseFromApi}
                var grRes = Object.keys(groupResult);
                grRes.forEach(key => {
                    var nextResult = groupResult[key].data;
                    if (nextResult !== undefined) {
                        if(parseInt(nextResult) < 6) {
                            var grpKey = key.split("-")[2];

                            // ensure that we're not deleting the whole project....
                            if(grpKey !== undefined && grpKey !== null && parseInt(grpKey) > 0) {

                                parent.db.ref("groups/" + project.id + "/" + grpKey).once('value', function(snapshot) {
                                    fs.appendFile("/var/www/html/removedTasks.json", JSON.stringify(snapshot.val()), (err) => {
                                        console.log("removed group written to file!");
                                        parent.db.ref("groups/" + project.id + "/" + grpKey).remove();
                                    });

                                })
                                console.log("We have to delete " + project.id + " key " + grpKey);
                            }
                        }
                    }

                });

            }, function (err) {
            console.log(err);
            });

            rest.settleAsync(requestPoolObj).then(function (groupResult) {

                // handle result here
                // result is {google: responseFromGoogle, api: responseFromApi}
                var grRes = Object.keys(groupResult);
                grRes.forEach(key => {
                    var nextResult = groupResult[key].data;
                    if (nextResult !== undefined) {
                        if(parseInt(nextResult) > 3) {
                            nextResult = 3; // max of 3 per group
                        }
                        completedCount += parseInt(nextResult);
                    }

                });
                console.log("Added " + grRes.length + " to project id " + project.id)
                processResults();
            }, function (err) {
                processResults(err);
            });
        }, function (error) {
            console.log(error.message);
            processResults();
        });
    }

    nextProject() {
        var parent = this;
        console.log("next project called");
        var processing = null;
        if (this.lastProcessIndex === null) {

            // we're dealing with a first project, find the first key
            this.lastProcessIndex = 0;
        } else {
            if (this.processAmount === 0) {
                console.log("We're done processing projects, lets go again!");
                    parent.run()
                return;
            } else {
                console.log("lastProcessIndex is " + this.lastProcessIndex + " so we're cool to keep going and stuff");
                console.log("projects to process:" + this.processAmount);
            }
            this.lastProcessIndex = this.lastProcessIndex + 1;
        }

        processing = this.projectsToProcess[this.lastProcessIndex];
        this.processAmount--;
        this.processProject(processing);
    }


    /**
     * Gets all the results from firebase and inserts them into the database on startup, then starts listening for updates from firebase as new objects are added
     * in real-time. As data grows, the firebse child_added function becomes weaker. On startup of this program, a wget downloaded results.json from firebase over HTTP
     * so that we can insert it on startup, and only have to listen for a small dataset.
     */

    putResultsInDatabase(){


        var queryCount = 0;

        var parent = this;
        var getStream = function () {
            var jsonData = 'results.json',
                stream = fs.createReadStream(jsonData, {encoding: 'utf8'}),
                parser = JSONStream.parse('*');
            return stream.pipe(parser);
        };

        getStream()
            .pipe(es.mapSync(function (result) {
                if(result === undefined || result === null) {
                    return;
                }
                try {
                    Object.keys(result).forEach(key => {
                        queryCount++;
                        var res = result[key].data;
                       // console.log(res.id);

                        var query = {
                            task_id: res.id,
                            user_id: res.user,
                            project_id: res.projectId,
                            timestamp: res.timestamp,
                            wkt: res.wkt,
                            result: res.result,
                            task_z:res.id.split('-')[0],
                            task_x:res.id.split('-')[1],
                            task_y:res.id.split('-')[2]

                        };
                        console.log("Inserting task id " + res.id + " into db");

                        pool.query('INSERT INTO `results` SET ? ON DUPLICATE KEY UPDATE duplicates=duplicates+1', query, function(err, result) {
                            try {
                                if(err) throw err
                                // remove the firebase entry if the query didn't have any errors
                                parent.db.ref("results/"+res.id+"/"+res.user).remove();
                                console.log("Finished inserting task id " + res.id + " into db");
                                }catch(err2) {
                                console.log(err2)
                            }
                            queryCount--;
                            if(queryCount === 0) {
                                parent.listenForResults();
                            }
                        });
                    })
                } catch(err) {
                    console.log(err);
                }
            }));

    }
    listenForResults(){




        var parent = this;

        this.db.ref("results").on('child_added', function (snapshot) {
            //  console.log("Got value from results projects")

            var result = snapshot.val();
            Object.keys(result).forEach(key => {

                var res = result[key].data;
                // console.log(res.id);

                var query = {
                    task_id: res.id,
                    user_id: res.user,
                    project_id: res.projectId,
                    timestamp: res.timestamp,
                    wkt: res.wkt,
                    result: res.result,
                    task_z: res.id.split('-')[0],
                    task_x: res.id.split('-')[1],
                    task_y: res.id.split('-')[2]

                };
                try {
                    pool.query('INSERT INTO `results` SET ? ON DUPLICATE KEY UPDATE duplicates=duplicates+1', query, function (err, result) {
                        try {
                            if (err) throw err
                            // remove the firebase entry if the query didn't have any errors
                            parent.db.ref("results/" + res.id + "/" + res.user).remove();

                        } catch (err2) {
                            console.log(err2)
                        }

                    });
                } catch (err) {
                    console.log(err);
                }
            })
        });



    }
    /**
     * Runs this worker, which gets the projects from firebase, then launches the first one.
     */
    run() {
        this.contributorsPerProject = {};
        this.processAmount = 0;
        this.projectsToProcess = [];
        this.lastProcessIndex = null;


        var parent = this;


        var tasks = 0;


        // subscribe to project values, changes the interval on each event
        //var uid = "some-uid";
        /*var customToken = firebase.auth().createCustomToken(uid);
         console.log(customToken);*/

        this.projects.once('value', function (snapshot) {
            console.log("Got value from fb projects")
            var projects = snapshot.val();
            Object.keys(projects).forEach(function (projectKey) {
                projects[projectKey].results = "http://api.mapswipe.org/projects/"+projectKey+".json"
                parent.projectsToProcess.push(projects[projectKey]);
                parent.processAmount++;
            });
            fs.unlink("/var/www/html/projects.json", function () {
                fs.appendFile("/var/www/html/projects.json", JSON.stringify(projects), (err) => {

                    console.log("users written to file!");
                });
            });
            parent.nextProject();
        });



        // re-run stats and users once every 50 times.
        if(this.runCount%50===0) {

            var contributors = 0;
            this.users.once('value', function (snapshot) {
                console.log("Got value from fb users")
                var data = snapshot.val();


                fs.unlink("/var/www/html/users.json", function () {
                    fs.appendFile("/var/www/html/users.json", JSON.stringify(data), (err) => {

                        console.log("users written to file!");
                    });
                });

                var stats = {
                    users: Object.keys(data).length,
                    totalDistanceMappedInSqKm: 0,
                    totalContributionsByUsers: 0,
                };


                Object.keys(data).forEach(function (userKey) {
                    var user = data[userKey];
                    stats.totalDistanceMappedInSqKm += user.distance;
                    stats.totalContributionsByUsers += user.contributions;
                });

                fs.unlink("/var/www/html/stats.json", function () {
                    fs.appendFile("/var/www/html/stats.json", JSON.stringify(stats), (err) => {
                        if (err) throw err
                        console.log("stats written to file");
                    });
                });


            });
        }
        this.runCount++;

    }

}

module.exports = Worker;