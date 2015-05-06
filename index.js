'use strict';

var _ = require('lodash'),
    async = require('async'),
    i2c = require('i2c-bus'),
    jspack = require('jspack').jspack;

// settings
var addressAccelerometer = 0x1C,
    addressCompass = 0x0E,
    gPerCount = 2.0 / 128, // Number of G represented by the LSB of the accelerometer at the current sensitivity
    busNumber = 1, // Check here for Rev 1 vs Rev 2 and select the correct bus
    tempOffset = 0; // is added to read temperature

var bus; // global

/*
 Prepare the I2C driver for talking to the XLoBorg
 */
function init(callback){
    console.log('Loading XLoBorg on bus ', busNumber);

    async.series([
        function(callback){
            // open the bus
            bus = i2c.open(busNumber, callback);
        },
        function(callback){
            // Check for accelerometer
            bus.readByte(addressAccelerometer, 1, function(err, res) {
                if (err){
                    console.log('Missing accelerometer at 0x1C');
                    callback(err);
                }
                else {
                    console.log('Found accelerometer at 0x1C');
                    initAccelometer(callback);
                }
            });
        },
        function(callback){
            // Check for compass

            bus.readByte(addressCompass,1, function(err, res) {
                if (err){
                    console.log('Missing compass at 0x0E');
                    callback(err);
                }
                else {
                    console.log('Found compass at 0x0E');
                    initCompass(callback);
                }
            });
        }
    ], function(err){
        callback(err);
    });
}

/*
 Initialises the accelerometer on bus to default states
 */

function initAccelometer(callback){
    var register, data;

    async.series([
        function(callback){
            // 1. Setup mode configuration
            register = 0x2A;           // CTRL_REG1
            data =  (0 << 6);          // Sleep rate 50 Hz
            data |= (0 << 4);          // Data rate 800 Hz
            data |= (0 << 2);          // No reduced noise mode
            data |= (1 << 1);          // Normal read mode
            data |= (1 << 0);          // Active

            bus.writeByte(addressAccelerometer ,register, data, function(err) {
                if (err){
                    console.log('Failed sending CTRL_REG1!');
                    callback(err);
                }
                else {
                    //console.log('Ok sending CTRL_REG1');
                    callback();
                }
            });
        },
        function(callback){
            // 2. Setup range
            register = 0x0E;             // XYZ_DATA_CFG
            data = 0x00;                 // Range 2G, no high pass filtering
            bus.writeByte(addressAccelerometer ,register, data, function(err) {
                if (err){
                    console.log('Failed sending XYZ_DATA_CFG!');
                    callback(err);
                }
                else {
                    //console.log('Ok sending XYZ_DATA_CFG');
                    callback();
                }
            });
        },
        function(callback){
            // 3. System state
            register = 0x0B;             // SYSMOD
            data = 0x01;                 // Awake mode

            bus.writeByte(addressAccelerometer, register, data, function(err) {
                if (err){
                    console.log('Failed sending SYSMOD!');
                    callback(err);
                }
                else {
                    //console.log('Ok sending SYSMOD!');
                    callback();
                }
            });
        },
        function(callback){
            // 4. Reset ready for reading
            register = 0x00;

            bus.writeByte(addressAccelerometer, register,0, function(err) {
                if (err){
                    console.log('Failed sending final write');
                    callback(err);
                }
                else {
                    //console.log('Ok sending final write');
                    callback();
                }
            });
        }

    ], function(err){
        if (err){
            console.error( err);
            callback(err);
        }
        else{
            callback();
        }

    });
}

/*
 Initialises the compass on bus to default states
 */
function initCompass(callback){
    var register, data;
    async.series([
        function(callback){
            // 1. Acquisition mode
            register = 0x11;           // CTRL_REG2
            data  = (1 << 7);          // Reset before each acquisition
            data |= (1 << 5);          // Raw mode, do not apply user offsets
            data |= (0 << 5);         // Disable reset cycle
            bus.writeByte(addressCompass,register, data, function(err) {
                if (err){
                    console.error('Failed sending CTRL_REG2!');
                    callback(err);
                }
                else {
                    //console.log('Ok sending CTRL_REG2');
                    callback();
                }
            });
        },
        function(callback){
            // 2. System operation
            register = 0x10;             // CTRL_REG1
            data  = (0 << 5);            // Output data rate (10 Hz when paired with 128 oversample)
            data |= (3 << 3);            // Oversample of 128
            data |= (0 << 2);            // Disable fast read
            data |= (0 << 1);            // Continuous measurement
            data |= (1 << 0);            // Active mode
            bus.writeByte(addressCompass,register, data, function(err) {
                if (err){
                    console.error('Failed sending CTRL_REG1!');
                    callback(err);
                }
                else {
                    //console.log('Ok sending CTRL_REG1');
                    callback();
                }
            });
        }
    ], function(err){
        if (err){
            console.error( err);
            callback(err);
        }
        else{
            callback();
        }

    });
}

