var express = require('express');
var router = express.Router();

//connect to MongoDB
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'tsiMeteoDB';
const sonde_id = "010";
const sonde_name = "sonde YSH";

const typesCapteurs = ["press","temp","hygro","pluvio","lum","wind_mean","wind_dir"];

var meteoObject = {};

var fs = require('fs'); 

var GPS = require('gps');

var tphFile = JSON.parse(fs.readFileSync('/dev/shm/tph.log', 'utf8'));
var sensorsFile = JSON.parse(fs.readFileSync('/dev/shm/sensors', 'utf8'));
var gpsNmeaFile = fs.readFileSync('/dev/shm/gpsNmea', 'utf8');
//var rainCounterFile = fs.readFileSync('/dev/shm/rainCounter.log', 'utf8');

meteoObject.id = sonde_id;
meteoObject.name = sonde_name;
meteoObject.measurements = {};
meteoObject.measurements.date =  sensorsFile.date; 
meteoObject.measurements.temp = tphFile.temp; 
meteoObject.measurements.hygro = tphFile.hygro; 
meteoObject.measurements.press = tphFile.press; 
    
meteoObject.measurements.lum = sensorsFile.measure[3].value;
meteoObject.measurements.wind_dir = sensorsFile.measure[4].value;
meteoObject.measurements.wind_mean = sensorsFile.measure[5].value;
meteoObject.measurements.wind_min = sensorsFile.measure[6].value;
meteoObject.measurements.wind_max = sensorsFile.measure[7].value;

var gpsTrame = gpsNmeaFile.split('\n')[1];
var gps = new GPS;
gps.on('data', function(parsed) {
    meteoObject.location = {};
    meteoObject.location.lat = parsed.lat;
    meteoObject.location.lng = parsed.lon;
    meteoObject.location.date = parsed.time.toISOString();
    console.log(meteoObject.location);
});
gps.update(gpsTrame);

//pour le rainCoutenerFile, voir la nomenclature à respecter! 


//insert meteoObject.json  //Okay
MongoClient.connect(url, function(err, client) 
    {
        console.log("Connected successfully to server");
        var dbo = client.db(dbName);
        dbo.collection("meteoCollection").insertOne(meteoObject, function(err,res)
            {
                if (err) throw err;
                console.log("Number of documents inserted: " + res.insertedCount);    
            }
        )
    }
)



//show everything //Okay
router.get('/', function(req, res, next) {
    MongoClient.connect(url, function(err, client) {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        var dbo = client.db(dbName);
        //show collection (all)
        dbo.collection("meteoCollection").find()
        .toArray(function(err, result) {
        if (err) throw err;
        console.log(result);
        res.json(result);
        client.close();
        });
    });
  });


//show last //okay
router.get('/last', function(req, res, next) {
    MongoClient.connect(url, function(err, client) {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        var dbo = client.db(dbName);
        let capteur = req.query.capteur_type;
        if (capteur === "all")
        {
            //show collection (all)
            dbo.collection("meteoCollection").find({}, {fields:{_id:0}})
               .sort({"measurements.date": -1}).limit(1) //sort and limit 1 to get the latest
               .toArray(function(err, result) {
                    if (err) throw err;
                    console.log(result);
                    res.json(result);
                    client.close();
            });
        }
        else if (typesCapteurs.includes(capteur))
        {
            var myProjection = {_id:0, id:1, name:1, 'measurements.date': 1};
            myProjection['measurements.' + capteur] = 1;

            dbo.collection("meteoCollection").find({}, {fields: myProjection})
            .sort({"measurements.date": -1}).limit(1) //sort and limit 1 to get the latest
            .toArray(function(err, result) {
                if (err) throw err;
                console.log(result);
                res.json(result);
                client.close();
            });
        }
        else if (capteur === 'location')
        {
            var myProjection = {_id:0, id:1, name:1, location: 1};

            dbo.collection("meteoCollection").find({}, {fields: myProjection})
            .sort({"measurements.date": -1}).limit(1) //sort and limit 1 to get the latest
            .toArray(function(err, result) {
                if (err) throw err;
                console.log(result);
                res.json(result);
                client.close();
            });
        }
        else 
        {
            console.log("*********" + capteur + " est inexistant***********");
            res.json({});
            client.close();
        }
    });
  });


  router.get('/period', function(req, res, next) {
    MongoClient.connect(url, function(err, client) {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        var dbo = client.db(dbName);
        
        let capteur = req.query.capteur_type;

        let datedeb = new Date(Number(req.query.dateStart)*1000);
        let datefin = new Date(Number(req.query.dateEnd)*1000);
        
        if (capteur === "all")
        {
            let final_result = {};
            var myProjection = {_id:0, id:0, name:0};

            dbo.collection("meteoCollection").find({
                "measurements.date":
                {
                    "$gte": datedeb.toISOString(),
                    "$lt": datefin.toISOString()
                }
            },{fields: myProjection})
            .toArray(function(err, result) {
                if (err) throw err;
                console.log(result);
                final_result.id = sonde_id;
                final_result.name = sonde_name;
                final_result.data = result;
                res.json(final_result);
                client.close();
            });
        }
        else if (typesCapteurs.includes(capteur)){
            let final_result = {};
            var myProjection = {_id:0, 'measurements.date': 1};
            myProjection['measurements.' + capteur] = 1;

            dbo.collection("meteoCollection").find({
                "measurements.date":
                {
                    "$gte": datedeb.toISOString(),
                    "$lt": datefin.toISOString()
                }
            },{fields: myProjection})
            .toArray(function(err, result) {
                if (err) throw err;
                console.log(result);
                final_result.id = sonde_id;
                final_result.name = sonde_name;
                final_result.data = result;
                res.json(final_result);
                client.close();
            });
        }
        else if (capteur === 'location'){
            let final_result = {};
            var myProjection = {_id:0, 'location.lat': 1, 'location.lng': 1,'location.date':1};

            console.log(datedeb.toISOString())
            console.log(datefin.toISOString())

            dbo.collection("meteoCollection").find({
                "location.date":
                {
                    "$gte": datedeb.toISOString(),
                    "$lt": datefin.toISOString()
                }
            },{fields: myProjection})
            .toArray(function(err, result) {
                if (err) throw err;
                console.log(result);
                final_result.id = sonde_id;
                final_result.name = sonde_name;
                final_result.data = result;
                res.json(final_result);
                client.close();
            });
        }
        else
        {
            console.log("*********" + capteur + " est inexistant***********");
            client.close();
        }
    });
  });


module.exports = router; // à la fin
