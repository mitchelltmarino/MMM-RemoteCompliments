# MMM-RemoteCompliments Setup Instructions

For MMM-RemoteCompliments to properly integrate with Google Drive you must download dependencies, create a Google APIs project to service the module, and execute the provided setup file.

## Table of Contents
* [**Download dependencies**](#Download%20Dependencies)
* [**Setting up your Google APIs project**](#Setting%20up%20your%20Google%20APIs%20project)
* [**Authorizing the application**](#Authorizing%20the%20application)


## Download dependencies

* Open the console and enter `npm install googleapis` from the MagicMirror root folder.
    * This will install the Google APIs service. (Working as of googleapis@33.0.0)

## Setting up your Google APIs project

Visit the [Google APIs developer website](https://console.developers.google.com).

Create a new project by going to Projects --> New Project. You can name this project whatever you like!
* In the image below, the Projects button is labeled as Maddy's Mirror, because the current project I am viewing is named "Maddy's Mirror".

Once your project is created, open that project and go to the dashboard. You will see an interface almost identical to that of the image below. Once you are at the dashboard, click the "Enable APIS and Services" button and enable the Google Drive API and Google Sheets API for the project.

![](/.Github/Setup_Assets/GoogleAPIs_Dashboard_1.PNG?raw=true "The Google APIs Dashboard.")

Now that your project is created, it is time to create credentials so that the MMM-RemoteCompliments module can become authorized to access your Google Drive. 
* Click the credentials tab on the left, and then at the top of that section click the "OAuth consent screen" tab at the top. 
* Here you just need to set the product name shown to users and press save. 
    * This is not significant and can be anything that you want. I chose to name mine the same as the project name.

![](/.Github/Setup_Assets/GoogleAPIs_Credentials_1.PNG?raw=true "The Google APIs OAuth consent setup interface.")

Once the OAuth consent screen is set up, click the credentials tabe at the top of the section. You will arrive at a page similar to the one below. Click on the "Create credentials" button and select OAuth Client ID.

![](/.Github/Setup_Assets/GoogleAPIs_Credentials_2.PNG?raw=true "The GoogleAPIs credentials setup page.")

Now, create a new OAuth Client ID with application type set as "other". You can name the credentials whatever you want, the name is simply used as an identifier for your reference.

![](/.Github/Setup_Assets/GoogleAPIs_Credentials_3.PNG?raw=true "Creating new OAuth client credentials.")

## Authorizing the application

Once your OAuth Client ID has been created, revisit the main credentials page. You can now see your credentials for the application listed under the OAuth 2.0 client IDs. 
* Click the download button for your credentials on the far right (the button with the down-facing arrow) to download the client secret for the application.

![](/.Github/Setup_Assets/GoogleAPIs5_Auth_1.PNG?raw=true "The Google APIs credentials page now that credentials exist.")

The client secret file that you downloaded is a JSON file containing credentials for the OAuth Client ID you created. 
* Move the client secret file into `/modules/MMM-RemoteCompliments/Drive`, then rename the file to "Auth.json". (Case sensitive)
    * Note that alternatively, you can create a file called Auth.json and paste the contents of that client secret file into Auth.json.

Once the client Secret File has been moved, you can run the application setup by doing the following:
* Open a console and cd into `/modules/MMM-RemoteCompliments/Drive`.
    * Enter `node Setup`.
        * This will run the Setup.js script.

The setup script will provide you with a URL you must visit to authorize the application. Copy and paste this into a web browser. When you visit the page, it will look identical to the one below. 

![](/.Github/Setup_Assets/GoogleAPIs5_Auth_2.PNG?raw=true "The request for app authorization.")

If you follow the instructions on the authorization page, you will successfully authorize the application.
* Login to your Google Account and click "Allow".
* Then copy and paste the code you are provided with into the console of the Setup.js script.
* If done correctly, MMM-RemoteCompliments will now be authorized to integrate with the Google APIs project you created earlier.

    
Once Authorized, the Setup script will create the Google Drive folders, files, and other dependencies required by the MMM-RemoteCompliments module.
* If the setup was successful, you will get a success message, as seen in the image below. 
* If the setup encounters an error, please tend to the error that occurred (it will inform you what went wrong) and re-run `node Setup`.

![](/.Github/Setup_Assets/Setup_Success_1.PNG?raw=true "The application has been configured uccessfully. :)")

If you have gotten this far, then congratulations on a successful setup - please enjoy the application! :)
