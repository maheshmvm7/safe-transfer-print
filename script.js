/*
=========================================================
 P2P FILE TRANSFER
=========================================================

Current HTML supported:

    #show-qr-btn
    #scan-qr-btn
    #qr-section
    #scanner-section
    #qrcode
    #reader
    #peer-id
    #connection-result
    #connected-peer
    #status-dot
    #status-text

Features:

    - PeerJS WebRTC connection
    - Receiver shows Peer ID as QR
    - Sender scans Receiver QR
    - Automatic connection after QR scan
    - Multiple file selection
    - Multiple file transfer
    - Chunked transfer
    - Transfer progress
    - Individual download buttons
=========================================================
*/


/* =====================================================
   GLOBAL STATE
===================================================== */

let peer = null;
let conn = null;

let qrScanner = null;
let scannerRunning = false;

let selectedFiles = [];

let receivingFile = null;
let receivedChunks = [];
let receivedBytes = 0;

let transferUI = null;

let connecting = false;

const CHUNK_SIZE = 16 * 1024;
const MAX_BUFFERED_AMOUNT = 512 * 1024;


/* =====================================================
   START
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    init
);


/* =====================================================
   INITIALIZATION
===================================================== */

async function init() {

    addTransferStyles();


    const showQRButton =
        document.getElementById(
            "show-qr-btn"
        );

    const scanQRButton =
        document.getElementById(
            "scan-qr-btn"
        );


    if (showQRButton) {

        showQRButton.addEventListener(
            "click",
            showMyQR
        );

    }


    if (scanQRButton) {

        scanQRButton.addEventListener(
            "click",
            showScanner
        );

    }


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
            "PeerJS failed to load"
        );


        setText(
            "description",
            "Could not load the WebRTC connection library."
        );
    }
}


/* =====================================================
   LOAD PEERJS
===================================================== */

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
                            "PeerJS loaded but Peer is unavailable."
                        )
                    );

                }

            };


            script.onerror = () => {

                reject(
                    new Error(
                        "Could not load PeerJS."
                    )
                );

            };


            document.head.appendChild(
                script
            );

        }
    );
}


/* =====================================================
   CREATE PEER
===================================================== */

function createPeer() {

    if (peer) {
        return;
    }


    setStatus(
        "info",
        "Connecting..."
    );


    peer = new Peer();


    /* ---------------------------------------------
       Peer ID generated
    --------------------------------------------- */

    peer.on(
        "open",
        id => {

            console.log(
                "My Peer ID:",
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
                "Show your QR code to the other device, or scan theirs."
            );

        }
    );


    /* ---------------------------------------------
       Incoming connection
    --------------------------------------------- */

    peer.on(
        "connection",
        incomingConnection => {

            console.log(
                "Incoming connection:",
                incomingConnection.peer
            );


            /*
             * The device whose QR was scanned
             * becomes the RECEIVER.
             */

            acceptConnection(
                incomingConnection
            );

        }
    );


    /* ---------------------------------------------
       Disconnected
    --------------------------------------------- */

    peer.on(
        "disconnected",
        () => {

            setStatus(
                "error",
                "Disconnected"
            );

        }
    );


    /* ---------------------------------------------
       Peer closed
    --------------------------------------------- */

    peer.on(
        "close",
        () => {

            setStatus(
                "error",
                "Peer closed"
            );

        }
    );


    /* ---------------------------------------------
       Peer error
    --------------------------------------------- */

    peer.on(
        "error",
        error => {

            console.error(
                "PeerJS error:",
                error
            );


            let message =
                "Connection error";


            if (
                error &&
                error.type ===
                    "peer-unavailable"
            ) {

                message =
                    "Receiver is unavailable";

            }


            if (
                error &&
                error.type ===
                    "network"
            ) {

                message =
                    "Network error";

            }


            setStatus(
                "error",
                message
            );

        }
    );
}


/* =====================================================
   GENERATE QR
===================================================== */

