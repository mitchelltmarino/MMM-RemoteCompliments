/* DriveUtils.js
 * Module: MMM-RemoteCompliments
 *
 * By Mitchell Marino https://github.com/mitchelltmarino
 * MIT Licensed.
 */
const fs = require('fs');
const moment = require('moment');
const { google } = require('googleapis');

// The driveFetcher class fetches data for the MMM-RemoteCompliments module.
class driveFetcher {

    /**
     * Constructor.
     * @param {String} moduleBasePath the base path for the module.
     * @param {String} moduleName the name of the module.
     */
    constructor(moduleBasePath, moduleName) {
        var self = this;
        self.moduleName = moduleName;
        self.basePath = moduleBasePath;
        // Broke down try catch blocks for easier troubleshooting.
        // Get driveFileId data.
        try {
            var fileIdContents = fs.readFileSync(`${self.basePath}/Drive/DriveFileIds.json`);
            self.driveFileIds = JSON.parse(fileIdContents);
        } catch (err) {
            console.log(`${self.moduleName}: Error opening a required file for driveFetcher: ${self.basePath}/Drive/DriveFileIds.json.\n`, err);
        }
        // Get Authorization data.
        try {
            var authContents = fs.readFileSync(`${self.basePath}/Drive/Auth.json`);
            self.credentials = JSON.parse(authContents);
        } catch (err) {
            console.log(`${self.moduleName}: Error opening a required file for MMM-RemoteCompliments: ${self.basePath}/Drive/Auth.json.\n`, err);
        }
        // Get Token data.
        try {
            var tokenContents = fs.readFileSync(`${self.basePath}/Drive/Token.json`);
            self.token = JSON.parse(tokenContents);
        } catch (err) {
            console.log(`${self.moduleName}: Error opening a required file for MMM-RemoteCompliments: ${self.basePath}/Drive/Token.json.\n`, err);
        }
    }

