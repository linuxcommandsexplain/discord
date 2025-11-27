/**
 * @name FakeDeafen
 * @description Lets you appear deafened while still being able to hear and talk (blocks VOICE_STATE updates but lets channel moves pass)
 * @version 0.7
 * @author Sleek
 * @authorId 153253064231354368
 * @invite B5kBdSsED2
 * @license Unlicensed
 * @website https://sleek.blackbox.sh/
 * @source https://github.com/s4dic/BetterDiscord/tree/main/FakeDeafen
 * @updateUrl https://raw.githubusercontent.com/s4dic/BetterDiscord/main/FakeDeafen/FakeDeafen.plugin.js
 */

module.exports = class FakeDeafen {
    constructor(meta) {
        this.meta = meta || {};
        this.pluginName = this.meta.name || "FakeDeafen";

        this.mySettings = {
            shiftKeyRequired: false,
            triggerKey: "w",
            showButton: false
        };

        this.isActive = false;

        this.myButton = document.createElement("button");
        this.myButton.textContent = "Toggle Fake Deafen";
        this.myButton.addEventListener("click", () => { this.toggleDeafen(); });

        this.myButton.style.width = "150px";
        this.myButton.style.height = "40px";
        this.myButton.style.fontSize = "12px";

        // handler pour add/removeEventListener
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);

        // flag pour laisser passer le prochain paquet vocal (channel move)
        this.allowNextVoicePacket = false;

        // stockera le module de changement de channel vocal
        this.channelActions = null;

        // Sauvegarde la méthode send originale une seule fois
        if (!WebSocket.prototype._fakeDeafenOriginalSend) {
            WebSocket.prototype._fakeDeafenOriginalSend = WebSocket.prototype.send;
        }
    }

    /* ---------------------- Utils ---------------------- */

    toast(message, options = {}) {
        if (BdApi.UI && typeof BdApi.UI.showToast === "function") {
            BdApi.UI.showToast(message, options);
        } else {
            console.log(`[${this.pluginName} toast]`, message, options);
        }
    }

    _asciiBytes(str) {
        const arr = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            arr[i] = str.charCodeAt(i) & 0xFF;
        }
        return arr;
    }

    /**
     * Retourne true si ce paquet gateway doit être bloqué (ne pas être envoyé).
     * On ne manipule pas le payload, on fait juste de l'inspection binaire.
     */
    shouldBlockPacket(data, url) {
        // On ne s'intéresse qu'au gateway Discord
        if (!url || !url.includes("gateway")) return false;

        let view;
        if (data instanceof ArrayBuffer) {
            view = new Uint8Array(data);
        } else if (ArrayBuffer.isView(data)) {
            view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        } else {
            return false;
        }

        // On cherche les séquences ASCII "self_mute" ou "self_deaf" dans le binaire.
        const patterns = [
            this._asciiBytes("self_mute"),
            this._asciiBytes("self_deaf")
        ];

        outer: for (const pat of patterns) {
            const plen = pat.length;
            if (plen === 0) continue;
            for (let i = 0; i <= view.length - plen; i++) {
                let ok = true;
                for (let j = 0; j < plen; j++) {
                    if (view[i + j] !== pat[j]) {
                        ok = false;
                        break;
                    }
                }
                if (ok) {
                    // On a trouvé un payload vocal (VOICE_STATE_UPDATE)
                    return true;
                }
            }
        }

        return false;
    }

    /* ---------------------- Fake Deafen core ---------------------- */

    toggleDeafen() {
        if (!this.isActive) {
            const plugin = this;
            const originalSend = WebSocket.prototype._fakeDeafenOriginalSend;

            WebSocket.prototype.send = function (data) {
                try {
                    // Si on a demandé explicitement de laisser passer le prochain paquet vocal,
                    // on laisse passer tel quel et on reset le flag.
                    if (plugin.allowNextVoicePacket && this.url && this.url.includes("gateway")) {
                        plugin.allowNextVoicePacket = false;
                        return originalSend.apply(this, arguments);
                    }

                    // Sinon, logique normale : on bloque les VOICE_STATE_UPDATE
                    if (plugin.shouldBlockPacket(data, this.url)) {
                        // On avale ce paquet (mute/deafen ne part pas au serveur)
                        return;
                    }
                } catch (e) {
                    console.error("[FakeDeafen] error while inspecting packet:", e);
                    // En cas d'erreur, on n’empêche surtout pas l'envoi
                }

                return originalSend.apply(this, arguments);
            };

            this.toast("Fake Deafen Activated", { type: "success" });
            this.isActive = true;
        } else {
            // Restaure la méthode originale
            WebSocket.prototype.send = WebSocket.prototype._fakeDeafenOriginalSend;
            this.toast("Fake Deafen Deactivated", { type: "warning" });
            this.isActive = false;
        }
    }

    /* ---------------------- BD lifecycle ---------------------- */

    start() {
        // Load settings (protégé)
        try {
            const saved = BdApi.Data.load(this.pluginName, "settings") || {};
            Object.assign(this.mySettings, saved);
        } catch (e) {
            console.error(`[${this.pluginName}] Failed to load settings`, e);
        }

        document.addEventListener("keydown", this.boundHandleKeyDown);

        // Patch des actions de channel vocal pour autoriser le prochain paquet quand on bouge
        try {
            this.channelActions =
                BdApi.Webpack.getByKeys("selectVoiceChannel", "selectChannel") || null;

            if (this.channelActions && this.channelActions.selectVoiceChannel) {
                BdApi.Patcher.instead(
                    this.pluginName,
                    this.channelActions,
                    "selectVoiceChannel",
                    (that, args, original) => {
                        // Quand l'utilisateur change de salon vocal,
                        // on autorise explicitement le prochain VOICE_STATE_UPDATE
                        this.allowNextVoicePacket = true;
                        return original.apply(that, args);
                    }
                );
            }
        } catch (e) {
            console.error(`[${this.pluginName}] Failed to patch selectVoiceChannel`, e);
        }

        // Inject le bouton si activé
        if (this.mySettings.showButton) {
            const muteButton = document.querySelector('[aria-label="Mute"]');
            if (muteButton && muteButton.parentNode) {
                const buttonContainer = document.createElement("div");
                buttonContainer.classList.add("button-container");
                buttonContainer.appendChild(this.myButton);
                muteButton.parentNode.insertBefore(buttonContainer, muteButton.nextSibling);
            }
        }
    }

    handleKeyDown(event) {
        const hasModifier =
            (this.mySettings.shiftKeyRequired && event.shiftKey) ||
            (!this.mySettings.shiftKeyRequired && event.ctrlKey);

        if (
            hasModifier &&
            event.key.toLowerCase() === this.mySettings.triggerKey.toLowerCase()
        ) {
            this.toggleDeafen();
        }
    }

    stop() {
        // On remet le send original
        if (WebSocket.prototype._fakeDeafenOriginalSend) {
            WebSocket.prototype.send = WebSocket.prototype._fakeDeafenOriginalSend;
        }

        if (this.myButton) this.myButton.remove();
        document.removeEventListener("keydown", this.boundHandleKeyDown);

        try {
            BdApi.Patcher.unpatchAll(this.pluginName);
        } catch (e) {
            console.error(`[${this.pluginName}] Failed to unpatch`, e);
        }

        this.allowNextVoicePacket = false;
    }

    /* ---------------------- Settings panel ---------------------- */

    getSettingsPanel() {
        const panel = document.createElement("div");

        const triggerKeySetting = document.createElement("div");
        triggerKeySetting.innerHTML = `
            <label>Trigger Key:
                <input type="text" value="${this.mySettings.triggerKey}" />
            </label>`;
        triggerKeySetting.querySelector("input").onchange = (e) => {
            this.mySettings.triggerKey = e.target.value;
            BdApi.Data.save(this.pluginName, "settings", this.mySettings);
        };

        const shiftKeySetting = document.createElement("div");
        shiftKeySetting.innerHTML = `
            <label>Use Shift Key:
                <input type="checkbox" ${this.mySettings.shiftKeyRequired ? "checked" : ""}/>
            </label>`;
        shiftKeySetting.querySelector("input").onchange = (e) => {
            this.mySettings.shiftKeyRequired = e.target.checked;
            BdApi.Data.save(this.pluginName, "settings", this.mySettings);
        };

        const showButtonSetting = document.createElement("div");
        showButtonSetting.innerHTML = `
            <label>Show Button:
                <input type="checkbox" ${this.mySettings.showButton ? "checked" : ""}/>
            </label>`;
        showButtonSetting.querySelector("input").onchange = (e) => {
            this.mySettings.showButton = e.target.checked;
            BdApi.Data.save(this.pluginName, "settings", this.mySettings);
        };

        panel.appendChild(triggerKeySetting);
        panel.appendChild(shiftKeySetting);
        panel.appendChild(showButtonSetting);

        return panel;
    }
};
