/* =========================================================
   P2P WEBRTC FILE TRANSFER
   QR CODE + MULTIPLE FILES
   ========================================================= */

/* ---------------------------------------------------------
   GLOBAL STATE
--------------------------------------------------------- */

let peer = null;
let connection = null;

let qrScanner = null;
let scannerRunning = false;

let selectedFiles = [];

let receivingFile = null;
let receivedChunks = [];
let receivedBytes = 0;

let transferUI = null;

let isConnecting = false;


/*
 * Keep chunks reasonably small.
 * This avoids putting very large messages
 * into the WebRTC DataChannel.
 */
const CHUNK_SIZE = 16 * 1024;


/*
 * Pause sending when the browser's
 * DataChannel buffer becomes large.
 */
const MAX_BUFFERED_AMOUNT = 512 * 1024;


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    injectTransferStyles();

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


    /*
     * PeerJS handles signaling.
     *
     * WebRTC carries the actual file data.
     *
     * Reliable + binary are important for file transfer.
     */

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
                "Show this QR code to the device that will send files."
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
             * The device showing the QR
             * is the receiver.
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


    if (
        !window.Html5Qrcode
    ) {

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
        location.hostname ===
            "localhost" ||
        location.hostname ===
            "127.0.0.1";


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

            () => {

                /*
                 * Normal scanner callback.
                 *
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
     * Prevent html5-qrcode from
     * firing this multiple times.
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
     * IMPORTANT:
     *
     * serialization: "binary"
     * reliable: true
     *
     * This connection can carry both
     * metadata objects and ArrayBuffer chunks.
     */

    const newConnection =
        peer.connect(
            remotePeerId,
            {
                reliable: true,

                serialization: "binary",

                label: "file-transfer"
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
                "Select one or more files to send."
            );


            /*
             * This device scanned the QR,
             * therefore this device is the sender.
             */

            createSenderUI();
        }
    );


    connection.on(
        "data",
        data => {

            /*
             * Usually the sender does not
             * receive data, but keeping this
             * listener is harmless.
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


    /*
     * Attach DATA listener immediately.
     *
     * We don't want to miss data after
     * the channel opens.
     */

    connection.on(
        "data",
        handleIncomingData
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
                "Waiting for files..."
            );


            /*
             * This device displayed the QR,
             * therefore this device is the receiver.
             */

            createReceiverUI();
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
   SENDER UI
========================================================= */

function createSenderUI() {

    removeTransferUI();


    transferUI =
        document.createElement(
            "div"
        );


    transferUI.className =
        "dynamic-transfer-ui";


    transferUI.innerHTML = `

        <div class="dynamic-title">
            SEND FILES
        </div>


        <label class="file-picker">

            <input
                id="file-input"
                type="file"
                multiple
            >

            <span>
                Select multiple files
            </span>

        </label>


        <div
            id="selected-files"
            class="selected-files"
        ></div>


        <div
            class="transfer-progress-wrap"
        >

            <div
                class="transfer-progress-head"
            >

                <span
                    id="send-progress-label"
                >
                    Ready
                </span>

                <span
                    id="send-progress-percent"
                >
                    0%
                </span>

            </div>


            <div
                class="transfer-progress-track"
            >

                <div
                    id="send-progress"
                    class="transfer-progress"
                ></div>

            </div>

        </div>


        <button
            id="send-files-btn"
            class="dynamic-button"
            type="button"
            disabled
        >
            Send Files
        </button>


        <div
            id="send-message"
            class="transfer-message"
        ></div>

    `;


    const parent =
        document.querySelector(
            ".connection"
        );


    if (!parent) {
        return;
    }


    parent.appendChild(
        transferUI
    );


    const fileInput =
        document.getElementById(
            "file-input"
        );


    const sendButton =
        document.getElementById(
            "send-files-btn"
        );


    fileInput.addEventListener(
        "change",
        event => {

            selectedFiles =
                Array.from(
                    event.target.files
                );


            renderSelectedFiles();


            sendButton.disabled =
                selectedFiles.length === 0;

        }
    );


    sendButton.addEventListener(
        "click",
        sendAllFiles
    );
}


/* =========================================================
   SHOW SELECTED FILES
========================================================= */

function renderSelectedFiles() {

    const container =
        document.getElementById(
            "selected-files"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    selectedFiles.forEach(
        (
            file,
            index
        ) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "selected-file-row";


            row.innerHTML = `

                <span
                    class="file-number"
                >
                    ${index + 1}
                </span>

                <span
                    class="file-name"
                    title="${escapeHTML(file.name)}"
                >
                    ${escapeHTML(file.name)}
                </span>

                <span
                    class="file-size"
                >
                    ${formatBytes(file.size)}
                </span>

            `;


            container.appendChild(
                row
            );
        }
    );
}


/* =========================================================
   SEND ALL FILES
========================================================= */

async function sendAllFiles() {

    if (
        !connection ||
        !connection.open
    ) {

        setStatus(
            "error",
            "Connection is not open"
        );


        return;
    }


    if (
        selectedFiles.length === 0
    ) {
        return;
    }


    const button =
        document.getElementById(
            "send-files-btn"
        );


    button.disabled = true;


    try {

        for (
            let i = 0;
            i < selectedFiles.length;
            i++
        ) {

            await sendFile(
                selectedFiles[i],
                i,
                selectedFiles.length
            );

        }


        updateSendProgress(
            100,
            "Transfer complete"
        );


        setStatus(
            "connected",
            "Files sent"
        );


        setText(
            "send-message",
            `${selectedFiles.length} file(s) sent successfully.`
        );

    } catch (error) {

        console.error(
            "FILE TRANSFER ERROR:",
            error
        );


        setStatus(
            "error",
            "File transfer failed"
        );


        setText(
            "send-message",
            error.message ||
            "File transfer failed."
        );

    } finally {

        button.disabled =
            false;

    }
}


/* =========================================================
   SEND SINGLE FILE
========================================================= */

async function sendFile(
    file,
    fileIndex,
    totalFiles
) {

    if (
        !connection ||
        !connection.open
    ) {

        throw new Error(
            "Connection closed."
        );
    }


    updateSendProgress(
        0,
        `Sending ${fileIndex + 1}/${totalFiles}: ${file.name}`
    );


    /*
     * FILE START MESSAGE
     */

    connection.send({
        type: "file-start",

        name: file.name,

        size: file.size,

        mime:
            file.type ||
            "application/octet-stream",

        fileIndex: fileIndex,

        totalFiles: totalFiles
    });


    /*
     * Empty files need no chunks.
     */

    if (
        file.size === 0
    ) {

        await waitForDataChannel();


        connection.send({
            type: "file-end",

            fileIndex: fileIndex,

            totalFiles: totalFiles
        });


        updateSendProgress(
            100,
            `${file.name} complete`
        );


        return;
    }


    let offset = 0;


    while (
        offset <
        file.size
    ) {

        /*
         * Apply backpressure.
         */

        await waitForBufferSpace();


        if (
            !connection ||
            !connection.open
        ) {

            throw new Error(
                "Connection closed during transfer."
            );
        }


        const end =
            Math.min(
                offset +
                    CHUNK_SIZE,

                file.size
            );


        const blob =
            file.slice(
                offset,
                end
            );


        const arrayBuffer =
            await blob.arrayBuffer();


        /*
         * Send binary chunk.
         */

        connection.send(
            arrayBuffer
        );


        offset +=
            arrayBuffer.byteLength;


        const percentage =
            Math.floor(
                (
                    offset /
                    file.size
                ) * 100
            );


        updateSendProgress(
            percentage,
            `Sending ${fileIndex + 1}/${totalFiles}: ${file.name}`
        );
    }


    /*
     * Make sure all previous data has
     * entered the DataChannel queue
     * before sending file-end.
     */

    await waitForBufferSpace();


    /*
     * FILE END MESSAGE
     */

    connection.send({
        type: "file-end",

        fileIndex: fileIndex,

        totalFiles: totalFiles
    });


    updateSendProgress(
        100,
        `${file.name} complete`
    );


    /*
     * Small pause between files.
     */

    await sleep(100);
}


/* =========================================================
   WAIT FOR DATA CHANNEL
========================================================= */

async function waitForDataChannel() {

    if (
        !connection ||
        !connection.open
    ) {

        throw new Error(
            "Connection is not open."
        );
    }


    /*
     * PeerJS exposes the underlying
     * RTCDataChannel through dataChannel.
     */

    if (
        connection.dataChannel
    ) {

        return;
    }


    /*
     * Wait briefly for it to become available.
     */

    for (
        let i = 0;
        i < 100;
        i++
    ) {

        if (
            connection.dataChannel
        ) {

            return;
        }


        await sleep(10);
    }
}


/* =========================================================
   WAIT FOR BUFFER SPACE
========================================================= */

async function waitForBufferSpace() {

    await waitForDataChannel();


    const channel =
        connection.dataChannel;


    if (!channel) {
        return;
    }


    /*
     * Wait while the browser's
     * RTCDataChannel is backed up.
     */

    while (
        channel.bufferedAmount >
        MAX_BUFFERED_AMOUNT
    ) {

        if (
            !connection ||
            !connection.open
        ) {

            throw new Error(
                "Connection closed."
            );
        }


        await sleep(10);
    }
}


/* =========================================================
   SEND PROGRESS
========================================================= */

function updateSendProgress(
    percentage,
    label
) {

    const progress =
        document.getElementById(
            "send-progress"
        );


    const percent =
        document.getElementById(
            "send-progress-percent"
        );


    const text =
        document.getElementById(
            "send-progress-label"
        );


    if (progress) {

        progress.style.width =
            `${percentage}%`;

    }


    if (percent) {

        percent.textContent =
            `${percentage}%`;

    }


    if (text) {

        text.textContent =
            label;

    }
}


/* =========================================================
   RECEIVER UI
========================================================= */

function createReceiverUI() {

    removeTransferUI();


    transferUI =
        document.createElement(
            "div"
        );


    transferUI.className =
        "dynamic-transfer-ui";


    transferUI.innerHTML = `

        <div class="dynamic-title">
            RECEIVING FILES
        </div>


        <div
            id="receive-current-file"
            class="receive-current-file"
        >
            Waiting for file...
        </div>


        <div
            class="transfer-progress-wrap"
        >

            <div
                class="transfer-progress-head"
            >

                <span
                    id="receive-progress-label"
                >
                    Ready
                </span>

                <span
                    id="receive-progress-percent"
                >
                    0%
                </span>

            </div>


            <div
                class="transfer-progress-track"
            >

                <div
                    id="receive-progress"
                    class="transfer-progress"
                ></div>

            </div>

        </div>


        <div
            id="received-files"
            class="received-files"
        ></div>


        <div
            id="receive-message"
            class="transfer-message"
        >
            Waiting for files...
        </div>

    `;


    const parent =
        document.querySelector(
            ".connection"
        );


    if (!parent) {
        return;
    }


    parent.appendChild(
        transferUI
    );
}


/* =========================================================
   RECEIVE DATA
========================================================= */

function handleIncomingData(
    data
) {

    console.log(
        "Incoming data:",
        data instanceof ArrayBuffer
            ? `ArrayBuffer ${data.byteLength} bytes`
            : data
    );


    /*
     * Metadata object.
     */

    if (
        data &&
        typeof data === "object" &&
        !(data instanceof ArrayBuffer) &&
        !(data instanceof Blob) &&
        !ArrayBuffer.isView(data)
    ) {

        if (
            data.type ===
            "file-start"
        ) {

            startReceiving(
                data
            );


            return;
        }


        if (
            data.type ===
            "file-end"
        ) {

            finishReceiving(
                data
            );


            return;
        }
    }


    /*
     * ArrayBuffer chunk.
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
     * Blob chunk.
     */

    if (
        data instanceof Blob
    ) {

        data.arrayBuffer()
            .then(
                receiveChunk
            )
            .catch(
                error => {

                    console.error(
                        "Blob error:",
                        error
                    );

                }
            );


        return;
    }


    /*
     * TypedArray.
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
    }
}


/* =========================================================
   START RECEIVING FILE
========================================================= */

function startReceiving(
    metadata
) {

    console.log(
        "FILE START:",
        metadata
    );


    /*
     * Reset old state.
     */

    receivingFile = {

        name:
            String(
                metadata.name ||
                "download"
            ),

        size:
            Number(
                metadata.size
            ) || 0,

        mime:
            metadata.mime ||
            "application/octet-stream",

        fileIndex:
            Number(
                metadata.fileIndex
            ) || 0,

        totalFiles:
            Number(
                metadata.totalFiles
            ) || 1
    };


    receivedChunks = [];

    receivedBytes = 0;


    updateReceiveProgress(
        0
    );


    setStatus(
        "connected",
        `Receiving ${receivingFile.fileIndex + 1}/${receivingFile.totalFiles}`
    );


    setText(
        "receive-current-file",
        receivingFile.name
    );


    setText(
        "receive-message",
        `Receiving ${formatBytes(receivingFile.size)}`
    );
}


/* =========================================================
   RECEIVE CHUNK
========================================================= */

function receiveChunk(
    buffer
) {

    if (!receivingFile) {

        console.warn(
            "Received data without file-start."
        );


        return;
    }


    receivedChunks.push(
        buffer
    );


    receivedBytes +=
        buffer.byteLength;


    let percentage = 0;


    if (
        receivingFile.size > 0
    ) {

        percentage =
            Math.min(
                100,
                Math.floor(
                    (
                        receivedBytes /
                        receivingFile.size
                    ) * 100
                )
            );

    } else {

        percentage = 100;

    }


    updateReceiveProgress(
        percentage
    );
}


/* =========================================================
   FINISH RECEIVING FILE
========================================================= */

function finishReceiving(
    metadata
) {

    if (!receivingFile) {

        console.warn(
            "file-end received without active file."
        );


        return;
    }


    console.log(
        "FILE END:",
        metadata
    );


    const fileInfo =
        receivingFile;


    /*
     * Rebuild the original file.
     */

    const blob =
        new Blob(
            receivedChunks,
            {
                type:
                    fileInfo.mime
            }
        );


    /*
     * Create local browser URL.
     */

    const url =
        URL.createObjectURL(
            blob
        );


    /*
     * Add download button.
     */

    addReceivedFile(
        fileInfo,
        blob.size,
        url
    );


    /*
     * Reset current transfer.
     */

    receivingFile = null;

    receivedChunks = [];

    receivedBytes = 0;


    updateReceiveProgress(
        100
    );


    const completed =
        fileInfo.fileIndex + 1;


    const total =
        fileInfo.totalFiles;


    if (
        completed >= total
    ) {

        setStatus(
            "connected",
            "All files received"
        );


        setText(
            "receive-message",
            `All ${total} file(s) received.`
        );

    } else {

        setStatus(
            "connected",
            `File ${completed}/${total} received`
        );


        setText(
            "receive-message",
            `Waiting for file ${completed + 1}/${total}...`
        );

    }
}


/* =========================================================
   RECEIVER PROGRESS
========================================================= */

function updateReceiveProgress(
    percentage
) {

    const progress =
        document.getElementById(
            "receive-progress"
        );


    const percent =
        document.getElementById(
            "receive-progress-percent"
        );


    if (progress) {

        progress.style.width =
            `${percentage}%`;

    }


    if (percent) {

        percent.textContent =
            `${percentage}%`;

    }
}


/* =========================================================
   ADD RECEIVED FILE
========================================================= */

function addReceivedFile(
    fileInfo,
    size,
    url
) {

    const container =
        document.getElementById(
            "received-files"
        );


    if (!container) {
        return;
    }


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "received-file-row";


    const info =
        document.createElement(
            "div"
        );


    info.className =
        "received-file-info";


    const index =
        document.createElement(
            "span"
        );


    index.className =
        "received-file-index";


    index.textContent =
        String(
            fileInfo.fileIndex + 1
        );


    const name =
        document.createElement(
            "span"
        );


    name.className =
        "received-file-name";


    name.textContent =
        fileInfo.name;


    name.title =
        fileInfo.name;


    const sizeElement =
        document.createElement(
            "span"
        );


    sizeElement.className =
        "received-file-size";


    sizeElement.textContent =
        formatBytes(
            size
        );


    const download =
        document.createElement(
            "a"
        );


    download.className =
        "dynamic-button download-button";


    download.href =
        url;


    download.download =
        fileInfo.name;


    download.textContent =
        "Download";


    info.appendChild(
        index
    );


    info.appendChild(
        name
    );


    info.appendChild(
        sizeElement
    );


    row.appendChild(
        info
    );


    row.appendChild(
        download
    );


    container.appendChild(
        row
    );
}


/* =========================================================
   REMOVE TRANSFER UI
========================================================= */

function removeTransferUI() {

    if (transferUI) {

        transferUI.remove();

        transferUI = null;

    }


    selectedFiles = [];

    receivingFile = null;

    receivedChunks = [];

    receivedBytes = 0;
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


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value
        );


    return div.innerHTML;
}


/* =========================================================
   FORMAT FILE SIZE
========================================================= */

function formatBytes(
    bytes
) {

    bytes =
        Number(
            bytes
        ) || 0;


    if (
        bytes === 0
    ) {

        return "0 B";
    }


    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];


    const index =
        Math.min(
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            ),
            units.length - 1
        );


    const value =
        bytes /
        Math.pow(
            1024,
            index
        );


    return (
        value.toFixed(
            index === 0
                ? 0
                : 2
        )
        +
        " "
        +
        units[index]
    );
}


/* =========================================================
   SLEEP
========================================================= */

function sleep(
    milliseconds
) {

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );
}


