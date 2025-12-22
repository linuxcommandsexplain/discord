/**
 * @name FakeDeafen
 * @description Lets you appear deafened while still being able to hear and talk (universal ETF+JSON support)
 * @version 1.1
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
            ctrlKeyRequired: false,
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
            if (!self.isActive) {
                return self.originalWebSocketSend.call(this, data);
            }

            let modified = false;

            if (typeof data === "string") {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.op === 4 && parsed.d) {
                        self.log("🎯 VOICE_STATE_UPDATE detected (JSON)", parsed.d);
                        
                        if (parsed.d.self_mute === false) {
                            parsed.d.self_mute = true;
                            self.log("📍 Changed self_mute: false → true");
                            modified = true;
                        }
                        if (parsed.d.self_deaf === false) {
                            parsed.d.self_deaf = true;
                            self.log("📍 Changed self_deaf: false → true");
                            modified = true;
                        }

                        if (modified) {
                            data = JSON.stringify(parsed);
                            self.log("✅ Modified JSON packet", parsed.d);
                        }
                    }
                } catch (e) {
                    self.log("⚠️ JSON parse error:", e);
                }
            } else if (data instanceof ArrayBuffer) {
                const view = new Uint8Array(data);
                
                if (view[0] === 0x83 && view[1] === 0x74) {
                    for (let i = 0; i < view.length - 4; i++) {
                        if (view[i] === 0x6f && view[i+1] === 0x70 && 
                            view[i+2] === 0x61 && view[i+3] === 0x04) {
                            
                            self.log("🎯 VOICE_STATE_UPDATE detected (ETF)");
                            const mutable = new Uint8Array(view);
                            
                            // Chercher "self_mute" + false
                            for (let j = i; j < mutable.length - 20; j++) {
                                if (mutable[j] === 0x73 && mutable[j+1] === 0x65 && 
                                    mutable[j+2] === 0x6c && mutable[j+3] === 0x66 && 
                                    mutable[j+4] === 0x5f && mutable[j+5] === 0x6d &&
                                    mutable[j+6] === 0x75 && mutable[j+7] === 0x74 && 
                                    mutable[j+8] === 0x65) {
                                    
                                    // Vérifier si suivi de "false" (0x73 0x05 "false")
                                    if (mutable[j+9] === 0x73 && mutable[j+10] === 0x05 &&
                                        mutable[j+11] === 0x66 && mutable[j+12] === 0x61 && 
                                        mutable[j+13] === 0x6c && mutable[j+14] === 0x73 && 
                                        mutable[j+15] === 0x65) {
                                        
                                        self.log("📍 Found self_mute=false, changing to true");
                                        mutable[j+10] = 0x04;  // Longueur 5 → 4
                                        mutable[j+11] = 0x74;  // 't'
                                        mutable[j+12] = 0x72;  // 'r'
                                        mutable[j+13] = 0x75;  // 'u'
                                        mutable[j+14] = 0x65;  // 'e'
                                        modified = true;
                                    }
                                }
                                
                                // Chercher "self_deaf" + false
                                if (mutable[j] === 0x73 && mutable[j+1] === 0x65 && 
                                    mutable[j+2] === 0x6c && mutable[j+3] === 0x66 && 
                                    mutable[j+4] === 0x5f && mutable[j+5] === 0x64 &&
                                    mutable[j+6] === 0x65 && mutable[j+7] === 0x61 && 
                                    mutable[j+8] === 0x66) {
                                    
                                    if (mutable[j+9] === 0x73 && mutable[j+10] === 0x05 &&
                                        mutable[j+11] === 0x66 && mutable[j+12] === 0x61 && 
                                        mutable[j+13] === 0x6c && mutable[j+14] === 0x73 && 
                                        mutable[j+15] === 0x65) {
                                        
                                        self.log("📍 Found self_deaf=false, changing to true");
                                        mutable[j+10] = 0x04;
                                        mutable[j+11] = 0x74;
                                        mutable[j+12] = 0x72;
                                        mutable[j+13] = 0x75;
                                        mutable[j+14] = 0x65;
                                        modified = true;
                                    }
                                }
                            }
                            
                            if (modified) {
                                data = mutable.buffer;
                                self.log("✅ Modified ETF packet");
                            }
                            break;
                        }
                    }
                }
            }

            return self.originalWebSocketSend.call(this, data);
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
        if (e.key.toLowerCase() !== this.mySettings.triggerKey.toLowerCase()) {
            return;
        }

        // Vérifier les modificateurs requis
        if (this.mySettings.shiftKeyRequired && !e.shiftKey) {
            return;
        }
        if (this.mySettings.ctrlKeyRequired && !e.ctrlKey) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        this.isActive = !this.isActive;

        if (this.indicator) {
            this.indicator.style.display = this.isActive ? "flex" : "none";
        }

        const status = this.isActive ? "ENABLED" : "DISABLED";
        BdApi.UI.showToast(`FakeDeafen ${status}`, { 
            type: this.isActive ? "success" : "info" 
        });
        this.log(`FakeDeafen toggled: ${status}`);
    }

    createIndicator() {
        this.indicator = document.createElement("div");
        this.indicator.textContent = "🥷 Fake Deafen ENABLED !";
        this.indicator.style.cssText = `
            position: fixed;
            top: 80px;
            right: 10px;
            padding: 12px 24px;
            background: rgba(237, 66, 69, 0.95);
            color: white;
            border-radius: 5px;
            display: none;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(237, 66, 69, 0.5);
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            font-weight: bold;
            font-size: 16px;
            pointer-events: auto;
        `;

        this.indicator.addEventListener("click", () => {
            this.isActive = false;
            this.indicator.style.display = "none";
            BdApi.UI.showToast("FakeDeafen DISABLED", { type: "info"});
            this.log("FakeDeafen disabled via indicator click");
        });

        document.body.appendChild(this.indicator);
        this.log("Indicator created");
    }


    removeIndicator() {
        if (this.indicator && this.indicator.parentNode) {
            this.indicator.parentNode.removeChild(this.indicator);
            this.indicator = null;
            this.log("Indicator removed");
        }
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.cssText = "padding: 16px; background: #2f3136; border-radius: 8px;";

        const title = document.createElement("h2");
        title.textContent = "FakeDeafen Settings";
        title.style.cssText = "color: #fff; margin-bottom: 16px; font-size: 20px;";
        panel.appendChild(title);

        const settingsDiv = document.createElement("div");
        settingsDiv.style.cssText = "display: flex; flex-direction: column; gap: 16px;";

        const settings = [
            { key: "shiftKeyRequired", label: "Require Shift key", type: "checkbox" },
            { key: "ctrlKeyRequired", label: "Require Ctrl key", type: "checkbox" },
            { key: "triggerKey", label: "Trigger key", type: "text" },
            { key: "debugMode", label: "Debug mode", type: "checkbox" }
        ];

        settings.forEach(({ key, label, type }) => {
            const div = document.createElement("div");
            div.style.cssText = "display: flex; flex-direction: column;";

            if (type === "checkbox") {
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = this.mySettings[key];
                checkbox.style.cssText = "margin-right: 8px; cursor: pointer;";
                checkbox.onchange = (e) => {
                    this.mySettings[key] = e.target.checked;
                    BdApi.Data.save(this.pluginName, "settings", this.mySettings);
                    this.log(`Setting ${key} = ${e.target.checked}`);
                };

                const labelEl = document.createElement("label");
                labelEl.style.cssText = "display: flex; align-items: center; cursor: pointer; color: #dcddde;";
                labelEl.appendChild(checkbox);
                labelEl.appendChild(document.createTextNode(" " + label));
                div.appendChild(labelEl);
            } else {
                const labelEl = document.createElement("label");
                labelEl.textContent = label + ":";
                labelEl.style.cssText = "display: block; margin-bottom: 5px; color: #dcddde;";
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
