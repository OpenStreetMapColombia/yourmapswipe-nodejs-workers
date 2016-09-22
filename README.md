# nodejs-yourmapswipe-workers
This repo contains 2 applications: The first one are the workers, the second one is the Mapswipe importer. Both run periodically.

#Add the following to your rc.local file on linux to make it auto start if your server restarts:

```shell
cd PATH_YOU_PUT_THIS
sh run-importer.sh || /bin/true
sh run-worker.sh || /bin/true
```

#Requirements:
- Make sure you have a firebase project and you have the sample data imported:
- Make sure you have a MySQL database with the following tables:
```sql
CREATE TABLE `projects` (
   `project_id` int(11) NOT NULL,
   `objective` varchar(20) DEFAULT NULL,
   `name` varchar(45) DEFAULT NULL,
   PRIMARY KEY (`project_id`)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8;


 CREATE TABLE `results` (
   `task_id` varchar(45) NOT NULL,
   `user_id` varchar(45) NOT NULL,
   `project_id` int(5) NOT NULL,
   `timestamp` bigint(32) NOT NULL,
   `result` int(1) NOT NULL,
   `wkt` varchar(256) DEFAULT NULL,
   `task_x` varchar(45) NOT NULL,
   `task_y` varchar(45) NOT NULL,
   `task_z` varchar(45) NOT NULL,
   `duplicates` int(5) DEFAULT '0',
   PRIMARY KEY (`task_id`,`user_id`,`project_id`)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8;



```

###Install:
- Make sure you have the Node.js installed
- Set up an nginx server and place the root on /var/www/html, create that directory if it doesn't exist yet, and make it writable for the user that will run this application. This is where your API will become available.
- Follow the steps here: https://firebase.google.com/docs/server/setup
- Add the new service account .json file in cfg/your-service-file.json. Do a search in the project for your-service-file.json and replace the name if you want to use the original file name.
- Do a search in the project for YOUR-DOMAIN and replace all the occurances with your firebase domain. It's very important that you get ALL of them.
- Do a search in the project for YOUR-MYSQL and replace all the occurances with your database credentials
- In api_key.txt place your bing API key
- Run it with the following commands:

```shell
sh run-importer.sh (to run the importer)
sh run-worker.sh (to run the worker)
```

API Documentation for generated files in /var/www/html available on: https://docs.google.com/document/d/1RwN4BNhgMT5Nj9EWYRBWxIZck5iaawg9i_5FdAAderw/edit#heading=h.wp1a8ue6nwhv

- If you want to allocate less memory (because you have smaller tasks) you can edit the --max-old-space-size=SIZE_IN_MB_YOU_NEED values

