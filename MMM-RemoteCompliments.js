/* Magic Mirror
 * Module: MMM-RemoteCompliments.js
 *
 * By Mitchell Marino
 * MIT Licensed.
 */

Module.register("MMM-RemoteCompliments", {
	defaults: {
		fadeSpeed: 4000,
		updateInterval: 10000,
		imageMaxWidth: '500px',
		imageMaxHeight: '500px'
	},

	/**
     * Get scripts required for the module.
	 * - Just needs jquery.
     */
	getScripts: function () {
		var self = this;
		return [self.file('/Scripts/jquery-3.3.1.min.js')];
	},

	/**
     * Get the header value for this module.
     */
	getHeader: function () {
		var self = this;
		return self.headerContent;
	},

	/**
     * Runs on module startup.
	 * - Just needs jquery.
     */
	start: function () {
		var self = this;
		// Current values.
		self.image = "";
		self.compliment = "";
		self.headerContent = "";
		self.imageLoadHandler = undefined;
		self.hidden = false;
		// Configuration Defaults.
		self.fadeSpeed = self.config.fadeSpeed;
		self.imageMaxWidth = self.config.imageMaxWidth;
		self.imageMaxHeight = self.config.imageMaxHeight;
		// Start node_helper fetching process.
		self.sendNotification('START_FETCHING', self.config.updateInterval);
	},

	/**
     * Sends a notification to the module header.
	 * - Formats the message before sending.
	 * @param {String} notification the identifier for the notification.
	 * @param {Any} payload the data associated withs the notification.
     */
	sendNotification: function (notification, payload) {
		var self = this;
		this.sendSocketNotification((self.name + '-' + notification), payload);
	},

	/**
	 * This method is called when a socket notification arrives.
	 * @param {String} notification the identifier for the notification.
	 * @param {Any} payload the data associated with the notification.
	 */
	socketNotificationReceived: function (notification, payload) {
		var self = this;
		// -- Updating data according to notification identifier --
		// 'COMPLIMENT'
		if (notification === (self.name + '-' + 'COMPLIMENT')) {
			// console.log(self.name + " 'COMPLIMENT' received: ", payload);
			self.updateComplimentText(payload);
		}
		// 'IMAGE_FILE'
		else if (notification === (self.name + '-' + 'IMAGE_FILE')) {
			// console.log(self.name + " 'IMAGE_FILE' received: ", payload);
			self.updateImageSource(payload);
		}
		// 'HEADER_CONTENT'
		else if (notification === (self.name + '-' + 'HEADER_CONTENT')) {
			// console.log(self.name + " 'HEADER_CONTENT' received: ", payload);
			self.refreshModuleDOM(payload);
		}
		// 'IMAGE_DIMENSIONS'
		else if (notification === (self.name + '-' + 'IMAGE_DIMENSIONS')) {
			// console.log(self.name + " 'IMAGE_DIMENSIONS' received: ", payload);
			self.updateImageDimensions(payload.maxWidth, payload.maxHeight);
		}
		// -- Show and show module depending if data exists. --
		// HIDE if no data must currently be displayed.
		if (self.compliment === "" && self.image === "" && !self.hidden) {
			self.hide(self.fadeSpeed / 2);
		}
		// SHOW if data must currently be displayed.
		else if ((self.compliment !== "" || self.image !== "") && self.hidden) {
			self.show(self.fadeSpeed / 2);
		}
	},

	/**
     * Update the text of the notification.
	 * 	- Update will transition with a nice fade effect.
	 * @param {String} text the new compliment.
     */
	updateComplimentText: function (text) {
		var self = this;
		// If compliment does not need updating, don't update.
		if (self.compliment === text) return;
		self.compliment = text;
		var speed = self.fadeSpeed / 2;
		// Reference the compliment document object. 
		var complimentDOM = $("#" + self.name + "-compliment");
		// If text is empty, just fade compliment out.
		if (text === "") {
			complimentDOM.fadeTo(speed, 0, "swing", function () {
				complimentDOM.text("");
			});
		}
		// Else, fade compliment out and then in.
		else {
			complimentDOM.fadeTo(speed, 0, "swing", function () {
				complimentDOM.text(text);
				complimentDOM.fadeTo(speed, 1, "swing");
			});
		}
	},

	/**
     * Update the source of the image.
	 * 	- Update will transition with a nice fade effect.
	 * @param {String} source the new source of the image.
     */
	updateImageSource: function (source) {
		var self = this;
		// If image does not need updating, don't update.
		if (self.image === source) return;
		self.image = source;
		var speed = self.fadeSpeed / 2;
		// Reference the image document object. 
		var imageDOM = $("#" + self.name + "-image");
		// Update handler if it does not currently exist.
		if (self.imageLoadHandler == null) {
			// Store the 
			imageDOM.on("load", function () {
				if (self.image !== "") $(this).fadeTo(speed, 1, "swing");
			});
		}
		// If source is empty, image will just fade out.
		if (source === "") {
			imageDOM.fadeTo(speed, 0, "swing", function () {
				// Reference top of page as source to avoid failed request.
				imageDOM.attr("src", "#");
				// Remove padding from below compliment if there is no image.
				$("#" + self.name + "-compliment").css("paddingBottom", '0px')
			});
		}
		// Else, image will fade out and once done loading, the newly sourced image will fade in.
		else {
			imageDOM.fadeTo(speed, 0, "swing", function () {
				// Add some padding between compliment and the image.
				$("#" + self.name + "-compliment").css("paddingBottom", '15px')
				imageDOM.attr("src", source);
			});
		}
	},

	/**
     * Update the maximum dimensions of the image.
	 * @param {String} width new maximum Width of the image. (in pixels)
	 * @param {String} height new maximum Height of the image. (in pixels)
     */
	updateImageDimensions: function (width, height) {
		var self = this;
		// If no change has occurred to dimensions, don't update.
		if (self.maxWidth === width &&
			self.maxHeight === height) return;
		// Reference the image document object.
		var imageDOM = $("#" + self.name + "-image");
		self.imageMaxWidth = width;
		self.imageMaxHeight = height;
		// Adjust image maximum  dimensions.
		imageDOM.css("maxWidth", width);
		imageDOM.css("maxHeight", height);
	},

	/**
     * Refresh the module DOM and change the module header.
	 * @param {String} headerContent the new content of the module header.
     */
	refreshModuleDOM: function (headerContent) {
		var self = this;
		// If no change has occurred to the header, the module does not need refreshing.
		if (self.headerContent === headerContent) return;
		self.headerContent = headerContent;
		// Remove the reference to the image load handler.
		$("#" + self.name + "-image").off(self.imageLoadHandler)
		self.imageLoadHandler = null;
		// Update the module DOM, with an animation speed of 4 seconds.
		self.updateDom(4000);
	},

	/**
     * This function is called if a notification is received.
	 * @param {String} notification the identifier for the notification.
	 * @param {Any} payload the associated with the notification.
	 * @param {String} sender the sender of the notification.
     */
	notificationReceived: function (notification, payload, sender) {
		var self = this;
		// Notification to update weather.
		if (notification === "CURRENTWEATHER_DATA") {
			console.log(self.name + ": 'CURRENTWEATHER_DATA' received: ", payload);
			// Relay the current weather data to the node_helper.
			self.sendNotification('CURRENTWEATHER_DATA', payload.data);
		}
		// Notification that states the module DOM has been created.
		if (notification === "MODULE_DOM_CREATED") {
			console.log(self.name + ": 'MODULE_DOM_CREATED' received: ", payload);
			// Hide module on startup. 
			// If the module receives data, the module will reveal itself.
			self.hide(0);
			self.hidden = true;
		}
	},

	/**
     * Override the DOM generator.
     */
	getDom: function () {
		var self = this;
		// -- Division --
		var wrapper = document.createElement("div");
		wrapper.className = this.config.classes ? this.config.classes : "thin medium bright";
		// -- Compliment --
		var compliment = document.createElement("p");
		compliment.id = self.name + "-compliment";
		compliment.style.margin = '0px';
		compliment.style.paddingBottom = '15px';
		compliment.textContent = self.compliment;
		// Add compliment to wrapper.
		wrapper.appendChild(compliment);
		// -- Image --
		var image = document.createElement("img");
		if (self.image === "") {
			image.setAttribute("src", "#");
		} else {
			image.setAttribute("src", self.image);
		}
		image.id = self.name + "-image";
		// Function to parse ints and strings into pixel values.
		// - ex: 500 --> "500px"
		var getPixels = function (value, defaultValue) {
			try {
				parseInt(value);
				// If not a number.
				if (isNaN(value)) {
					// Check if ends with pixels.
					startString = value.slice(0, -2);
					endString = value.slice(-2);
					// Check if uppercase.
					if (endString.toUpperCase === 'PX' && !isNaN(startString)) return (startString + endString.toLowerCase());
					return defaultValue;
				}
				return value.toString() + 'px';
			} catch (err) {
				return defaultValue;
			}
		}
		image.style.maxWidth = getPixels(self.imageMaxWidth, self.config.imageMaxWidth);
		image.style.maxHeight = getPixels(self.imageMaxHeight, self.config.imageMaxHeight);
		// Center image.
		image.style.objectFit = 'contain';
		image.style.display = 'block';
		image.style.padding = '0px';
		image.style.margin = '0 auto';
		// Add image to wrapper.
		wrapper.appendChild(image);
		return wrapper;
	}
});