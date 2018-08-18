const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

// If modifying these scopes, delete credentials.json.
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'Token.json';
const FILE_IDS = 'DriveFileIds.json'

// Get Write Permissions.
authorization = new Promise(function (resolve, reject) {
  fs.readFile('Auth.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);

    // Extract credentials.
    credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    //Check for existing token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      // If read failed, obtain access token via request & Authorization.
      if (err) {
        getAccessToken(oAuth2Client).then((oAuth2Client) => {
          resolve(oAuth2Client);
        },
          // If token cannot be obtained.
          (err) => {
            reject(err);
          }
        );
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
    if (err) console.error('Error parsing SetupConfig.json: ', err);

    directoryMetaData = JSON.parse(content);

    //Create drive file for the folder that stores everything.
    var fileMetadata = {
      'name': directoryMetaData.mainFolder.name,
      'mimeType': 'application/vnd.google-apps.folder'
    };
    createDriveFile(drive, fileMetadata).then((parentId) => {
      console.log("Main drive folder created, with Id: ", parentId);

      //Create all files inside parentId asynchronously.
      Promise.all([
        // Create random compliments.
        createDriveFile(drive, {
          'name': directoryMetaData.mainFolder.files.randomComplimentsName,
          'parents': [parentId],
          'mimeType': 'application/vnd.google-apps.document'
        }),
        // Create current compliments.
        createDriveFile(drive, {
          'name': directoryMetaData.mainFolder.files.currentComplimentsName,
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
          'name': directoryMetaData.mainFolder.misc.config,
          'parents': [parentId],
          'mimeType': 'application/vnd.google-apps.spreadsheet'
        }).then((fileId) => {
          setupConfigFile(auth, fileId);
          return fileId;
        }),
        // Create instructions file.
        createDriveFile(drive, {
          'name': directoryMetaData.mainFolder.misc.instructions,
          'parents': [parentId],
          'mimeType': 'application/vnd.google-apps.document'
        })]
      ).then((idArray) => {
        /*
        Time to prepare Ids for long term storage.
        idArray contains:
        [0] --> Random Compliments.
        [1] --> Current Compliments.
        [2] --> Scheduled Compliments.
        [3] --> Image folder.
        [4] --> Configuration file.
        [5] --> Instructions file.
        */
        idStorage = {
          "mainFolder": {
            "Id": parentId,
            "files": {
              "randomComplimentsId": idArray[0],
              "currentComplimentsId": idArray[1],
              "scheduledComplimentsId": idArray[2],
            },
            "folders": {
              "imageFolderId": idArray[3],
            },
            "misc": {
              "configId": idArray[4],
              "instructionsId": idArray[5]
            }
          }
        }
        // Store the file Ids for later usage by the smart mirror module.
        fs.writeFile(FILE_IDS, JSON.stringify(idStorage, null, 4), (err) => {
          if (err) {
            print('error');
          } else {
            console.log('File Ids saved to: ', FILE_IDS);
          }
          // Resolve once all operations are complete.
        });
      },
        (err) => {
          console.error("Error creating drive files: ", err)
        });
    },
      (err) => {
        console.log('Something went wrong with Authorization: ', err);
      });
  });
});

//Function to request access token.
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
    //Receive authorization code.
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) reject(err);
        //Set oAuth2Client credentials, respective to the token.
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 4), (err) => {
          if (err) reject(err);
          console.log('Token stored to', TOKEN_PATH);
          // Resolve once all operations are complete.
          resolve(oAuth2Client);
        });
      });
    });
  });
}

// Create a file or folder on Drive.
function createDriveFile(drive, fileMetadata) {
  return new Promise(function (resolve, reject) {
    // Create the file.
    drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    }, function (err, payload) {
      if (err) reject(err);
      // On success, continue with Id of directory parent.
      resolve(payload.data.id);
    });
  });
}

// Setup Excel File.
function setupConfigFile(auth, fileId) {
  var sheets = google.sheets({ version: 'v4', auth });
  var values = [
  ['Enable Module Configurations'],
  ['Function', 'Is Active (True / False)'],
  ['Random Compliments', true],
  ['Current Compliments', false],
  ['Scheduled Compliments', false],
  ['Images', false],
  [],
  [],
  ['Random Compliments Configurations'],
  ['Variable', 'Value'],
  ['complimentChangeInterval', 30],
  ['morningStartTime', 3],
  ['morningEndTime', 12],
  ['afternoonStartTime', 12],
  ['afternoonEndTime', 17]
  ];
  sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: 'A1:B15',
    valueInputOption: 2,
    resource: { values },
  }, (err, result) => {
    if (err) {
      // Handle error
      console.log(err);
    } else {
      console.log('Setup configuration file, %d cells updated.', result.data.updatedCells);
    }
  });
}

// Setup Excel File.
function setupScheduledComplimentsFile(auth, fileId) {
  var sheets = google.sheets({ version: 'v4', auth });
  let values = [['Start Date', 'Start Time', 'End Date', 'End Time', 'Message']];
  sheets.spreadsheets.values.update({
    spreadsheetId: fileId,
    range: 'A1:E1',
    valueInputOption: 2,
    resource: { values },
  }, (err, result) => {
    if (err) {
      // Handle error
      console.log(err);
    } else {
      console.log('Setup scheduled compliments file, %d cells updated.', result.data.updatedCells);
    }
  });
}
