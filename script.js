/* =========================================================
   P2P WEBRTC FILE TRANSFER
   QR CODE + PEERJS
   ========================================================= */

let peer = null;
let connection = null;

let qrScanner = null;
let scannerRunning = false;

let isConnecting = false;


/* =========================================================
   FILE TRANSFER SETTINGS
   ========================================================= */

const CHUNK_SIZE = 16 * 1024;

let selectedFile = null;

let incomingFile = null;
let incomingChunks = [];
let incomingBytes = 0;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    setupButtons();
    setupFileTransfer();

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
             * Therefore this device is the receiver.
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
                /* Ignore unsuccessful scans */
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
                    "p2p-file-transfer"

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
                "Connection established. Select a file to send."
            );


            showFileTransfer();

        }
    );


    connection.on(
        "data",
        data => {

            handleIncomingData(
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
                "Connection established. Waiting for a file..."
            );


            /*
             * IMPORTANT:
             *
             * Do NOT redirect to preview.html here.
             *
             * The receiver must keep this page open
             * so the WebRTC connection remains active.
             */

            showFileTransfer();

        }
    );


    connection.on(
        "data",
        data => {

            handleIncomingData(
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
   FILE TRANSFER UI
   ========================================================= */

function setupFileTransfer() {

    const fileInput =
        document.getElementById(
            "file-input"
        );

    const selectButton =
        document.getElementById(
            "select-file-btn"
        );

    const dropZone =
        document.getElementById(
            "drop-zone"
        );


    if (!fileInput || !selectButton || !dropZone) {
        return;
    }


    selectButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            fileInput.click();

        }
    );


    dropZone.addEventListener(
        "click",
        event => {

            if (
                event.target === selectButton
            ) {
                return;
            }

            fileInput.click();

        }
    );


    fileInput.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (file) {
                prepareFile(file);
            }

        }
    );


    dropZone.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            dropZone.classList.add(
                "dragover"
            );

        }
    );


    dropZone.addEventListener(
        "dragleave",
        event => {

            event.preventDefault();

            dropZone.classList.remove(
                "dragover"
            );

        }
    );


    dropZone.addEventListener(
        "drop",
        event => {

            event.preventDefault();

            dropZone.classList.remove(
                "dragover"
            );


            const file =
                event.dataTransfer.files?.[0];

            if (file) {
                prepareFile(file);
            }

        }
    );
}


/* =========================================================
   SHOW FILE UI
   ========================================================= */

function showFileTransfer() {

    const transfer =
        document.getElementById(
            "file-transfer"
        );


    transfer?.classList.remove(
        "hidden"
    );
}


/* =========================================================
   PREPARE FILE
   ========================================================= */

function prepareFile(
    file
) {

    if (
        !connection ||
        !connection.open
    ) {

        setStatus(
            "error",
            "Not connected"
        );

        return;
    }


    selectedFile =
        file;


    const fileInfo =
        document.getElementById(
            "file-info"
        );


    const fileName =
        document.getElementById(
            "file-name"
        );


    const fileSize =
        document.getElementById(
            "file-size"
        );


    const progress =
        document.getElementById(
            "transfer-progress"
        );


    const status =
        document.getElementById(
            "transfer-status"
        );


    const received =
        document.getElementById(
            "received-file"
        );


    fileInfo?.classList.remove(
        "hidden"
    );


    received?.classList.add(
        "hidden"
    );


    if (fileName) {
        fileName.textContent =
            file.name;
    }


    if (fileSize) {
        fileSize.textContent =
            formatBytes(file.size);
    }


    if (progress) {
        progress.style.width =
            "0%";
    }


    if (status) {
        status.textContent =
            "Starting transfer...";
    }


    sendFile(
        file
    );
}


/* =========================================================
   SEND FILE
   ========================================================= */

async function sendFile(
    file
) {

    if (
        !connection ||
        !connection.open
    ) {

        setStatus(
            "error",
            "Connection unavailable"
        );

        return;
    }


    console.log(
        "Sending file:",
        file.name,
        file.size
    );


    try {

        /*
         * Send metadata first.
         */

        connection.send({

            type:
                "file-start",

            name:
                file.name,

            size:
                file.size,

            mime:
                file.type ||
                "application/octet-stream"

        });


        let offset = 0;


        while (
            offset <
            file.size
        ) {

            const slice =
                file.slice(
                    offset,
                    offset +
                    CHUNK_SIZE
                );


            const buffer =
                await slice.arrayBuffer();


            await waitForDataChannel();


            connection.send(
                buffer
            );


            offset +=
                buffer.byteLength;


            const percentage =
                Math.min(
                    100,
                    (
                        offset /
                        file.size
                    ) * 100
                );


            updateProgress(
                percentage,
                `Sending ${Math.round(percentage)}%`
            );

        }


        /*
         * Tell receiver that all chunks
         * have been sent.
         */

        connection.send({

            type:
                "file-end"

        });


        updateProgress(
            100,
            "Transfer complete"
        );


        console.log(
            "File sent successfully."
        );


    } catch (error) {

        console.error(
            "File send error:",
            error
        );


        updateProgress(
            0,
            "Transfer failed"
        );

    }
}


