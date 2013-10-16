var RaspiCam = require("raspicam"),
	colors = require("colors"),
	Spacebrew = require('./sb-1.3.0').Spacebrew,
	sb,
	camera,
	config = require("./machine"),
	fs = require("fs");


var image_path = __dirname + "/files/";


// setup spacebrew
sb = new Spacebrew.Client( config.server, config.name, config.description );  // create spacebrew client object


// create the spacebrew subscription channels
sb.addPublish("config", "string", "");	// publish config for handshake
sb.addSubscribe("config", "boolean");	// subscription for config handshake


sb.addSubscribe("start", "boolean");	// subscription for starting timelapse
sb.addSubscribe("stop", "boolean");		// subscription for starting timelapse

sb.addPublish("src", "string", "");		// publish image url for handshake
sb.addPublish("image", "image");		// publish the serialized binary image data


sb.onBooleanMessage = onBooleanMessage;	
sb.onOpen = onOpen;

// connect to spacbrew
sb.connect();  


/**
 * Function that is called when Spacebrew connection is established
 */
function onOpen() {
	console.log( "Connected through Spacebrew as: " + sb.name() + "." );

	// initialize RaspiCam timelapse
	camera = new RaspiCam({
		mode: "timelapse",
		output: image_path + "image_%06d.png", // image_000001.jpg, image_000002.jpg,...
		encoding: "png",
		timelapse: 10000, // take a picture every 3 seconds
		timeout: 86400000 // stop after 24 hours 
	});

	camera.on("start", function( err, timestamp ){
		console.log("timelapse started at " + timestamp);
	});

	camera.on("read", function( err, timestamp, filename ){
		console.log("timelapse image captured with filename: " + filename);

		//send the url to the image to be used as a src in client apps
		sb.send("src", "string", image_path + filename);
	});

	camera.on("data", function( err, timestamp, filename ){
		fs.readFile(image_path + filename, function(err, data) {
			var base64data = data.toString('base64');
			console.log('sending base 64 with length' + base64data.length);

			sb.send("image", "image", base64data);
		});
	});

	camera.on("exit", function( timestamp ){
		console.log("timelapse child process has exited");
	});

	camera.on("stop", function( err, timestamp ){
		console.log("timelapse child process has been stopped at " + timestamp);
	});

}



/**
 * onStringMessage Function that is called whenever new spacebrew string messages are received.
 *          It accepts two parameters:
 * @param  {String} name    Holds name of the subscription feed channel
 * @param  {String} value 	Holds value received from the subscription feed
 */
function onBooleanMessage( name, value ){

	console.log("[onBooleanMessage] value: " + value + " name: " + name);

	switch(name){
		case "config":
			console.log([
		      // Timestamp
		      String(+new Date()).grey,
		      // Message
		      String("sending config").cyan
		    ].join(" "));

			sb.send("config", "string", JSON.stringify( config ) );
			break;
		case "start":
			if(value == true){
				console.log([
			      // Timestamp
			      String(+new Date()).grey,
			      // Message
			      String("starting camera").magenta
			    ].join(" "));

				// start timelapse
				camera.start();
			}	
			break;
		case "stop":
			if(value == true){
				console.log([
			      // Timestamp
			      String(+new Date()).grey,
			      // Message
			      String("stopping camera").magenta
			    ].join(" "));

				// stop timelapse
				camera.stop();
			}
			break;
	}
}