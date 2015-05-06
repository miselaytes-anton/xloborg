# XLoBorg

node.js version of [XLoBorg](https://www.piborg.org/xloborg) python library

## Disclaimer

This is in no way an official XLoBorg library

## Usage
        
    var xloborg = require('xloborg');

    // prepare for use
    xloborg.init(function(err){
        if (err){
         console.error(err);
        }
        else {
            console.log('ready');
        }
    });

    // read accelometer
    xloborg.readAccelometer(function(err, result){
        if (err){
            console.error(err);
        }
        else {
            var accelerometer = {
                x: result[0],
                y: result[1],
                z: result[2]
            }
        }
    });

    // read compass
    xloborg.readCompass(function(err, result){
        if (err){
          console.error(err);
        }
        else {
             var compass = {
                x: result[0],
                y: result[1],
                z: result[2]
        }
    }
    });

    // read temperature
    xloborg.readTemperature(function(err, result){
        if (err){
            console.error(err);
        }
        else {
         var temperature = result;
        }
    });

# Test
node xloborg/test.js

should result in something similar to:

    {
        accelerometer: [0.078125, 0.00625, 1.734735],
        compass: [-381, -354, 1068],
        temperature: 25
    }
    //...more objects
