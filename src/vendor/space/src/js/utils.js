export const waitForElement = (selector, parent = document) => new Promise((resolve) => {
    const el = parent.querySelector(selector);
    if (el) {
        resolve(el);
    }

    const observer = new MutationObserver(() => {
        const el = parent.querySelector(selector);
        if (!el) {
            return;
        }

        resolve(el);
        observer.disconnect();
    });

    observer.observe(document.body, {
        subtree: true,
        childList: true,
    });
});

/* Game Shelf (rf-shelf) performance patch: the theme's own home designs, game panels and picker (#rfs, #rfs-sheet …)
   change the DOM a lot — rendering a library home is hundreds of insertions. None of that concerns the trackers below,
   yet every body-wide MutationObserver here re-ran its lookups (and one forced a full style recalc) on each batch.
   steamOnly(cb) skips a batch whose changes all happened inside our own elements. */
const RFS_OWN = '#rfs, #rfs-sheet, #rfs-viewer, #rfs-bar, #rfs-themes, #rfs-toast, #rfs-tip, #rfs-navwrap, #rfs-dl, #rfs-family';
export const steamOnly = cb => (records, observer) => {
    let last = null;
    for (const r of records) {
        const t = r.target && r.target.nodeType === 1 ? r.target : r.target && r.target.parentElement;
        if (t === last) continue;
        last = t;
        if (!t || !t.closest || !t.closest(RFS_OWN)) return cb(records, observer);
    }
};

export const tryPromise = cb => {
    if (typeof cb !== 'function') return Promise.resolve();
    if ('try' in Promise) {
        return Promise.try(cb);
    }
    return Promise.resolve().then(cb);
};

export const getFiber = el => {
    if (!el) return null;
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber'));
    return key ? el[key] : null;
};

export const createContainerTracker =(selector, { onCleanup, onSetup, onUpdate } = {}) => {
    let container = null;

    const rebind = async () => {
        const nextContainer = document.querySelector(selector);

        if (nextContainer === container) {
            return;
        }

        container = nextContainer;

        if (!container) {
            await tryPromise(onCleanup);
            return;
        }

        await tryPromise(onSetup);
        await tryPromise(onUpdate);
    };

    return {
        rebind,
        getContainer: () => container,
        setContainer: (newContainer) => { container = newContainer; },
    };
};

export const CssClassNames = {
    HtmlRoot: '.Rp8QOGJ2DypeDniMnRBhr',
    WebkitRoot: '._1rDh5rXSFZJOqCa4UpnI4z',
    MainBody: '.RGNMWtyj73_-WdhflrmuY',
    RightPanel: '._3BFcmjAaMyP6GTPwc0VyWi',
    Library: {
        Body: '._9sPoVBFyE_vE87mnZJ5aB',
        Container: '._3x1HklzyDs4TEjACrRO2tB',
        Divider: '._276E6ijBpjMA2_iTxNhhjc',
        Games: {
            Container: '._1ijTaXJJA5YWl_fW2IxcaT',
            Game: '._2-O4ZG0KrnSrzISHBKctFQ',
            Separator: '._2RggXvVkWMDvvxFegjtKso',
            Name: '._2SXJM0PeFEi3gbC7V3S5pE',
        }
    },
    UserPanel: {
        Container: '._3cykd-VfN_xBxf3Qxriccm',
        Button: '._2Szzh5sKyGgnLUR870zbDE',
        FriendButton: '._1TdaAqMFadi0UTqilrkelR',
        FamilyButton: '._13vrqU6oOqmmxrsZSW5O39',
    },
    DownloadBar: '._1_yS5UP7el0aN4vntx3dx',
    Overlay: {
        Clock: '.vCykYvbW9JAoUuOZK3L8M',
        Sidebar: '.fbu3l7kPiBeb3EKCjIb8n',
        ActiveButton: '._1BXjK5v8XI_SEhGola5ftn',
        PinnedButton: '._3EcEdRFCaMHk3xQ16qirtm._1dJ6yrpvLYTTBOt2IhFPua',
    },
};
