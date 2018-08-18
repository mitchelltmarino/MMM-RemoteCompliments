const fs = require('fs');
const moment = require('moment');
const { google } = require('googleapis');

class driveFetcher {

    // Constructor.
    constructor(moduleBasePath) {
        var self = this;
        // Base Path for the module.
        self.basePath = moduleBasePath;
        try {
            var fileIdContents = fs.readFileSync(`${self.basePath}/Drive/driveFileIds.json`);
            self.driveFileIds = JSON.parse(fileIdContents);
            var authContents = fs.readFileSync(`${self.basePath}/Drive/Auth.json`);
            self.credentials = JSON.parse(authContents);
            var tokenContents = fs.readFileSync(`${self.basePath}/Drive/Token.json`);
            self.token = JSON.parse(tokenContents);
        } catch (err) {
            console.log('Error opening a required file for MMM-RemoteCompliments: ', err);
        }
    }

    // Main utility of the driveFetcher class.
    getDriveData() {
        /* Resolve will return: 
        [0] --> Random Compliments (JSON).
        [1] --> Current Compliment (String).
        [2] --> Scheduled Compliment (String).
        [3] --> Images available (List).
        */
        var self = this;
        return new Promise(function (resolve, reject) {

            /*
            self.driveFileIds.mainFolder.files.randomComplimentsId
            self.driveFileIds.mainFolder.files.currentComplimentsId
            self.driveFileIds.mainFolder.files.scheduledComplimentsId
            self.driveFileIds.mainFolder.files.imageFolderId
            self.driveFileIds.mainFolder.files.configId
            self.driveFileIds.mainFolder.files.instructionsId
            */

            //Obtain authorization.
            authorize(self.credentials, self.token).then((auth) => {

                // Initialize Drive.
                const drive = google.drive({ version: 'v3', auth });
                // Initialize Sheets.
                const sheets = google.sheets({ version: 'v4', auth });

                // Get Configurations.
                getSpreadsheetContents(true, sheets, self.driveFileIds.mainFolder.misc.configId).then((payload) => {
                    // Complete each task.
                    /*
                    payload[1][1] --> Random Compliments.
                    payload[2][1] --> Current Compliments.
                    payload[3][1] --> Scheduled Compliments.
                    payload[4][1] --> Images.
                    */
                    // Parse the config settings that were returned from the config spreadsheet.
                    try{
                        var isValid = function(val) {
                            if (typeof val == 'boolean'){
                                return val;
                            } else if (typeof val == 'string'){
                                if (val.trim().toUpperCase() === 'TRUE'){
                                    return true;   
                                }else{
                                    return false;
                                }
                            };
                            throw 'bad value';
                        };
                        var configSettings = {
                            randomCompliments: payload[2][1],
                            currentCompliments: payload[3][1],
                            scheduledCompliments: payload[4][1],
                            imageFolder: payload[5][1]
                        }
                    } catch (err) {
                        var configSettings = {
                            randomCompliments: true,
                            currentCompliments: true,
                            scheduledCompliments: true,
                            imageFolder: true
                        }
                    }
                    // Build task list.
                    var tasks = [
                        // Get Random Compliments.   
                        getDocumentContents(configSettings.randomCompliments, drive, self.driveFileIds.mainFolder.files.randomComplimentsId).then((payload) => {
                            if (payload === '__ERROR__') {
                                console.log('An error occured while getting current compliment.');
                                payload = "";
                            }
                            var randomComplimentJSON = {};
                            try {
                                randomComplimentJSON = JSON.parse(payload);
                            } catch (err) {
                                if (payload.trim() != "") console.log('Error parsing randomCompliment JSON, it may be invalid.');
                            }
                            return randomComplimentJSON;
                        }),
                        // Get Current Compliment.
                        getDocumentContents(configSettings.currentCompliments, drive, self.driveFileIds.mainFolder.files.currentComplimentsId).then((payload) => {
                            if (payload === '__ERROR__') {
                                console.log('An error occured while getting current compliment.');
                                payload = "";
                            }
                            return payload;
                        }),
                        // Get Scheduled Compliment.
                        getSpreadsheetContents(configSettings.scheduledCompliments, sheets, self.driveFileIds.mainFolder.files.scheduledComplimentsId).then((payload) => {
                            /*
                            payload[i][0] --> Start Date
                            payload[i][1] --> Start Time
                            payload[i][2] --> End Date
                            payload[i][3] --> End Time
                            payload[i][4] --> Message
                            */
                            if (payload === '__ERROR__') {
                                console.log('An error occured while getting scheduled compliment.');
                                return "";
                            }
                            // Remove header array index.
                            payload = payload.splice(1);
                            // Choose the compliment from list using custom algo.
                            return chooseScheduledComment(payload);
                        }),
                        // Image Folder Contents
                        listFileContents(configSettings.imageFolder, drive, self.driveFileIds.mainFolder.folders.imageFolderId).then((payload) => {
                            /*
                            - Delete local image files no longer on Google Drive.
                            - Download image files that exist on Drive but not locally.
                            - Do not return until all operations are complete.
                            */
                            return new Promise(function (resolve, reject) {
                                try {
                                    // Get list of image files on Drive.
                                    var driveImageFiles = payload.files
                                    // List of file operations to fulfill.
                                    var fileOperations = [];
                                    /*
                                    Read image files that exist locally.
                                    */
                                    fs.readdir(`${self.basePath}/images/`, (err, localImageFiles) => {
                                        if (err) return console.log(err);
                                        // Download image files from Drive if they do not exist locally.
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
                                        /*
                                        Deleting local files if they do not exist on Drive.
                                        */
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
                                                        fs.unlink(`${self.basePath}/images/${fileName}`, (err) => {
                                                            if (err) console.log(err);
                                                            console.log(`${self.basePath}/images/${fileName} was deleted beacuse it no longer exists on Drive.`);
                                                            resolve('Delete Success');
                                                        });
                                                    }));
                                            }
                                        });
                                        /* 
                                        Perform all downloads and deletes required.
                                        */
                                        Promise.all(fileOperations).then((details) => {
                                            fs.readdir(`${self.basePath}/images/`, (err, localImageFiles) => {
                                                // Once all file operations are complete, return a list of remaining files.
                                                resolve(localImageFiles);
                                            });
                                        });
                                    });
                                } catch (err) {
                                    // If an error occurred, return empty list (i.e. no local files).
                                    resolve([]);
                                }
                            });
                        })]
                    // Resolve all promises, then resolve the result.
                    Promise.all(tasks).then((results) => {

                        try{
                            var isValid = function(val, isTime) {
                                if (isNaN(val)) throw val+' is not a number';
                                if (isTime && (val < 0 || val > 24)) throw val+' is not a valid time (should be from 0-24) ';
                                return val;
                            };
                            var randomComplimentsConfig = {
                                complimentChangeInterval: isValid(parseInt(payload[10][1]), false),
                                morningStartTime: isValid(parseInt(payload[11][1]), true),
                                morningEndTime: isValid(parseInt(payload[12][1]), true),
                                afternoonStartTime: isValid(parseInt(payload[13][1]), true),
                                afternoonEndTime: isValid(parseInt(payload[14][1]), true)
                            }
                        } catch (err) {
                            var randomComplimentsConfig = {
                                complimentChangeInterval: 30,
                                morningStartTime: 3,
                                morningEndTime: 12,
                                afternoonStartTime: 12,
                                afternoonEndTime: 17
                            }
                        }
                        // Nice formatting.
                        var driveContent = {
                            randomCompliments: {
                                config: randomComplimentsConfig,
                                data: results[0]
                            },
                            currentCompliment: results[1],
                            scheduledCompliment: results[2],
                            localImageFiles: results[3]
                        }
                        resolve(driveContent);
                    });
                }, (err) => {
                    console.log('Error getting configurations: ', err);
                });
            }, (err) => {
                console.log('Error obtaining authorization: ', err);
            });
        });
    }

}

