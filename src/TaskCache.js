/**
 * @author Pim de Witte (pimdewitte.me/pimdewitte95@gmail.com). Copyright MSF UK 2016.
 *
 * TaskCache handles the local indexing and sorting of all the tasks in the cache.
 * 1) Tasks are loaded from the inputted CSV file and a new project ID is generated
 * 2) Tasks are then added to the local task cache
 * 3) After syncing and fully loading all the tasks, all tasks are grouped using the GeoGrouping algorithm.
 * 4) The groups and tasks are synced with Firebase, who will make the API available to the public.
 *
 */
'use strict';

var Model = require('./Model');
var model = new Model();


class TaskCache {

    constructor(projectObject) {
    }


    /**
     * Add the task to the task cache without sorting it
     * E.g.
     *                                tasks:  {>> pushTask pushes here by tile x and tile y index <<}
     *  taskCache ->   project 1 ->
     *                                also sets xMin, xMax, yMin, yMax for project
     * @param projectId
     * @param task
     */

     pushTask(projectId, task) {
        if(this.taskCache === undefined){

            // INITIALIZE THE TASK CACHE
            this.taskCache = {};
        }
            if(task === undefined ||task.taskX === undefined || task.taskY === undefined) {
                console.log("Task " + task.id + " was missing x and y coordinates");
                return;
            }

            // if the project id was not yet found in the local cache,
            if(!(projectId in this.taskCache)) {
                this.taskCache[projectId] = {
                    lastDistributedGroup: 0, // the last group that was distributed to end users
                    groupCount: 0,
                    tasks: {},
                    groups: {},

                    zoomLevel: task.taskZ,

                    xMin: task.taskX, // the min and max coordinates are overwritten during the loop that places them in the task cache
                    xMax: task.taskX,
                    yMin: task.taskY,
                    yMax: task.taskY, // ensure that the first loaded tile is ALWAYS the x0y0 coordinate on the grid. Otherwise it messes up groups.
                };
            }

            // Set the minimum and maximum boundaries for the group
            if(task.taskX > this.taskCache[projectId].xMax) {
                this.taskCache[projectId].xMax = task.taskX;
            }

            if(task.taskY > this.taskCache[projectId].yMax) {
                this.taskCache[projectId].yMax = task.taskY;
            }

            if(task.taskX < this.taskCache[projectId].xMin) {
                this.taskCache[projectId].xMin = task.taskX;
            }

            if(task.taskY < this.taskCache[projectId].yMin) {
                this.taskCache[projectId].yMin = task.taskY;
            }




            // since we want to minimize network traffic and cache size, we only store information that is vital for the grouping.
            // the task is reported to Firebase here, where the rest is stored.

            this.taskCache[projectId].tasks[task.taskZ+"-"+task.taskX+"-"+task.taskY] = task; // index task by y and y coordinate
            //console.log("Pushed task with task id" + this.taskCache[projectId].tasks[task.taskZ+"-"+task.taskX+"-"+task.taskY].id);




            // we assign a key in the database based on the zoom level, x, and y of the tile, so that we never have
            // overlapping tiles, and we can update tiles on the fly if we get reports for bad imagery, regardless of the group.

            model.setOrUpdateTask(task);
    };

    /**
     * Sorts the tasks in the cache into the correct project group based on the project.
     * We sort it by group_x_size and group_y_size so that clients can download chunks of tasks
     * without having to sort during the requests. This way, we can keep track of groups and decide which groups
     * need to be re-distributed to end users, etc.
     *
     *
     * It works like th
     *
     * is with x group size 10 and y group size 3
     * The (x) means no tile was found at that location (This happens when the project we get is not for a rectangular area).
     *
     *
     * yLoop1+-> [(xMin,yMin),x,x,x,x,x,x,x,x,x,x,x,g1,g1,g1,g1,g1,g1,g1,g1,g2,g2,g2,g2,g2,g2,g2,g2,x,x,x,x,x,x,x,x]
     * yLoop1-> [x,x,x,x,x,x,x,x,x,x,x,g1,g1,g1,g1,g1,g1,g1,g1,g1,g2,g2,g2,g2,g2,g2,g2,g2,x,x,x,x,x,x,x,x,x]
     * yLoop1-> [x,x,x,x,x,x,x,x,x,x,x,g1,g1,g1,g1,g1,g1,g1,g1,g1,g2,g2,g2,g2,g2,g2,g2,g2,x,x,x,x,x,x,x,x,x]
     * yLoop2-> [x,x,x,x,x,x,x,x,x,x,x,g3,g3,g3,g3,g3,g3,g3,g3,g3,g4,g4,g4,g4,g4,g4,g4,g4,x,x,x,x,x,x,x,x,x]
     * yLoop2-> [x,x,x,x,x,x,x,x,x,x,x,x,g3,g3,g3,g3,g3,g3,g3,g3,g4,g4,g4,g4,g4,g4,g4,g4,x,x,x,x,x,x,x,x,x]
     * yLoop2-> [x,x,x,x,x,x,x,x,x,x,x,x,x,g3,g3,g3,g3,g3,g3,g3,g4,g4,g4,g4,g4,g4,g4,g4,x,x,x,x,x,x,x,x,)yMax,xMax)]
     *
     * As a result, the client will always rectangular, adjacant tiles in a group.
     *
     * The client will then generate the cards on it's own by starting at xMin and yMin, and grabbing the right amount of tiles
     * under the xMin+offset index.
     */

