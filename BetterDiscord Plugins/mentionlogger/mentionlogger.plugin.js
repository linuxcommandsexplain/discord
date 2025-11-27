/**
 * @name MentionLogger
 * @description Records all hidden mentions / Pings
 * @author Sleek
 * @authorId 153253064231354368
 * @version 1.1.2
 * @invite B5kBdSsED2
 * @license Unlicensed
 * @website https://sleek.blackbox.sh/
 * @source https://github.com/s4dic/BetterDiscord/tree/main/mentionlogger
 * @updateUrl https://raw.githubusercontent.com/s4dic/BetterDiscord/main/mentionlogger/mentionlogger.plugin.js
 */

module.exports = class MentionLogger {
    constructor() {
        this.pluginName = "MentionLogger";
        this.defaultSettings = { mentions: [] };
        this.settings = this.loadSettings();

        this.dispatcher = null;
        this.unsubscribe = null;
    }

    /* BetterDiscord lifecycle */

    load() {
        // Rien de spécial à faire ici
    }

    start() {
        console.log(`[${this.pluginName}] started`);
        this.initializePlugin();
    }

    stop() {
        if (this.unsubscribe) {
            try {
                this.unsubscribe();
            } catch (e) {
                console.error(`[${this.pluginName}] error while unsubscribing`, e);
            }
            this.unsubscribe = null;
        }

        try {
            BdApi.Patcher.unpatchAll(this.pluginName);
        } catch (e) {
            console.error(`[${this.pluginName}] error while unpatching`, e);
        }

        console.log(`[${this.pluginName}] stopped`);
    }

    /* Initialisation */

    initializePlugin() {
        const Dispatcher = BdApi.Webpack.getByKeys("dispatch", "subscribe");
        const UserStore = BdApi.Webpack.getStore("UserStore");

        if (!Dispatcher || !UserStore) {
            console.error(
                `[${this.pluginName}] Failed to get Dispatcher or UserStore`,
                { Dispatcher, UserStore }
            );
            return;
        }

        this.dispatcher = Dispatcher;

        this.unsubscribe = Dispatcher.subscribe("MESSAGE_CREATE", (e) => {
            const message = e?.message;
            const currentUser = UserStore.getCurrentUser?.();

            if (!message || !currentUser) return;
            if (!message.mentions || !Array.isArray(message.mentions)) return;

            const isMentioningCurrentUser = message.mentions.some(m => m.id === currentUser.id);
            if (isMentioningCurrentUser) {
                console.log(`[${this.pluginName}] Mention detected:`, message);
                this.logMention(message);
            }
        });
    }

    /* Core logic */

    logMention(message) {
        const author = message.author || {};

        const mentionDetails = {
            authorUsername: author.username || "Unknown",
            authorGlobalName: author.global_name || author.username || "Unknown",
            authorId: author.id || "0",
            content: message.content || "",
            messageId: message.id,
            timestamp: new Date(message.timestamp).toLocaleString(),
            channelId: message.channel_id,
            guildId: message.guild_id
        };

        const isDuplicate = this.settings.mentions.some(
            mention => mention.messageId === mentionDetails.messageId
        );

        if (!isDuplicate) {
            this.settings.mentions.push(mentionDetails);
            this.saveSettings();
            console.log(`[${this.pluginName}] Mention details saved:`, mentionDetails);
        } else {
            console.log(
                `[${this.pluginName}] Mention already recorded, ignored:`,
                mentionDetails
            );
        }
    }

    /* Persistence */

    loadSettings() {
        try {
            const stored = BdApi.Data.load(this.pluginName, "settings") || {};
            return Object.assign({}, this.defaultSettings, stored);
        } catch (e) {
            console.error(`[${this.pluginName}] Failed to load settings`, e);
            return Object.assign({}, this.defaultSettings);
        }
    }

    saveSettings() {
        try {
            BdApi.Data.save(this.pluginName, "settings", this.settings);
        } catch (e) {
            console.error(`[${this.pluginName}] Failed to save settings`, e);
        }
    }

    /* Settings panel */

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.userSelect = "text";

        const title = document.createElement("h3");
        title.innerText = "Mentions History";
        title.style.color = "#ff0000";
        panel.appendChild(title);

        const mentionsList = document.createElement("div");
        mentionsList.style.userSelect = "text";

        // On garde l'ordre naturel : plus anciennes en haut, plus récentes en bas
        const mentions = this.settings.mentions;

        mentions.forEach((mention, index) => {
            const mentionEl = document.createElement("div");

            const formattedDate = mention.timestamp;

            const contentWithoutMention = (mention.content || "")
                .replace(/<@\d+>/g, "")
                .replace(/\s{2,}/g, " ")
                .trim();

            mentionEl.innerHTML = `
                <strong style="color: #00FF00;">Mention ${index + 1}:</strong><br>
                <span style="color: #00FF00;">Unique ID:</span> <span style="color: #ff0000;">&lt;@${mention.authorId}&gt;</span><br>
                <span style="color: #00FF00;">Mention Channel:</span> <span style="color: #ffff00;">&lt;#${mention.channelId}&gt;</span><br>
                <span style="color: #00FF00;">Discord Username:</span> <span style="color: #ffffff;">${mention.authorUsername}</span><br>
                <span style="color: #00FF00;">Author:</span> <span style="color: #ffffff;">${mention.authorGlobalName}</span><br>
                <span style="color: #00FF00;">Timestamp:</span> <span style="color: #ffffff;">${formattedDate}</span><br>
                <span style="color: #00FF00;">Mention Content:</span> <span style="color: #ffffff;">${contentWithoutMention}</span><br>
                <br>
            `;
            mentionsList.appendChild(mentionEl);
        });

        panel.appendChild(mentionsList);

        const clearButton = document.createElement("button");
        clearButton.textContent = "Clear mentions history";
        clearButton.onclick = () => {
            this.settings.mentions = [];
            this.saveSettings();

            while (mentionsList.firstChild) {
                mentionsList.removeChild(mentionsList.firstChild);
            }
        };
        panel.appendChild(clearButton);

        return panel;
    }
};