// Get Auth.
function authorize(credentials, token) {
    return new Promise(function (resolve, reject) {
        // Read Auth Credentials.
        // Extract credentials.
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);
        // Check if we have previously stored a token.
        oAuth2Client.setCredentials(token);
        resolve(oAuth2Client);
    });
}

// List file contents that are images.
function listFileContents(run, drive, fileId) {
    return new Promise(function (resolve, reject) {
        if (!run) resolve([]);
        try {
            pageToken = null
            drive.files.list({
                q: `mimeType contains 'image/' and '${fileId}' in parents`,
                fields: 'files(id, name)',
                spaces: 'drive',
                pageToken: pageToken
            }, function (err, payload) {
                if (err) {
                    // Handle error
                    reject(err);
                } else {
                    resolve(payload.data);
                }
            });
        } catch (err) {
            resolve([]);
        }
    });
}

// Extract data from Google documents.
function getDocumentContents(run, drive, fileId) {
    return new Promise(function (resolve, reject) {
        try {
            if (!run) resolve("");
            // Get file contents.
            drive.files.export({
                fileId,
                mimeType: 'text/plain'
            }, function (err, payload) {
                if (err) reject(err);
                // On success, return the results of the export..
                data = payload.data;
                /* Weird bug where symbols can be appended to beginning of message it seems. 
                Simply just remove 1st char while it is not in ASCII regularly used chars. */
                while ((data.charAt(0) < 32 || data.charAt(0) > 126) && data != "") {
                    data = data.substr(1);
                }
                resolve(data);
            });
        } catch (err) {
            resolve('__ERROR__');
        }
    });
}

