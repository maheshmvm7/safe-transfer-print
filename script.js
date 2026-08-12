const qrSection = document.getElementById("qr-section");
const scannerSection = document.getElementById("scanner-section");

const showQrBtn = document.getElementById("show-qr-btn");
const scanQrBtn = document.getElementById("scan-qr-btn");

const peerIdElement = document.getElementById("peer-id");

const title = document.getElementById("title");
const description = document.getElementById("description");

const statusText = document.getElementById("status-text");
const statusDot = document.getElementById("status-dot");

const connectionResult =
    document.getElementById("connection-result");

const connectedPeer =
    document.getElementById("connected-peer");

const scannerMessage =
    document.getElementById("scanner-message");


let scanner = null;
let scannerRunning = false;


/*
    Generate random peer ID
*/

function generatePeerId() {

    const randomPart =
        crypto.randomUUID()
        .replaceAll("-", "")
        .substring(0, 12)
        .toUpperCase();

    return `P2P-${randomPart}`;
}


/*
    Create QR code
*/

function generateQRCode() {

    const peerId = generatePeerId();

    peerIdElement.textContent = peerId;

    const qrContainer =
        document.getElementById("qrcode");

    qrContainer.innerHTML = "";

    new QRCode(qrContainer, {
        text: peerId,
        width: 220,
        height: 220,
        colorDark: "#111111",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
    });

    console.log("Local Peer ID:", peerId);
}


/*
    Set status
*/

function setStatus(text, connected = false) {

    statusText.textContent = text;

    statusDot.classList.toggle(
        "connected",
        connected
    );
}


/*
    Show QR mode
*/

async function showQR() {

    await stopScanner();

    showQrBtn.classList.add("active");
    scanQrBtn.classList.remove("active");

    qrSection.classList.remove("hidden");
    scannerSection.classList.add("hidden");

    connectionResult.classList.add("hidden");

    title.textContent = "Connect device";

    description.textContent =
        "Scan this QR code from another device to establish a connection.";

    setStatus("Waiting");

    generateQRCode();
}


/*
    Show scanner mode
*/

async function showScanner() {

    showQrBtn.classList.remove("active");
    scanQrBtn.classList.add("active");

    qrSection.classList.add("hidden");
    scannerSection.classList.remove("hidden");

    connectionResult.classList.add("hidden");

    title.textContent = "Scan device";

    description.textContent =
        "Use your camera to scan the QR code displayed on the other device.";

    setStatus("Scanning");

    startScanner();
}


/*
    Start camera scanner
*/

async function startScanner() {

    if (scannerRunning) {
        return;
    }

    scannerMessage.textContent =
        "Requesting camera permission...";

    try {

        // Explicitly request camera permission first
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: {
                    ideal: "environment"
                }
            },
            audio: false
        });

        // We only needed this to obtain permission.
        // html5-qrcode will create its own stream.
        stream.getTracks().forEach(track => track.stop());

        scanner = new Html5Qrcode("reader");

        const cameras =
            await Html5Qrcode.getCameras();

        if (!cameras || cameras.length === 0) {

            scannerMessage.textContent =
                "No camera was detected on this device.";

            setStatus("No camera");

            return;
        }

        // Prefer the rear/environment camera when available
        let cameraId = cameras[0].id;

        const rearCamera = cameras.find(camera =>
            /back|rear|environment/i.test(camera.label)
        );

        if (rearCamera) {
            cameraId = rearCamera.id;
        }

        await scanner.start(
            cameraId,

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                },

                aspectRatio: 1
            },

            onScanSuccess,

            onScanFailure
        );

        scannerRunning = true;

        scannerMessage.textContent =
            "Point the camera at the QR code.";

        setStatus("Scanning");

    } catch (error) {

        console.error("Camera error:", error);

        if (error.name === "NotAllowedError") {

            scannerMessage.textContent =
                "Camera permission was denied. Allow camera access for this site.";

        } else if (error.name === "NotFoundError") {

            scannerMessage.textContent =
                "No camera was found on this device.";

        } else if (error.name === "NotReadableError") {

            scannerMessage.textContent =
                "The camera is already being used by another application.";

        } else if (error.name === "SecurityError") {

            scannerMessage.textContent =
                "Camera access was blocked by the browser.";

        } else {

            scannerMessage.textContent =
                "Unable to access the camera. Check browser permissions.";

        }

        setStatus("Camera unavailable");
    }
}
/*
    QR scan success
*/

async function onScanSuccess(decodedText) {

    console.log("QR detected:", decodedText);

    await stopScanner();

    connectedPeer.textContent = decodedText;

    connectionResult.classList.remove("hidden");

    scannerMessage.textContent =
        "Device detected.";

    setStatus("Connected", true);

    title.textContent = "Device found";

    description.textContent =
        "The QR handshake has been completed.";
}


/*
    QR scan failure

    This intentionally does nothing because
    the scanner calls this continuously while
    looking for a QR code.
*/

function onScanFailure(error) {
    // Ignore normal scanning failures
}


/*
    Stop scanner
*/

async function stopScanner() {

    if (!scanner || !scannerRunning) {
        return;
    }

    try {

        await scanner.stop();

        scanner.clear();

    } catch (error) {

        console.error(
            "Scanner stop error:",
            error
        );

    }

    scannerRunning = false;
    scanner = null;
}


/*
    Toggle buttons
*/

showQrBtn.addEventListener(
    "click",
    showQR
);

scanQrBtn.addEventListener(
    "click",
    showScanner
);


/*
    Generate initial QR
*/

generateQRCode();