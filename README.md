# UPC Music Scanner

This code is for a tiny web app meant to quickly add music media to a spreadsheet. It will work with CD and vinyl media, and maybe others, using the MusicBrainz API.

## Instructions

### Create a spreadsheet on Google Drive

- Visit https://drive.google.com
- Click "+ New"
- Click "Google Sheets >"
- Across row 1, add these column headers:
  1. Timestamp - when the row was created
  1. UPC Code - the code itself
  1. Artist - the artist name
  1. Title - the title of the media
  1. Format - CD, vinyl, etc.
  1. Label - recording publisher
  1. Catalog No - item catalog number
  1. Packaging - type of container
  1. Release Date - the date of release if known
  1. Primary Type
  1. Country
- I like to make row 1 bold and lock that row so it remains on screen while scrolling down

### Add the App Script to the spreadsheet

- On that spreadsheet, click Extensions, Apps Script
- In that window, replace the content with the content of `app_script.gs` in this project
- REVIEW THAT CODE CAREFULLY
- Click Deploy, then New Deployment
- For "Select type", choose "Web app"
- Enter a description if you like
- For "Execute as", choose "Me"
- For "Who has access", choose "Anyone"
- Click "Deploy"
- Click "Authorize access"
- Google hasn't verified this app, so click Advanced, then Go to Untitled project
- Read the warnings carefully, and if you wish to proceed, click Continue
- COPY the Deployment ID and send it to your phone
- Close the Apps Script tab

### Start the local server

Use of the camera in a web app requires the app be served over a secured (HTTPS) connection.
If you have an HTTPS certificate, you can serve the app as you wish. One easy-ish way to
do that is as follows.

- Start a terminal shell in this directory
- Set your app id with `. .env.dev`
- Start a server with `python3 -m http.server 8000`
- In another terminal, run `ngrok http 8000`

### Load the app

- On your Android phone, use Google Chrome to open the URL provided by ngrok
(Any browser that supports BarcodeDetector should work, but it is not widely available.)

### Use the app
- Upon first run, it will ask for your Deploy ID. Enter the string saved above.
- Click "Start Scanner"
- Point the camera at a UPC code on a CD or vinyl record
- If the code is recognized, the app will query MusicBrainz for information about the media
- If a match is found, the app will display the information and allow you to add it to your spreadsheet
- If no match is found, the app will display the barcode and allow you to add it to the spreadsheet so you can research it later
- Click "Stop Scanner" to stop the camera and barcode detection
- Click "Append Spreadsheet" to add the displayed information to your Google Sheet (this does not clear the displayed information)
- Whether or not you add the data to your spreadsheet, click "Scan Another" to restart the barcode scanner

### Installing the app

- To install the app on your phone, click the browser menu (three dots) and select "Add to Home screen"
- This will allow you to use the app without opening the browser first, and it will also give you a more native app-like experience
- The app will scan barcodes offline, but both the media search and adding to your spreadsheet require a network connection

### Filling in data

The spreadsheet now has a new menu, "MusicBrainz", with an item "Fill Missing Data". That will look at each row in the
spreadsheet, and for each row with a barcode and any missing fields, it will query MusicBrainz for the missing data. It
will not overwrite anything you've added.

That task puts "??" in fields that are empty, or in every field if MusicBrainz doesn't have that barcode.

The free MusicBrainz API has a rate limit of 1 request per second, so the script waits 1 second before each request.

Google Sheets limits task run time to 6 minutes. It may take longer than that to fill in all your data, but since it
fills in missing data with "??", it will not request rows that have values. Run the script again as many times as you
need for it to finish.

## Other notes

- If you have any issues or suggestions for improvement, please open an issue on the GitHub repository for this project

Icons Created by Nicolas Ramallo from the Noun Project
