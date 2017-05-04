"use strict";

module.exports = {
    privateIPv4Address: /^(?:(?:(?:127\.)|(?:10\.)[0-9]{0,3}\.)|(?:172\.1[6-9]\.)|(?:172\.2[0-9]\.)|(?:172\.3[0-1]\.)|(?:192\.168\.))[0-9]{1,3}\.[0-9]{1,3}$/,
    windowsNamedPipe: /^\\\\\.\\pipe\\.+/,
    unixDomainSocket: /^\/.+/,
    integer: /^[0-9]+$/
};
