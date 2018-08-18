/* Magic Mirror
 * Node Helper: {{MODULE_NAME}}
 *
 * By Mitchell Marino
 * {{LICENSE}} Licensed.
 */

var NodeHelper = require("node_helper");
var moment = require('moment');
var driveUtils = require('./DriveUtils.js')

module.exports = NodeHelper.create({

	/* Startup. */
	start: function () {
		var self = this;
		// Update interval.
		self.updateInterval = 0;
		// The fetcher.
		self.driveFetcher = new driveUtils.driveFetcher(self.path);
		// Files.
		self.localFiles = [];
		// Trackers.
		self.lastMessageUpdate = undefined;
		self.lastMessage = "";
		self.currentMessage = "";
		self.currentWeatherType = undefined;
		self.lastComplimentIndex = -1;
		self.currentFileIndex = -1;
		console.log("Starting node helper for: " + self.name);
	},

	// Send notification containing Google Drive Data.
	sendDataNotification: function (payload) {
		this.sendSocketNotification(`${this.name}-GOOGLE_DRIVE_DATA`, payload);
	},

	// Fetch data from drive using the driveFetcher object.
	fetchData: function () {
		var self = this;
		self.driveFetcher.getDriveData().then((payload) => {
			console.log('PAYLOAD: \n', payload);
			data = self.selectMessage(payload);
			self.sendDataNotification(data); // Send message and file.
			self.scheduleUpdate(self.updateInterval);

		}, (err) => {
			//console.log("An error happened to occur, so do nothing.");
			self.scheduleUpdate(self.updateInterval);
		});
	},

	/* socketNotificationReceived(notification, payload)
	 * This method is called when a socket notification arrives.
	 *
	 * argument notification string - The identifier of the noitication.
	 * argument payload mixed - The payload of the notification.
	 */
	socketNotificationReceived: function (notification, payload) {
		var self = this;
		// Notification from the MMM-RemoteCompliments module that requests for fetching to begin.
		if (notification === `${this.name}-START_FETCHING`) {
			console.log("Starting Google Drive fetcher for MMM-RemoteCompliments. ", notification, "payload: ", payload);
			// Set update interval..
			self.updateInterval = payload;
			// Schedule update timer.
			self.fetchData();
		}
		if (notification === `${this.name}-CURRENTWEATHER_DATA`) {
			console.log("WEATHER UPDATE");
			this.setCurrentWeatherType(payload);
		}
	},

	scheduleUpdate: function (delay) {
		var self = this;
		var nextLoad = self.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}
		setTimeout(function () {
			self.fetchData();
		}, nextLoad);
	},

	// Select the message.
	selectMessage: function (driveData) {
		var self = this;
		// scheduledCompliment > currentCompliment > randomCompliment.
		if (driveData.scheduledCompliment !== "") {
			self.lastMessageUpdate = undefined;
			return driveData.scheduledCompliment;
		}
		if (driveData.currentCompliment !== "") {
			self.lastMessageUpdate = undefined;
			return driveData.currentCompliment;
		}
		if (driveData.randomCompliments.data !== {}) {
			// IF CHANGE INTERVAL DIFFERENT THAN CURRENT ONE, CHANGE IT AND SET UNDEFINED.
			if (self.needsUpdate(driveData.randomCompliments.config.complimentChangeInterval)) {
				compliment = self.selectRandomCompliment(driveData.randomCompliments);
				if (typeof compliment !== 'undefined') {
					return compliment;
				}
			}
			return self.lastMessage;
		}
		return "";
	},

	// From data currentweather set weather type
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

	// Whether or not the random compliment needs an update.
	needsUpdate: function (updateInterval) {
		var self = this;
		var now = moment();
		if (typeof self.lastMessageUpdate === "undefined" ||
			now.diff(self.lastMessageUpdate, 'minutes') >= updateInterval) {
			self.lastMessageUpdate = now;
			return true;
		}
		return false;
	},

	/* randomIndex(compliments)
	 * Generate a random index for a list of compliments.
	 *
	 * argument compliments Array<String> - Array with compliments.
	 *
	 * return Number - Random index.
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

	/* complimentArray()
	 * Retrieve an array of compliments for the time of the day.
	 *
	 * return compliments Array<String> - Array with compliments for the time of the day.
	 */
	complimentArray: function (randomCompliments) {
		var self = this;
		var complimentConfig = randomCompliments.config;
		var complimentData = randomCompliments.data;
		var hour = moment().hour();
		var compliments;
		if (hour >= complimentConfig.morningStartTime && hour < complimentConfig.morningEndTime && complimentData.hasOwnProperty("morning")) {
			compliments = complimentData.morning.slice(0);
		} else if (hour >= complimentConfig.afternoonStartTime && hour < complimentConfig.afternoonEndTime && complimentData.hasOwnProperty("afternoon")) {
			compliments = complimentData.afternoon.slice(0);
		} else if (complimentData.hasOwnProperty("evening")) {
			compliments = complimentData.evening.slice(0);
		}
		if (typeof compliments === "undefined") {
			compliments = new Array();
		}
		if (typeof self.currentWeatherType !== "undefined") {
			console.log("CUR WEATHER:" + self.currentWeatherType);
			compliments.push.apply(compliments, complimentData[self.currentWeatherType]);
		}
		compliments.push.apply(compliments, complimentData.anytime);
		return compliments;
	},

	/* complimentArray()
	 * Retrieve a random compliment.
	 *
	 * return compliment string - A compliment.
	 */
	selectRandomCompliment: function (randomCompliments) {
		var self = this;
		var compliments = self.complimentArray(randomCompliments);
		console.log("CURRCOMP: ", compliments);
		var index = self.randomIndex(compliments);
		if (typeof compliments[index] !== 'undefined') {
			// ADD PERIOD TO END.
		}
		return compliments[index];
	}

});