/*globals flagrate */
/// <reference path="../../node_modules/flagrate/index.d.ts" />
"use strict";

window.addEventListener("DOMContentLoaded", async () => {

    const electron = require("electron");
    const remote = electron.remote;
    const semver = require("semver");
    const mirakurun = remote.getGlobal("mirakurun");
    const focusedWindow = remote.BrowserWindow.getFocusedWindow();

    const container = flagrate.Element.extend(document.getElementById("container"));

    let status;
    try {
        status = await mirakurun.getStatus();
    } catch (e) {
        console.error(e);
        container.insertText("Connection Failed.");
        setTimeout(() => {
            focusedWindow.reload();
        }, 3000);
        return;
    }

    const title = document.querySelector("h1");
    title.insertText(` - Mirakurun ${status.version} ${status.process.arch} (${status.process.platform})`);

    const tunersElement = new flagrate.Element();
    const logsElement = new flagrate.Element().addClassName("logs");
    const versionElement = new flagrate.Element();

    const tab = new flagrate.createTab({
        fill: true,
        tabs: [
            {
                key: "tuners",
                label: "Tuners",
                element: tunersElement,
                onSelect: () => {
                    setTimeout(updateTuners, 0);
                }
            },
            {
                key: "logs",
                label: "Logs",
                element: logsElement,
                onSelect: () => {
                    const scrollBottom = Math.max(0, logsElement.scrollHeight - logsElement.getHeight());
                    logsElement.scrollTop = scrollBottom;
                }
            },
            {
                key: "version",
                label: "Version",
                element: versionElement
            }
        ]
    }).insertTo(container);

    /*
        Tuners
    */
    const tunersGrid = new flagrate.Grid({
        disableSelect: true,
        disableSort: true,
        cols: [
            {
                key: "name",
                label: "Name",
                width: 80
            },
            {
                key: "types",
                label: "Types",
                width: 55
            },
            {
                key: "command",
                label: "Command"
            },
            {
                key: "users",
                label: "Users [Priority]",
                width: 170
            }
        ]
    }).insertTo(tunersElement);

    function updateTuners() {
        if (!tunersElement.exists()) {
            return;
        }

        const tuners = remote.getGlobal("tuners");
        const rows = tuners.map(tuner => {
            let menuItems;
            if (tuner.command) {
                menuItems = [{
                    label: "Kill Tuner Process...",
                    onSelect: () => {
                        new flagrate.Modal({
                            title: "Kill Tuner Process",
                            text: "Are you sure?",
                            buttons: [
                                {
                                    label: "Kill",
                                    color: "@red",
                                    onSelect: async (e, modal) => {
                                        modal.close();

                                        modal = new flagrate.Modal({
                                            disableCloseButton: true,
                                            disableCloseByMask: true,
                                            disableCloseByEsc: true,
                                            title: "Kill Tuner Process",
                                            text: "Killing..."
                                        }).open();

                                        await mirakurun.killTunerProcess(tuner.index);

                                        modal.close();
                                    }
                                },
                                {
                                    label: "Cancel",
                                    onSelect: (e, modal) => {
                                        modal.close();
                                    }
                                }
                            ]
                        }).open();
                    }
                }];
            }

            return {
                cell: {
                    name: tuner.name,
                    types: tuner.types.join(", "),
                    command: {
                        text: tuner.command || "-",
                        className: "command"
                    },
                    users: {
                        html: tuner.users.map(user => `${user.id} [${user.priority}]`).join("<br>")
                    }
                },
                menuItems: menuItems
            };
        });

        tunersGrid.splice(0, tunersGrid.rows.length, rows);
    }
    setInterval(updateTuners, 3000);

    /*
        Logs
    */
    (async () => {
        try {
            const logStream = await mirakurun.getLogStream();
            logStream.setEncoding("utf8");
            logStream.on("data", logProcessor);
            logStream.on("end", () => setTimeout(() => {
                try { focusedWindow.reload(); } catch (e) {}
            }, 3000));
            window.addEventListener("beforeunload", () => logStream.destroy());
        } catch (e) {
        }

        const tabButton = tab.tabs[tab.indexOf("logs")]._button;
        let cnt = 0;
        let buf = "";

        function logProcessor(data) {
            let scrollBottom = Math.max(0, logsElement.scrollHeight - logsElement.clientHeight);
            const isScrollable = (scrollBottom - 50) < logsElement.scrollTop;

            buf += data;
            for (let i = 0; i < buf.length; i++) {
                if (buf[i] !== "\n") {
                    continue;
                }
                const line = buf.slice(0, i);
                buf = buf.slice(i + 1);
                i = 0;
                logParser(line);
                cnt++;
                if (cnt > 500) {
                    logsElement.children[0].remove();
                }
                tabButton.setLabel(`Logs (${cnt})`);
            }

            if (logsElement.exists() &&  isScrollable) {
                scrollBottom = Math.max(0, logsElement.scrollHeight - logsElement.clientHeight);
                logsElement.scrollTop = scrollBottom;
            }
        }

        function logParser(line) {
            const parsed = line.match(/^[0-9.T:+-]+ ([a-z]+): /);
            const level = parsed ? parsed[1] : "other";
            new flagrate.Element("div", {
                "class": level
            }).insertText(line).insertTo(logsElement);
        }
    })();

    /*
        Version
    */
    (async () => {
        try {
            const version = await mirakurun.checkVersion();

            const form = new flagrate.Form({
                fields: [
                    {
                        label: "Current",
                        text: version.current
                    },
                    {
                        label: "Latest",
                        text: version.latest
                    }
                ]
            }).insertTo(versionElement);

            if (semver.satisfies(version.current, "~2.8.3") === true && version.current !== version.latest) {
                form.push({
                    label: "Update",
                    text: "click to update the Mirakurun. (only PM2 or Winser environment.)",
                    element: new flagrate.Button({
                        label: `Update to ${version.latest}...`,
                        color: "@warning",
                        onSelect: updateMirakurun
                    })
                });
            }
        } catch (e) {
            console.error(e);
            versionElement.updateText("failed: mirakurun.checkVersion();");
        }

        function updateMirakurun() {
            new flagrate.Modal({
                title: "Update Mirakurun",
                html: "This will may take few minutes.<br>If update failed, check version of Node, PM2, NPM.",
                buttons: [
                    {
                        label: "Update",
                        color: "@warning",
                        onSelect: async (e, modal) => {
                            modal.close();

                            modal = new flagrate.Modal({
                                disableCloseButton: true,
                                disableCloseByMask: true,
                                disableCloseByEsc: true,
                                title: "Update Mirakurun",
                                text: "Update Requested...",
                                buttons: [
                                    {
                                        label: "Updating...",
                                        onSelect: () => focusedWindow.reload()
                                    }
                                ]
                            }).open();

                            const im = await mirakurun.updateVersion();
                            im.on("data", data => {
                                modal.content.insert("<br>" + data);
                            });
                            im.on("close", () => {
                                modal.content.insert("Waiting for Restart...");
                                setTimeout(() => focusedWindow.reload(), 1000 * 5);
                            });
                        }
                    },
                    {
                        label: "Cancel",
                        onSelect: (e, modal) => {
                            modal.close();
                        }
                    }
                ]
            }).open();
        }
    })();
});
