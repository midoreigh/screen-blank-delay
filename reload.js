import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';

export async function reload() {
    try {
        const ext = Main.extensionManager.lookup('screen-blank-delay@midoreigh');
        if (!ext) {
            return 'ERROR: Extension screen-blank-delay@midoreigh not found in extensionManager';
        }

        // Disable existing instance cleanly
        if (ext.stateObj) {
            try {
                ext.stateObj.disable();
            } catch (err) {
                console.warn(`[ScreenBlankDelay] Warning disabling previous instance: ${err.message}`);
            }
        }

        // Clean up any stale statusArea indicator
        if (Main.panel.statusArea[ext.uuid]) {
            try {
                Main.panel.statusArea[ext.uuid].destroy();
            } catch (err) {
                delete Main.panel.statusArea[ext.uuid];
            }
        }

        // Import the updated extension.js module with cache-busting timestamp
        const uri = `${ext.dir.get_uri()}/extension.js?v=${Date.now()}`;
        const mod = await import(uri);

        // Instantiate Extension class with required metadata, dir, and path
        const newInstance = new mod.default({
            ...ext.metadata,
            dir: ext.dir,
            path: ext.path,
        });

        ext.stateObj = newInstance;
        newInstance.enable();
        ext.state = 1; // ExtensionState.ACTIVE

        return 'RELOAD_SUCCESS';
    } catch (e) {
        const errMsg = `RELOAD_FAILED: ${e.message}\n${e.stack}`;
        try {
            GLib.file_set_contents('/tmp/reload_error.log', errMsg);
        } catch (_) {}
        return errMsg;
    }
}

// Auto-run if imported directly
export default await reload();
