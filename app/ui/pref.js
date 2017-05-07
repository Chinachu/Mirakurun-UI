/*globals flagrate */
/// <reference path="../../node_modules/flagrate/index.d.ts" />
"use strict";

window.addEventListener("DOMContentLoaded", () => {

    const settings = require("electron-settings");
    const regexp = require("../regexp");

    const container = flagrate.Element.extend(document.getElementById("container"));

    const div = new flagrate.Element().insertTo(container);

    let current = "";
    if (settings.get("host") && settings.get("port")) {
        current = `${settings.get("host")}:${settings.get("port")}`;
    }

    let saveHostTimer;

    const form = new flagrate.Form({
        fields: [
            {
                label: "Host",
                input: {
                    type: "combobox",
                    items: [
                        "192.168.x.x:40772"
                    ],
                    trim: true,
                    val: current,
                    validators: [
                        (input, done) => {

                            if (input === "") {
                                done(null, "N/A");
                                return;
                            }

                            const [host, port] = input.split(":");

                            if (regexp.privateIPv4Address.test(host) === true && regexp.integer.test(port) === true) {
                                clearTimeout(saveHostTimer);
                                saveHostTimer = setTimeout(() => {
                                    if (current !== input) {
                                        current = input;

                                        settings.setAll({
                                            host: host,
                                            port: port
                                        });
                                    }
                                }, 1500);

                                done(true, "TCP/IPv4");
                                return;
                            }

                            done(false, "Invalid Host");
                        },
                        (input, done) => done(true, "Saved.")
                    ]
                }
            }
        ]
    });

    form.insertTo(div);
});
