/* Setup.js
 * Module: MMM-RemoteCompliments
 *
 * By Mitchell Marino https://github.com/mitchelltmarino
 * MIT Licensed.
 */
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

// If modifying these scopes, delete credentials.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Factors to determine whether setup was a success.
global.successFactors = {
  allFilesCreated: undefined,
  driveFileIDsSaved: undefined,
  scheduledComplimentsSetup: undefined,
  configurationSetup: undefined,
}

// Get Authorization.
authorization = new Promise(function (resolve, reject) {

  // Read the Auth file, and load it.
  fs.readFile('Auth.json', (err, content) => {

    // Handle errors.
    if (err) {
      console.log("Error opening Auth.json. Please make sure it exists.");
      return reject(err);
    }

    // Extract credentials.
    credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    //Check for existing token.
    fs.readFile('Token.json', (err, token) => {
      // If read failed, obtain access token via request & Authorization.
      if (err) {
        getAccessToken(oAuth2Client).then(
          (oAuth2Client) => {
            // If token was obtained.
            resolve(oAuth2Client);
          },
          (err) => {
            // If token cannot be obtained.
            console.log("Could not obtain an access token.");
            return reject(err);
          });
      } else {
        // If read was successful, return token.
        oAuth2Client.setCredentials(JSON.parse(token));
        resolve(oAuth2Client);
      }
    });
  });

}).then((auth) => {
  // Have authorization, now its time to create folders.

  // Google Drive API connection.
  const drive = google.drive({ version: 'v3', auth });

  // Get config info.
  fs.readFile('SetupConfig.json', (err, content) => {

    // Handle errors.
    if (err) {
      console.log('Error opening SetupConfig.json.');
      throw err;
    }

    directoryMetaData = JSON.parse(content);

    // Create drive folder that stores everything.
    var fileMetadata = {
      'name': directoryMetaData.mainFolder.name,
      'mimeType': 'application/vnd.google-apps.folder'
    };
    createDriveFile(drive, fileMetadata).then((parentId) => {

      // Main drive folder created at this point. Time to create files that it contains.
      console.log("Main drive folder created, with Id: ", parentId);

      // Create all files inside the main drive folder.
      Promise.all([
        // Create random compliments.
        createDriveFile(drive, {
          'name': directoryMetaData.mainFolder.files.randomComplimentsName,
          'parents': [parentId],
          'mimeType': 'application/vnd.google-apps.document'
        }),
        // Create current compliment.
        createDriveFile(drive, {
          'name': directoryMetaData.mainFolder.files.currentComplimentName,
          'parents': [parentId],
          'mimeType': 'application/vnd.google-apps.document'
        }),
        // Create scheduled compliments.
        createDriveFile(drive, {
          'name': directoryMetaData.mainFolder.files.scheduledComplimentsName,
          'parents': [parentId],
          'mimeType': 'application/vnd.google-apps.spreadsheet'
        }).then((fileId) => {
          setupScheduledComplimentsFile(auth, fileId);
          return fileId;
        }),
        // Create image folder.
        createDriveFile(drive, {
          'name': directoryMetaData.mainFolder.folders.imageFolderName,
          'parents': [parentId],
          'mimeType': 'application/vnd.google-apps.folder'
        }),
        // Create configuration file.
        createDriveFile(drive, {
          'name': directoryMetaData.mainFolder.files.config,
          'parents': [parentId],
          'mimeType': 'application/vnd.google-apps.spreadsheet'
        }).then((fileId) => {
          setupConfigFile(auth, fileId);
          return fileId;
        })]
      ).then(
        (idArray) => {

          // All files have now been setup.
          global.successFactors.allFilesCreated = true;

          /*
          idArray contains:
          [0] --> Random Compliments Id.
          [1] --> Current Compliment Id.
          [2] --> Scheduled Compliments Id.
          [3] --> Image folder Id.
          [4] --> Configuration file Id.
          */
          // Time to prepare Ids for long term storage.
          idStorage = {
            "mainFolder": {
              "Id": parentId,
              "files": {
                "randomComplimentsId": idArray[0],
                "currentComplimentId": idArray[1],
                "scheduledComplimentsId": idArray[2],
                "configId": idArray[4]
              },
              "folders": {
                "imageFolderId": idArray[3],
              }
            }
          }

          // Store the file Ids for later use by the MMM-RemoteCompliments module.
          fs.writeFile('DriveFileIds.json', JSON.stringify(idStorage, null, 4), (err) => {

            // Handle errors.
            if (err) {
              console.log("Error storing the file IDs.");
              global.successFactors.driveFileIDsSaved = false;
              return checkSetupSuccess();
            }
            // All files are saved.
            console.log("File Ids saved to: DriveFileIds.json");
            global.successFactors.driveFileIDsSaved = true;
            return checkSetupSuccess();
          });
        },
        (err) => {
          // If something went wrong creating Drive files.
          console.log("Error creating one or more drive files:", err);
          global.successFactors.allFilesCreated = false;
        });
    },
      (err) => {
        // If something went wrong creating main Drive file.
        console.log("Error creating main drive file:\n", err);
        global.successFactors.allFilesCreated = false;
      });
  });
}, (err) => {
  // Handle rejection of authorizaiton.
  console.log(err);
  console.log("Something went wrong with the setup. It is recommended you delete the files created on your Google Drive (if any have been created) and try setup again after fixing the above error.");
}).catch((err) => {
  // Handle errors that are thrown.
  console.log(err);
  console.log("Something went wrong with the setup. It is recommended you delete the files created on your Google Drive (if any have been created) and try setup again after fixing the above error.");
});