function generateQR(
    peerId
) {

    const qr =
        document.getElementById(
            "qrcode"
        );


    if (!qr) {
        return;
    }


    qr.innerHTML = "";


    if (!window.QRCode) {

        console.error(
            "QRCode library not loaded."
        );


        setStatus(
            "error",
            "QR library unavailable"
        );


        return;
    }


    new QRCode(
        qr,
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


/* =====================================================
   SHOW MY QR
===================================================== */

function showMyQR() {

    const showButton =
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


    if (showButton) {

        showButton.classList.add(
            "active"
        );

    }


    if (scanButton) {

        scanButton.classList.remove(
            "active"
        );

    }


    if (qrSection) {

        qrSection.classList.remove(
            "hidden"
        );

    }


    if (scannerSection) {

        scannerSection.classList.add(
            "hidden"
        );

    }


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


        setStatus(
            "info",
            "Ready"
        );

    }
}


/* =====================================================
   SHOW SCANNER
===================================================== */

async function showScanner() {

    const showButton =
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


    if (showButton) {

        showButton.classList.remove(
            "active"
        );

    }


    if (scanButton) {

        scanButton.classList.add(
            "active"
        );

    }


    if (qrSection) {

        qrSection.classList.add(
            "hidden"
        );

    }


    if (scannerSection) {

        scannerSection.classList.remove(
            "hidden"
        );

    }


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


    /*
     * Camera requires HTTPS or localhost.
     */

    const secure =
        location.protocol === "https:";


    const local =
        location.hostname ===
            "localhost" ||
        location.hostname ===
            "127.0.0.1";


    if (
        !secure &&
        !local
    ) {

        setText(
            "scanner-message",
            "Camera requires HTTPS or localhost."
        );


        setStatus(
            "error",
            "Camera unavailable"
        );


        return;
    }


    if (
        !window.Html5Qrcode
    ) {

        setText(
            "scanner-message",
            "QR scanner library not loaded."
        );


        setStatus(
            "error",
            "Scanner unavailable"
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

                handleScannedPeerId(
                    decodedText
                );

            },

            () => {

                /*
                 * Ignore normal scanner
                 * "QR not found" callbacks.
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


        setText(
            "scanner-message",
            "Could not start camera."
        );


        setStatus(
            "error",
            "Camera could not start"
        );
    }
}


/* =====================================================
   HANDLE SCANNED PEER ID
===================================================== */

async function handleScannedPeerId(
    value
) {

    const remoteId =
        String(
            value
        ).trim();


    if (!remoteId) {
        return;
    }


    /*
     * Prevent multiple connections
     * from repeated QR callbacks.
     */

    if (
        connecting ||
        (
            conn &&
            conn.open
        )
    ) {

        return;
    }


    connecting = true;


    setText(
        "scanner-message",
        "QR detected. Connecting..."
    );


    setStatus(
        "info",
        "Connecting..."
    );


    await stopScanner();


    connectToReceiver(
        remoteId
    );
}


/* =====================================================
   CONNECT TO RECEIVER
===================================================== */

function connectToReceiver(
    remoteId
) {

    if (
        !peer ||
        peer.destroyed
    ) {

        connecting = false;


        setStatus(
            "error",
            "Peer is not ready"
        );


        return;
    }


    if (
        remoteId ===
        peer.id
    ) {

        connecting = false;


        setStatus(
            "error",
            "You scanned your own QR"
        );


        return;
    }


    try {

        conn =
            peer.connect(
                remoteId,
                {
                    reliable: true
                }
            );


        conn.on(
            "open",
            () => {

                console.log(
                    "Outgoing connection opened."
                );


                connecting = false;


                showConnectionResult(
                    remoteId
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


                createSenderUI();

            }
        );


        conn.on(
            "close",
            () => {

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


                connecting = false;


                setStatus(
                    "error",
                    "Connection failed"
                );

            }
        );

    } catch (error) {

        console.error(
            error
        );


        connecting = false;


        setStatus(
            "error",
            "Could not connect"
        );
    }
}


/* =====================================================
   ACCEPT INCOMING CONNECTION
===================================================== */

function acceptConnection(
    incomingConnection
) {

    /*
     * If already connected,
     * reject another connection.
     */

    if (
        conn &&
        conn.open
    ) {

        try {

            incomingConnection.close();

        } catch (_) {}

        return;
    }


    conn =
        incomingConnection;


    conn.on(
        "open",
        () => {

            console.log(
                "Incoming connection opened."
            );


            showConnectionResult(
                conn.peer
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


            createReceiverUI();

        }
    );


    /*
     * IMPORTANT:
     * Receiver listens for data.
     */

    conn.on(
        "data",
        handleReceivedData
    );


    conn.on(
        "close",
        () => {

            setStatus(
                "info",
                "Sender disconnected"
            );

        }
    );


    conn.on(
        "error",
        error => {

            console.error(
                "Incoming connection error:",
                error
            );


            setStatus(
                "error",
                "Connection error"
            );

        }
    );
}


/* =====================================================
   CONNECTION RESULT
===================================================== */

function showConnectionResult(
    remotePeerId
) {

    const result =
        document.getElementById(
            "connection-result"
        );


    const connectedPeer =
        document.getElementById(
            "connected-peer"
        );


    if (connectedPeer) {

        connectedPeer.textContent =
            remotePeerId;

    }


    if (result) {

        result.classList.remove(
            "hidden"
        );

    }
}


/* =====================================================
   CREATE SENDER UI
===================================================== */

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
                id="dynamic-file-input"
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


    document
        .querySelector(
            ".connection"
        )
        .appendChild(
            transferUI
        );


    const input =
        document.getElementById(
            "dynamic-file-input"
        );


    const sendButton =
        document.getElementById(
            "send-files-btn"
        );


    input.addEventListener(
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
        sendSelectedFiles
    );
}


/* =====================================================
   RENDER SELECTED FILES
===================================================== */

function renderSelectedFiles() {

    const container =
        document.getElementById(
            "selected-files"
        );


    if (!container) {
        return;
    }


    if (
        selectedFiles.length === 0
    ) {

        container.innerHTML = "";

        return;
    }


    container.innerHTML =
        selectedFiles
            .map(
                (
                    file,
                    index
                ) => {

                    return `

                        <div
                            class="selected-file-row"
                        >

                            <span
                                class="file-number"
                            >
                                ${index + 1}
                            </span>


                            <span
                                class="file-name"
                            >
                                ${escapeHTML(
                                    file.name
                                )}
                            </span>


                            <span
                                class="file-size"
                            >
                                ${formatBytes(
                                    file.size
                                )}
                            </span>

                        </div>

                    `;

                }
            )
            .join("");
}


/* =====================================================
   SEND ALL FILES
===================================================== */

async function sendSelectedFiles() {

    if (
        !conn ||
        !conn.open
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

            await sendOneFile(
                selectedFiles[i],
                i,
                selectedFiles.length
            );

        }


        setStatus(
            "connected",
            "Transfer complete"
        );


        setText(
            "send-message",
            `All ${selectedFiles.length} files sent successfully.`
        );

    } catch (error) {

        console.error(
            "Transfer error:",
            error
        );


        setStatus(
            "error",
            "Transfer failed"
        );


        setText(
            "send-message",
            error.message ||
            "Transfer failed."
        );

    }


    button.disabled = false;
}


/* =====================================================
   SEND ONE FILE
===================================================== */

async function sendOneFile(
    file,
    index,
    totalFiles
) {

    if (
        !conn ||
        !conn.open
    ) {

        throw new Error(
            "Connection closed."
        );

    }


    const progress =
        document.getElementById(
            "send-progress"
        );


    const percent =
        document.getElementById(
            "send-progress-percent"
        );


    const label =
        document.getElementById(
            "send-progress-label"
        );


    progress.style.width =
        "0%";


    percent.textContent =
        "0%";


    label.textContent =
        `File ${index + 1}/${totalFiles}: ${file.name}`;


    /*
     * Tell receiver that a file
     * is starting.
     */

    conn.send(
        {
            type: "file-start",

            name: file.name,

            size: file.size,

            mime:
                file.type ||
                "application/octet-stream",

            fileIndex: index,

            totalFiles: totalFiles
        }
    );


    /*
     * Send file chunks.
     */

    let offset = 0;


    while (
        offset < file.size
    ) {

        await waitForBuffer();


        if (
            !conn ||
            !conn.open
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


        const chunk =
            file.slice(
                offset,
                end
            );


        const buffer =
            await chunk.arrayBuffer();


        conn.send(
            buffer
        );


        offset +=
            buffer.byteLength;


        const percentage =
            file.size === 0
                ? 100
                : Math.floor(
                    (
                        offset /
                        file.size
                    ) * 100
                );


        progress.style.width =
            `${percentage}%`;


        percent.textContent =
            `${percentage}%`;


        await nextFrame();

    }


    /*
     * Tell receiver that this
     * particular file has ended.
     */

    await waitForBuffer();


    conn.send(
        {
            type: "file-end",

            fileIndex: index,

            totalFiles: totalFiles
        }
    );


    /*
     * Give the DataChannel a small
     * opportunity before next file.
     */

    await sleep(50);
}


/* =====================================================
   WAIT FOR DATA CHANNEL BUFFER
===================================================== */

function waitForBuffer() {

    return new Promise(
        resolve => {

            if (
                !conn ||
                !conn.open
            ) {

                resolve();

                return;
            }


            /*
             * PeerJS exposes the underlying
             * RTCDataChannel as _dc.
             */

            const channel =
                conn._dc ||
                conn.dataChannel;


            if (!channel) {

                resolve();

                return;
            }


            if (
                channel.bufferedAmount <=
                MAX_BUFFERED_AMOUNT
            ) {

                resolve();

                return;
            }


            const timer =
                setInterval(
                    () => {

                        if (
                            !conn ||
                            !conn.open ||
                            channel.bufferedAmount <=
                                MAX_BUFFERED_AMOUNT
                        ) {

                            clearInterval(
                                timer
                            );


                            resolve();

                        }

                    },
                    20
                );

        }
    );
}


/* =====================================================
   CREATE RECEIVER UI
===================================================== */

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


    document
        .querySelector(
            ".connection"
        )
        .appendChild(
            transferUI
        );
}


/* =====================================================
   HANDLE RECEIVED DATA
===================================================== */

function handleReceivedData(
    data
) {

    /*
     * Metadata object.
     */

    if (
        data &&
        typeof data === "object" &&
        !(
            data instanceof ArrayBuffer
        ) &&
        !(
            data instanceof Blob
        ) &&
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
     * Typed array chunk.
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
     * Blob chunk.
     */

    if (
        data instanceof Blob
    ) {

        data
            .arrayBuffer()
            .then(
                receiveChunk
            );

    }
}


/* =====================================================
   START RECEIVING FILE
===================================================== */

function startReceiving(
    data
) {

    /*
     * A new file begins.
     */

    receivingFile = {

        name:
            data.name,

        size:
            Number(
                data.size
            ) || 0,

        mime:
            data.mime ||
            "application/octet-stream",

        fileIndex:
            Number(
                data.fileIndex
            ) || 0,

        totalFiles:
            Number(
                data.totalFiles
            ) || 1
    };


    receivedChunks = [];

    receivedBytes = 0;


    updateReceiveUI();


    setStatus(
        "connected",
        `Receiving ${receivingFile.fileIndex + 1}/${receivingFile.totalFiles}`
    );
}


/* =====================================================
   RECEIVE FILE CHUNK
===================================================== */

function receiveChunk(
    buffer
) {

    if (!receivingFile) {

        console.warn(
            "Received chunk without file metadata."
        );


        return;
    }


    receivedChunks.push(
        buffer
    );


    receivedBytes +=
        buffer.byteLength;


    updateReceiveUI();
}


/* =====================================================
   FINISH RECEIVING FILE
===================================================== */

function finishReceiving(
    data
) {

    if (!receivingFile) {

        console.warn(
            "Received file-end without active file."
        );


        return;
    }


    const fileInfo =
        receivingFile;


    /*
     * Rebuild file.
     */

    const blob =
        new Blob(
            receivedChunks,
            {
                type:
                    fileInfo.mime
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    /*
     * Create download entry.
     */

    addReceivedFile(
        fileInfo,
        blob.size,
        url
    );


    /*
     * Reset current file.
     */

    receivedChunks = [];

    receivedBytes = 0;

    receivingFile = null;


    /*
     * Update progress.
     */

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
            "100%";

    }


    if (percent) {

        percent.textContent =
            "100%";

    }


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
            `All ${total} files received successfully.`
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


/* =====================================================
   UPDATE RECEIVER PROGRESS
===================================================== */

function updateReceiveUI() {

    if (!receivingFile) {
        return;
    }


    const current =
        document.getElementById(
            "receive-current-file"
        );


    const label =
        document.getElementById(
            "receive-progress-label"
        );


    const percent =
        document.getElementById(
            "receive-progress-percent"
        );


    const progress =
        document.getElementById(
            "receive-progress"
        );


    const percentage =
        receivingFile.size === 0
            ? 100
            : Math.floor(
                (
                    receivedBytes /
                    receivingFile.size
                ) * 100
            );


    if (current) {

        current.textContent =
            receivingFile.name;

    }


    if (label) {

        label.textContent =
            `File ${receivingFile.fileIndex + 1}/${receivingFile.totalFiles}`;

    }


    if (percent) {

        percent.textContent =
            `${percentage}%`;

    }


    if (progress) {

        progress.style.width =
            `${percentage}%`;

    }
}


/* =====================================================
   ADD RECEIVED FILE
===================================================== */

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


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "received-file-row";


    const info =
        document.createElement(
            "div"
        );


    info.className =
        "received-file-info";


    const number =
        document.createElement(
            "span"
        );


    number.className =
        "received-file-index";


    number.textContent =
        fileInfo.fileIndex + 1;


    const name =
        document.createElement(
            "span"
        );


    name.className =
        "received-file-name";


    name.textContent =
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
        number
    );


    info.appendChild(
        name
    );


    info.appendChild(
        sizeElement
    );


    item.appendChild(
        info
    );


    item.appendChild(
        download
    );


    container.appendChild(
        item
    );
}


/* =====================================================
   REMOVE TRANSFER UI
===================================================== */

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


/* =====================================================
   STOP SCANNER
===================================================== */

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


/* =====================================================
   STATUS
===================================================== */

function setStatus(
    type,
    text
) {

    const dot =
        document.getElementById(
            "status-dot"
        );


    const statusText =
        document.getElementById(
            "status-text"
        );


    if (statusText) {

        statusText.textContent =
            text;

    }


    if (dot) {

        dot.classList.toggle(
            "connected",
            type === "connected"
        );

    }
}


/* =====================================================
   SET TEXT
===================================================== */

function setText(
    id,
    text
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            text;

    }
}


/* =====================================================
   SLEEP
===================================================== */

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


/* =====================================================
   NEXT FRAME
===================================================== */

function nextFrame() {

    return new Promise(
        resolve => {

            requestAnimationFrame(
                resolve
            );

        }
    );
}


/* =====================================================
   FORMAT FILE SIZE
===================================================== */

function formatBytes(
    bytes
) {

    if (
        !bytes ||
        bytes <= 0
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


    return (
        (
            bytes /
            Math.pow(
                1024,
                index
            )
        ).toFixed(
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


/* =====================================================
   DYNAMIC TRANSFER CSS
=====================================================

   Your current style.css has the connection/QR
   styling but no file-transfer controls.

   These styles are injected only for the
   dynamically-created file-transfer UI.
===================================================== */

function addTransferStyles() {

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

            border:
                1px solid
                var(--border);

            background:
                var(--panel);

            text-align: left;

        }


        .dynamic-title {

            margin-bottom: 15px;

            font-size: 10px;

            letter-spacing:
                0.15em;

            color:
                var(--muted);

        }


        .file-picker {

            display: block;

            width: 100%;

            padding: 16px;

            border:
                1px dashed
                var(--border);

            background:
                var(--bg);

            text-align: center;

            cursor: pointer;

            font-size: 12px;

            transition:
                border-color
                0.2s ease;

        }


        .file-picker:hover {

            border-color:
                var(--text);

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

            min-width: 0;

            padding: 9px 0;

            border-bottom:
                1px solid
                var(--border);

            font-family:
                monospace;

            font-size: 11px;

        }


        .file-number,
        .received-file-index {

            flex:
                0 0 20px;

            color:
                var(--muted);

        }


        .file-name,
        .received-file-name {

            flex: 1;

            min-width: 0;

            overflow: hidden;

            text-overflow:
                ellipsis;

            white-space:
                nowrap;

        }


        .file-size,
        .received-file-size {

            color:
                var(--muted);

            white-space:
                nowrap;

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

            justify-content:
                space-between;

            gap: 10px;

            margin-bottom: 7px;

            color:
                var(--muted);

            font-family:
                monospace;

            font-size: 10px;

        }


        .transfer-progress-track {

            width: 100%;

            height: 5px;

            overflow: hidden;

            background:
                var(--border);

        }


        .transfer-progress {

            width: 0;

            height: 100%;

            background:
                var(--text);

            transition:
                width
                0.08s linear;

        }


        .dynamic-button {

            display: inline-flex;

            align-items:
                center;

            justify-content:
                center;

            margin-top: 15px;

            padding:
                10px 18px;

            border: none;

            background:
                var(--text);

            color: white;

            font-size: 12px;

            text-decoration:
                none;

            cursor: pointer;

        }


        .dynamic-button:disabled {

            opacity: 0.4;

            cursor:
                not-allowed;

        }


        .download-button {

            flex:
                0 0 auto;

            margin-top: 0;

            padding:
                7px 12px;

            font-size: 10px;

        }


        .transfer-message {

            margin-top: 10px;

            color:
                var(--muted);

            font-size: 11px;

        }


        .receive-current-file {

            margin-bottom: 12px;

            font-family:
                monospace;

            font-size: 12px;

            word-break:
                break-all;

        }


        @media (
            max-width: 600px
        ) {

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