/**
 * The model is responsible for syncing the data from the cache with the remote database.
 */

'use strict';
var firebase = require('firebase');
var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
var fs = require('fs'),
    JSONStream = require('JSONStream'),
    es = require('event-stream');

firebase.initializeApp({
    serviceAccount: "./cfg/your-service-file.json",
    databaseURL: "https://YOUR-DOMAIN.firebaseio.com"
});

var mysql      = require('mysql');

var pool  = mysql.createPool({
    connectionLimit : 100,
    host     : 'YOUR-MYSQL-DATABASE-IP',
    user     : 'YOUR-MYSQL-DATABASE-USER',
    password : 'YOUR-MYSQL-DATABASE-PASS',
    database : 'YOUR-MYSQL-DATABASE'
});


class Api {

    run() {

        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());

        var port = process.env.PORT || 8080;        // set our port

        var router = express.Router();              // get an instance of the express Router

        router.get('/', function(req, res) {
            res.json({ message: 'Welcome to the Mapswipe API' });
        });
        router.get('/results', function(req, res) {
            pool.query('select * project_id = '+project.id+'', function (err, result) {
                try {
                    if (err) throw err
                    // remove the firebase entry if the query didn't have any errors
                    parent.projects.child(project.id + "").update({
                        contributors: result[0].contributors
                    }).then(data => {
                        console.log("set " + result[0].contributors + " for project id:" + project);
                    });

                } catch (err2) {
                    console.log(err2)
                }

            });
            res.json({ message: 'Welcome to the Mapswipe API' });
        });





        app.listen(port);
        console.log('Magic happens on port ' + port);

    }

}

module.exports = Worker;