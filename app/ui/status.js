/*globals flagrate, remote */
/// <reference path="../../node_modules/flagrate/index.d.ts" />
"use strict";

window.addEventListener("DOMContentLoaded", async () => {

    const container = flagrate.Element.extend(document.getElementById("container"));

    const mirakurun = remote.getGlobal("mirakurun");

    let status/*, logStream*/;
    try {
        status = await mirakurun.getStatus();
        // logStream = await mirakurun.getLogStream();
        // remote.BrowserWindow.getFocusedWindow().once("closed", () => { logStream.destroy(); });
    } catch (e) {
        console.error(e);
        container.updateText("Connection Failed.");
        return;
    }

    const title = document.querySelector("h1");
    title.insertText(` - Mirakurun ${status.version} ${status.process.arch} (${status.process.platform})`);

    const tunersElement = new flagrate.Element();
    // const logsElement = new flagrate.Element();

    const tunersGrid = new flagrate.Grid({
        disableSelect: true,
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

    const updateTuners = () => {
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
    };
    setInterval(updateTuners, 3000);
    updateTuners();

    /* logStream.on("data", data => {
        logsElement.insertText(data);
    }); */

    new flagrate.createTab({
        fill: true,
        tabs: [
            {
                key: "tuners",
                label: "Tuners",
                element: tunersElement
            }/* ,
            {
                key: "logs",
                label: "Logs",
                element: logsElement
            } */
        ]
    }).insertTo(container);
});
