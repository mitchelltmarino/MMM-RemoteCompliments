# MMM-RemoteCompliments

This is a module for the open source [MagicMirror²](https://github.com/MichMich/MagicMirror/) platform.

MMM-RemoteCompliments provides seamless integration with Google Drive to display compliments and images on the mirror.

## Installation 

* Navigate to the MagicMirror/modules directory.
* Enter `git clone https://github.com/mitchelltmarino/MMM-RemoteCompliments.git`
* Follow the [setup instructions](#setup-instructions) at the bottom of this page.
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


## Setup Instructions

For MMM-RemoteCompliments to properly integrate with Google Drive you must download dependencies, create a Google Cloud Platform project to service the module, and execute the provided setup file.

1. **Download dependencies**

    * Open the console and enter `npm install googleapis`

        * This will install the Google APIs service. (Working as of googleapis@33.0.0)

2. **Create a Google Cloud Platform project**

    * Visit https://console.developers.google.com.

    * Create a new project, with a name of your choice.
        * Enable the Google Drive API.
        * Enable the Google Sheets API.

    * Create new credentials for the project, with the credential type set to "other".
        * Download the JSON file for the credentials you created. This is called the client secret.
        * Move the client secret into `/modules/MMM-RemoteCompliments/Drive`, then rename the file to "Auth.json". (Case sensitive)

3. **Execute the setup file**

    * Open a console and cd into `/modules/MMM-RemoteCompliments/Drive`.
        * Enter `node Setup`.
            * This will run the Setup.js script.

    * You will be provided with a URL you must visit to authorize the application. 
        * Visit the URL.
        * Login with your Google Account and press then click on "Allow".
        * Copy and paste the code you are provided with into the console.
        * If done correctly, MMM-RemoteCompliments will now be authorized to integrate with the Google Cloud Platform project you created earlier.
        
    * The setup will then create the Google Drive folders, files, and other dependencies required by the MMM-RemoteCompliments module.
        * If the setup was successful, you will get a success message. 
        * If the setup encounters an error, please tend to the error that occurred (it will inform you what went wrong) and re-run `node Setup`.


## Google Drive files

After the module is setup you will find a file hierarchy setup on your Google Drive like so:

```
Smart Mirror - Remote Compliments
└─── Scheduled Compliments
└─── Current Compliment
└─── Random Compliments
└─── Configuration
└─── images
```

Once the files are created on your Google Drive, you can rename them however you like, and move the files wherever you want. The files are tracked by the module through their unique file IDs. The following table gives a breakdown of each file and folder:

| File / Folder Name           | Description
|----------------- |-----------
| `Scheduled Compliment`        | **Type:** Spreadsheet <br>This spreadsheet allows for compliments to be scheduled to appear on certain dates, and between intervals of time with to-the-minute precision. <br><br> Specify `Start Date`, `Start Time`, `End Date`, `End Time` and `Compliment` to have a compliment appear on the mirror between any given interval! Please visit [Scheduling Compliments]() to learn more.
| `Current Compliment`        | **Type:** Document <br>This document should contain current compliment to display on the mirror. <br><br> The contents of this document will display on the mirror, if any contents are present.
| `Random Compliments`        | **Type:** Document <br>This document should contain a JSON representation of random compliments to display based on time of day, or current weather. <br><br> Check out the [compliments module configuration](https://github.com/MichMich/MagicMirror/tree/master/modules/default/compliments#compliment-configuration) for more information, as the MMM-RemoteCompliments implementation for random compliments was essentially built on top of that. <br><br>**Possible values for time of day:** `morning`, `afternoon`, `evening`, and `anytime`. <br> **Possible values for current weather:** `day_sunny`, `day_cloudy`, `cloudy`, `cloudy_windy`, `showers`, `rain`, `thunderstorm`, `snow`, `fog`, `night_clear`, `night_cloudy`, `night_showers`, `night_rain`, `night_thunderstorm`, `night_snow`, and `night_alt_cloudy_windy`.
| `Configuration`        | **Type:** Spreadsheet <br> This spreadsheet contains many different configuration options for MMM-RemoteCompliments. <br><br> The majority of configurations  are done in this spreadsheet. Visit [Google Drive configuration options](#google-drive-configuration-options) to learn more about the contents of this spreadsheet. 
| `Images`        | **Type:** Folder <br> Any images placed in this folder will appear on the mirror. <br><br> If there is only one image, then that image will display statically on the mirror. If there is multiple images, however, the module will rotate through the images based on the [update interval](#update-intervals) specified for images in the configuration file.

Note that for compliments, there is a priority mechanism which chooses which type of compliment to display in the case that multiple compliment types are present. The priority is as follows:
* Scheduled Compliments > Current Compliment > Random Compliments

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
| `Append Period`        | Whether to append a period to the end of the compliment (if the compliment does not end with a symbol already). <br><br>**Type:** `Boolean` <br>**Possible Values:**  `true` or `false` <br>**Default Value:** `false`