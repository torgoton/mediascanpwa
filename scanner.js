const GS_APP_ID = ENV['GS_APP_ID'] || null;

if (!GS_APP_ID) {
  alert('Google Sheets App ID is not set. Please set GS_APP_ID in your environment variables.');
  throw new Error('Missing GS_APP_ID environment variable');
}

let videoStream = null;
let scanning = false;
let barcodeDetector = null;
let currentCDData = null;

const video = document.getElementById('video');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const errorMessage = document.getElementById('error-message');
const scannedCodes = document.getElementById('scanned-codes');
const resultDialog = document.getElementById('result-dialog');
const dialogInfo = document.getElementById('dialog-info');
const scanAnotherButton = document.getElementById('scan-another-button');
const appendSheetButton = document.getElementById('append-sheet-button');

const aboutButton = document.getElementById('about-button');
const aboutDialog = document.getElementById('about-dialog');
const aboutCloseButton = document.getElementById('about-close-button');


async function checkBarcodeDetectorSupport() {
    if (!('BarcodeDetector' in window)) {
        showError('BarcodeDetector API is not supported in this browser. Please use Chrome 83+ or Edge 83+.');
        startButton.disabled = true;
        return false;
    }
    
    try {
        const formats = await BarcodeDetector.getSupportedFormats();
        console.log('Supported barcode formats:', formats);
        
        if (!formats.includes('ean_13') && !formats.includes('upc_a') && !formats.includes('upc_e')) {
            showError('UPC/EAN barcode formats are not supported.');
            return false;
        }
        
        return true;
    } catch (error) {
        showError('Error checking barcode support: ' + error.message);
        return false;
    }
}

// Initialize the barcode detector
async function initBarcodeDetector() {
    try {
        barcodeDetector = new BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e']
        });
        return true;
    } catch (error) {
        showError('Failed to initialize barcode detector: ' + error.message);
        return false;
    }
}

// Start camera
async function startCamera() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = videoStream;
        return true;
    } catch (error) {
        showError('Camera access denied or not available: ' + error.message);
        return false;
    }
}

// Stop camera
function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        video.srcObject = null;
    }
}

// Scan for barcodes
async function scanBarcode() {
    if (!scanning || !barcodeDetector) return;
    
    try {
        const barcodes = await barcodeDetector.detect(video);
        
        if (barcodes.length > 0) {
            const barcode = barcodes[0];
            stopScanning();
            addScannedCode(barcode.rawValue, barcode.format);
            await lookupCD(barcode.rawValue);
            return;
        }
    } catch (error) {
        console.error('Scan error:', error);
    }
    
    if (scanning) {
        requestAnimationFrame(scanBarcode);
    }
}

// Add scanned code to results
function addScannedCode(code, format) {
    const timestamp = new Date().toLocaleString();
    const codeElement = document.createElement('div');
    codeElement.className = 'scanned-code';
    codeElement.innerHTML = `
        <strong>${code}</strong>
        <span class="format">${format}</span>
        <span class="timestamp">${timestamp}</span>
    `;
    scannedCodes.insertBefore(codeElement, scannedCodes.firstChild);
}

