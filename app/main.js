/*
   Copyright 2017 kanreisa

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
"use strict";

const electron = require("electron");
const app = electron.app;
const settings = require("electron-settings");
const Mirakurun = require("mirakurun").default;
const regexp = require("./regexp");
const pkg = require("../package.json");

const mirakurun = global.mirakurun = new Mirakurun();
mirakurun.userAgent = `${pkg.name}/${app.getVersion()}`;

const icon = {
    normal: electron.nativeImage.createFromPath(`${__dirname}/images/icon.png`),
    normal30: electron.nativeImage.createFromPath(`${__dirname}/images/icon30.png`),
    offline: electron.nativeImage.createFromPath(`${__dirname}/images/icon-gray.png`),
    active: electron.nativeImage.createFromPath(`${__dirname}/images/icon-active.png`)
};

app.on("ready", init);

const TrayMenuItems = [
    {
        label: "Status",
        click: showStatus
    },
    {
        label: "Preferences",
        click: showPref
    },
    {
        type: "separator"
    },
    {
        label: "Open Homepage",
        click: openHomepage
    },
    {
        label: "Report Bugs",
        click: openFeedback
    },
    {
        type: "separator"
    },
    {
        label: `About ${ app.getName() }`,
        icon: icon.normal,
        click: about
    },
    {
        type: "separator"
    },
    {
        label: "Quit",
        accelerator: "CmdOrCtrl+Q",
        click: quit
    }
];

let statusWindow,
    prefWindow,
    tray,
    menu,
    eventsStream,
    checkRetryTimer;

function init() {

    menu = electron.Menu.buildFromTemplate(TrayMenuItems);

    tray = new electron.Tray(icon.offline);
    tray.setToolTip(`${app.getName()} - N/A`);
    tray.setContextMenu(menu);

    prefWindow = new electron.BrowserWindow({
        icon: icon.normal,
        width: 400,
        height: 200,
        minWidth: 400,
        minHeight: 200,
        frame: false,
        closable: false,
        alwaysOnTop: true,
        transparent: true,
        show: false
    });

    prefWindow.loadURL(`file://${ __dirname }/ui/pref.html`);

    setTimeout(checker, 1000);
    settings.watch("host", () => checkRetryTimer = setTimeout(checker, 1500));
    settings.watch("port", () => checkRetryTimer = setTimeout(checker, 1500));
}

async function checker() {

    clearTimeout(checkRetryTimer);

    tray.setImage(icon.offline);

    if (eventsStream) {
        if (eventsStream.socket.destroyed === false) {
            eventsStream.destroy();
        }

        eventsStream.removeAllListeners();
    }

    const host = settings.get("host");
    const port = settings.get("port");
    console.log("host:", host);
    console.log("port:", port);

    if (!host || !port) {
        return;
    }
    if (regexp.privateIPv4Address.test(host) === false || regexp.integer.test(port) === false) {
        return;
    }

    mirakurun.host = host;
    mirakurun.port = parseInt(port, 10);

    try {
        global.tuners = await mirakurun.getTuners();
        console.log("tuners:", global.tuners.length);
    } catch (e) {
        console.warn("tuners:", "error");
        tray.setToolTip(`${app.getName()} - Disconnected`);

        checkRetryTimer = setTimeout(checker, 5000);
        return;
    }

    try {
        eventsStream = await mirakurun.getEventsStream({
            resource: "tuner",
            type: "update"
        });
        eventsStream.setEncoding("utf8");
        console.warn("events:", eventsStream.statusCode);
    } catch (e) {
        console.warn("events:", "error");
        tray.setToolTip(`${app.getName()} - Disconnected`);

        checkRetryTimer = setTimeout(checker, 5000);
        return;
    }

    if (eventsStream.statusCode !== 200) {
        eventsStream = undefined;
        tray.setToolTip(`${app.getName()} - Error: ${eventsStream.statusCode}`);

        checkRetryTimer = setTimeout(checker, 5000);
        return;
    }

    const updateTray = () => {
        const isActive = global.tuners.some(tuner => tuner.isUsing === true && tuner.users.some(user => user.priority !== -1));
        if (isActive) {
            tray.setToolTip(`${app.getName()} - Active`);
            tray.setImage(icon.active);
        } else {
            tray.setToolTip(`${app.getName()} - Standby`);
            tray.setImage(icon.normal);
        }
    };
    updateTray();

    eventsStream.on("data", data => {
        data = data.match(/(\{.+\})\n,/m);
        if (!data) {
            return;
        }
        // console.log(data[1]);
        try {
            const tuner = JSON.parse(data[1]).data;
            global.tuners[tuner.index] = tuner;
            updateTray();
        } catch (e) { }
    });

    eventsStream.on("end", () => {
        console.log("ENDED!!! will retry");
        checkRetryTimer = setTimeout(checker, 3000);
    });

    clearTimeout(checkRetryTimer);
}

function showStatus() {

    if (statusWindow) {
        statusWindow.show();
        statusWindow.focus();
        return;
    }

    statusWindow = new electron.BrowserWindow({
        icon: icon.normal,
        width: 600,
        height: 350,
        minWidth: 600,
        minHeight: 300,
        frame: false,
        closable: true,
        alwaysOnTop: true,
        transparent: true
    });

    statusWindow.loadURL(`file://${ __dirname }/ui/status.html`);

    statusWindow.once("closed", () => {
        statusWindow = null;
    });
}

function showPref() {

    prefWindow.show();
    prefWindow.focus();
}

function openHomepage() {
    electron.shell.openExternal(pkg.homepage);
}

function openFeedback() {
    electron.shell.openExternal(pkg.bugs.url);
}

function about() {

    electron.dialog.showMessageBox({
        type: "info",
        icon: icon.normal30,
        title: app.getName(),
        message: app.getName(),
        detail: `Version ${app.getVersion()}\nNode ${process.version}`,
        buttons: [
            "Close"
        ]
    });
}

function quit() {

    if (statusWindow) {
        statusWindow.destroy();
    }
    if (prefWindow) {
        prefWindow.destroy();
    }

    app.quit();
}
