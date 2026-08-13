/* =========================================================
   P2P WEBRTC CONNECTION
   QR CODE + PEERJS
   ========================================================= */

let peer = null;
let connection = null;

let qrScanner = null;
let scannerRunning = false;

let isConnecting = false;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    setupButtons();

    setStatus(
        "info",
        "Loading..."
    );

    try {

        await loadPeerJS();

        createPeer();

    } catch (error) {

        console.error(
            "Initialization error:",
            error
        );

        setStatus(
            "error",
            "WebRTC library failed"
        );

        setText(
            "description",
            "Could not load PeerJS."
        );
    }
}


/* =========================================================
   BUTTONS
   ========================================================= */

function setupButtons() {

    const qrButton =
        document.getElementById(
            "show-qr-btn"
        );

    const scanButton =
        document.getElementById(
            "scan-qr-btn"
        );


    if (qrButton) {

        qrButton.addEventListener(
            "click",
            showQR
        );

    }


    if (scanButton) {

        scanButton.addEventListener(
            "click",
            showScanner
        );

    }
}


/* =========================================================
   LOAD PEERJS
   ========================================================= */

function loadPeerJS() {

    if (window.Peer) {

        return Promise.resolve();

    }


    return new Promise(
        (resolve, reject) => {

            const script =
                document.createElement(
                    "script"
                );


            script.src =
                "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";


            script.onload = () => {

                if (window.Peer) {

                    resolve();

                } else {

                    reject(
                        new Error(
                            "PeerJS is unavailable."
                        )
                    );

                }

            };


            script.onerror = () => {

                reject(
                    new Error(
                        "Unable to load PeerJS."
                    )
                );

            };


            document.head.appendChild(
                script
            );

        }
    );
}


/* =========================================================
   CREATE PEER
   ========================================================= */

function createPeer() {

    if (peer) {

        return;

    }


    peer = new Peer({

        config: {

            iceServers: [

                {
                    urls:
                        "stun:stun.l.google.com:19302"
                }

            ]

        },

        debug: 1

    });


    /* -----------------------------------------------------
       PEER READY
       ----------------------------------------------------- */

    peer.on(
        "open",
        id => {

            console.log(
                "Peer ID:",
                id
            );


            setText(
                "peer-id",
                id
            );


            generateQR(
                id
            );


            setStatus(
                "info",
                "Ready"
            );


            setText(
                "title",
                "Connect device"
            );


            setText(
                "description",
                "Show this QR code to the device that will connect."
            );

        }
    );


    /* -----------------------------------------------------
       INCOMING CONNECTION
       ----------------------------------------------------- */

    peer.on(
        "connection",
        incoming => {

            console.log(
                "Incoming connection:",
                incoming.peer
            );


            /*
             * This device owns the QR code.
             *
             * Therefore this device is
             * the receiver.
             */

            acceptIncomingConnection(
                incoming
            );

        }
    );


    /* -----------------------------------------------------
       PEER ERRORS
       ----------------------------------------------------- */

    peer.on(
        "error",
        error => {

            console.error(
                "Peer error:",
                error
            );


            switch (error.type) {

                case "peer-unavailable":

                    setStatus(
                        "error",
                        "Peer unavailable"
                    );

                    break;


                case "network":

                    setStatus(
                        "error",
                        "Signaling network error"
                    );

                    break;


                case "webrtc":

                    setStatus(
                        "error",
                        "WebRTC connection error"
                    );

                    break;


                default:

                    setStatus(
                        "error",
                        error.message ||
                        "Peer error"
                    );

            }

        }
    );


    peer.on(
        "disconnected",
        () => {

            setStatus(
                "error",
                "Disconnected from signaling"
            );

        }
    );


    peer.on(
        "close",
        () => {

            setStatus(
                "error",
                "Peer closed"
            );

        }
    );
}


/* =========================================================
   QR GENERATION
   ========================================================= */

