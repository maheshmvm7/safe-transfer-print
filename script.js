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
   FILE TRANSFER
   ========================================================= */

const CHUNK_SIZE = 16 * 1024;

let selectedFile = null;

let incomingFile = null;
let incomingChunks = [];
let incomingBytes = 0;

let receivedObjectURL = null;


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

    setStatus("info", "Loading...");

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
        document.getElementById("show-qr-btn");

    const scanButton =
        document.getElementById("scan-qr-btn");


    qrButton?.addEventListener(
        "click",
        showQR
    );


    scanButton?.addEventListener(
        "click",
        showScanner
    );
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
                document.createElement("script");

            script.src =
                "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";


            script.onload = () => {

                if (window.Peer) {
                    resolve();
                } else {
                    reject(
                        new Error(
                            "PeerJS unavailable"
                        )
                    );
                }

            };


            script.onerror = () => {

                reject(
                    new Error(
                        "Unable to load PeerJS"
                    )
                );

            };


            document.head.appendChild(script);
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
       PEER OPEN
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


            generateQR(id);


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


            acceptIncomingConnection(
                incoming
            );
        }
    );


    /* -----------------------------------------------------
       PEER ERROR
       ----------------------------------------------------- */

    peer.on(
        "error",
        error => {

            console.error(
                "Peer error:",
                error
            );


            setStatus(
                "error",
                error.message ||
                "Peer error"
            );
        }
    );


    peer.on(
        "disconnected",
        () => {

            setStatus(
                "error",
                "Disconnected"
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

function generateQR(peerId) {

    const container =
        document.getElementById("qrcode");


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (!window.QRCode) {

        setStatus(
            "error",
            "QR library unavailable"
        );

        return;
    }


    new QRCode(
        container,
        {
            text: peerId,
            width: 220,
            height: 220,
            colorDark: "#111111",
            colorLight: "#ffffff",
            correctLevel:
                QRCode.CorrectLevel.H
        }
    );
}


/* =========================================================
   SHOW QR
   ========================================================= */

function showQR() {

    document
        .getElementById("show-qr-btn")
        ?.classList.add("active");


    document
        .getElementById("scan-qr-btn")
        ?.classList.remove("active");


    document
        .getElementById("qr-section")
        ?.classList.remove("hidden");


    document
        .getElementById("scanner-section")
        ?.classList.add("hidden");


    stopScanner();


    setText(
        "title",
        "Connect device"
    );


    setText(
        "description",
        "Scan this QR code from another device to establish a connection."
    );


    if (peer?.id) {
        generateQR(peer.id);
    }
}


/* =========================================================
   SHOW SCANNER
   ========================================================= */

async function showScanner() {

    document
        .getElementById("show-qr-btn")
        ?.classList.remove("active");


    document
        .getElementById("scan-qr-btn")
        ?.classList.add("active");


    document
        .getElementById("qr-section")
        ?.classList.add("hidden");


    document
        .getElementById("scanner-section")
        ?.classList.remove("hidden");


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

        return;
    }


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
            new Html5Qrcode("reader");


        scannerRunning = true;


        await qrScanner.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 220,
                    height: 220
                }
            },

            decodedText => {

                onQRCodeDetected(
                    decodedText
                );
            },

            () => {}
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
    }
}


/* =========================================================
   QR DETECTED
   ========================================================= */

async function onQRCodeDetected(text) {

    const remotePeerId =
        String(text).trim();


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

function connectToPeer(remotePeerId) {

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
        remotePeerId === peer.id
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
     * THIS DEVICE = SENDER
     */

    connection =
        peer.connect(
            remotePeerId,
            {
                reliable: true,
                serialization: "binary",
                label: "p2p-file-transfer"
            }
        );


    attachConnectionEvents(
        connection,
        remotePeerId,
        true
    );
}


/* =========================================================
   ACCEPT CONNECTION
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


    /*
     * THIS DEVICE = RECEIVER
     */

    connection =
        incomingConnection;


    attachConnectionEvents(
        connection,
        incomingConnection.peer,
        false
    );
}


/* =========================================================
   CONNECTION EVENTS
   ========================================================= */