// Extract data from Google sheets.
function getSpreadsheetContents(run, sheets, fileId) {
    return new Promise(function (resolve, reject) {
        try {
            if (!run) resolve([]);
            // Get values.
            sheets.spreadsheets.values.get({
                spreadsheetId: fileId,
                range: 'A:E',
                majorDimension: 'ROWS',
            }, (err, result) => {
                if (err) console.log(err);
                resolve(result.data.values);
            });
        } catch (err) {
            resolve('__ERROR__');
        }
    });
}

// Determine how much time to add to the moment.
function parseTime(timeString) {
    // Hours will hold hours, minutes will hold minutes.
    var hours = 0;
    var minutes = 0;
    var am = false;
    // Remove whitespace.
    timeString = timeString.trim();
    stringEnd = timeString.slice(-2);
    // Check if last 2 characters are PM or AM.
    if (stringEnd.toUpperCase() === 'PM') {
        hours += 12;
        timeString.slice(0, -2);
    }
    else if (stringEnd.toUpperCase() === 'AM') {
        timeString.slice(0, -2);
        am = true;
    }
    // Separate hours and minutes.
    timeSplit = timeString.split(':');
    // Convert to number.
    hours += parseInt(timeSplit[0], 10);
    minutes += parseInt(timeSplit[1], 10);
    // If AM and hours is 12, adjust hours to 0 for logical reasons.
    if (am && hours == 12) {
        hours = 0;
    }
    // Return useful JSON.
    return { hours, minutes };
}

// Fix redundencies in compliment data.
function cleanseScheduledComments(complimentArray) {
    const startLength = complimentArray.length;
    for (var i = 0; i < startLength; i++) {
        // If start date is invalid or message is undefined, pop the message it.
        if (!moment(new Date(complimentArray[i][0])).isValid() || complimentArray[i][4].trim() === "") {
            complimentArray.splice(i, 1);
        } else {
            // If end is undefined, give it start date.
            if (!moment(new Date(complimentArray[i][2])).isValid()) {
                complimentArray[i][2] = complimentArray[i][0];
            }
            // If Start Time is undefined, set it to 12:00 AM.
            if (complimentArray[i][1].trim() === "") {
                complimentArray[i][1] = "12:00 AM"
            }
            // If End Time is undefined, set it to 11:59 PM.
            if (complimentArray[i][3].trim() === "") {
                complimentArray[i][3] = "11:59 PM"
            }
        }
    }
    // Return cleansed array.
    return complimentArray;
}

// Determine which compliment gets priority to be shown. Decision based on compliment with most recent start time.
function chooseScheduledComment(complimentArray) {
    // Cleanse complimentArray data.
    complimentArray = cleanseScheduledComments(complimentArray);
    // Current time.
    var now = moment();
    // Defaults.
    var chosenDifference = Number.MAX_SAFE_INTEGER;
    var chosenCompliment = "";
    // Find compliment with the most recent start time.
    for (var i in complimentArray) {
        // Get the difference between compliment's start time and current time.
        var startDifference = now.diff(moment(new Date(complimentArray[i][0])).add(parseTime(complimentArray[i][1])), 'minutes');
        var endDifference = now.diff(moment(new Date(complimentArray[i][2])).add(parseTime(complimentArray[i][3])), 'minutes');
        if (startDifference >= 0 && startDifference <= chosenDifference && endDifference <= 0) {
            // Start time is past current moment, Start Time is more recent than selected comment's, End Time has not passed.
            chosenDifference = startDifference;
            chosenCompliment = complimentArray[i];
        }
    }
    // Return the compliment with most recent start time.
    return chosenCompliment;
}

// Download drive file.
function downloadDriveImageFile(drive, basePath, fileInfo) {
    return new Promise(function (resolve, reject) {
        fileId = fileInfo.id;
        extension = fileInfo.name.split('.')[1];
        var dest = fs.createWriteStream(`${basePath}/images/${fileId}.${extension}`);
        drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, {
                responseType: 'stream'
            }, (err, payload) => {
                if (err) console.log(err);
                payload.data.on('error', () => {
                    console.log(`Error downloading image: {id: '${fileInfo.id}', name: '${fileInfo.name}' }`);
                }).on('end', () => {
                    console.log(`Downloaded image successfully: {id: '${fileInfo.id}', name: '${fileInfo.name}' }`);
                })
                    .pipe(dest);
                dest.on('finish', function () {
                    resolve('Download Success');
                });
            });
    });
}

module.exports = { driveFetcher }