/**
 * Obtain an access token which provides authorization for reads and writes to Google Drive.
 * Will provide a user with a secure external URL which will allow them to authorize this Application 
 * if they follow the instructions properly.
 * @param {google.auth.OAuth2} oAuth2Client a Google OAuth 2 object to be populated with authorization credentials.
 */
function getAccessToken(oAuth2Client) {
  return new Promise(function (resolve, reject) {
    //Authorization webpage.
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    //Receive code for authorization.
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(err);
        //Set oAuth2Client credentials, respective to the token.
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile('Token.json', JSON.stringify(token, null, 4), (err) => {
          if (err) return reject(err);
          console.log("Token stored to: Token.json");
          // Resolve once all operations have completed successfully.
          resolve(oAuth2Client);
        });
      });
    });
  });
};

/**
 * Create a file (or folder) on Google Drive.
 * @param {google.drive} drive a Google Drive connection. (Through Google APIs)
 * @param {JSON} fileMetadata the metadata for the file to be created.
 */
function createDriveFile(drive, fileMetadata) {
  return new Promise(function (resolve, reject) {
    // Create the file.
    drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    }, function (err, payload) {
      if (err) return reject(err);
      // On success, continue with Id of directory parent.
      resolve(payload.data.id);
    });
  });
};

/**
 * Setup the Configuration File. (i.e. populate the configuration file with data and defaults).
 * @param {google.auth.OAuth2} auth a Google OAuth 2 object containing authorization credentials.
 * @param {String} fileId the unique fileId of the Configuration File to be setup.
 */
function setupConfigFile(auth, fileId) {
  var sheets = google.sheets({ version: 'v4', auth });
  var values = [
    ['Enable Functions'],
    ['Function', 'Is Active (True / False)'],
    ['Scheduled Compliments', true],
    ['Current Compliment', true],
    ['Random Compliments', true],
    ['Images', true],
    [],
    [],
    ['Random Compliments Variables'],
    ['Variable', 'Value'],
    ['Morning Start Time', 3],
    ['Morning End Time', 12],
    ['Afternoon Start Time', 12],
    ['Afternoon End Time', 17],
    [],
    [],
    ['Update Intervals'],
    ['Variable', 'Minutes', 'Seconds'],
    ['Random Compliments', 30, 0],
    ['Images', 0, 30],
    [],
    [],
    ['Miscellaneous'],
    ['Variable', 'Value'],
    ['Header Content', 'MMM-RemoteCompliments'],
    ['Image Max Width', 500],
    ['Image Max Height', 500],
    ['Append Period', false]
  ];
  sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: 'A1:C28',
    valueInputOption: 2,
    resource: { values },
  }, (err, result) => {
    if (err) {
      console.log('An error occurred while setting up Configuration file:\n', err);
      global.successFactors.configurationSetup = false;
      return checkSetupSuccess();
    }
    console.log('Setup configuration file, %d cells updated.', result.data.updatedCells);
    global.successFactors.configurationSetup = true;
    return checkSetupSuccess();
  });
};

/**
 * Setup the Scheduled Compliments File. (i.e. populate the Scheduled Compliments file with header data).
 * @param {google.auth.OAuth2} auth a Google OAuth 2 object containing authorization credentials.
 * @param {String} fileId the unique fileId of the Configuration File to be setup.
 */
function setupScheduledComplimentsFile(auth, fileId) {
  var sheets = google.sheets({ version: 'v4', auth });
  let values = [['Start Date', 'Start Time', 'End Date', 'End Time', 'Compliment']];
  sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: 'A1:E1',
    valueInputOption: 2,
    resource: { values },
  }, (err, result) => {
    if (err) {
      console.log('An error occurred while setting up Scheduled Compliments file:\n', err);
      global.successFactors.scheduledComplimentsSetup = false;
      return checkSetupSuccess();
    }
    console.log('Setup scheduled compliments file, %d cells updated.', result.data.updatedCells);
    global.successFactors.scheduledComplimentsSetup = true;
    return checkSetupSuccess();
  });
};

/**
 * Check if conditions are met for setup to qualify as Success.
 * If there was a failure in an operation, notify the user and then exit.
 */
function checkSetupSuccess() {
  // Conditionals.
  var hasUndefined = false;
  var hasFalse = false;
  // Iterate through global successFactors JSON object.
  for (var key in global.successFactors) {
    if (global.successFactors[key] === undefined) {
      hasUndefined = true;
      break;
    }
    if (global.successFactors[key] === false) {
      console.log('key: ',key);
      hasFalse = true;
      break;
    }
  }
  // If no undefined and no false, print success.
  if (!hasUndefined && !hasFalse) {
    console.log("---\nSetup was a success! Please enjoy MMM-RemoteCompliments!");
  }
  // If false, let user know and exit.
  if (hasFalse){
    console.log("---\nSomething went wrong with the setup. It is recommended you delete the files created on your Google Drive and try setup again after fixing the above error.");
    process.exit(1);
  }
}