/* =========================================================
   DATA CHANNEL BACKPRESSURE
   ========================================================= */

async function waitForDataChannel() {

    if (
        !connection ||
        !connection.dataChannel
    ) {
        return;
    }


    const channel =
        connection.dataChannel;


    /*
     * Prevent the browser's WebRTC
     * send buffer from growing too much.
     */

    while (
        channel.bufferedAmount >
        1024 * 1024
    ) {

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    20
                )
        );

    }
}


/* =========================================================
   RECEIVE DATA
   ========================================================= */

function handleIncomingData(
    data
) {

    /*
     * Metadata / control messages.
     */

    if (
        data &&
        typeof data === "object" &&
        !ArrayBuffer.isView(data) &&
        !(data instanceof ArrayBuffer) &&
        !(data instanceof Blob)
    ) {

        if (
            data.type ===
            "file-start"
        ) {

            startIncomingFile(
                data
            );

            return;
        }


        if (
            data.type ===
            "file-end"
        ) {

            finishIncomingFile();

            return;
        }

    }


    /*
     * Binary chunk.
     */

    if (
        data instanceof ArrayBuffer
    ) {

        receiveFileChunk(
            data
        );

        return;
    }


    /*
     * Some browsers / PeerJS configurations
     * can deliver binary data as Blob.
     */

    if (
        data instanceof Blob
    ) {

        data.arrayBuffer()
            .then(
                buffer =>
                    receiveFileChunk(
                        buffer
                    )
            );

    }

}


/* =========================================================
   START RECEIVING FILE
   ========================================================= */

function startIncomingFile(
    metadata
) {

    incomingFile = {

        name:
            metadata.name,

        size:
            metadata.size,

        mime:
            metadata.mime ||
            "application/octet-stream"

    };


    incomingChunks = [];

    incomingBytes = 0;


    const fileInfo =
        document.getElementById(
            "file-info"
        );


    const fileName =
        document.getElementById(
            "file-name"
        );


    const fileSize =
        document.getElementById(
            "file-size"
        );


    const received =
        document.getElementById(
            "received-file"
        );


    fileInfo?.classList.remove(
        "hidden"
    );


    received?.classList.add(
        "hidden"
    );


    if (fileName) {

        fileName.textContent =
            incomingFile.name;

    }


    if (fileSize) {

        fileSize.textContent =
            formatBytes(
                incomingFile.size
            );

    }


    updateProgress(
        0,
        "Receiving 0%"
    );


    console.log(
        "Receiving file:",
        incomingFile
    );
}


/* =========================================================
   RECEIVE CHUNK
   ========================================================= */

function receiveFileChunk(
    buffer
) {

    if (!incomingFile) {
        return;
    }


    incomingChunks.push(
        buffer
    );


    incomingBytes +=
        buffer.byteLength;


    const percentage =
        Math.min(
            100,
            (
                incomingBytes /
                incomingFile.size
            ) * 100
        );


    updateProgress(
        percentage,
        `Receiving ${Math.round(percentage)}%`
    );
}


/* =========================================================
   FINISH RECEIVING
   ========================================================= */

function finishIncomingFile() {

    if (!incomingFile) {
        return;
    }


    console.log(
        "File transfer finished."
    );


    const blob =
        new Blob(
            incomingChunks,
            {
                type:
                    incomingFile.mime
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const received =
        document.getElementById(
            "received-file"
        );


    const receivedName =
        document.getElementById(
            "received-file-name"
        );


    const download =
        document.getElementById(
            "download-file"
        );


    const preview =
        document.getElementById(
            "preview-file"
        );


    received?.classList.remove(
        "hidden"
    );


    if (receivedName) {

        receivedName.textContent =
            incomingFile.name;

    }


    if (download) {

        download.href =
            url;

        download.download =
            incomingFile.name;

    }


    if (preview) {

        preview.href =
            url;

    }


    updateProgress(
        100,
        "File received"
    );


    /*
     * Free the individual chunks.
     */

    incomingChunks = [];

    incomingFile = null;

    incomingBytes = 0;
}


/* =========================================================
   PROGRESS
   ========================================================= */

function updateProgress(
    percentage,
    text
) {

    const progress =
        document.getElementById(
            "transfer-progress"
        );


    const status =
        document.getElementById(
            "transfer-status"
        );


    if (progress) {

        progress.style.width =
            `${percentage}%`;

    }


    if (status) {

        status.textContent =
            text;

    }
}


/* =========================================================
   FORMAT BYTES
   ========================================================= */

function formatBytes(
    bytes
) {

    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
    ) {
        return "0 Bytes";
    }


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB",
        "TB"
    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        `${(
            bytes /
            Math.pow(
                1024,
                index
            )
        ).toFixed(index === 0 ? 0 : 2)} ${units[index]}`
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