    /**
     * Get data from Google Drive for the MMM-RemoteCompliments module to use.
     * - Resolve with a JSON object if fetch is successful, and nothing went wrong that can't reasonably be handled.
     * - Reject with an error message if something went wrong that could not be handled, and should require another attempt at fetching.
     */
    getDriveData() {
        // self will reference driveFetcher object by convention.
        var self = this;
        return new Promise(function (resolve, reject) {
            /*
            Reference to find files by ID..
            ---
            self.driveFileIds.mainFolder.files.randomComplimentsId
            self.driveFileIds.mainFolder.files.currentComplimentId
            self.driveFileIds.mainFolder.files.scheduledComplimentsId
            self.driveFileIds.mainFolder.files.configId
            self.driveFileIds.mainFolder.folders.imageFolderId
            */

            //Obtain authorization.
            authorize(self.credentials, self.token).then((auth) => {

                // Initialize Drive.
                const drive = google.drive({ version: 'v3', auth });
                // Initialize Sheets.
                const sheets = google.sheets({ version: 'v4', auth });

                // Get Configuration File Contents.
                getSpreadsheetContents(true, sheets, self.driveFileIds.mainFolder.files.configId).then((payload) => {
                    /*
                    Booleans on which function is active can be found in payload..
                    ---
                    payload[1][1] --> Scheduled Compliments.
                    payload[2][1] --> Current Compliment.
                    payload[3][1] --> Random Compliments.
                    payload[4][1] --> Images.
                    */

                    // Parse booleans that determine whether the main functions are active or not.
                    var getBoolean = function (array, i1, i2) {
                        // Handle booleans, strings representing booleans, and errors.
                        try {
                            var value = array[i1][i2];
                            if (typeof value === 'boolean') {
                                return value;
                            }
                            if (typeof value === 'string') {
                                if (value.trim().toUpperCase() === 'TRUE') return true;
                                return false;
                            }
                        } catch (err) {
                            return false;
                        }
                    };
                    // Define Configuration Settings.
                    var functionBooleans = {
                        scheduledCompliments: getBoolean(payload, 2, 1),
                        currentCompliment: getBoolean(payload, 3, 1),
                        randomCompliments: getBoolean(payload, 4, 1),
                        images: getBoolean(payload, 5, 1)
                    }

                    // Build a list of promises to be fulfilled asynchronously through Promise.all().
                    var tasks = [
                        // Get Scheduled Compliment.
                        getSpreadsheetContents(functionBooleans.scheduledCompliments, sheets, self.driveFileIds.mainFolder.files.scheduledComplimentsId).then((payload) => {
                            /*
                            payload[i][0] --> Start Date
                            payload[i][1] --> Start Time
                            payload[i][2] --> End Date
                            payload[i][3] --> End Time
                            payload[i][4] --> Message
                            */
                            // Remove header array index.
                            payload = payload.splice(1);
                            // Choose the compliment from list using custom priority algorithm.
                            return chooseScheduledCompliment(payload);
                        }),

                        // Get Current Compliment.
                        getDocumentContents(functionBooleans.currentCompliment, drive, self.driveFileIds.mainFolder.files.currentComplimentId),

                        // Get Random Compliments.   
                        getDocumentContents(functionBooleans.randomCompliments, drive, self.driveFileIds.mainFolder.files.randomComplimentsId).then((payload) => {
                            var randomComplimentJSON = {};
                            // If JSON fails to parse, simply assume the JSON is empty.
                            try {
                                randomComplimentJSON = JSON.parse(payload);
                            } catch (err) {
                                /*
                                Uncomment this block and the module will inform you if your JSON is invalid in the console.
                                if (payload.trim() != "") console.log(`${self.moduleName}: Error parsing randomCompliment JSON, it may be invalid.`);
                                */
                            }
                            return randomComplimentJSON;
                        }),

                        // Image Folder Contents
                        listFileImageContents(functionBooleans.images, drive, self.driveFileIds.mainFolder.folders.imageFolderId).then((payload) => {
                            // If images function is not active, just return payload.files (which will be an empty array).
                            if (!functionBooleans.images) return payload.files;
                            // If images folder does not exist, 
                            if (!fs.existsSync(`${self.basePath}/Drive/images/`)) fs.mkdirSync(`${self.basePath}/Drive/images/`);
                            // If images function is active,
                            /*
                            - Delete local image files no longer on Google Drive.
                            - Download image files that exist on Drive but not locally.
                            - Do not return until all operations are complete.
                            */
                            return new Promise(function (resolve, reject) {

                                // Get list of image files on Drive.
                                var driveImageFiles = payload.files
                                // List of file operations to fulfill.
                                var fileOperations = [];

                                // Read image files that exist locally.
                                fs.readdir(`${self.basePath}/Drive/images/`, (err, localImageFiles) => {
                                    if (err) return reject(`Error reading contents from file located at: ${self.basePath}/Drive/images`);

                                    // Queue up downloads for image files from Drive that do not exist locally.
                                    driveImageFiles.forEach(function (fileInfo) {
                                        var existsLocally = false;
                                        for (var i in localImageFiles) {
                                            if (localImageFiles[i].split('.')[0] === fileInfo.id) {
                                                existsLocally = true;
                                                break;
                                            }
                                        }
                                        if (!existsLocally) fileOperations.push(downloadDriveImageFile(drive, self.basePath, fileInfo));
                                    });

                                    // Queue up deletes for local image files if they do not exist on Drive.
                                    localImageFiles.forEach(function (fileName) {
                                        var existsOnDrive = false;
                                        for (var i in driveImageFiles) {
                                            if (driveImageFiles[i].id === fileName.split('.')[0]) {
                                                existsOnDrive = true;
                                                break;
                                            }
                                        }
                                        if (!existsOnDrive) {
                                            fileOperations.push(
                                                new Promise(function (resolve, reject) {
                                                    fs.unlink(`${self.basePath}/Drive/images/${fileName}`, (err) => {
                                                        if (err) {
                                                            // console.log(`${self.moduleName}: Error deleting following file: ${self.basePath}/Drive/images/${fileName}`);
                                                            // If an error occurs deleting (which is unforeseen), it should be resolved the next fetch iteration.
                                                            resolve('Failure');
                                                        }
                                                        // console.log(`${self.moduleName}: ${self.basePath}/Drive/images/${fileName} was deleted beacuse it no longer exists on Drive.`);
                                                        // Resolve value is not important, only important that it has been completed.
                                                        resolve('Success');
                                                    });
                                                }));
                                        }
                                    });

                                    // Perform all queued up downloads and deletes asynchronously.
                                    Promise.all(fileOperations).then(
                                        (success) => {
                                            // Downloads and deletes of images have occurred at this point.

                                            // Get a list of files that exist locally.
                                            fs.readdir(`${self.basePath}/Drive/images/`, (err, localImageFiles) => {
                                                // Handle error in the case that the image folder could not be read.
                                                if (err) return reject(`Could not read contents of folder located at: ${self.basePath}/Drive/images`);

                                                // Add the full file path to the local image files.
                                                for (var i in localImageFiles) {
                                                    localImageFiles[i] = `${self.basePath}/Drive/images/${localImageFiles[i]}`;
                                                }

                                                // Resolve with the list.
                                                resolve(localImageFiles);
                                            });
                                        },
                                        (errorMessage) => {
                                            // Large issues that occur during image file operations will be forwarded through a rejection error message.
                                            reject(errorMessage);
                                        });
                                });
                            });
                        })]

                    // Complete all tasks asynchronously.
                    Promise.all(tasks).then((results) => {
                        // Time to process all configuration options.

                        // ############################
                        // Random Compliments Variables 
                        // ############################
                        try {
                            // Function to determine if random Compliments Variables are valid.
                            var isValidDayHour = function (value) {
                                if (isNaN(value)) throw value + ' is not a number.';
                                if (value < 0 || value > 24) throw value + ' is not a valid daytime hour. (should be from 0-24)';
                                return value;
                            };
                            // Attempt to construct randomComplimentsVariables.
                            var randomComplimentsVariables = {
                                morningStartTime: isValidDayHour(parseInt(payload[10][1])),
                                morningEndTime: isValidDayHour(parseInt(payload[11][1])),
                                afternoonStartTime: isValidDayHour(parseInt(payload[12][1])),
                                afternoonEndTime: isValidDayHour(parseInt(payload[13][1]))
                            }
                            // If logic is incorrect, resort to defaults.
                            if (randomComplimentsVariables.morningEndTime < randomComplimentsVariables.morningStartTime) throw 'Morning End Time is earlier than Morning Start Time.';
                            if (randomComplimentsVariables.afternoonStartTime < randomComplimentsVariables.morningEndTime) throw 'Afternoon Start Time is earlier than Morning End Time.';
                            if (randomComplimentsVariables.afternoonEndTime < randomComplimentsVariables.afternoonStartTime) throw 'Afternoon End Time is earlier than Afternoon Start Time.';
                        } catch (err) {
                            // console.log('MMM-RemoteCompliments: Error with randomComplimentsVariables: ', err);
                            // If values or logic invalid, resort to the default time periods.
                            var randomComplimentsVariables = {
                                morningStartTime: 3,
                                morningEndTime: 12,
                                afternoonStartTime: 12,
                                afternoonEndTime: 17
                            }
                        }

                        // ############################
                        //      Update Intervals 
                        // ############################
                        // Function to handle update interval.
                        var getIntervalValue = function (array, i1, i2, defaultValue) {
                            try {
                                var value = parseInt(array[i1][i2]);
                                if (isNaN(value)) throw ' is not a number.';
                                // Do not allow negatives.
                                return Math.abs(value);
                            } catch (err) {
                                // console.log(`${self.moduleName}: Error with Interval Value ${array[i1][i2]}, (payload:[${i1}][${i2}]): `, err);
                                return defaultValue;
                            }
                        };
                        // Set update interval values.
                        var updateIntervals = {
                            randomCompliments: {
                                minutes: getIntervalValue(payload, 18, 1, 30),
                                seconds: getIntervalValue(payload, 18, 2, 0)
                            },
                            images: {
                                minutes: getIntervalValue(payload, 19, 1, 0),
                                seconds: getIntervalValue(payload, 19, 2, 30)
                            }
                        }
                        // randomCompliments update interval.
                        // If update interval is set to 0 minutes and 0 seconds, default the values.
                        if (updateIntervals.randomCompliments.minutes === 0 && updateIntervals.randomCompliments.seconds === 0){
                            updateIntervals.randomCompliments.minutes = 30;
                            updateIntervals.randomCompliments.seconds = 0;
                        // If update interval is less than 10 seconds, set to 10 seconds as less than 10 seconds would be absurd.
                        } else if (updateIntervals.randomCompliments.minutes === 0 && updateIntervals.randomCompliments.seconds < 10) {
                            updateIntervals.randomCompliments.seconds = 10;
                        }
                        // Image update interval.
                        // If update interval is set to 0 minutes and 0 seconds, default the values.
                        if (updateIntervals.images.minutes === 0 && updateIntervals.images.seconds === 0){
                            updateIntervals.randomCompliments.minutes = 0;
                            updateIntervals.randomCompliments.seconds = 30;
                        // If update interval is less than 10 seconds, set to 10 seconds as less than 10 seconds would be absurd.
                        } else if (updateIntervals.images.minutes === 0 && updateIntervals.images.seconds < 10) {
                            updateIntervals.images.seconds = 10;
                        }

                        // ############################
                        //        Miscellaneous 
                        // ############################
                        // Header Content.
                        var headerContent;
                        try {
                            headerContent = payload[24][1]
                            headerContent = headerContent.toString();
                        } catch (err) {
                            headerContent = "MMM-RemoteCompliments";
                        }
                        // Image Max Width and Height.
                        var getPixels = function (array, i1, i2, defaultValue) {
                            try {
                                var value = parseInt(array[i1][i2]);
                                // If not a number.
                                if (isNaN(value)) {
                                    // Check if ends with pixels.
                                    startString = value.slice(0, -2);
                                    endString = value.slice(-2);
                                    if (endString.toUpperCase === 'PX' && !isNaN(startString)) return (startString + endString.toLowerCase());
                                    throw 'Not a valid format.';
                                }
                                return value.toString() + 'px';
                            } catch (err) {
                                // console.log(`${self.moduleName}: Error with dimension ${array[i1][i2]}, (payload:[${i1}][${i2}]): `, err);
                                return defaultValue;
                            }
                        };
                        // Set the image dimensions values.
                        var imageDimensions = {
                            maxWidth: getPixels(payload, 25, 1, '500px'),
                            maxHeight: getPixels(payload, 26, 1, '500px')
                        };

                        // Append Period.
                        var appendPeriod;
                        try {
                            // Handle booleans, strings representing booleans, and errors.
                            appendPeriod = payload[27][1];
                            if (typeof appendPeriod === 'string') {
                                if (appendPeriod.trim().toUpperCase() === 'TRUE') {
                                    appendPeriod = true;
                                } else {
                                    appendPeriod = false;
                                }
                            }
                            else if (typeof appendPeriod !== 'boolean') {
                                throw 'value of appendPeriod should be a boolean';
                            }
                        } catch (err) {
                            // console.log(`${self.moduleName}: error with appendPeriod: `, err);
                            appendPeriod = false;
                        }

                        // ############################
                        //    Formatting For Return 
                        // ############################
                        var driveContent = {
                            scheduledCompliment: results[0],
                            currentCompliment: results[1],
                            randomCompliments: {
                                config: {
                                    variables: randomComplimentsVariables,
                                    updateInterval: updateIntervals.randomCompliments,
                                },
                                data: results[2],
                            },
                            localImageFiles: {
                                config: {
                                    updateInterval: updateIntervals.images
                                },
                                data: results[3]
                            },
                            misc: {
                                headerContent: headerContent,
                                appendPeriod: appendPeriod,
                                imageDimensions: imageDimensions
                            }
                        }
                        // Return conveniently formatted JSON data.
                        resolve(driveContent);
                    },
                        // If a task expereinces an error that may not be reasonably recovered from,
                        (errorMessage) => {
                            // Reject with the error message.
                            reject(errorMessage);
                        });
                },
                    (errorMessage) => {
                        // If an error occurs getting configuration values from spreadsheet, reject with the error message.
                        reject(errorMessage);
                    });
            },
                (errorMessage) => {
                    // If an error with authorization occurs, reject with the error message.
                    reject(errorMessage);
                });
        });
    }
}

