/* Magic Mirror
 * Node Helper: MMM-RemoteCompliments.js
 *
 * By Mitchell Marino
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var moment = require('moment');
var _ = require('lodash');
var driveUtils = require('./Drive/DriveUtils.js')

module.exports = NodeHelper.create({

    /**
     * Runs on module startup. Primarily used to initialize useful variables.
     */
	start: function () {
		var self = this;
		// Update interval.
		self.fetchInterval = 0;
		// Files.
		self.localImageFiles = [];
		// Last Trackers
		self.lastImage = "";
		self.lastHeader = "";
		self.lastCompliment = "";
		self.lastImageDimensions = "";
		// Update Trackers
		self.nextImageUpdate = undefined;
		self.nextRandomComplimentUpdate = undefined;
		// Miscellaneous
		self.misc = undefined;
		// Configurations.
		self.imagesConfig = undefined;
		self.randomComplimentsConfig = undefined;
		// Current data.
		self.currentWeatherType = undefined;
		// Indices.
		self.currentImageIndex = -1;
		self.lastComplimentIndex = -1;
		// The fetcher.
		self.driveFetcher = new driveUtils.driveFetcher(self.path, self.name);
		// Starting message.
		console.log("Starting node helper for: " + self.name);
	},

	/**
     * Main process of the node_helper. 
	 * - Fetches data from Google Drive using the driveFetcher.
	 * - Calls handleDriveData() to handle the data once fetched.
	 * - Handles errors that occur when fetching from Drive.
	 * - Schedules the next fatch from Google Drive.
     */
	fetchData: function () {
		var self = this;
		self.driveFetcher.getDriveData().then((payload) => {
			/* 
			// Uncomment this block to have fetch result printed.
			console.log('PAYLOAD: \n', JSON.stringify(payload, null, 4));
			*/
			self.handleDriveData(payload);
			self.scheduleFetch(self.fetchInterval);
		}, (err) => {
			// console.log(`${self.name}: An error occurred when fetching from Google Drive that could not be recovered from: `, err);
			// console.log(`${self.name}: Fetching again in two seconds.`)
			self.scheduleFetch(2000);
		});
	},

	/**
	 * Schedule the next fetchData() call.
	 * @param {Number} nextLoad the number of milliseconds until the next fetch occurs.
	 */
	scheduleFetch: function (nextLoad) {
		var self = this;
		setTimeout(function () {
			self.fetchData();
		}, nextLoad);
	},

	/**
	 * This method handles data from Google Drive.
	 * - Selects which compliment to display.
	 * - Schedules and clears random compliment updates as required.
	 * - Schedules and clears image updates.
	 * - Updates locally stored configurations and values.
	 * - Sends data notifications to the client process.
	 * @param {JSON} driveData the identifier of the notification.
	 */
	handleDriveData: function (driveData) {
		var self = this;

		// -- Miscellaneous Handling --
		if (!_.isEqual(driveData.misc, self.misc)) {
			// Store old value of appendPeriod.
			var prevAppendPeriod;
			try {
				prevAppendPeriod = self.misc.appendPeriod;
			} catch (err) {
				prevAppendPeriod = driveData.misc.appendPeriod;
			}
			// Update object's misc data.
			self.misc = driveData.misc;
			// Update header content if changed.
			self.sendDataNotification('HEADER_CONTENT', self.misc.headerContent);
			// Update image content if changed.
			self.sendDataNotification('IMAGE_DIMENSIONS', self.misc.imageDimensions);
			// If appendPeriod changed value, update the front end.
			if (prevAppendPeriod !== self.misc.appendPeriod) self.sendDataNotification('COMPLIMENT', self.lastCompliment);
		}

		// -- Compliment Handling --
		// - Priority: scheduledCompliment > currentCompliment > randomCompliment.
		// Scheduled Compliment.
		if (driveData.scheduledCompliment !== "") {
			self.clearRandomComplimentsUpdates();
			self.sendDataNotification('COMPLIMENT', driveData.scheduledCompliment)
		}
		// Current Compliment.
		else if (driveData.currentCompliment !== "") {
			self.clearRandomComplimentsUpdates();
			self.sendDataNotification('COMPLIMENT', driveData.currentCompliment)
		}
		// Random Compliments.
		else if (!_.isEqual(driveData.randomCompliments.data, {})) {
			// Update Config if it changed.
			if (!_.isEqual(driveData.randomCompliments.config, self.randomComplimentsConfig)) {
				self.clearRandomComplimentsUpdates();
				self.randomComplimentsConfig = driveData.randomCompliments.config;
			}
			// Update Data if it changed.
			if (!_.isEqual(driveData.randomCompliments.data, self.randomCompliments)) {
				self.clearRandomComplimentsUpdates();
				self.randomCompliments = driveData.randomCompliments.data;
			}
			// If randomCompliments needs scheduling, schedule it.
			if (self.nextRandomComplimentUpdate == null) {
				self.updateRandomCompliment();
			}
		} else {
			// If no compliments.
			self.clearRandomComplimentsUpdates();
			self.sendDataNotification('COMPLIMENT', "");
		}

		// -- Image Handling --
		if (!_.isEqual(driveData.localImageFiles.data, [])) {
			// Update image config if it changed.
			if (!_.isEqual(driveData.localImageFiles.config, self.imagesConfig)) {
				self.clearImageUpdates();
				self.imagesConfig = driveData.localImageFiles.config;
			}
			// Update image data if it changed.
			if (!_.isEqual(driveData.localImageFiles.data, self.localImageFiles)) {
				self.clearImageUpdates();
				self.localImageFiles = driveData.localImageFiles.data;
			}
			// If imageUpdate needs scheduling, schedule it.
			if (self.nextImageUpdate == null) {
				self.updateImage();
			}
		} else {
			// If no images.
			self.clearImageUpdates();
			self.sendDataNotification('IMAGE_FILE', "");
		}
	},

	/**
	 * This method is called when a socket notification arrives. (A notification sent from the client process)
	 * @param {String} notification the identifier of the notification.
	 * @param {Any} payload the payload of the notification.
	 */
	socketNotificationReceived: function (notification, payload) {
		var self = this;
		// 'START_FETCHING'
		// - Notifies the node_helper to begin its main process.
		if (notification === `${self.name}-START_FETCHING`) {
			// console.log(`${self.name}: Starting Google Drive fetcher - Interval: `, payload);
			// Set the fetch Interval.
			self.fetchInterval = payload;
			// fetch immediately
			self.fetchData();
		}
		// 'CURRENTWEATHER_DATA'
		// - A payload containing current weather data. Used for RandomCompliments.
		if (notification === `${self.name}-CURRENTWEATHER_DATA`) {
			// Set current weather type using the data.
			self.setCurrentWeatherType(payload);
		}
	},

	/**
     * Send a notification to the module client process. Valid notifications:
	 * 	- 'COMPLIMENT': a compliment.
	 * 	- 'IMAGE_FILE': an image file path.
	 * 	- 'HEADER_CONTENT': content for the module header.
	 * 	- 'IMAGE_DIMENSIONS': dimensions for max width / height of the image.
	 * @param {String} notification the identifier of the notification type.
	 * @param {Any} payload the payload to be sent with the notification.
     */
	sendDataNotification: function (notification, payload) {
		var self = this;
		// Handle payload differently for each notification type.
		// 'COMPLIMENT'
		if (notification === 'COMPLIMENT') {
			// Append period if appendPeriod boolean is set.
			if (self.misc.appendPeriod) payload = self.appendPeriod(payload);
			// If compliment is same as the last one sent, don't send a notification.
			if (payload === self.lastCompliment) return;
			self.lastCompliment = payload;
		}
		// 'IMAGE_FILE'
		else if (notification === 'IMAGE_FILE') {
			// If image file is same as last image file sent, don't send a notification.
			if (payload === self.lastImage) return;
			self.lastImage = payload;
			// Parse payload into proper route for the client process to access image.
			if (payload !== "") payload = "modules" + payload.split("modules")[1];
		}
		// 'HEADER_CONTENT'
		else if (notification === 'HEADER_CONTENT') {
			// If header content is same as the last header content sent, don't send a notification.
			if (payload === self.lastHeader) return;
			self.lastHeader = payload;
		}
		// 'IMAGE_DIMENSIONS'
		else if (notification === 'IMAGE_DIMENSIONS') {
			// If image dimensions are the same as last dimsensions sent, don't send a notification.
			if (_.isEqual(payload, self.lastImageDimensions)) return;
			self.lastImageDimensions = payload;
		}
		// After payload has been processed, send the notification.
		self.sendSocketNotification(`${self.name}-${notification}`, payload);
	},

	/**
	 * The main process for updating the image.
	 * - Rotates the image index and sends the new image to the client process.
	 * - Schedules the next image update.
	 */
	updateImage: function () {
		var self = this;
		self.rotateImageIndex();
		self.sendDataNotification('IMAGE_FILE', self.localImageFiles[self.currentImageIndex]);
		self.scheduleImageUpdate();
	},

	/**
	 * Schedule the next updateImage() call.
	 */
	scheduleImageUpdate: function () {
		var self = this;
		// Convert minutes and seconds from image update interval into milliseconds.
		var minutes = self.imagesConfig.updateInterval.minutes * 1000 * 60;
		var seconds = self.imagesConfig.updateInterval.seconds * 1000;
		var nextLoad = minutes + seconds;
		// Store a reference to the timeout event.
		self.nextImageUpdate = setTimeout(function () {
			self.updateImage();
		}, nextLoad);
	},

	/**
	 * Clear any existing timeouts for image updates.
	 */
	clearImageUpdates: function () {
		var self = this;
		clearTimeout(self.nextImageUpdate);
		self.nextImageUpdate = null;
	},

	/**
	 * Rotate the index of the image list.
	 */
	rotateImageIndex: function () {
		var self = this;
		self.currentImageIndex++;
		if (self.currentImageIndex > self.localImageFiles.length - 1) self.currentImageIndex = 0;
	},

	/**
	 * The main process for updating the random compliment.
	 * - Select a random compliment and sends it to the client process.
	 * - Schedules the next randomCompliments update.
	 */
	updateRandomCompliment: function () {
		var self = this;
		// Get a randomCompliment.
		var compliment = self.selectRandomCompliment();
		// If randomCompliment is undefined, default to "".
		if (compliment == null) compliment = "";
		self.sendDataNotification('COMPLIMENT', compliment);
		self.scheduleRandomComplimentsUpdate();
	},

	/**
	 * Schedule the next updateRandomCompliment() call.
	 */
	scheduleRandomComplimentsUpdate: function () {
		var self = this;
		// Convert minutes and seconds from randomCompliments update interval into milliseconds.
		var minutes = self.randomComplimentsConfig.updateInterval.minutes * 1000 * 60;
		var seconds = self.randomComplimentsConfig.updateInterval.seconds * 1000;
		var nextLoad = minutes + seconds;
		// Store a reference to the timeout event.
		self.nextRandomComplimentUpdate = setTimeout(function () {
			self.updateRandomCompliment();
		}, nextLoad);
	},

	/**
	 * Clear any existing timeouts for random compliments updates.
	 */
	clearRandomComplimentsUpdates: function () {
		var self = this;
		clearTimeout(self.nextRandomComplimentUpdate);
		self.nextRandomComplimentUpdate = null;
	},

	/**
	 * Retrieve a random compliment.
	 * @return {String} a randomly selected compliment.
	 */
	selectRandomCompliment: function () {
		var self = this;
		var compliments = self.complimentArray(self.randomCompliments);
		var index = self.randomIndex(compliments);
		return compliments[index];
	},

	/** 
	 * Retrieve an array of compliments for the time of the day.
	 * @return {Array<String>} an array of compliments for the current time of day and weather.
	 */
	complimentArray: function () {
		var self = this;
		var hour = moment().hour();
		var config = self.randomComplimentsConfig.variables;
		var compliments;
		// Morning list.
		if (hour >= config.morningStartTime && hour < config.morningEndTime && self.randomCompliments.hasOwnProperty("morning")) {
			compliments = self.randomCompliments.morning.slice(0);
		// Afternoon list.
		} else if (hour >= config.afternoonStartTime && hour < config.afternoonEndTime && self.randomCompliments.hasOwnProperty("afternoon")) {
			compliments = self.randomCompliments.afternoon.slice(0);
		// Evening list.
		} else if (self.randomCompliments.hasOwnProperty("evening")) {
			compliments = self.randomCompliments.evening.slice(0);
		}
		// If no morning, afternoon or evening values, make new array.
		if (typeof compliments === "undefined") {
			compliments = new Array();
		}
		// If weather is defined, add weather compliments.
		if (typeof self.currentWeatherType !== "undefined") {
			compliments.push.apply(compliments, self.randomCompliments[self.currentWeatherType]);
		}
		// Add anytime.
		compliments.push.apply(compliments, self.randomCompliments.anytime);
		return compliments;
	},

	/**
	 * Generate a random index for a list of compliments.
	 * @param {Array<String>} compliments an array of compliments.
	 * @return {Number} a random index within the bounds of the compliments array.
	 */
	randomIndex: function (compliments) {
		var self = this;
		if (compliments.length === 1) {
			return 0;
		}
		var generate = function () {
			return Math.floor(Math.random() * compliments.length);
		};
		var complimentIndex = generate();
		while (complimentIndex === self.lastComplimentIndex) {
			complimentIndex = generate();
		}
		self.lastComplimentIndex = complimentIndex;
		return complimentIndex;
	},

	/**
	 * This method updates the current weather type.
	 * @param {JSON} data the data used to update the current weather type.
	 */
	setCurrentWeatherType: function (data) {
		var self = this;
		var weatherIconTable = {
			"01d": "day_sunny",
			"02d": "day_cloudy",
			"03d": "cloudy",
			"04d": "cloudy_windy",
			"09d": "showers",
			"10d": "rain",
			"11d": "thunderstorm",
			"13d": "snow",
			"50d": "fog",
			"01n": "night_clear",
			"02n": "night_cloudy",
			"03n": "night_cloudy",
			"04n": "night_cloudy",
			"09n": "night_showers",
			"10n": "night_rain",
			"11n": "night_thunderstorm",
			"13n": "night_snow",
			"50n": "night_alt_cloudy_windy"
		};
		self.currentWeatherType = weatherIconTable[data.weather[0].icon];
	},

	/**
	 * Append a period to the string if the string does not end with one of the designated symbols.
	 * @return {String} the string with a period appended to it if required.
	 */
	appendPeriod: function (compliment) {
		// If compliment is empty string do not append.
		if (compliment === "") return compliment;
		var symbols = ['.', '!', '?', '(', ')', '<', '>', '[', ']']
		var append = true;
		var lastChar = compliment.slice(-1);
		for (var i in symbols) {
			if (symbols[i] === lastChar) {
				// If compliment ends with a symbol, do not need to append a period.
				append = false;
				break;
			}
		}
		// If compliment did not end with a symbol, append a period.
		if (append === true) compliment += '.';
		return compliment;
	}

});