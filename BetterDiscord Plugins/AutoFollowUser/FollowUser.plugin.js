/**
 * @name AutoFollowUser
 * @author Sleek
 * @version 1.1.4
 * @description Ce plugin BetterDiscord vous permet de suivre automatiquement vos amis lorsqu'ils entrent dans un salon vocal, sans logs ni console.
 */

module.exports = class AutoFollowUser {
    constructor() {
        this.currentUser = null;
        this.followInterval = null;
        this.modalObserver = null;
        this.contextObserver = null;
    }

    start() {
        this.observeContextMenus();
        this.observeModals();
    }

    stop() {
        this.stopFollowInterval();
        this.disconnectModalObserver();
        this.disconnectContextObserver();
    }

    observeContextMenus() {
        this.contextObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        // Détection de TOUS les types de menus contextuels
                        const menu = node.querySelector?.('[role="menu"]') || 
                                   (node.getAttribute?.('role') === 'menu' ? node : null);
                        
                        if (menu && !menu.querySelector('#auto-follow-context')) {
                            this.injectContextMenuItem(menu);
                        }
                    }
                }
            }
        });
        this.contextObserver.observe(document.body, { childList: true, subtree: true });
    }

    disconnectContextObserver() {
        if (this.contextObserver) {
            this.contextObserver.disconnect();
            this.contextObserver = null;
        }
    }

    injectContextMenuItem(contextMenu) {
        // Extraction de l'userId via React Fiber (remontée dans l'arbre)
        let fiber = this.getReactInstance(contextMenu);
        let userId = null;
        let attempts = 0;
        
        // Remonte l'arbre React pour trouver l'userId
        while (fiber && attempts < 50) {
            const props = fiber.memoizedProps || fiber.pendingProps;
            
            if (props?.user?.id) {
                userId = props.user.id;
                break;
            }
            if (props?.userId) {
                userId = props.userId;
                break;
            }
            if (props?.channel?.recipients?.[0]) {
                userId = props.channel.recipients[0];
                break;
            }
            
            fiber = fiber.return;
            attempts++;
        }
        
        if (!userId) return;

        // Vérification si déjà injecté
        if (contextMenu.querySelector('#auto-follow-context')) return;

        const isFollowing = this.currentUser === userId;
        const menuItem = this.createMenuItem(userId, isFollowing);

        // Insertion après le premier groupe de menu
        const firstGroup = contextMenu.querySelector('[role="group"]');
        if (firstGroup) {
            firstGroup.appendChild(menuItem);
        } else {
            // Fallback: insertion au début
            const firstItem = contextMenu.querySelector('[role="menuitem"]');
            if (firstItem) {
                firstItem.parentNode.insertBefore(menuItem, firstItem);
            }
        }
    }

    createMenuItem(userId, isFollowing) {
        const item = document.createElement('div');
        item.className = 'item_c91bad labelContainer_c91bad colorDefault_c91bad';
        item.setAttribute('role', 'menuitem');
        item.setAttribute('tabindex', '-1');
        item.id = 'auto-follow-context';
        
        item.style.cssText = `
            background: transparent !important; 
            color: var(--interactive-normal) !important;
            padding: 6px 8px !important;
            min-height: 32px !important;
            display: flex !important;
            align-items: center !important;
            box-sizing: border-box !important;
            cursor: pointer !important;
        `;
        
        item.innerHTML = `
            <div class="label_c91bad" style="color: inherit !important; flex: 1 1 auto;">
                ${isFollowing ? '📌 UnFollow this user' : '📌 Follow this user'}
            </div>
        `;
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Ferme TOUS les menus contextuels ouverts
            document.querySelectorAll('[role="menu"]').forEach(m => {
                const layer = m.closest('[class*="layer"]');
                if (layer) layer.remove();
                else m.remove();
            });
            
            this.toggleUserFollow(userId);
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
                cursor: pointer !important;
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
                cursor: pointer !important;
            `;
        });
        
        return item;
    }

    getReactInstance(element) {
        for (const key in element) {
            if (key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber')) {
                return element[key];
            }
        }
        return null;
    }

    toggleUserFollow(userId) {
        if (this.currentUser === userId) {
            this.currentUser = null;
            this.stopFollowInterval();
            BdApi.UI.showToast('❌ Auto-follow stopped', { type: 'info' });
        } else {
            if (this.currentUser) this.stopFollowInterval();
            this.currentUser = userId;
            this.startFollowInterval();
            BdApi.UI.showToast('✅ Auto-follow started', { type: 'success' });
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
                            BdApi.UI.showToast('❌ Channel full - Auto-follow stopped', { type: 'error' });
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
