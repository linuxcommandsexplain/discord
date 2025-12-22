/**
 * @name FakeDeafen
 * @description Lets you appear deafened while still being able to hear and talk (blocks VOICE_STATE updates but lets channel moves pass)
 * @version 1.0
 * @author Sleek
 * @authorId 153253064231354368
 * @invite B5kBdSsED2
 * @license Unlicensed
 * @website https://sleek.blackbox.sh/
 * @source https://github.com/s4dic/BetterDiscord/tree/main/FakeDeafen
 * @updateUrl https://raw.githubusercontent.com/s4dic/BetterDiscord/main/FakeDeafen/FakeDeafen.plugin.js
 */

module.exports = class FakeDeafen {
    constructor() {
        this.pluginName = "FakeDeafen";
        this.mySettings = {
            shiftKeyRequired: false,
            triggerKey: "w",
            debugMode: false
        };
        this.isActive = false;
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.originalWebSocketSend = null;
        this.indicator = null;
    }

    log(...args) {
        if (this.mySettings.debugMode) {
            console.log(`[${this.pluginName}]`, ...args);
        }
    }

    start() {
        try {
            const settings = BdApi.Data.load(this.pluginName, "settings");
            if (settings) {
                this.mySettings = { ...this.mySettings, ...settings };
            }
        } catch (e) {
            console.error('[FakeDeafen] Failed to load settings:', e);
        }

        document.addEventListener("keydown", this.boundHandleKeyDown);
        this.patchWebSocket();
        this.createIndicator();

        BdApi.UI.showToast(`${this.pluginName} started - Press ${this.mySettings.triggerKey.toUpperCase()} to toggle`, { type: "success" });
        this.log("Plugin started");
    }

    stop() {
        document.removeEventListener("keydown", this.boundHandleKeyDown);
        this.unpatchWebSocket();
        this.removeIndicator();
        this.isActive = false;

        BdApi.UI.showToast(`${this.pluginName} stopped`, { type: "info" });
        this.log("Plugin stopped");
    }

    patchWebSocket() {
        if (this.originalWebSocketSend) {
            this.log("WebSocket already patched, skipping");
            return;
        }

        this.originalWebSocketSend = WebSocket.prototype.send;
        const self = this;

        WebSocket.prototype.send = function(data) {
            let payload = data;
            let modified = false;

            if (!self.isActive) {
                return self.originalWebSocketSend.call(this, payload);
            }

            try {
                // Handle ETF format (ArrayBuffer)
                if (payload instanceof ArrayBuffer) {
                    const view = new Uint8Array(payload);
                    
                    // Check for ETF magic bytes
                    if (view[0] === 0x83 && view[1] === 0x74) {
                        // Look for op:4 pattern (0x6f 0x70 0x61 0x04)
                        for (let i = 0; i < view.length - 20; i++) {
                            if (view[i] === 0x6f && view[i+1] === 0x70 && 
                                view[i+2] === 0x61 && view[i+3] === 0x04) {
                                
                                self.log("🎯 VOICE_STATE_UPDATE detected (ETF)");
                                
                                // Search for "self_mute" followed by atom "false" (0x73 0x05 "false")
                                for (let j = i; j < view.length - 16; j++) {
                                    // Pattern: self_mute + s(5) + "false"
                                    if (view[j] === 0x73 && view[j+1] === 0x65 && view[j+2] === 0x6c && 
                                        view[j+3] === 0x66 && view[j+4] === 0x5f && view[j+5] === 0x6d &&
                                        view[j+6] === 0x75 && view[j+7] === 0x74 && view[j+8] === 0x65 &&
                                        view[j+9] === 0x73 && view[j+10] === 0x05 &&
                                        view[j+11] === 0x66 && view[j+12] === 0x61 && view[j+13] === 0x6c &&
                                        view[j+14] === 0x73 && view[j+15] === 0x65) {
                                        
                                        self.log("📍 Found self_mute=false, changing to true");
                                        // Replace "false" (0x73 0x05 0x66...) with "true" (0x73 0x04 0x74...)
                                        const modifiable = new Uint8Array(view);
                                        modifiable[j+10] = 0x04; // length 4 instead of 5
                                        modifiable[j+11] = 0x74; // 't'
                                        modifiable[j+12] = 0x72; // 'r'
                                        modifiable[j+13] = 0x75; // 'u'
                                        modifiable[j+14] = 0x65; // 'e'
                                        // Shift remaining bytes left by 1
                                        for (let k = j + 15; k < modifiable.length - 1; k++) {
                                            modifiable[k] = modifiable[k + 1];
                                        }
                                        payload = modifiable.buffer.slice(0, modifiable.length - 1);
                                        modified = true;
                                    }
                                }
                                
                                // Search for "self_deaf" followed by atom "false"
                                const currentView = new Uint8Array(payload);
                                for (let j = i; j < currentView.length - 16; j++) {
                                    if (currentView[j] === 0x73 && currentView[j+1] === 0x65 && currentView[j+2] === 0x6c && 
                                        currentView[j+3] === 0x66 && currentView[j+4] === 0x5f && currentView[j+5] === 0x64 &&
                                        currentView[j+6] === 0x65 && currentView[j+7] === 0x61 && currentView[j+8] === 0x66 &&
                                        currentView[j+9] === 0x73 && currentView[j+10] === 0x05 &&
                                        currentView[j+11] === 0x66 && currentView[j+12] === 0x61 && currentView[j+13] === 0x6c &&
                                        currentView[j+14] === 0x73 && currentView[j+15] === 0x65) {
                                        
                                        self.log("📍 Found self_deaf=false, changing to true");
                                        const modifiable = new Uint8Array(currentView);
                                        modifiable[j+10] = 0x04;
                                        modifiable[j+11] = 0x74;
                                        modifiable[j+12] = 0x72;
                                        modifiable[j+13] = 0x75;
                                        modifiable[j+14] = 0x65;
                                        for (let k = j + 15; k < modifiable.length - 1; k++) {
                                            modifiable[k] = modifiable[k + 1];
                                        }
                                        payload = modifiable.buffer.slice(0, modifiable.length - 1);
                                        modified = true;
                                    }
                                }
                                
                                if (modified) {
                                    self.log("✅ Modified ETF packet");
                                }
                                break;
                            }
                        }
                    }
                }
                // Handle JSON/zlib format (String/Blob)
                else if (typeof payload === "string") {
                    try {
                        const parsed = JSON.parse(payload);
                        if (parsed.op === 4 && parsed.d) {
                            self.log("🎯 VOICE_STATE_UPDATE detected (JSON)");
                            if (parsed.d.self_mute === false) {
                                parsed.d.self_mute = true;
                                modified = true;
                                self.log("📍 Changed self_mute: false → true");
                            }
                            if (parsed.d.self_deaf === false) {
                                parsed.d.self_deaf = true;
                                modified = true;
                                self.log("📍 Changed self_deaf: false → true");
                            }
                            if (modified) {
                                payload = JSON.stringify(parsed);
                                self.log("✅ Modified JSON packet");
                            }
                        }
                    } catch (e) {
                        // Not JSON, ignore
                    }
                }
            } catch (e) {
                self.log("❌ Error modifying packet:", e);
            }

            return self.originalWebSocketSend.call(this, payload);
        };

        this.log("WebSocket patched successfully");
    }

    unpatchWebSocket() {
        if (this.originalWebSocketSend) {
            WebSocket.prototype.send = this.originalWebSocketSend;
            this.originalWebSocketSend = null;
            this.log("WebSocket unpatched");
        }
    }

    handleKeyDown(e) {
        if (this.mySettings.shiftKeyRequired && !e.shiftKey) {
            return;
        }

        if (e.key.toLowerCase() === this.mySettings.triggerKey.toLowerCase()) {
            this.isActive = !this.isActive;
            this.updateIndicator();
            BdApi.UI.showToast(
                `FakeDeafen ${this.isActive ? "enabled" : "disabled"}`,
                { type: this.isActive ? "success" : "info" }
            );
            this.log(`FakeDeafen ${this.isActive ? "enabled" : "disabled"}`);
        }
    }

    createIndicator() {
        if (this.indicator) return;

        this.indicator = document.createElement("div");
        this.indicator.id = "fakedeafen-indicator";
        this.indicator.textContent = "FD";
        this.indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            background: #43b581;
            color: white;
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            cursor: pointer;
            user-select: none;
        `;
        
        this.indicator.addEventListener("click", () => {
            this.isActive = !this.isActive;
            this.updateIndicator();
            BdApi.UI.showToast(
                `FakeDeafen ${this.isActive ? "enabled" : "disabled"}`,
                { type: this.isActive ? "success" : "info" }
            );
        });

        document.body.appendChild(this.indicator);
        this.log("Indicator created");
    }

    updateIndicator() {
        if (this.indicator) {
            this.indicator.style.display = this.isActive ? "flex" : "none";
        }
    }

    removeIndicator() {
        if (this.indicator) {
            this.indicator.remove();
            this.indicator = null;
            this.log("Indicator removed");
        }
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "20px";

        const settingsDiv = document.createElement("div");
        settingsDiv.style.cssText = "display: flex; flex-direction: column; gap: 15px;";

        const settings = [
            { key: "shiftKeyRequired", label: "Require Shift key", type: "checkbox" },
            { key: "triggerKey", label: "Trigger key", type: "text" },
            { key: "debugMode", label: "Debug mode", type: "checkbox" }
        ];

        settings.forEach(({ key, label, type }) => {
            const div = document.createElement("div");
            div.style.cssText = "display: flex; flex-direction: column; gap: 5px;";

            if (type === "checkbox") {
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = this.mySettings[key];
                checkbox.onchange = (e) => {
                    this.mySettings[key] = e.target.checked;
                    BdApi.Data.save(this.pluginName, "settings", this.mySettings);
                    this.log(`Setting ${key} = ${e.target.checked}`);
                };

                const labelEl = document.createElement("label");
                labelEl.style.color = "#dcddde";
                labelEl.appendChild(checkbox);
                labelEl.appendChild(document.createTextNode(" " + label));
                div.appendChild(labelEl);
            } else {
                const labelEl = document.createElement("label");
                labelEl.textContent = label + ":";
                labelEl.style.display = "block";
                labelEl.style.marginBottom = "5px";
                labelEl.style.color = "#dcddde";
                div.appendChild(labelEl);

                const input = document.createElement("input");
                input.type = "text";
                input.value = this.mySettings[key];
                input.style.cssText = `
                    width: 100%;
                    padding: 8px;
                    background: #202225;
                    border: 1px solid #202225;
                    border-radius: 3px;
                    color: #fff;
                    font-size: 14px;
                `;
                input.onchange = (e) => {
                    this.mySettings[key] = e.target.value;
                    BdApi.Data.save(this.pluginName, "settings", this.mySettings);
                    this.log(`Setting ${key} = ${e.target.value}`);
                };
                div.appendChild(input);
            }

            settingsDiv.appendChild(div);
        });

        panel.appendChild(settingsDiv);

        const info = document.createElement("div");
        info.style.cssText = "margin-top: 20px; padding: 12px; background: #2f3136; border-radius: 5px; color: #b9bbbe; font-size: 13px;";
        info.innerHTML = `
            <strong>How to use:</strong><br>
            1. Join a voice channel<br>
            2. Press <strong>${this.mySettings.triggerKey.toUpperCase()}</strong> to toggle FakeDeafen<br>
            3. Click unmute/undeafen in Discord UI - you'll appear deaf to others but can hear and talk<br>
            4. Press <strong>${this.mySettings.triggerKey.toUpperCase()}</strong> again to disable<br>
            <br>
            <em>✅ Fixed ETF boolean encoding for Canary</em>
        `;
        panel.appendChild(info);

        return panel;
    }
};