function attachConnectionEvents(
    conn,
    remotePeerId,
    isSender
) {

    conn.on(
        "open",
        () => {

            console.log(
                "WebRTC connection OPEN"
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


            if (isSender) {

                setText(
                    "description",
                    "Connection established. Select a file to send."
                );

            } else {

                setText(
                    "description",
                    "Connection established. Waiting for a file..."
                );

            }


            showFileTransfer();
        }
    );


    conn.on(
        "data",
        data => {

            console.log(
                "Received data:",
                data
            );


            handleIncomingData(
                data
            );
        }
    );


    conn.on(
        "close",
        () => {

            console.log(
                "Connection closed"
            );


            setStatus(
                "info",
                "Connection closed"
            );
        }
    );


    conn.on(
        "error",
        error => {

            console.error(
                "Connection error:",
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
   FILE UI
   ========================================================= */

function setupFileTransfer() {

    const fileInput =
        document.getElementById("file-input");

    const selectButton =
        document.getElementById("select-file-btn");

    const dropZone =
        document.getElementById("drop-zone");


    if (
        !fileInput ||
        !selectButton ||
        !dropZone
    ) {
        console.warn(
            "File transfer HTML not found"
        );

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
   SHOW FILE TRANSFER
   ========================================================= */

function showFileTransfer() {

    document
        .getElementById("file-transfer")
        ?.classList.remove("hidden");
}


/* =========================================================
   PREPARE FILE
   ========================================================= */

function prepareFile(file) {

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


    selectedFile = file;


    document
        .getElementById("file-info")
        ?.classList.remove("hidden");


    document
        .getElementById("received-file")
        ?.classList.add("hidden");


    setText(
        "file-name",
        file.name
    );


    setText(
        "file-size",
        formatBytes(file.size)
    );


    updateProgress(
        0,
        "Preparing file..."
    );


    sendFile(file);
}


/* =========================================================
   SEND FILE
   ========================================================= */

async function sendFile(file) {

    try {

        console.log(
            "Starting file transfer:",
            file.name,
            file.size,
            file.type
        );


        /*
         * Send metadata.
         */

        connection.send({
            type: "file-start",
            name: file.name,
            size: file.size,
            mime:
                file.type ||
                "application/octet-stream"
        });


        let offset = 0;


        while (
            offset <
            file.size
        ) {

            const end =
                Math.min(
                    offset + CHUNK_SIZE,
                    file.size
                );


            const slice =
                file.slice(
                    offset,
                    end
                );


            const buffer =
                await slice.arrayBuffer();


            /*
             * IMPORTANT:
             *
             * Convert to Uint8Array.
             * This avoids inconsistent binary
             * handling between PeerJS/browser versions.
             */

            const chunk =
                new Uint8Array(buffer);


            await waitForBuffer();


            connection.send(
                chunk
            );


            offset +=
                chunk.byteLength;


            const percent =
                (
                    offset /
                    file.size
                ) * 100;


            updateProgress(
                percent,
                `Sending ${Math.floor(percent)}%`
            );
        }


        /*
         * Wait until the data channel
         * has drained before sending
         * the final message.
         */

        await waitForBuffer(true);


        connection.send({
            type: "file-end"
        });


        updateProgress(
            100,
            "File sent successfully"
        );


        console.log(
            "FILE SENT:",
            file.name
        );


    } catch (error) {

        console.error(
            "File transfer failed:",
            error
        );


        updateProgress(
            0,
            "File transfer failed"
        );
    }
}


/* =========================================================
   DATA CHANNEL BUFFER
   ========================================================= */

async function waitForBuffer(
    finalWait = false
) {

    if (
        !connection ||
        !connection.dataChannel
    ) {
        return;
    }


    const channel =
        connection.dataChannel;


    const limit =
        finalWait
            ? 0
            : 512 * 1024;


    while (
        channel.bufferedAmount >
        limit
    ) {

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    10
                )
        );
    }
}


/* =========================================================
   RECEIVE DATA
   ========================================================= */

async function handleIncomingData(data) {

    /*
     * CONTROL MESSAGE
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
     * ARRAY BUFFER
     */

    if (
        data instanceof ArrayBuffer
    ) {

        receiveChunk(
            data
        );

        return;
    }


    /*
     * UINT8ARRAY / TYPED ARRAY
     */

    if (
        ArrayBuffer.isView(data)
    ) {

        const buffer =
            data.buffer.slice(
                data.byteOffset,
                data.byteOffset +
                data.byteLength
            );


        receiveChunk(
            buffer
        );

        return;
    }


    /*
     * BLOB
     */

    if (
        data instanceof Blob
    ) {

        const buffer =
            await data.arrayBuffer();


        receiveChunk(
            buffer
        );

        return;
    }


    console.warn(
        "Unknown incoming data:",
        data
    );
}


/* =========================================================
   START INCOMING FILE
   ========================================================= */

function startIncomingFile(metadata) {

    console.log(
        "FILE START:",
        metadata
    );


    incomingFile = {

        name:
            metadata.name,

        size:
            Number(metadata.size),

        mime:
            metadata.mime ||
            "application/octet-stream"
    };


    incomingChunks = [];

    incomingBytes = 0;


    document
        .getElementById("file-info")
        ?.classList.remove("hidden");


    document
        .getElementById("received-file")
        ?.classList.add("hidden");


    setText(
        "file-name",
        incomingFile.name
    );


    setText(
        "file-size",
        formatBytes(
            incomingFile.size
        )
    );


    updateProgress(
        0,
        "Receiving 0%"
    );
}


/* =========================================================
   RECEIVE CHUNK
   ========================================================= */

function receiveChunk(buffer) {

    if (!incomingFile) {

        console.warn(
            "Received chunk without file metadata"
        );

        return;
    }


    /*
     * Store an actual Uint8Array.
     */

    const chunk =
        new Uint8Array(buffer);


    incomingChunks.push(
        chunk
    );


    incomingBytes +=
        chunk.byteLength;


    const percent =
        (
            incomingBytes /
            incomingFile.size
        ) * 100;


    updateProgress(
        percent,
        `Receiving ${Math.floor(percent)}%`
    );


    console.log(
        `Received ${incomingBytes}/${incomingFile.size}`
    );
}


/* =========================================================
   FINISH FILE
   ========================================================= */

function finishIncomingFile() {

    if (!incomingFile) {

        console.warn(
            "FILE END received without file"
        );

        return;
    }


    console.log(
        "FILE END"
    );


    /*
     * VERIFY FILE SIZE
     */

    if (
        incomingBytes !==
        incomingFile.size
    ) {

        console.error(
            "File size mismatch:",
            {
                expected:
                    incomingFile.size,

                received:
                    incomingBytes
            }
        );


        updateProgress(
            0,
            `Transfer incomplete: ${formatBytes(incomingBytes)} / ${formatBytes(incomingFile.size)}`
        );


        return;
    }


    /*
     * Create the final Blob.
     */

    const blob =
        new Blob(
            incomingChunks,
            {
                type:
                    incomingFile.mime
            }
        );


    console.log(
        "Blob created:",
        blob.size,
        blob.type
    );


    /*
     * Remove previous object URL.
     */

    if (receivedObjectURL) {

        URL.revokeObjectURL(
            receivedObjectURL
        );
    }


    receivedObjectURL =
        URL.createObjectURL(
            blob
        );


    /*
     * DOWNLOAD
     */

    const download =
        document.getElementById(
            "download-file"
        );


    if (download) {

        download.href =
            receivedObjectURL;

        download.download =
            incomingFile.name;

        download.style.display =
            "inline-block";
    }


    /*
     * PREVIEW
     */

    const preview =
        document.getElementById(
            "preview-file"
        );


    if (preview) {

        preview.href =
            receivedObjectURL;

        preview.target =
            "_blank";

        preview.rel =
            "noopener";

        preview.style.display =
            "inline-block";
    }


    /*
     * DISPLAY RESULT
     */

    setText(
        "received-file-name",
        incomingFile.name
    );


    document
        .getElementById("received-file")
        ?.classList.remove("hidden");


    updateProgress(
        100,
        "File received successfully"
    );


    /*
     * IMPORTANT:
     *
     * Clear chunks only AFTER
     * the Blob has been created.
     */

    incomingChunks = [];

    incomingBytes = 0;

    incomingFile = null;


    console.log(
        "FILE READY:",
        receivedObjectURL
    );
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
            `${Math.max(
                0,
                Math.min(
                    100,
                    percentage
                )
            )}%`;
    }


    if (status) {
        status.textContent =
            text;
    }
}


/* =========================================================
   FORMAT BYTES
   ========================================================= */

function formatBytes(bytes) {

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
        (
            bytes /
            Math.pow(
                1024,
                index
            )
        ).toFixed(
            index === 0 ? 0 : 2
        ) +
        " " +
        units[index]
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
   STOP SCANNER
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
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;
    }
}