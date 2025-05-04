/**
 * @name AutoFollowUser
 * @author Sleek
 * @version 1.1.3
 * @description Ce plugin BetterDiscord vous permet de suivre automatiquement vos amis lorsqu'ils entrent dans un salon vocal, sans logs ni console.
 */

module.exports = class AutoFollowUser {
    constructor() {
        this.currentUser = null;
        this.followInterval = null;
        this.modalObserver = null;
    }

    start() {
        this.applyUserContextMenuPatch();
        this.observeModals();
    }

    stop() {
        this.removeUserContextMenuPatch();
        this.stopFollowInterval();
        this.disconnectModalObserver();
    }

    applyUserContextMenuPatch() {
        BdApi.ContextMenu.patch('user-context', this.modifyUserContextMenu.bind(this));
    }

    removeUserContextMenuPatch() {
        BdApi.ContextMenu.unpatch('user-context', this.modifyUserContextMenu.bind(this));
    }

    modifyUserContextMenu(menu, context) {
        const user = context.user;
        const item = BdApi.React.createElement(BdApi.ContextMenu.Item, {
            id: `auto-follow-user-${user.id}`,
            label: this.currentUser === user.id ? 'UnFollow this user ❌' : 'Follow this user ✅',
            action: () => this.toggleUserFollow(user.id)
        });
        menu.props.children.push(item);
    }

    toggleUserFollow(userId) {
        if (this.currentUser === userId) {
            this.currentUser = null;
            this.stopFollowInterval();
        } else {
            if (this.currentUser) this.stopFollowInterval();
            this.currentUser = userId;
            this.startFollowInterval();
        }
    }

    startFollowInterval() {
        const v = BdApi.findModuleByProps('getVoiceStateForUser');
        const s = BdApi.findModuleByProps('selectVoiceChannel');
        this.followInterval = setInterval(() => {
            const u = v.getVoiceStateForUser(this.currentUser);
            if (u && u.channelId) s.selectVoiceChannel(u.channelId);
        }, 1000);
    }

    stopFollowInterval() {
        if (this.followInterval) {
            clearInterval(this.followInterval);
            this.followInterval = null;
        }
    }

    observeModals() {
        this.modalObserver = new MutationObserver(m => {
            for (let a of m) {
                for (let n of a.addedNodes) {
                    if (n.nodeType === 1 && n.querySelector?.('div[role="dialog"]')) {
                        const t = n.textContent;
                        if (t && (t.includes('CHANNEL IS FULL') || t.includes('max number of people'))) {
                            this.stopFollowInterval();
                            this.currentUser = null;
                            return;
                        }
                    }
                }
            }
        });
        this.modalObserver.observe(document.body, { childList: true, subtree: true });
    }

    disconnectModalObserver() {
        if (this.modalObserver) {
            this.modalObserver.disconnect();
            this.modalObserver = null;
        }
    }
};
