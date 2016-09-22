'use strict';
var firebase = require('firebase');
firebase.initializeApp({
    serviceAccount: "./cfg/your-service-file.json",
    databaseURL: "https://YOUR-DOMAIN.firebaseio.com"
});


/**
 * The model is responsible for syncing the data from the cache with the remote database.
 */

class Model {

    getDatabase() {
        return this.db;
    }
    /**
     * Constructs the model class and initializes firebase properly
     */

    constructor() {
        this.groupsReported = {};
        this.batch = {};
        console.log("called initialiezr");

        this.db = firebase.database();
        this.imports = this.db.ref("imports");
        this.groups = this.db.ref("groups");
        this.projects = this.db.ref("projects");
        console.log("daffff");

    }

    getProjectsToImport(projectId) {
        var parent = this;
        return new Promise(function(resolve, reject) {
            {
                parent.imports.on('value', function(data) {
                    var projectsToImport = data.val();
                    resolve(projectsToImport)
                });
            }
        })
    }
    getProjects(projectId) {
        var parent = this;
        return new Promise(function(resolve, reject) {
            {
                parent.projects.on('value', function(data) {
                    var projects = data.val();
                    resolve(projects);
                });
            }
        })
    }

    setProjectGroupAverage(project, avg) {
        if(project !== undefined && project !== null) {
            this.projects.child(project + "").update({
                groupAverage: avg
            }).then(data => {
                console.log("group data updated in firebase");
            })
        } else {
            console.log("Project was null or undefined for some reason")
        }
    }
    setProject(project, newId) {
        if(project !== undefined && project !== null) {
            if (project.projectDescription !== undefined) {
                project["projectDetails"] = project.projectDescription;
            }
            project["contributors"] = 0;
            project["id"] = newId;
            project["progress"] = 0;
            this.projects.child(newId).update(project).then(data => {
                console.log("Project set in firebase");
            });
        }
    }

    setImportComplete(id) {
        if(id !== undefined && id !== null) {
            this.imports.child(id).update({
                complete: true
            }).then(data => {
                console.log("updated firebase with import details");

            })
        } else {
            console.log("Import id was null or undefined for some reason");
        }

    }

    /**
     * Sets or updates a task in the database
     *
     * @param task                  The task object
     */


    setOrUpdateTask(task) {
       // this.batch["/tasks/"+task.taskZ+"-"+task.taskX+"-"+task.taskY] = task;
    }

    /**
     * Sets or updates a group in firebase. Note that we store the group nested behind the project id because we do a LOT of querying based on the group, because we always want
     * to distribute the least distributed group or most inaccurately filled in group to end users. Since there is so much querying, it does not make sense to execute
     * those queries against a large dataset.
     *
     * @param group                 The group object
     * @param groupIndex            The index of the group in the project
     * @param ySize                 The size of the Y group (For example, 3 different Y values exist under eachother stating with yMin on ySize = 3)
     *                              This is useful in order to distribute different group sizes to different screen sizes.
     */
    setOrUpdateGroup(group, groupIndex, ySize) {
        this.groupsReported[groupIndex] = false;
        var parent = this;
        if(group.projectId !== undefined) {
            var groupRef = this.groups.child(group.projectId).child(groupIndex);
            if (groupRef !== undefined && groupRef !== null) {
                groupRef.set(group).then(data => {
                        console.log("group reported:" + groupIndex);
                        parent.groupsReported[groupIndex] = false;
                    }
                );
            } else {
                console.log("Group ref was null or undefined for some reason.");
            }
        } else {
            console.log("root group was undefined");
        }


    }
    resetCurrentGroups(project) {
        if(groupRef !== undefined && groupRef !== null) {
            var groupRef = this.groups.child(project);
            groupRef.set({});
        } else {
                console.log("Group ref was null or undefined for some reason.");
            }
    }

    startExitProcess(process) {
        var parent = this;
        setInterval(function() {
            var foundProcessingProject = false;
            Object.keys(parent.taskCache.groupsReported).forEach(isGroupReported => {
                if (parent.taskCache.groupsReported[isGroupReported] === false) {
                    console.log("Still waiting for project");
                    foundProcessingProject = true;
                }
            });
            if(foundProcessingProject === true) {
                console.log("found processing projects... waiting!")
            } else {
                console.log("exiting")
                process.exit();
            }
        }, 5000);
    };


}

module.exports=Model;