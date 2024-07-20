const secretKey = 'y0u12-53cr3t-k3y#'; // Replace with your actual secret key

export const encodeId = (id) => {
    const base64Id = Buffer.from(id.toString()).toString('base64');
    let encoded = '';
    for (let i = 0; i < base64Id.length; i++) {
        const charCode = base64Id.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length);
        encoded += String.fromCharCode(charCode);
    }
    return Buffer.from(encoded).toString('base64');
};

export const decodeId = (encodedId) => {
    const decoded = Buffer.from(encodedId, 'base64').toString('utf8');
    let base64Id = '';
    for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ secretKey.charCodeAt(i % secretKey.length);
        base64Id += String.fromCharCode(charCode);
    }
    return Buffer.from(base64Id, 'base64').toString('utf8');
};
