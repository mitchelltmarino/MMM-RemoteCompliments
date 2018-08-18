/* global Module */

/* Magic Mirror
 * Module: MMM-RemoteCompliments.js
 *
 * By Mitchell Marino
 * {{LICENSE}} Licensed.
 */

Module.register("MMM-RemoteCompliments", {
	defaults: {
		updateInterval: 10000
	},
	getScripts: function () {
		return [];
	},
	getStyles: function () {
		return [];
	},
	start: function () {
		var self = this;
		self.sendNotification('START_FETCHING', self.config.updateInterval);
	},
	// Sending notifications to node_helper.
	sendNotification: function (notification, payload) {
		var self = this;
		console.log(self.name + "-" + notification);
		this.sendSocketNotification((self.name + '-' + notification), payload);
	},
	/* socketNotificationReceived(notification, payload)
	 * This method is called when a socket notification arrives.
	 *
	 * argument notification string - The identifier of the noitication.
	 * argument payload mixed - The payload of the notification.
	 */
	socketNotificationReceived: function (notification, payload) {
		var self = this;
		if (notification === (self.name + '-' + 'GOOGLE_DRIVE_DATA')) {
			console.log("Working notification system. Notification:", notification, "payload: ", payload);
		}
	},

	notificationReceived: function (notification, payload, sender){
		// Notification to update weather.
		if (notification === "CURRENTWEATHER_DATA") {
			this.sendNotification('CURRENTWEATHER_DATA', payload.data);
		}
	},

	// Override dom generator.
	getDom: function () {
		var wrapper = document.createElement("div");
		wrapper.innerHTML = this.config.text;
		return wrapper;
	}

	/*
	getDom: function() {
		var self = this;

		// create element wrapper for show into the module
		var wrapper = document.createElement("div");
		// If this.dataRequest is not empty
		if (this.dataRequest) {
			var wrapperDataRequest = document.createElement("div");
			// check format https://jsonplaceholder.typicode.com/posts/1
			wrapperDataRequest.innerHTML = this.dataRequest.title;

			var labelDataRequest = document.createElement("label");
			// Use translate function
			//             this id defined in translations files
			labelDataRequest.innerHTML = this.translate("TITLE");


			wrapper.appendChild(labelDataRequest);
			wrapper.appendChild(wrapperDataRequest);
		}

		// Data from helper
		if (this.dataNotification) {
			var wrapperDataNotification = document.createElement("div");
			// translations  + datanotification
			wrapperDataNotification.innerHTML =  this.translate("UPDATE") + ": " + this.dataNotification.date;

			wrapper.appendChild(wrapperDataNotification);
		}
		return wrapper;
	}
	*/
});