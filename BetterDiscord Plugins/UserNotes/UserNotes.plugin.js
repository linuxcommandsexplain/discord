/**
 * @name UserNotes
 * @author DevilBro & Sleek
 * @authorId 108351165988618240
 * @version 2.1
 * @description Allows you to write User Notes locally (File-based storage with dynamic modal)
 * @invite B5kBdSsED2
 * @website https://github.com/s4dic/discord
 * @source https://github.com/s4dic/discord/tree/main/BetterDiscord%20Plugins/UserNotes/
 * @updateUrl https://github.com/s4dic/discord/tree/main/BetterDiscord%20Plugins/UserNotes/UserNotes.plugin.js
 */

module.exports = (_ => {
    const changeLog = {
        
    };

    return !window.BDFDB_Global || (!window.BDFDB_Global.loaded && !window.BDFDB_Global.started) ? class {
        constructor (meta) {for (let key in meta) this[key] = meta[key];}
        getName () {return this.name;}
        getAuthor () {return this.author;}
        getVersion () {return this.version;}
        getDescription () {return `The Library Plugin needed for ${this.name} is missing. Open the Plugin Settings to download it. \n\n${this.description}`;}
        
        downloadLibrary () {
            BdApi.Net.fetch("https://mwittrien.github.io/BetterDiscordAddons/Library/0BDFDB.plugin.js").then(r => {
                if (!r || r.status != 200) throw new Error();
                else return r.text();
            }).then(b => {
                if (!b) throw new Error();
                else return require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0BDFDB.plugin.js"), b, _ => BdApi.UI.showToast("Finished downloading BDFDB Library", {type: "success"}));
            }).catch(error => {
                BdApi.UI.alert("Error", "Could not download BDFDB Library Plugin. Try again later or download it manually from GitHub: https://mwittrien.github.io/downloader/?library");
            });
        }
        
        load () {
            if (!window.BDFDB_Global || !Array.isArray(window.BDFDB_Global.pluginQueue)) window.BDFDB_Global = Object.assign({}, window.BDFDB_Global, {pluginQueue: []});
            if (!window.BDFDB_Global.downloadModal) {
                window.BDFDB_Global.downloadModal = true;
                BdApi.UI.showConfirmationModal("Library Missing", `The Library Plugin needed for ${this.name} is missing. Please click "Download Now" to install it.`, {
                    confirmText: "Download Now",
                    cancelText: "Cancel",
                    onCancel: _ => {delete window.BDFDB_Global.downloadModal;},
                    onConfirm: _ => {
                        delete window.BDFDB_Global.downloadModal;
                        this.downloadLibrary();
                    }
                });
            }
            if (!window.BDFDB_Global.pluginQueue.includes(this.name)) window.BDFDB_Global.pluginQueue.push(this.name);
        }
        start () {this.load();}
        stop () {}
        getSettingsPanel () {
            let template = document.createElement("template");
            template.innerHTML = `<div style="color: var(--header-primary); font-size: 16px; font-weight: 300; white-space: pre; line-height: 22px;">The Library Plugin needed for ${this.name} is missing.\nPlease click <a style="font-weight: 500;">Download Now</a> to install it.</div>`;
            template.content.firstElementChild.querySelector("a").addEventListener("click", this.downloadLibrary);
            return template.content.firstElementChild;
        }
    } : (([Plugin, BDFDB]) => {
        const path = require("path");
        const fs = require("fs");
        
        return class UserNotes extends Plugin {
            onLoad () {
                this.notesDir = path.join(BdApi.Plugins.folder, "UserNotesData");
            }
            
            onStart () {
                if (!fs.existsSync(this.notesDir)) {
                    fs.mkdirSync(this.notesDir, { recursive: true });
                }
                
                this.patchContextMenu();
            }
            
            onStop () {
                const customStyle = document.getElementById("usernotes-custom-css");
                if (customStyle) customStyle.remove();
                
                if (this.observer) {
                    this.observer.disconnect();
                    this.observer = null;
                }
            }
            
            patchContextMenu() {
                this.observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType !== 1) continue;
                            
                            const menu = node.id === 'user-context' ? node : 
                                        node.querySelector('#user-context');
                            
                            if (menu && !menu.dataset.userNotesPatched) {
                                menu.dataset.userNotesPatched = 'true';
                                this.injectMenuItem(menu);
                            }
                        }
                    }
                });
                
                this.observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
            
            injectMenuItem(menu) {
                const reactFiberKey = Object.keys(menu).find(k => k.startsWith('__reactFiber'));
                if (!reactFiberKey) return;
                
                let userId = null;
                let userName = "User";
                
                let fiber = menu[reactFiberKey];
                let maxDepth = 20;
                while (fiber && maxDepth-- > 0) {
                    if (fiber.memoizedProps?.user?.id) {
                        userId = fiber.memoizedProps.user.id;
                        userName = fiber.memoizedProps.user.username || fiber.memoizedProps.user.globalName || "User";
                        break;
                    }
                    fiber = fiber.return;
                }
                
                if (!userId) return;
                
                const note = this.loadNote(userId);
                const hasNote = note && note.trim() !== "";
                
                const groups = menu.querySelectorAll('[role="group"]');
                const lastGroup = groups[groups.length - 1];
                if (!lastGroup) return;
                
                const noteItem = this.createMenuItem(userId, userName, hasNote);
                
                const newGroup = document.createElement('div');
                newGroup.setAttribute('role', 'group');
                newGroup.appendChild(noteItem);
                
                const separator = document.createElement('div');
                separator.className = 'separator_c9dda3';
                separator.setAttribute('role', 'separator');
                
                lastGroup.parentNode.insertBefore(separator, lastGroup.nextSibling);
                lastGroup.parentNode.insertBefore(newGroup, separator.nextSibling);
            }
            
            createMenuItem(userId, userName, hasNote) {
                const item = document.createElement('div');
                item.className = 'item_c91bad labelContainer_c91bad colorDefault_c91bad';
                item.setAttribute('role', 'menuitem');
                item.setAttribute('tabindex', '-1');
                item.id = 'user-note-context';
                
                // Force le style natif Discord avec padding correct
                item.style.cssText = `
                    background: transparent !important; 
                    color: var(--interactive-normal) !important;
                    padding: 6px 8px !important;
                    min-height: 32px !important;
                    display: flex !important;
                    align-items: center !important;
                    box-sizing: border-box !important;
                `;
                
                item.innerHTML = `
                    <div class="label_c91bad" style="color: inherit !important; flex: 1 1 auto;">🕵️ ${this.labels.user_note}</div>
                    ${hasNote ? '<div class="hint_c91bad" style="color: inherit !important;">✓</div>' : ''}
                `;
                
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    document.querySelector('#user-context')?.remove();
                    this.openNotesModal({ id: userId, username: userName });
                });
                
                item.addEventListener('mouseenter', () => {
                    item.classList.add('focused_c1e9c4');
                    item.style.cssText = `
                        background: var(--menu-item-default-hover-bg) !important; 
                        color: var(--interactive-hover) !important;
                        padding: 6px 8px !important;
                        min-height: 32px !important;
                        display: flex !important;
                        align-items: center !important;
                        box-sizing: border-box !important;
                    `;
                });
                
                item.addEventListener('mouseleave', () => {
                    item.classList.remove('focused_c1e9c4');
                    item.style.cssText = `
                        background: transparent !important; 
                        color: var(--interactive-normal) !important;
                        padding: 6px 8px !important;
                        min-height: 32px !important;
                        display: flex !important;
                        align-items: center !important;
                        box-sizing: border-box !important;
                    `;
                });
                
                return item;
            }

            
            getSettingsPanel (collapseStates = {}) {
                let settingsPanel;
                return settingsPanel = BDFDB.PluginUtils.createSettingsPanel(this, {
                    collapseStates: collapseStates,
                    children: _ => {
                        let settingsItems = [];
                        settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsItem, {
                            type: "Button",
                            color: BDFDB.LibraryComponents.Button.Colors.RED,
                            label: "Remove all Notes",
                            onClick: _ => {
                                BDFDB.ModalUtils.confirm(this, "Are you sure you want to remove all usernotes?", _ => {
                                    this.deleteAllNotes();
                                });
                            },
                            children: BDFDB.LanguageUtils.LanguageStrings.REMOVE
                        }));
                        return settingsItems;
                    }
                });
            }
            
            openNotesModal (user) {
                let note = this.loadNote(user.id);
                const screenHeight = window.innerHeight;
                const screenWidth = window.innerWidth;
                const modalHeight = Math.floor(screenHeight * 0.7);
                const modalWidth = Math.min(Math.floor(screenWidth * 0.6), 900);
                const textareaRows = Math.floor((modalHeight - 150) / 20);
                
                this.injectCustomCSS();
                
                BDFDB.ModalUtils.open(this, {
                    size: "LARGE",
                    header: "User Note",
                    subHeader: user.username,
                    className: "usernotes-modal-custom",
                    children: [
                        BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextArea, {
                            value: note,
                            placeholder: "Write your note here...",
                            autoFocus: true,
                            rows: textareaRows,
                            maxLength: 50000,
                            onChange: value => note = value,
                            style: {
                                minHeight: `${modalHeight - 200}px`,
                                fontSize: "14px",
                                lineHeight: "1.5"
                            }
                        })
                    ],
                    buttons: [{
                        contents: BDFDB.LanguageUtils.LanguageStrings.SAVE,
                        color: "BRAND",
                        close: true,
                        onClick: _ => this.saveNote(user.id, note)
                    }, {
                        contents: BDFDB.LanguageUtils.LanguageStrings.CANCEL,
                        color: "TRANSPARENT",
                        close: true
                    }]
                });
            }
            
            injectCustomCSS () {
                if (document.getElementById("usernotes-custom-css")) return;
                const style = document.createElement("style");
                style.id = "usernotes-custom-css";
                style.textContent = `
                    .usernotes-modal-custom textarea {
                        font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
                        resize: vertical;
                    }
                `;
                document.head.appendChild(style);
            }
            
            loadNote (userId) {
                const notePath = path.join(this.notesDir, `${userId}.txt`);
                if (fs.existsSync(notePath)) {
                    return fs.readFileSync(notePath, "utf8");
                }
                return "";
            }
            
            saveNote (userId, content) {
                const notePath = path.join(this.notesDir, `${userId}.txt`);
                if (!content || content.trim() === "") {
                    if (fs.existsSync(notePath)) {
                        fs.unlinkSync(notePath);
                        BDFDB.NotificationUtils.toast("Note removed", {type: "success"});
                    }
                } else {
                    fs.writeFileSync(notePath, content, "utf8");
                    BDFDB.NotificationUtils.toast("Note saved", {type: "success"});
                }
            }
            
            deleteAllNotes () {
                if (!fs.existsSync(this.notesDir)) return;
                const files = fs.readdirSync(this.notesDir);
                files.forEach(file => {
                    if (file.endsWith(".txt")) {
                        fs.unlinkSync(path.join(this.notesDir, file));
                    }
                });
                BDFDB.NotificationUtils.toast("All notes removed", {type: "success"});
            }
            
            setLabelsByLanguage () {
                switch (BDFDB.LanguageUtils.getLanguage().id) {
                    case "bg": return { user_note: "Потребителска бележка" };
                    case "cs": return { user_note: "Uživatelská poznámka" };
                    case "da": return { user_note: "Brugernote" };
                    case "de": return { user_note: "Benutzernotiz" };
                    case "el": return { user_note: "Σημείωση χρήστη" };
                    case "es": return { user_note: "Nota de usuario" };
                    case "fi": return { user_note: "Käyttäjän muistiinpano" };
                    case "fr": return { user_note: "Note utilisateur" };
                    case "hi": return { user_note: "उपयोगकर्ता नोट" };
                    case "hr": return { user_note: "Korisnička bilješka" };
                    case "hu": return { user_note: "Felhasználói jegyzet" };
                    case "it": return { user_note: "Nota utente" };
                    case "ja": return { user_note: "ユーザーノート" };
                    case "ko": return { user_note: "사용자 메모" };
                    case "lt": return { user_note: "Vartotojo pastaba" };
                    case "nl": return { user_note: "Gebruikersnotitie" };
                    case "no": return { user_note: "Brukermerknad" };
                    case "pl": return { user_note: "Uwaga użytkownika" };
                    case "pt-BR": return { user_note: "Nota do usuário" };
                    case "ro": return { user_note: "Notă utilizator" };
                    case "ru": return { user_note: "Примечание пользователя" };
                    case "sv": return { user_note: "Användaranteckning" };
                    case "th": return { user_note: "หมายเหตุผู้ใช้" };
                    case "tr": return { user_note: "Kullanıcı notu" };
                    case "uk": return { user_note: "Примітка користувача" };
                    case "vi": return { user_note: "Ghi chú của người dùng" };
                    case "zh-CN": return { user_note: "用户须知" };
                    case "zh-TW": return { user_note: "用戶須知" };
                    default: return { user_note: "User Note" };
                }
            }
        };
    })(window.BDFDB_Global.PluginUtils.buildPlugin(changeLog));
})();