/**
 * Obtain Authorization and an Access Token using Google APIs implementation of OAuth 2.
 * @param {JSON} credentials credentials used to obtain OAuth 2 authorization.
 * @param {JSON} token token data (including refresh token) used to obtain a new Access Token. 
 */
function authorize(credentials, token) {
    return new Promise(function (resolve, reject) {
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);
        // Check if we have previously stored a token.
        try {
            oAuth2Client.setCredentials(token);
            resolve(oAuth2Client);
        } catch (err) {
            return reject("Error obtaining Authorization.");
        }
    });
}

/**
 * List the image file contents of a Google Drive Folder.
 * @param {Boolean} run whether or not to perform the fetch.
 * @param {Object} drive a Google Drive connection. (Through Google APIs)
 * @param {String} fileId the unique fileId of the file.
 */
function listFileImageContents(run, drive, fileId) {
    return new Promise(function (resolve, reject) {
        // If not run, return a default empty value.
        if (!run) resolve({ files: [] });
        // Query: Files are images, they are located in image folder, and they are not in trash.
        drive.files.list({
            q: `mimeType contains 'image/' and '${fileId}' in parents and trashed = false`,
            fields: 'files(id, name)',
            spaces: 'drive',
            pageSize: 1000,
            pageToken: null
        }, function (err, payload) {
            // If request error, reject with error message.
            if (err) return reject(`Unable to get imageFileContents of the drive Image folder with ID '${fileId}'.`);
            resolve(payload.data);
        });
    });
}