function generateQR(
    peerId
) {

    const container =
        document.getElementById(
            "qrcode"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    if (!window.QRCode) {

        console.error(
            "QRCode library is missing."
        );


        setStatus(
            "error",
            "QR library unavailable"
        );


        return;

    }


    new QRCode(
        container,
        {

            text:
                peerId,

            width:
                220,

            height:
                220,

            colorDark:
                "#111111",

            colorLight:
                "#ffffff",

            correctLevel:
                QRCode.CorrectLevel.H

        }
    );
}


/* =========================================================
   SHOW QR
   ========================================================= */

function showQR() {

    const qrButton =
        document.getElementById(
            "show-qr-btn"
        );

    const scanButton =
        document.getElementById(
            "scan-qr-btn"
        );

    const qrSection =
        document.getElementById(
            "qr-section"
        );

    const scannerSection =
        document.getElementById(
            "scanner-section"
        );


    qrButton?.classList.add(
        "active"
    );


    scanButton?.classList.remove(
        "active"
    );


    qrSection?.classList.remove(
        "hidden"
    );


    scannerSection?.classList.add(
        "hidden"
    );


    stopScanner();


    setText(
        "title",
        "Connect device"
    );


    setText(
        "description",
        "Scan this QR code from another device to establish a connection."
    );


    if (
        peer &&
        peer.id
    ) {

        generateQR(
            peer.id
        );

    }
}


/* =========================================================
   SHOW SCANNER
   ========================================================= */

async function showScanner() {

    const qrButton =
        document.getElementById(
            "show-qr-btn"
        );

    const scanButton =
        document.getElementById(
            "scan-qr-btn"
        );

    const qrSection =
        document.getElementById(
            "qr-section"
        );

    const scannerSection =
        document.getElementById(
            "scanner-section"
        );


    qrButton?.classList.remove(
        "active"
    );


    scanButton?.classList.add(
        "active"
    );


    qrSection?.classList.add(
        "hidden"
    );


    scannerSection?.classList.remove(
        "hidden"
    );


    setText(
        "title",
        "Scan device"
    );


    setText(
        "description",
        "Scan the QR code displayed on the receiving device."
    );


    if (scannerRunning) {

        return;

    }


    if (!window.Html5Qrcode) {

        setStatus(
            "error",
            "QR scanner unavailable"
        );


        setText(
            "scanner-message",
            "html5-qrcode.min.js was not loaded."
        );


        return;

    }


    /*
     * Camera requires HTTPS or localhost.
     */

    const isHTTPS =
        location.protocol === "https:";

    const isLocalhost =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1";


    if (
        !isHTTPS &&
        !isLocalhost
    ) {

        setStatus(
            "error",
            "HTTPS required for camera"
        );


        setText(
            "scanner-message",
            "Camera access requires HTTPS or localhost."
        );


        return;

    }


    try {

        qrScanner =
            new Html5Qrcode(
                "reader"
            );


        scannerRunning = true;


        setText(
            "scanner-message",
            "Point the camera at the receiver QR code."
        );


        await qrScanner.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps:
                    10,

                qrbox:
                {
                    width:
                        220,

                    height:
                        220
                }

            },

            decodedText => {

                onQRCodeDetected(
                    decodedText
                );

            },

            () => {

                /*
                 * Ignore unsuccessful scans.
                 */

            }

        );


        setStatus(
            "info",
            "Scanning..."
        );


    } catch (error) {

        console.error(
            "Scanner error:",
            error
        );


        scannerRunning = false;

        qrScanner = null;


        setStatus(
            "error",
            "Camera failed"
        );


        setText(
            "scanner-message",
            "Could not start the camera."
        );

    }
}


/* =========================================================
   QR DETECTED
   ========================================================= */

async function onQRCodeDetected(
    text
) {

    const remotePeerId =
        String(
            text
        ).trim();


    if (!remotePeerId) {

        return;

    }


    if (
        isConnecting ||
        (
            connection &&
            connection.open
        )
    ) {

        return;

    }


    /*
     * Prevent multiple scanner callbacks.
     */

    isConnecting = true;


    setText(
        "scanner-message",
        "QR detected. Connecting..."
    );


    setStatus(
        "info",
        "Connecting..."
    );


    await stopScanner();


    connectToPeer(
        remotePeerId
    );
}


/* =========================================================
   CONNECT TO PEER
   ========================================================= */