/* =========================================================
   DYNAMIC FILE TRANSFER CSS
========================================================= */

function injectTransferStyles() {

    if (
        document.getElementById(
            "p2p-transfer-styles"
        )
    ) {

        return;
    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "p2p-transfer-styles";


    style.textContent = `

        .dynamic-transfer-ui {

            width: min(100%, 600px);

            margin-top: 25px;

            padding: 20px;

            border: 1px solid var(--border);

            background: var(--panel);

            text-align: left;

        }


        .dynamic-title {

            margin-bottom: 15px;

            font-size: 10px;

            letter-spacing: .15em;

            color: var(--muted);

        }


        .file-picker {

            display: block;

            width: 100%;

            padding: 16px;

            border: 1px dashed var(--border);

            background: var(--bg);

            text-align: center;

            cursor: pointer;

            font-size: 12px;

        }


        .file-picker:hover {

            border-color: var(--text);

        }


        .file-picker input {

            display: none;

        }


        .selected-files,
        .received-files {

            margin-top: 12px;

        }


        .selected-file-row,
        .received-file-row {

            display: flex;

            align-items: center;

            gap: 10px;

            width: 100%;

            padding: 9px 0;

            border-bottom: 1px solid var(--border);

            font-family: monospace;

            font-size: 11px;

        }


        .file-number,
        .received-file-index {

            flex: 0 0 20px;

            color: var(--muted);

        }


        .file-name,
        .received-file-name {

            flex: 1;

            min-width: 0;

            overflow: hidden;

            text-overflow: ellipsis;

            white-space: nowrap;

        }


        .file-size,
        .received-file-size {

            color: var(--muted);

            white-space: nowrap;

        }


        .received-file-info {

            display: flex;

            align-items: center;

            gap: 10px;

            min-width: 0;

            flex: 1;

        }


        .transfer-progress-wrap {

            margin-top: 18px;

        }


        .transfer-progress-head {

            display: flex;

            justify-content: space-between;

            gap: 10px;

            margin-bottom: 7px;

            color: var(--muted);

            font-family: monospace;

            font-size: 10px;

        }


        .transfer-progress-track {

            width: 100%;

            height: 5px;

            overflow: hidden;

            background: var(--border);

        }


        .transfer-progress {

            width: 0;

            height: 100%;

            background: var(--text);

            transition: width .08s linear;

        }


        .dynamic-button {

            display: inline-flex;

            align-items: center;

            justify-content: center;

            margin-top: 15px;

            padding: 10px 18px;

            border: none;

            background: var(--text);

            color: white;

            font-size: 12px;

            text-decoration: none;

            cursor: pointer;

        }


        .dynamic-button:disabled {

            opacity: .4;

            cursor: not-allowed;

        }


        .download-button {

            flex: 0 0 auto;

            margin-top: 0;

            padding: 7px 12px;

            font-size: 10px;

        }


        .transfer-message {

            margin-top: 10px;

            color: var(--muted);

            font-size: 11px;

        }


        .receive-current-file {

            margin-bottom: 12px;

            font-family: monospace;

            font-size: 12px;

            word-break: break-all;

        }


        @media (max-width: 600px) {

            .dynamic-transfer-ui {

                padding: 15px;

            }


            .selected-file-row,
            .received-file-row {

                font-size: 10px;

            }


            .file-size,
            .received-file-size {

                display: none;

            }

        }

    `;


    document.head.appendChild(
        style
    );
}