/**
 * Fetch the data from a Google Drive document.
 * @param {Boolean} run whether or not to perform the fetch.
 * @param {Object} drive a Google Drive connection. (Through Google APIs)
 * @param {String} fileId the unique fileId of the document to fetch.
 */
function getDocumentContents(run, drive, fileId) {
    return new Promise(function (resolve, reject) {
        // If not run, return a default empty value.
        if (!run) resolve("");
        // Get document contents.
        drive.files.export({
            fileId,
            mimeType: 'text/plain'
        }, function (err, payload) {
            // If request error, reject with error message.
            if (err) return reject(`Error with GET request for document with ID '${fileId}'.`);
            // On success, return the results of the export..
            data = payload.data;
            // Weird bug where symbols can be appended to beginning of message it seems. 
            // Simply just remove first char while it is not in ASCII regularly used chars.
            while ((data.charAt(0) < 32 || data.charAt(0) > 126) && data != "") {
                data = data.substr(1);
            }
            resolve(data);
        });
    });
}

/**
 * Fetch the data from a Google Drive spreadsheet.
 * @param {Boolean} run whether or not to perform the fetch.
 * @param {Object} sheets a Google Sheets connection. (Through Google APIs)
 * @param {String} fileId the unique fileId of the spreadsheet to fetch.
 */