function connectToPeer(
    remotePeerId
) {

    if (
        !peer ||
        peer.destroyed
    ) {

        isConnecting = false;


        setStatus(
            "error",
            "Peer is not ready"
        );


        return;

    }


    if (
        remotePeerId ===
        peer.id
    ) {

        isConnecting = false;


        setStatus(
            "error",
            "You scanned yourself"
        );


        return;

    }


    console.log(
        "Connecting to:",
        remotePeerId
    );


    /*
     * This device scanned the QR.
     *
     * Therefore this device is
     * the sender.
     */

    const newConnection =
        peer.connect(
            remotePeerId,
            {

                reliable:
                    true,

                serialization:
                    "binary",

                label:
                    "p2p-connection"

            }
        );


    connection =
        newConnection;


    connection.on(
        "open",
        () => {

            console.log(
                "WebRTC data connection OPEN"
            );


            isConnecting = false;


            showConnectionResult(
                remotePeerId
            );


            setStatus(
                "connected",
                "Connected"
            );


            setText(
                "title",
                "Connected"
            );


            setText(
                "description",
                "Connection established."
            );

        }
    );


    connection.on(
        "data",
        data => {

            console.log(
                "Data received:",
                data
            );

        }
    );


    connection.on(
        "close",
        () => {

            console.log(
                "Connection closed."
            );


            setStatus(
                "info",
                "Connection closed"
            );

        }
    );


    connection.on(
        "error",
        error => {

            console.error(
                "Data connection error:",
                error
            );


            isConnecting = false;


            setStatus(
                "error",
                error.message ||
                "Connection failed"
            );

        }
    );
}


/* =========================================================
   ACCEPT INCOMING CONNECTION
   ========================================================= */

function acceptIncomingConnection(
    incomingConnection
) {

    if (
        connection &&
        connection.open
    ) {

        incomingConnection.close();

        return;

    }


    connection =
        incomingConnection;


    console.log(
        "Incoming connection object created."
    );


    connection.on(
        "open",
        () => {

            console.log(
                "Incoming WebRTC connection OPEN"
            );


            showConnectionResult(
                connection.peer
            );


            setStatus(
                "connected",
                "Connected"
            );


            setText(
                "title",
                "Connected"
            );


            setText(
                "description",
                "Connection established. Opening preview..."
            );


            /*
             * IMPORTANT:
             *
             * This device is the receiver.
             *
             * Open preview.html automatically.
             */

            openPreviewPage(
                connection.peer
            );

        }
    );


    connection.on(
        "data",
        data => {

            /*
             * Keep the connection alive.
             *
             * preview.html can create its own
             * connection if required.
             */

            console.log(
                "Data received:",
                data
            );

        }
    );


    connection.on(
        "close",
        () => {

            setStatus(
                "info",
                "Sender disconnected"
            );

        }
    );


    connection.on(
        "error",
        error => {

            console.error(
                "Incoming connection error:",
                error
            );


            setStatus(
                "error",
                error.message ||
                "Connection error"
            );

        }
    );
}


/* =========================================================
   OPEN PREVIEW PAGE
   ========================================================= */

function openPreviewPage(
    remotePeerId
) {

    const peerId =
        encodeURIComponent(
            String(
                remotePeerId ||
                ""
            )
        );


    console.log(
        "Opening preview.html"
    );


    console.log(
        "Remote peer:",
        remotePeerId
    );


    /*
     * Pass the sender's PeerJS ID
     * to preview.html.
     */

    const previewURL =
        peerId
            ? `preview.html?peer=${peerId}`
            : "preview.html";


    /*
     * Small delay to allow the
     * connected state to update.
     */

    setTimeout(
        () => {

            window.location.href =
                previewURL;

        },
        300
    );
}


/* =========================================================
   CONNECTION RESULT
   ========================================================= */

function showConnectionResult(
    remotePeerId
) {

    const result =
        document.getElementById(
            "connection-result"
        );


    const remote =
        document.getElementById(
            "connected-peer"
        );


    if (remote) {

        remote.textContent =
            remotePeerId;

    }


    result?.classList.remove(
        "hidden"
    );
}


/* =========================================================
   STOP QR SCANNER
   ========================================================= */

async function stopScanner() {

    if (
        !qrScanner ||
        !scannerRunning
    ) {

        return;

    }


    try {

        await qrScanner.stop();

    } catch (error) {

        console.warn(
            "Scanner stop:",
            error
        );

    }


    try {

        await qrScanner.clear();

    } catch (error) {

        console.warn(
            "Scanner clear:",
            error
        );

    }


    qrScanner = null;

    scannerRunning = false;
}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(
    type,
    text
) {

    const dot =
        document.getElementById(
            "status-dot"
        );


    const status =
        document.getElementById(
            "status-text"
        );


    if (status) {

        status.textContent =
            text;

    }


    if (dot) {

        dot.classList.toggle(
            "connected",
            type === "connected"
        );

    }
}


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }
}