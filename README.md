<style>
table {
    width:100%;
}
</style>

# MMM-RemoteCompliments

This is a module for the open source [MagicMirror²](https://github.com/MichMich/MagicMirror/) platform.

MMM-RemoteCompliments provides seamless integration with Google Drive to display compliments and images on the mirror.

## Installation 

* Navigate to the MagicMirror/modules directory.
* Enter: `git clone https://github.com/mitchelltmarino/MMM-RemoteCompliments.git`
* Follow the [setup instructions](##Setup-Instructions) at the bottom of this page.
* Restart MagicMirror

## Using the module

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
var config = {
    modules: [
        {
            module: "MMM-RemoteCompliments",
            config: {
                // See below for configurable options
            }
        }
    ]
}
```

## Configuration options

The following properties can be configured in the `config/config.js` file:

| Option           | Description
|----------------- |-----------
| `header`        | The default header of the module. A value is required to enable changing of the header from Google Drive. <br><br>**Type:** `String`<br>**Default Value:** `"MMM-RemoteCompliments"`
| `fadeSpeed`        | The speed of the update animation. (Milliseconds) <br><br>**Type:** `int`<br>**Possible Values:** `0` - `5000`<br>**Default Value:** `4000` (4 seconds)
| `fetchInterval`        | The interval at which fetches from Google Drive should occur. (Milliseconds) <br><br>**Type:** `int`<br>**Possible Values:** `0` - `5000`<br>**Default Value:** `4000` (4 seconds)   

## Google Drive configuration options

The majority of configurations for MMM-RemoteCompliments done via Google Drive, in the `configuration` spreadsheet.

This way the module configurations can be easily modified at any time, without a direct connection to the mirror. The configurations options available are broken down by sections.

### Enable Function Configurations
| Option           | Description
|----------------- |-----------
| `Scheduled Compliments` | Whether to display scheduled compliments. <br><br>**Type:** `Boolean`<br>**Possible Values:** `true` or `false`<br>**Default Value:** `false`
| `Current Compliments`        | Whether to display current compliments. <br><br>**Type:** `Boolean`<br>**Possible Values:** `true` or `false`<br>**Default Value:** `false`
| `Random Compliments`        | Whether to display random compliments. <br><br>**Type:** `Boolean`<br>**Possible Values:** `true` or `false`<br>**Default Value:** `false`
| `Images`        | Whether to display images. <br><br>**Type:** `Boolean`<br>**Possible Values:** `true` or `false`<br>**Default Value:** `false`


### Random Compliments Configurations
| Option           | Description
|----------------- |-----------
| `Morning Start Time`        | The time in hours (24 hour format), after which the time of day is considered the morning. <br><br>**Type:** `int` <br>**Possible Values:** `0` - `24`<br>**Default Value:** `3`
| `Morning End Time`        | The time in hours (24 hour format), after which the time of day is no longer considered the morning.<br><br>**Type:** `int` <br>**Possible Values:** `0` - `24`<br>**Default Value:** `12`
| `Afternoon Start Time`        | The time in hours (24 hour format), after which the time of day is considered the afternoon. <br><br>**Type:** `int` <br>**Possible Values:** `0` - `24`<br>**Default Value:** `12`
| `Afternoon End Time`        | The time in hours (24 hour format), after which the time of day is no longer considered the afternoon.  <br><br>**Type:** `int` <br>**Possible Values:** `0` - `24`<br>**Default Value:** `17`


### Update Intervals
| Option           | Description 
|----------------- |------------
| `Random Compliments`| The number of minutes and seconds after which the random compliment displayed should change.<br><br>**Type:** `int` <br>**Possible Values:** Any number greater than 0. <br>**Default Value:** `30` minutes `0` seconds
| `Images`| The number of minutes and seconds after which the image displayed should change.<br><br>**Type:** `int` <br>**Possible Values:**  Any number greater than 0. <br>**Default Value:** `0` minutes `30` seconds


### Miscellaneous
| Option           | Description
|----------------- |-----------
| `Header Content`        | The content of the module header.<br><br>**Type:** `String` <br>**Default Value:** `""`
| `Image Max Width`        | The maximum width of the image displayed.  (Pixels) <br><br>**Type:** `int` <br>**Default Value:** `500`
| `Image Max Height`        | The maximum height of the image displayed. (Pixels) <br><br>**Type:** `int` <br>**Default Value:** `500`
| `Append Period`        | Whether to append a period to the end of the compliment if it does not end with a symbol already. <br><br>**Type:** `Boolean` <br>**Possible Values:**  `true` or `false` <br>**Default Value:** `false`


## Setup Instructions

In order for MMM-RemoteCompliments to properly integrate with Google Drive, you must first download dependencies, create a Google Cloud Platform project to service the module, and execute a provided setup file.

1. **Download dependencies**
    * Open the console and enter: `npm install googleapis`
        * This will install the Google APIs service. (Working as of googleAPIS@33.0.0)

2. **Create a Google Cloud Platform project**
    * Visit: https://console.developers.google.com.
    * Create a new project, with a name of your choice.
        * Enable the Google Drive API.
        * Enable the Google Sheets API.
    * Create new credentials for the project, with the credential type set as "other".
        * Download the JSON for the credentials you created. This is called the client secret.
        * Move the client secret into `/modules/MMM-RemoteCompliments/Drive`, then rename the file to "Auth.json". (Case sensitive)

3. **Execute the setup file**
    * Open a console and cd into `/modules/MMM-RemoteCompliments/Drive`.
        * Enter into the console: `node Setup`.
            * This will run Setup.js
    * You will be provided with a URL you must visit to authorize the application. 
        * Visit the URL.
        * Login with your Google Account and press then click on "Allow".
        * Copy and paste the code you are provided with into the console.
    * If done correctly, MMM-RemoteCompliments will now be authorized to integrate with the Google Cloud Platform project you created earlier.
        * Once Authorized successfully, the setup will create the Google Drive folders, files, and other dependencies required by the MMM-RemoteCompliments module.
        * If the setup was successful, you will get a success message. If the setup encounters an error, please tend to the error that occurred (it will inform you what went wrong) and re-run `node Setup`.