function getSpreadsheetContents(run, sheets, fileId) {
    return new Promise(function (resolve, reject) {
        // If not run, return a default empty value.
        if (!run) resolve([]);
        // Get spreadsheet contents.
        sheets.spreadsheets.values.get({
            spreadsheetId: fileId,
            range: 'A:E',
            majorDimension: 'ROWS',
        }, (err, result) => {
            if (err) return reject(`Error with GET request for spreadsheet with ID '${fileId}'.`);
            resolve(result.data.values);
        });
    });
}

/**
 * Parse the hours and minutes from a String in one of the following formats:
 * - HH:MM AM (For example, 5:30 AM)
 * - HH:MM PM (For example, 10:30 PM)
 * - HH:MM (For exmaple, 20:00) 
 * @param {String} timeString the string to be parsed into hours and minutes.
 * @return {JSON} JSON in format { hours, minutes }.
 */
function parseTime(timeString) {
    try {
        var hours = 0;
        var minutes = 0;
        timeString = timeString.trim();
        // Conditional on whether AM exists in String.
        var am = false;
        var pm = false;
        stringEnd = timeString.slice(-2);
        // Handling based on whether AM or PM exist in String.
        if (stringEnd.toUpperCase() === 'PM') {
            hours += 12;
            timeString = timeString.slice(0, -2);
            pm = true;
        }
        else if (stringEnd.toUpperCase() === 'AM') {
            timeString = timeString.slice(0, -2);
            am = true;
        }
        // Separate hours and minutes.
        timeSplit = timeString.split(':');
        hours += parseInt(timeSplit[0], 10);
        minutes += parseInt(timeSplit[1], 10);
        // Logical adjustments.
        if (am && hours === 12) hours = 0;
        if (pm && hours === 24) hours = 12;;
        // Validity Check.
        if (isNaN(hours)) throw 'Hours is not a valid number.'
        if (isNaN(minutes)) throw 'Minutes is not a valid number.'
        if (hours >= 24 || hours < 0) throw `Hours value ${hours} is not within the valid range (0-23).`
        if (minutes >= 60 || minutes < 0) throw `minutes value ${minutes} is not within the valid range (0-59).`
        // Return JSON.
        return { hours, minutes };
    } catch (err) {
        // console.log(`MMM-RemoteCompliments: An error occured while parsing the time. {timeString: ${timeString}, err: ${err}}`);
        // Return default of 0 hrs 0 mins if error occurs.
        return { hours: 0, minutes: 0 };
    }
}

