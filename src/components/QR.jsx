import { QRCodeCanvas } from "qrcode.react";

function QR({ message }) {
    if (!message) return null;

    return (
        <div>
            <h3>QR Code:</h3>
            <QRCodeCanvas value={JSON.stringify(message)} />
        </div>
    );
}

export default QR;