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

### Load the app

#### Option 1 - load from my site

- On your phone, open this link: https://mediascan.chrisschumann.dev/

Any browser that supports BarcodeDetector should work, but that's not many.

https://caniuse.com/mdn-api_barcodedetector details which browsers on which
plaftorms offer it.

Easy browsers to install it from currently (May 2026):
- Chrome for Android
- Opera Mobile
- Samsung Internet

#### Option 2 - run it on your machine

Use of the camera in a web app requires the app be served over a secured (HTTPS) connection.
If you have an HTTPS certificate, you can serve the app as you wish. One easy-ish way to
do that is as follows.

- Start a terminal shell in this directory
- Start a server with `python3 -m http.server 8000`
- In another terminal, run `ngrok http 8000`
- That will give you a URL you can visit on your phone, something like `https://abc123.ngrok.io`

### Use the app
- Upon first run, it will ask for your Deploy ID. Enter the string from your Google Sheet saved above.
- Click "Start Scanner"
- Point the camera at a UPC code on a CD or vinyl record
- If the code is recognized, the app will query MusicBrainz for information about the media
- If a match is found, the app will display the information and allow you to add it to your spreadsheet
- If no match is found, the app will display the barcode and allow you to add it to the spreadsheet so you can research it later
- Click "Stop Scanner" to stop the camera and barcode detection
- Click "Append Spreadsheet" to add the displayed information to your Google Sheet (this does not clear the displayed information)
- Whether or not you add the data to your spreadsheet, click "Scan Another" to restart the barcode scanner

### Installing the app

- To install the app on your phone, find the option in your browser that says "Add to Home screen" or something similar
- This will allow you to use the app without opening the browser first, and it will also give you a more native app-like experience
- The app will scan barcodes offline, but both the media search and adding to your spreadsheet require a network connection

### Filling in data

#### Data about the media

The spreadsheet has a menu, "Fill Data", with an item "Fill Missing Data". That will look at each row in the
spreadsheet, and for each row with a barcode and any missing fields, it will query MusicBrainz for the missing data. It
will not overwrite anything you've added.

That task puts "??" in fields that are empty, or in every field if MusicBrainz doesn't have that barcode.

The free MusicBrainz API has a rate limit of 1 request per second, so the script waits 1 second before each request.

Google Sheets limits task run time to 6 minutes. It may take longer than that to fill in all your data, but since it
fills in missing data with "??", it will not request rows that have values. Run the script again as many times as you
need for it to finish.

#### Data about how desired it is

On that menu is also "Fetch Discogs Want Counts". This REQUIRES an API token from Discogs.com.
You can enter that easily with the "Set Discogs API Token" menu entry.

What it does is go through your spreadsheet, line by line, and if the 16th column (Q) is empty, it will ask discogs.com how many users on that site have said they would like a copy of that title in some format - not necessarily the format you have.

Discogs.com also has a rate limit, and the code respects that.

## Other notes

- If you have any issues or suggestions for improvement, please open an issue on the GitHub repository for this project

- Icons Created by Nicolas Ramallo from the Noun Project

- The code does not check for HTTP 429 responses, so if you reduce the delays in the code, expect that to go poorly.