/**
 * Add defaults values in list of ScheduledComments where needed, and remove invalid indices.
 * @param {Array<Array>} complimentArray An array of compliments.
 * @return {Array<JSON>} A prepared array of compliments, each in format {startMoment, endMoment, compliment}.
 */
function prepareScheduledComments(complimentArray) {
    // Current time.
    var now = moment();
    // Array to be returned.
    var preparedArray = [];
    // Iterate through each compliment returned via Google Spreadsheet.
    for (var i = 0; i < complimentArray.length; i++) {
        // Fill in vacant array indeces with empty strings.
        for (var j = complimentArray[i].length; j < 5; j++) {
            complimentArray[i].push("");
        }
        // Prepare the start time, end time, and compliment.
        try {
            // If message is undefined, simply pop the compliment.
            if (complimentArray[i][4].trim() === "") throw 'compliment is not defined.';
            // DATES.
            // Start date.
            var startMoment = moment(new Date(complimentArray[i][0])).hours(0).minutes(0).seconds(0).milliseconds(0);
            if (!startMoment.isValid()) throw 'start date is invalid.';
            // If start date year is before current year (if year not given, default is 2001), set it to current year.
            if (startMoment.year() < now.year()) startMoment.year(now.year());
            // End date.
            var endMoment = moment(new Date(complimentArray[i][2])).hours(0).minutes(0).seconds(0).milliseconds(0);
            // If end date year is before current year(if year not given, default is 2001), set it to current year.
            if (endMoment.year() < now.year()) endMoment.year(now.year());
            // If end date is not defined, is invalid, or is before startDate, set it to a copy of startDate.
            if (complimentArray[i][2] === "" || !endMoment.isValid() || endMoment.diff(startMoment, 'days') < 0) endMoment = moment(startMoment);
            // TIMES.
            var startTime = parseTime(complimentArray[i][1]);
            var endTime = parseTime(complimentArray[i][3]);
            // If (start date and end date are the same) AND (start time is after end time)
            if (startMoment.diff(endMoment) === 0 &&
                (startTime.hours > endTime.hours || (startTime.hours === endTime.hours && startTime.minutes >= endTime.minutes))) {
                // Add 1 day to endMoment.
                endMoment.add(1, 'days');
            }
            startMoment.add(startTime);
            endMoment.add(endTime);
            // Push prepared moments and compliment to the array of prepared scheduledCompliments.
            preparedArray.push([startMoment, endMoment, complimentArray[i][4]]);
        } catch (err) {
            // If error occurs, the index the error occurred at will somply be not consider this index.
            // console.log(`MMM-RemoteCompliments: There was an error preparing a scheduled compliment: `, err);
        }
    }
    // console.log(`MMM-RemoteCompliments: Before preparation:\n `, complimentArray);
    // console.log(`MMM-RemoteCompliments: After preparation:\n `, preparedArray);
    // Return prepared array.
    return preparedArray;
}

