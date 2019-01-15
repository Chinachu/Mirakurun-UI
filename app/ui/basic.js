/*globals flagrate */
/// <reference path="../../node_modules/flagrate/index.d.ts" />
"use strict";

window.addEventListener("DOMContentLoaded", () => {

    const electron = require("electron");
    const remote = electron.remote;

    const container = flagrate.Element.extend(document.getElementById("container"));

    window.addEventListener("blur", updateWindowState);
    window.addEventListener("focus", updateWindowState);

    function updateWindowState() {
        setImmediate(() => {
            if (document.hasFocus() === true) {
                container.addClassName("active");
            } else {
                container.removeClassName("active");
            }
        });
    }

    updateWindowState();

    new flagrate.Element("h1", {
        "class": "title"
    })
        .insertText(document.title)
        .insertTo(container);

    new flagrate.Button({
        label: "✕",
        color: "#fff",
        className: "close",
        onSelect: () => {
            const w = remote.BrowserWindow.getFocusedWindow();
            if (w.isClosable()) {
                w.close();
            } else {
                w.hide();
            }
        }
    }).insertTo(container);

    new flagrate.ContextMenu({
        target: container,
        items: [
            {
                label: "Open DevTools",
                onSelect: () => {
                    remote.BrowserWindow.getFocusedWindow().webContents.openDevTools();
                }
            }
        ]
    });
});