    sortTasks(groupYSize, groupXSize) {


            var currentGroup;
            for(var project in this.taskCache) {
                model.resetCurrentGroups(project);
                var averageGroupSizeArray = [];
                currentGroup = 100;

                var xMin = parseFloat(this.taskCache[project].xMin);
                var xMax = parseFloat(this.taskCache[project].xMax);
                var yMin = parseFloat(this.taskCache[project].yMin);
                var yMax = parseFloat(this.taskCache[project].yMax);

                var zoomLevel = parseFloat(this.taskCache[project].zoomLevel);



                var group = null;

                var counter = 0;

                // Based on the project's yMin and yMax, for each Y group, we iterate over each one and then enter into the X function instantly
                for(var y = parseFloat(Object.assign(yMax)); y >= yMin; y-=groupYSize) {

                    // for each X group (with the interval of the X group size), we calculate all the Y groups and increase by the X group size
                    for(var x = parseFloat(Object.assign(xMin)); x <= xMax; x+=groupXSize) {

                        // Write the previous group

                        if(group != null && group.count > 0) {
                            averageGroupSizeArray.push(group.count);
                            model.setOrUpdateGroup(group, currentGroup);
                            process.stdout.write("\nAbove this you see group " + currentGroup + " with "+group.count+" indicies \n");

                        } else if(group !== null && group.count === 0) {
                          //  console.log("Group count for "+group.id+" was 0");
                        }
                        // Jump to a new group

                        currentGroup++; // increase the group count for every new area of times
                        group = {
                            id: currentGroup,
                            count: 0,
                            tasks: {}, // holds the tasks based on their coordinates
                            distributedCount: 0, // holds the last time this group was distributed to end users
                            completedCount: 0, // the amount of times this group was completed by an end user
                            reportCount: 0, // the amount of reports we have received back in this group (generally, we will distribute groups with the lowest reportCount to more poeple to avoid false negatives.
                            xMin: null,
                            xMax: null,
                            yMin: null,
                            yMax: null,
                            zoomLevel: zoomLevel,
                            projectId: project
                        };


                        // y is 12744
                        // groupSize = 3
                        // rows being indexed = 12744 to 12744 - 3 = 12741, 12744 is true, 12743 is true, 12742 is true,
                        // since the tiles are ordered by Y in the dataset, we will adhere to that in how we order them here .
                        for(var tileY = parseFloat(Object.assign(y)); tileY > y-groupYSize && tileY >= yMin; tileY--) {
                            //process.stdout.write("\n");
                            // now we've reached the action loop. In this loop we assign the found tile to the group it belongs.
                            for(var tileX = parseFloat(Object.assign(x)); tileX <= x+groupXSize && tileX <= xMax;  tileX++) {



                                var key = zoomLevel+"-"+tileX+"-"+tileY;


                                if(key in this.taskCache[project].tasks) {
                                    group.tasks[key] = this.taskCache[project].tasks[key];

                                    // Set the group boundaries so we can easily search them and show somebody where they are mapping if necessary.
                                    // It also is the base for the client-sided algorithm to render the cards effectively, so do not remove this, ever!

                                    var task = group.tasks[key];

                                    if(group.xMax === null || task.taskX > group.xMax) {
                                        group.xMax = task.taskX;
                                    }

                                    if(group.yMax === null || task.taskY > group.yMax) {
                                        group.yMax = task.taskY;
                                    }

                                    if(group.xMin === null || task.taskX < group.xMin) {
                                        group.xMin = task.taskX;
                                    }

                                    if(group.yMin === null || task.taskY < group.yMin) {
                                        group.yMin = task.taskY;
                                    }
                                    group.count = group.count + 1;
                                    counter++;
                                    //process.stdout.write("o");
                                } else {
                                   // process.stdout.write(".");
                                }
                            }

                        }


                    }

                }

            }

        var sum = 0;
        for( var i = 0; i < averageGroupSizeArray.length; i++ ){
            sum += parseInt( averageGroupSizeArray[i]);
        }

        var avg = sum/averageGroupSizeArray.length;
        model.setProjectGroupAverage(project, avg);
        console.log("Average group size for project" + project + " is " + avg);

        };
}
module.exports=TaskCache;