/**
 * Determine which compliment gets priority to be returned. Decision based on the following considerations:
 * 1. Start time for the compliment has passed.
 * 2. End time for the compliment has not passed.
 * 3. Start time is the most recent of all compliments where factors 1 and 2 hold true.
 * @param {Array<Array>} complimentArray An array of compliments.
 * @return {String} The compliment of highest priority.
 */
function chooseScheduledCompliment(complimentArray) {
    // If no compliments, return empty String.
    if (complimentArray.length === 0) return "";
    preparedArray = prepareScheduledComments(complimentArray);
    // Current daytime, excluding seconds and milliseconds.
    var now = moment().seconds(0).milliseconds(0);
    // Default Message.
    var chosenDifference = Number.MAX_SAFE_INTEGER;
    var chosenCompliment = "";
    // Find compliment with the most recent start time.
    for (var i in preparedArray) {
        // Get the difference between:
        // - Compliment start time and current time.
        // - Compliment end time and current time.
        var startDifference = now.diff(preparedArray[i][0], 'minutes');
        var endDifference = now.diff(preparedArray[i][1], 'minutes');
        // Uncomment if wish to debug:
        // console.log(`MMM-RemoteCompliments: FOR COMPLIMENT '${preparedArray[i][2]}':`);
        // console.log(`MMM-RemoteCompliments: START TIME (${preparedArray[i][0]}) IS PASSED: `, startDifference >= 0)
        // console.log(`MMM-RemoteCompliments: START TIME (${preparedArray[i][0]}) IS MOST RECENT: `, startDifference <= chosenDifference)
        // console.log(`MMM-RemoteCompliments: END TIME (${preparedArray[i][1]}) HAS NOT PASSED: `, endDifference < 0)
        if (startDifference >= 0 && startDifference <= chosenDifference && endDifference < 0) {
            // Considerations:
            // - Start time is past current moment.
            // - Start Time is more recent than selected comments.
            // - End Time has not passed.
            chosenDifference = startDifference;
            chosenCompliment = preparedArray[i][2];
        }
    }
    // Return the compliment of highest priority.
    // if (chosenCompliment !== "") console.log(`MMM-RemoteCompliments: Chosen Scheduled Compliment`, chosenCompliment);
    return chosenCompliment;
}

/**
 * Download a file from Google Drive, handling both success and failure conditions.
 * @param {Object} drive a Google Drive connection. (Through Google APIs)
 * @param {String} basePath the basePath of the MMM-RemoteCompliments module. Used to determine where the image should be saved.
 * @param {String} fileInfo the unique fileId of the image File to fetch.
 */
function downloadDriveImageFile(drive, basePath, fileInfo) {
    return new Promise(function (resolve, reject) {
        // Useful variables.
        var fileId = fileInfo.id;
        var extension = fileInfo.name.split('.')[1];
        var dest = fs.createWriteStream(`${basePath}/Drive/images/${fileId}.${extension}`);
        // Request.
        drive.files.get(
            // Parameters.
            {
                fileId: fileId,
                alt: 'media'
            },
            {
                responseType: 'stream'
            },
            // Callback.
            (err, payload) => {
                // Handle request error.
                if (err) return reject(`Error with get request for image: {id: '${fileInfo.id}', name: '${fileInfo.name}' }`);

                // Handle errors that occur when downloading file via stream.
                payload.data.on('error', () => {
                    // If download stream encountered an error, delete the local file. (i.e. the incomplete download)
                    fs.unlink(`${basePath}/Drive/images/${fileId}.${extension}`, (err) => {
                        if (err) return reject(`Error downloading ${basePath}/Drive/images/${fileId}.${extension} and it could not be deleted locally.`);
                        reject(`${basePath}/Drive/images/${fileId}.${extension} was deleted due to an error downloading.`)
                    });
                });

                // Handler for when download is completed successfully.
                dest.on('finish', () => {
                    // console.log(`MMM-RemoteCompliments: Downloaded image from Drive successfully: {id: '${fileInfo.id}', name: '${fileInfo.name}' }`);
                    // Resolve value is not important, only important that it has been completed.
                    resolve('Success.');
                });

                // Pipe the read stream to the write stream.
                payload.data.pipe(dest);
            });
    });
}

// Export driveFetcher for use by the module.
module.exports = {
    driveFetcher
}