// Look up CD information using MusicBrainz API
async function lookupCD(barcode) {
    dialogInfo.innerHTML = '<div>Looking up information...</div>';
    resultDialog.classList.remove('hidden');
    appendSheetButton.disabled = true;
    currentCDData = null;
    
    try {
        const response = await fetch(
            `https://musicbrainz.org/ws/2/release?query=barcode:${barcode}&fmt=json&inc=release-groups`,
            {
                headers: {
                    'User-Agent': 'UPCScanner/1.0'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        
        if (data.releases && data.releases.length > 0) {
            const release = data.releases[0];
            const artist = release['artist-credit']?.[0]?.name || 'Unknown Artist';
            const title = release.title || 'Unknown Title';
            const date = release.date || 'Unknown Date';
            const format = release.media?.[0]?.format || 'Unknown';
            const catalogNumber = release['label-info']?.[0]?.['catalog-number'] || 'Unknown';
            const label = release['label-info']?.[0]?.label?.name || 'Unknown';
            const packaging = release.packaging || 'Unknown';
            const primaryType = release['release-group']?.['primary-type'] || 'Unknown';
            const country = release.country || 'Unknown';
            
            currentCDData = {
                barcode: barcode,
                artist: artist,
                album: title,
                releaseDate: date,
                format: format,
                label: label,
                catalogNumber: catalogNumber,
                packaging: packaging,
                primaryType: primaryType,
                country: country
            };
            
            dialogInfo.innerHTML = `
                <div class="cd-info"><strong>Barcode:</strong> ${barcode}</div>
                <div class="cd-info"><strong>Artist:</strong> ${artist}</div>
                <div class="cd-info"><strong>Album:</strong> ${title}</div>
                <div class="cd-info"><strong>Format:</strong> ${format}</div>
                <div class="cd-info"><strong>Label:</strong> ${label}</div>
                <div class="cd-info"><strong>Catalog #:</strong> ${catalogNumber}</div>
                <div class="cd-info"><strong>Packaging:</strong> ${packaging}</div>
                <div class="cd-info"><strong>Type:</strong> ${primaryType}</div>
                <div class="cd-info"><strong>Country:</strong> ${country}</div>
                <div class="cd-info"><strong>Release:</strong> ${date}</div>
            `;
            
            appendSheetButton.disabled = false;
        } else {
            currentCDData = {
                barcode: barcode,
                artist: 'Unknown',
                album: 'Unknown',
                releaseDate: 'Unknown',
                format: 'Unknown',
                label: 'Unknown',
                catalogNumber: 'Unknown',
                packaging: 'Unknown',
                primaryType: 'Unknown',
                country: 'Unknown'
            };
            
            dialogInfo.innerHTML = `
                <div class="cd-info"><strong>Barcode:</strong> ${barcode}</div>
                <div class="cd-info">No entry found for this barcode</div>
            `;
            
            appendSheetButton.disabled = false;
        }
    } catch (error) {
        console.error('Lookup error:', error);
        
        currentCDData = {
            barcode: barcode,
            artist: 'Unknown',
            album: 'Unknown',
            releaseDate: 'Unknown',
            format: 'Unknown',
            label: 'Unknown',
            catalogNumber: 'Unknown',
            packaging: 'Unknown',
            primaryType: 'Unknown',
            country: 'Unknown'
        };
        
        dialogInfo.innerHTML = `
            <div class="cd-info"><strong>Barcode:</strong> ${barcode}</div>
            <div class="cd-info">Failed to lookup CD information</div>
        `;
        
        appendSheetButton.disabled = false;
    }
}

// Add CD data to Google Sheet
async function addToGoogleSheet(cdData) {
    try {
        const response = await fetch('https://script.google.com/macros/s/' + GS_APP_ID + '/exec', {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cdData)
        });
        
        console.log('CD data added to Google Sheet');
    } catch (error) {
        console.error('Failed to add to Google Sheet:', error);
    }
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

// Hide error message
function hideError() {
    errorMessage.classList.add('hidden');
}

// Start scanning
async function startScanning() {
    hideError();
    
    if (!barcodeDetector) {
        const initialized = await initBarcodeDetector();
        if (!initialized) return;
    }
    
    const cameraStarted = await startCamera();
    if (!cameraStarted) return;
    
    scanning = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    
    requestAnimationFrame(scanBarcode);
}

// Stop scanning
function stopScanning() {
    scanning = false;
    stopCamera();
    startButton.disabled = false;
    stopButton.disabled = true;
}

// Event listeners
startButton.addEventListener('click', startScanning);
stopButton.addEventListener('click', stopScanning);

appendSheetButton.addEventListener('click', async () => {
    if (currentCDData) {
        appendSheetButton.disabled = true;
        appendSheetButton.textContent = 'Adding...';
        await addToGoogleSheet(currentCDData);
        appendSheetButton.textContent = 'Added ✓';
    }
});

scanAnotherButton.addEventListener('click', () => {
    resultDialog.classList.add('hidden');
    appendSheetButton.textContent = 'Append Spreadsheet';
    startScanning();
});

aboutButton.addEventListener('click', () => aboutDialog.classList.remove('hidden'));
aboutCloseButton.addEventListener('click', () => aboutDialog.classList.add('hidden'));

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    themeToggle.textContent = isLight ? '🌙 Dark' : '☀️ Light';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light');
    themeToggle.textContent = '🌙 Dark';
}

// Initialize on page load
(async function init() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js');
    }
    
    const supported = await checkBarcodeDetectorSupport();
    if (supported) {
        console.log('BarcodeDetector is ready to use');
    }
})();