/*
 Reads the X, Y and Z axis raw magnetometer readings
 */
function readCompass(callback){
    // Read the data from the compass chip
    async.series([
        function(callback){
            bus.writeByte(addressCompass,0x00, 0, function(err) {
                if (err){
                    console.log(err);
                    callback(err);
                }
                else {
                    callback();
                }
            });
        },
        function(){
            bus.readI2cBlock(addressCompass, 0, 18, new Buffer(18), function(err, bytesRead, buffer) {
                if (err){
                    console.log(err);
                    callback(err);
                }
                else {
                    var values = {
                        xh: buffer[1],
                        xl: buffer[2],
                        yh: buffer[3],
                        yl: buffer[4],
                        zh: buffer[5],
                        zl: buffer[6]
                    };
                    // Convert from unsigned to correctly signed values
                    var bytes = jspack.Pack('BBBBBB', [values.xh, values.xl, values.yh, values.yl, values.zh, values.zl]);
                    var result = jspack.Unpack('hhh', bytes);

                    callback(null, result);
                }
            });
        }
    ]);
}

/*
 Reads the die temperature of the compass in degrees Celsius
 */
function readTemperature(callback){
    // Read the data from the compass chip
    async.series([
        function(callback){
            bus.writeByte(addressCompass,0x00, 0, function(err) {
                if (err){
                    console.log(err);
                    callback(err);
                }
                else {
                    callback();
                }

            });
        },
        function(){
            bus.readI2cBlock(addressCompass, 0, 18, new Buffer(18), function(err, bytesRead, buffer) {
                if (err){
                    console.log(err);
                    callback(err);
                }
                else {
                    var temp = buffer[16];
                    // Convert from unsigned to correctly signed values
                    var bytes = jspack.Pack('B', [temp]);
                    var result = jspack.Unpack('b', bytes)[0] + tempOffset;

                    callback(null, result);
                }
            });
        }
    ]);
}


function readAccelerometer(callback){
    //Reads the X, Y and Z axis force, in terms of Gs

    bus.readI2cBlock(addressAccelerometer, 0, 4, new Buffer(4), function(err, bytesRead, buffer) {

        // http://stackoverflow.com/questions/621290/what-is-the-difference-between-signed-and-unsigned-variables
        if (err){
            console.log(err);
            callback(err);
        }
        else {
            var arr = [buffer.readInt8(1), buffer.readInt8(2), buffer.readInt8(3)];  // read as signed
            // var arr = _.toArray(new Uint8Array(res)); // read as unsigned
            arr = _.map(arr, function(num){
                return num * gPerCount;
            });

            callback(null, arr);
        }
    });
}

/*
 Public
 */
module.exports = {
    init: init,
    readAccelerometer: readAccelerometer,
    readCompass: readCompass,
    readTemperature: readTemperature,
    test: function(){
        async.series([
            function(callback){
                init(callback);
            },
            function(){

                async.forever(
                    function(next) {
                        var result = {};
                        async.series([
                            function(cb){
                                readAccelerometer(function(err, arr){
                                    if (err){
                                        return cb(err);
                                    }
                                    result.accelerometer = arr;
                                    cb();
                                });
                            },
                            function(cb){
                                readCompass(function(err, arr){
                                    if (err){
                                        return cb(err);
                                    }
                                    result.compass = arr;
                                    cb();

                                });
                            },
                            function(cb){
                                readTemperature(function(err, value){
                                    if (err){
                                        return cb(err);
                                    }
                                    result.temperature = value;
                                    cb();

                                });
                            }
                        ], function(err){
                            if (err){
                                return next(err);
                            }
                            console.log(result);
                            setTimeout(function(){
                                next();
                            }, 500);
                        });

                    },
                    function(err) {
                        console.error(err);
                    }
                );
            }
        ]);
    }
};