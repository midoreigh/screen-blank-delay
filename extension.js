import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {Extension, gettext} from 'resource:///org/gnome/shell/extensions/extension.js';

function _(str) {
    try {
        return gettext(str);
    } catch {
        return str;
    }
}
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

function getDelayOptions() {
    return [
        {seconds: 60, label: _('1 minute')},
        {seconds: 120, label: _('2 minutes')},
        {seconds: 180, label: _('3 minutes')},
        {seconds: 300, label: _('5 minutes')},
        {seconds: 480, label: _('8 minutes')},
        {seconds: 600, label: _('10 minutes')},
        {seconds: 720, label: _('12 minutes')},
        {seconds: 900, label: _('15 minutes')},
        {seconds: 1800, label: _('30 minutes')},
        {seconds: 3600, label: _('1 hour')},
        {seconds: 0, label: _('Never')},
    ];
}

function getDelayChips() {
    return [
        {seconds: 60, text: '1m', label: _('1 minute')},
        {seconds: 120, text: '2m', label: _('2 minutes')},
        {seconds: 180, text: '3m', label: _('3 minutes')},
        {seconds: 300, text: '5m', label: _('5 minutes')},
        {seconds: 480, text: '8m', label: _('8 minutes')},
        {seconds: 600, text: '10m', label: _('10 minutes')},
        {seconds: 720, text: '12m', label: _('12 minutes')},
        {seconds: 900, text: '15m', label: _('15 minutes')},
        {seconds: 1800, text: '30m', label: _('30 minutes')},
        {seconds: 3600, text: '1h', label: _('1 hour')},
        {seconds: 0, text: _('Never'), label: _('Never')},
    ];
}

function createDelayChipsGrid(currentSeconds, onSelect) {
    const item = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
        style_class: 'screen-blank-delay-grid-container',
    });

    const gridBox = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        x_expand: true,
        style_class: 'screen-blank-delay-grid-container',
    });

    const chips = getDelayChips();
    const rows = [
        chips.slice(0, 4),   // 1m, 2m, 3m, 5m
        chips.slice(4, 8),   // 8m, 10m, 12m, 15m
        chips.slice(8, 11),  // 30m, 1h, Never
    ];

    const chipButtons = [];

    for (const rowData of rows) {
        const rowBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            x_expand: true,
            style_class: 'screen-blank-delay-row',
        });

        for (const chip of rowData) {
            const btn = new St.Button({
                label: chip.text,
                style_class: 'button screen-blank-delay-chip',
                can_focus: true,
                toggle_mode: true,
                checked: chip.seconds === currentSeconds,
                x_expand: true,
                accessible_name: chip.label,
            });

            if (chip.seconds === currentSeconds)
                btn.add_style_class_name('selected');

            btn.connect('clicked', () => {
                for (const b of chipButtons) {
                    b.checked = false;
                    b.remove_style_class_name('selected');
                }
                btn.checked = true;
                btn.add_style_class_name('selected');
                onSelect(chip.seconds);
            });

            chipButtons.push(btn);
            rowBox.add_child(btn);
        }

        gridBox.add_child(rowBox);
    }

    item.add_child(gridBox);
    return item;
}

function createMonitorDelayChipsGrid(monDelay, onSelect) {
    const item = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
        style_class: 'screen-blank-delay-grid-container',
    });

    const gridBox = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        x_expand: true,
        style_class: 'screen-blank-delay-grid-container',
    });

    const chipButtons = [];

    // Follow System button
    const followRow = new St.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL,
        x_expand: true,
        style_class: 'screen-blank-delay-row',
    });

    const followBtn = new St.Button({
        label: _('Follow System'),
        style_class: 'button screen-blank-delay-chip',
        can_focus: true,
        toggle_mode: true,
        checked: monDelay === -1,
        x_expand: true,
    });
    if (monDelay === -1)
        followBtn.add_style_class_name('selected');

    followBtn.connect('clicked', () => {
        for (const b of chipButtons) {
            b.checked = false;
            b.remove_style_class_name('selected');
        }
        followBtn.checked = true;
        followBtn.add_style_class_name('selected');
        onSelect(-1);
    });
    chipButtons.push(followBtn);
    followRow.add_child(followBtn);
    gridBox.add_child(followRow);

    // 11 delay options in 3 rows
    const chips = getDelayChips();
    const rows = [
        chips.slice(0, 4),   // 1m, 2m, 3m, 5m
        chips.slice(4, 8),   // 8m, 10m, 12m, 15m
        chips.slice(8, 11),  // 30m, 1h, Never
    ];

    for (const rowData of rows) {
        const rowBox = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            x_expand: true,
            style_class: 'screen-blank-delay-row',
        });

        for (const chip of rowData) {
            const btn = new St.Button({
                label: chip.text,
                style_class: 'button screen-blank-delay-chip',
                can_focus: true,
                toggle_mode: true,
                checked: chip.seconds === monDelay,
                x_expand: true,
                accessible_name: chip.label,
            });

            if (chip.seconds === monDelay)
                btn.add_style_class_name('selected');

            btn.connect('clicked', () => {
                for (const b of chipButtons) {
                    b.checked = false;
                    b.remove_style_class_name('selected');
                }
                btn.checked = true;
                btn.add_style_class_name('selected');
                onSelect(chip.seconds);
            });

            chipButtons.push(btn);
            rowBox.add_child(btn);
        }

        gridBox.add_child(rowBox);
    }

    item.add_child(gridBox);
    return item;
}

function formatDelay(seconds) {
    if (seconds === 0)
        return _('Never');
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds % 3600 === 0) {
        const hrs = seconds / 3600;
        return hrs === 1 ? _('1 hour') : `${hrs} hrs`;
    }
    const mins = Math.floor(seconds / 60);
    return mins === 1 ? _('1 min') : `${mins} min`;
}

function formatDelayCompact(seconds) {
    if (seconds === 0)
        return _('Never');
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds % 3600 === 0)
        return `${seconds / 3600}h`;
    const mins = Math.round(seconds / 60);
    return `${mins}m`;
}

/**
 * Manages per-monitor idle timeouts and screen blanking overlays
 */
class MonitorBlankManager {
    constructor(extension) {
        this._extension = extension;
        this._settings = extension.getSettings();
        this._sessionSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.session'});

        this._idleMonitor = global.backend.get_core_idle_monitor();
        this._monitors = new Map(); // connector -> monitor info
        this._activeWatchId = 0;
        this._timerId = 0;
        this._pointerWatchTimerId = 0;
        this._lastPointer = {x: -1, y: -1};
        this._lastBlankAllTime = 0;
        this._powerSaveTimerId = 0;
        this._cursorVisibleInhibited = false;
        try {
            this._cursorTracker = global.backend?.get_cursor_tracker?.() ?? null;
        } catch {
            this._cursorTracker = null;
        }

        this._wakeOnPointerMove = this._settings.get_boolean('wake-on-pointer-move');
        this._fadeAnimation = this._settings.get_boolean('fade-animation');
        this._perMonitorEnabled = this._settings.get_boolean('per-monitor-enabled');

        this._settingsSignals = [
            this._settings.connect('changed::wake-on-pointer-move', () => {
                this._wakeOnPointerMove = this._settings.get_boolean('wake-on-pointer-move');
            }),
            this._settings.connect('changed::fade-animation', () => {
                this._fadeAnimation = this._settings.get_boolean('fade-animation');
            }),
            this._settings.connect('changed::per-monitor-enabled', () => {
                this._perMonitorEnabled = this._settings.get_boolean('per-monitor-enabled');
                this.updateMonitors();
            }),
            this._settings.connect('changed::per-monitor-delays', () => {
                this.updateMonitors();
            }),
        ];

        this._layoutSignalId = Main.layoutManager.connect('monitors-changed', () => {
            this.updateMonitors();
        });

        this._sessionModeSignalId = Main.sessionMode.connect('updated', () => {
            if (Main.sessionMode.isLocked)
                this._clearAllOverlays();
        });

        this._focusWindowSignalId = global.display.connect('notify::focus-window', () => {
            this._onFocusWindowChanged();
        });

        this._setupActiveWatch();
        this.updateMonitors();
        this._startLoop();
    }

    _setupActiveWatch() {
        if (this._activeWatchId === 0 && this._idleMonitor) {
            this._activeWatchId = this._idleMonitor.add_user_active_watch(() => {
                this._onUserActive();
            });
        }
    }

    _onUserActive() {
        this._activeWatchId = 0;
        const nowMicro = GLib.get_monotonic_time();
        if (this._lastBlankAllTime && nowMicro - this._lastBlankAllTime < 800000) {
            this._setupActiveWatch();
            return;
        }

        const now = nowMicro / 1000000;
        for (const info of this._monitors.values()) {
            info.lastActivityTime = now;
            if (info.isOverlayBlanked)
                this.unblankMonitor(info.connector);
        }
        this._setupActiveWatch();
    }

    _onFocusWindowChanged() {
        const focusWindow = global.display.focus_window;
        if (!focusWindow)
            return;

        const monitorIdx = focusWindow.get_monitor();
        const now = GLib.get_monotonic_time() / 1000000;
        for (const info of this._monitors.values()) {
            if (info.index === monitorIdx) {
                info.lastActivityTime = now;
                if (info.isOverlayBlanked)
                    this.unblankMonitor(info.connector);
                break;
            }
        }
    }

    updateMonitors() {
        this._queryDisplayConfig().then(displayMap => {
            this._syncMonitors(displayMap);
        }).catch(err => {
            log(`[ScreenBlankDelay] Error querying display config: ${err.message}`);
            this._syncMonitors(new Map());
        });
    }

    async _queryDisplayConfig() {
        const displayMap = new Map();
        try {
            const result = await Gio.DBus.session.call(
                'org.gnome.Mutter.DisplayConfig',
                '/org/gnome/Mutter/DisplayConfig',
                'org.gnome.Mutter.DisplayConfig',
                'GetCurrentState',
                null,
                null,
                Gio.DBusCallFlags.NONE,
                1000,
                null
            );

            const unpacked = result.deepUnpack();
            const monitors = unpacked[1]; // list of monitors
            const logicalMonitors = unpacked[2]; // list of logical monitors

            // Map connector -> display name
            const connectorNames = new Map();
            for (const mon of monitors) {
                const connector = mon[0][0];
                const props = mon[2] || {};
                let displayName = props['display-name'];
                if (displayName && typeof displayName.deepUnpack === 'function')
                    displayName = displayName.deepUnpack();
                if (!displayName || typeof displayName !== 'string')
                    displayName = connector;
                connectorNames.set(connector, displayName);
            }

            // Map logical monitors (x, y) to connector
            const logicalMonitorsList = [];
            for (const lm of logicalMonitors) {
                const x = lm[0];
                const y = lm[1];
                const isPrimary = lm[4];
                const monitorsOnLM = lm[5];
                if (monitorsOnLM && monitorsOnLM.length > 0) {
                    const connector = monitorsOnLM[0][0];
                    const displayName = connectorNames.get(connector) || connector;
                    const monData = {connector, displayName, isPrimary};
                    displayMap.set(`${x},${y}`, monData);
                    logicalMonitorsList.push(monData);
                }
            }
            displayMap._list = logicalMonitorsList;
        } catch (e) {
            // fallback
        }
        return displayMap;
    }

    _syncMonitors(displayMap) {
        const delaysDict = this._settings.get_value('per-monitor-delays').deepUnpack();
        const activeMonitors = Main.layoutManager.monitors;
        const logicalMonitorsList = displayMap._list || [];
        const now = GLib.get_monotonic_time() / 1000000;
        const seenConnectors = new Set();

        for (let i = 0; i < activeMonitors.length; i++) {
            const m = activeMonitors[i];
            const key = `${m.x},${m.y}`;
            let info = displayMap.get(key);
            if (!info && i < logicalMonitorsList.length)
                info = logicalMonitorsList[i];
            if (!info)
                info = {};

            const connector = info.connector || `Display-${i + 1}`;
            let displayName = info.displayName || _('Display %d').format(i + 1);
            if (displayName && typeof displayName.deepUnpack === 'function')
                displayName = displayName.deepUnpack();
            if (displayName && typeof displayName === 'object' && 'unpack' in displayName)
                displayName = displayName.unpack();
            if (typeof displayName !== 'string')
                displayName = String(displayName);
            const isPrimary = info.isPrimary ?? (i === Main.layoutManager.primaryIndex);

            seenConnectors.add(connector);

            let configuredDelay = delaysDict[connector];
            if (configuredDelay === undefined)
                configuredDelay = -1; // Follow System

            let existing = this._monitors.get(connector);
            if (!existing) {
                existing = {
                    connector,
                    displayName,
                    index: i,
                    geometry: {x: m.x, y: m.y, width: m.width, height: m.height},
                    isPrimary,
                    delay: configuredDelay,
                    lastActivityTime: now,
                    isOverlayBlanked: false,
                    overlayActor: null,
                };
                this._monitors.set(connector, existing);
            } else {
                existing.index = i;
                existing.geometry = {x: m.x, y: m.y, width: m.width, height: m.height};
                existing.displayName = displayName;
                existing.isPrimary = isPrimary;
                existing.delay = configuredDelay;
                if (existing.overlayActor) {
                    existing.overlayActor.set_position(m.x, m.y);
                    existing.overlayActor.set_size(m.width, m.height);
                }
            }
        }

        // Remove disconnected monitors
        for (const [conn, mon] of this._monitors.entries()) {
            if (!seenConnectors.has(conn)) {
                if (mon.overlayActor)
                    mon.overlayActor.destroy();
                this._monitors.delete(conn);
            }
        }

        this._extension.syncUI();
    }

    getMonitorsList() {
        return Array.from(this._monitors.values()).sort((a, b) => {
            if (a.isPrimary) return -1;
            if (b.isPrimary) return 1;
            return a.index - b.index;
        });
    }

    setMonitorDelay(connector, delaySeconds) {
        const delaysDict = this._settings.get_value('per-monitor-delays').deepUnpack();
        if (delaySeconds === -1) {
            delete delaysDict[connector];
        } else {
            delaysDict[connector] = delaySeconds;
        }

        const builder = new GLib.VariantBuilder(new GLib.VariantType('a{si}'));
        for (const [k, v] of Object.entries(delaysDict)) {
            builder.add_value(new GLib.Variant('{si}', [k, v]));
        }
        this._settings.set_value('per-monitor-delays', builder.end());

        const mon = this._monitors.get(connector);
        if (mon) {
            mon.delay = delaySeconds;
            if (mon.isOverlayBlanked && delaySeconds === 0)
                this.unblankMonitor(connector);
        }
        this._extension.syncUI();
    }

    _showPointer() {
        if (this._cursorVisibleInhibited) {
            try {
                const seat = global.stage.context.get_backend().get_default_seat();
                seat.uninhibit_unfocus();
            } catch {
                // Ignore if seat unfocus uninhibiting is not supported
            }
            try {
                if (this._cursorTracker)
                    this._cursorTracker.uninhibit_cursor_visibility();
            } catch {
                // Ignore if cursor tracker uninhibit fails
            }
            this._cursorVisibleInhibited = false;
        }
    }

    _hidePointer() {
        if (!this._cursorVisibleInhibited) {
            try {
                const seat = global.stage.context.get_backend().get_default_seat();
                seat.inhibit_unfocus();
            } catch {
                // Ignore if seat unfocus inhibiting is not supported
            }
            try {
                if (this._cursorTracker)
                    this._cursorTracker.inhibit_cursor_visibility();
            } catch {
                // Ignore if cursor tracker inhibit fails
            }
            this._cursorVisibleInhibited = true;
        }
    }

    _setPowerSaveMode(mode) {
        try {
            Gio.DBus.session.call(
                'org.gnome.Mutter.DisplayConfig',
                '/org/gnome/Mutter/DisplayConfig',
                'org.freedesktop.DBus.Properties',
                'Set',
                new GLib.Variant('(ssv)', [
                    'org.gnome.Mutter.DisplayConfig',
                    'PowerSaveMode',
                    new GLib.Variant('i', mode),
                ]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (conn, res) => {
                    try {
                        conn.call_finish(res);
                    } catch {
                        // Mutter display config not available or unsupported
                    }
                }
            );
        } catch {
            // Mutter display config not available or unsupported
        }
    }

    _syncPowerSave() {
        const anyBlanked = Array.from(this._monitors.values()).some(m => m.isOverlayBlanked);
        const allBlanked = this._monitors.size > 0 && Array.from(this._monitors.values()).every(m => m.isOverlayBlanked);

        if (allBlanked) {
            this._hidePointer();
            const fadeDelay = this._fadeAnimation ? 650 : 0;
            if (this._powerSaveTimerId) {
                GLib.source_remove(this._powerSaveTimerId);
                this._powerSaveTimerId = 0;
            }

            if (fadeDelay > 0) {
                this._powerSaveTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, fadeDelay, () => {
                    this._powerSaveTimerId = 0;
                    const stillAll = this._monitors.size > 0 && Array.from(this._monitors.values()).every(m => m.isOverlayBlanked);
                    if (stillAll)
                        this._setPowerSaveMode(3);
                    return GLib.SOURCE_REMOVE;
                });
            } else {
                this._setPowerSaveMode(3);
            }
        } else {
            if (this._powerSaveTimerId) {
                GLib.source_remove(this._powerSaveTimerId);
                this._powerSaveTimerId = 0;
            }
            this._setPowerSaveMode(0);
            if (!anyBlanked)
                this._showPointer();
        }
    }

    blankMonitorNow(connector) {
        const mon = this._monitors.get(connector);
        if (mon && !mon.isOverlayBlanked) {
            this._lastBlankAllTime = GLib.get_monotonic_time();
            this._blankMonitor(mon);
            this._syncPowerSave();
        }
    }

    blankAllNow() {
        this._lastBlankAllTime = GLib.get_monotonic_time();

        for (const mon of this._monitors.values()) {
            if (!mon.isOverlayBlanked)
                this._blankMonitor(mon);
        }
        this._syncPowerSave();
    }

    unblankMonitor(connector) {
        const mon = this._monitors.get(connector);
        if (!mon || !mon.isOverlayBlanked)
            return;

        mon.isOverlayBlanked = false;
        mon.lastActivityTime = GLib.get_monotonic_time() / 1000000;
        this._syncPowerSave();

        if (mon.overlayActor) {
            const actor = mon.overlayActor;
            mon.overlayActor = null;
            if (this._fadeAnimation) {
                actor.ease({
                    opacity: 0,
                    duration: 500,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => actor.destroy(),
                });
            } else {
                actor.destroy();
            }
        }
        this._extension.syncUI();
    }

    _blankMonitor(mon) {
        if (Main.sessionMode.isLocked)
            return;

        mon.isOverlayBlanked = true;

        const overlay = new St.Widget({
            reactive: true,
            can_focus: true,
            style: 'background-color: #000000;',
            opacity: this._fadeAnimation ? 0 : 255,
        });

        overlay.set_position(mon.geometry.x, mon.geometry.y);
        overlay.set_size(mon.geometry.width, mon.geometry.height);
        overlay.set_name(`screen-blank-overlay-${mon.connector}`);

        overlay.connect('button-press-event', () => {
            const now = GLib.get_monotonic_time();
            if (this._lastBlankAllTime && now - this._lastBlankAllTime < 800000)
                return Clutter.EVENT_STOP;
            this.unblankMonitor(mon.connector);
            return Clutter.EVENT_STOP;
        });

        overlay.connect('scroll-event', () => {
            const now = GLib.get_monotonic_time();
            if (this._lastBlankAllTime && now - this._lastBlankAllTime < 800000)
                return Clutter.EVENT_STOP;
            this.unblankMonitor(mon.connector);
            return Clutter.EVENT_STOP;
        });

        overlay.connect('motion-event', () => {
            const now = GLib.get_monotonic_time();
            if (this._lastBlankAllTime && now - this._lastBlankAllTime < 800000)
                return Clutter.EVENT_PROPAGATE;
            if (this._wakeOnPointerMove)
                this.unblankMonitor(mon.connector);
            return Clutter.EVENT_PROPAGATE;
        });

        overlay.connect('key-press-event', () => {
            const now = GLib.get_monotonic_time();
            if (this._lastBlankAllTime && now - this._lastBlankAllTime < 800000)
                return Clutter.EVENT_STOP;
            this.unblankMonitor(mon.connector);
            return Clutter.EVENT_STOP;
        });

        Main.uiGroup.add_child(overlay);
        Main.uiGroup.set_child_above_sibling(overlay, null);
        overlay.grab_key_focus();
        mon.overlayActor = overlay;

        if (this._fadeAnimation) {
            overlay.ease({
                opacity: 255,
                duration: 600,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
        this._extension.syncUI();
    }

    _clearAllOverlays() {
        if (this._powerSaveTimerId) {
            GLib.source_remove(this._powerSaveTimerId);
            this._powerSaveTimerId = 0;
        }
        this._setPowerSaveMode(0);
        this._showPointer();

        for (const mon of this._monitors.values()) {
            mon.isOverlayBlanked = false;
            if (mon.overlayActor) {
                mon.overlayActor.destroy();
                mon.overlayActor = null;
            }
        }
        this._extension.syncUI();
    }

    _startLoop() {
        // Fast pointer motion check (every 250ms) to wake up monitors on cursor movement
        this._pointerWatchTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._checkPointerPosition();
            return GLib.SOURCE_CONTINUE;
        });

        // 1-second interval idle check
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._checkIdleStatus();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _checkPointerPosition() {
        const [x, y] = global.get_pointer();
        const dx = Math.abs(x - this._lastPointer.x);
        const dy = Math.abs(y - this._lastPointer.y);
        if (dx < 6 && dy < 6)
            return;

        this._lastPointer.x = x;
        this._lastPointer.y = y;

        const now = GLib.get_monotonic_time() / 1000000;
        const nowMicro = GLib.get_monotonic_time();

        if (this._lastBlankAllTime && nowMicro - this._lastBlankAllTime < 800000)
            return;

        for (const mon of this._monitors.values()) {
            const g = mon.geometry;
            if (x >= g.x && x < g.x + g.width && y >= g.y && y < g.y + g.height) {
                mon.lastActivityTime = now;
                if (mon.isOverlayBlanked && this._wakeOnPointerMove)
                    this.unblankMonitor(mon.connector);
            }
        }
    }

    _checkIdleStatus() {
        if (!this._perMonitorEnabled || Main.sessionMode.isLocked)
            return;

        const now = GLib.get_monotonic_time() / 1000000;
        const systemDelay = this._sessionSettings.get_uint('idle-delay');

        for (const mon of this._monitors.values()) {
            if (mon.isOverlayBlanked)
                continue;

            let effectiveDelay = mon.delay;
            if (effectiveDelay === -1) {
                // If following system, let system idle-delay handle it unless per-monitor is desired
                continue;
            }

            if (effectiveDelay === 0)
                continue; // Never

            const idleDuration = now - mon.lastActivityTime;
            if (idleDuration >= effectiveDelay) {
                this._blankMonitor(mon);
                this._syncPowerSave();
            }
        }
    }

    destroy() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }

        if (this._pointerWatchTimerId) {
            GLib.source_remove(this._pointerWatchTimerId);
            this._pointerWatchTimerId = 0;
        }

        if (this._activeWatchId && this._idleMonitor) {
            this._idleMonitor.remove_watch(this._activeWatchId);
            this._activeWatchId = 0;
        }

        if (this._layoutSignalId) {
            Main.layoutManager.disconnect(this._layoutSignalId);
            this._layoutSignalId = 0;
        }

        if (this._sessionModeSignalId) {
            Main.sessionMode.disconnect(this._sessionModeSignalId);
            this._sessionModeSignalId = 0;
        }

        if (this._focusWindowSignalId) {
            global.display.disconnect(this._focusWindowSignalId);
            this._focusWindowSignalId = 0;
        }

        for (const id of this._settingsSignals)
            this._settings.disconnect(id);
        this._settingsSignals = [];

        this._clearAllOverlays();
        this._monitors.clear();

        this._settings = null;
        this._sessionSettings = null;
        this._idleMonitor = null;
        this._cursorTracker = null;
        this._extension = null;
    }
}

/**
 * Quick Settings Toggle and Menu
 */
const ScreenBlankQuickToggle = GObject.registerClass(
class ScreenBlankQuickToggle extends QuickSettings.QuickMenuToggle {
    _init(extension) {
        super._init({
            title: _('Screen Blank'),
            iconName: 'preferences-desktop-screensaver-symbolic',
            toggleMode: true,
            menuButtonAccessibleName: _('Open screen blank menu'),
        });

        this._extension = extension;
        this._sessionSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.session'});
        this._extSettings = extension.getSettings();

        this.connect('clicked', () => this._onToggleClicked());

        // Header
        this.menu.setHeader(
            'preferences-desktop-screensaver-symbolic',
            _('Screen Blank Delay'),
            _('Configure idle timeouts')
        );

        // Header settings gear button (in submenu header)
        this._headerSettingsBtn = new St.Button({
            style_class: 'icon-button',
            child: new St.Icon({
                icon_name: 'emblem-system-symbolic',
                icon_size: 16,
            }),
            can_focus: true,
            accessible_name: _('Screen Blank Settings'),
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._headerSettingsBtnSignalId = this._headerSettingsBtn.connect('clicked', () => {
            this._extension.openPreferences();
            Main.panel.closeQuickSettings();
        });
        if (typeof this.menu.addHeaderSuffix === 'function') {
            this.menu.addHeaderSuffix(this._headerSettingsBtn);
        }

        this._buildMenu();
        this.sync();
    }

    _onToggleClicked() {
        const currentDelay = this._sessionSettings.get_uint('idle-delay');
        if (currentDelay > 0) {
            // Save current and turn off (Never)
            this._extSettings.set_uint('last-active-system-delay', currentDelay);
            this._sessionSettings.set_uint('idle-delay', 0);
        } else {
            // Restore previous delay
            let restoreDelay = this._extSettings.get_uint('last-active-system-delay');
            if (!restoreDelay || restoreDelay === 0)
                restoreDelay = 300;
            this._sessionSettings.set_uint('idle-delay', restoreDelay);
        }
    }

    _buildMenu() {
        this.menu.removeAll();

        const currentSystemDelay = this._sessionSettings.get_uint('idle-delay');
        const systemDelayStr = currentSystemDelay === 0 ? _('Never') : formatDelay(currentSystemDelay);

        // System Delay header label
        const titleItem = new PopupMenu.PopupMenuItem(
            `${_('System Delay')}: ${systemDelayStr}`,
            {reactive: false}
        );
        titleItem.add_style_class_name('screen-blank-monitor-title');
        this.menu.addMenuItem(titleItem);

        // 11 delays in a tile-fashion grid: 1m, 2m, 3m, 5m, 8m, 10m, 12m, 15m, 30m, 1h, Never
        this.menu.addMenuItem(createDelayChipsGrid(currentSystemDelay, seconds => {
            this._sessionSettings.set_uint('idle-delay', seconds);
            if (seconds > 0)
                this._extSettings.set_uint('last-active-system-delay', seconds);
        }));

        // Per-Monitor Section (if multiple monitors or per-monitor enabled)
        const monitors = this._extension.blankManager.getMonitorsList();
        if (monitors.length > 1 || this._extSettings.get_boolean('per-monitor-enabled')) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            for (const mon of monitors) {
                const badge = mon.isPrimary ? _('(Primary)') : '';
                const currentDelayStr = mon.delay === -1
                    ? _('Follow System')
                    : formatDelay(mon.delay);
                const title = mon.displayName && mon.displayName !== mon.connector
                    ? `${mon.displayName} (${mon.connector})`
                    : (mon.displayName || mon.connector);
                const itemText = `${title} ${badge}: ${currentDelayStr}`.replace(/\s+/g, ' ').trim();

                const subMenuItem = new PopupMenu.PopupSubMenuMenuItem(itemText, true);
                subMenuItem.icon.icon_name = 'video-display-symbolic';

                // Monitor Tile Grid of delays
                subMenuItem.menu.addMenuItem(createMonitorDelayChipsGrid(mon.delay, seconds => {
                    this._extension.blankManager.setMonitorDelay(mon.connector, seconds);
                }));

                // Blank this monitor now
                subMenuItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                const blankNowItem = new PopupMenu.PopupMenuItem(
                    mon.isOverlayBlanked ? _('Wake Screen Now') : _('Blank This Screen Now')
                );
                blankNowItem.connect('activate', () => {
                    if (mon.isOverlayBlanked)
                        this._extension.blankManager.unblankMonitor(mon.connector);
                    else
                        this._extension.blankManager.blankMonitorNow(mon.connector);
                });
                subMenuItem.menu.addMenuItem(blankNowItem);

                this.menu.addMenuItem(subMenuItem);
            }
        }

        // Action Section
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const blankAllItem = new PopupMenu.PopupMenuItem(_('Blank All Screens Now'));
        blankAllItem.connect('activate', () => {
            this.menu.close();
            this._extension.blankManager.blankAllNow();
        });
        this.menu.addMenuItem(blankAllItem);
    }

    sync() {
        const currentDelay = this._sessionSettings.get_uint('idle-delay');
        this.checked = currentDelay > 0;

        const subtitleText = currentDelay === 0 ? _('Never') : formatDelay(currentDelay);
        this.set({
            subtitle: subtitleText,
            iconName: currentDelay === 0 ? 'display-symbolic' : 'preferences-desktop-screensaver-symbolic',
        });

        this._buildMenu();
    }

    destroy() {
        if (this._headerSettingsBtn) {
            if (this._headerSettingsBtnSignalId) {
                this._headerSettingsBtn.disconnect(this._headerSettingsBtnSignalId);
                this._headerSettingsBtnSignalId = 0;
            }
            this._headerSettingsBtn.destroy();
            this._headerSettingsBtn = null;
        }
        if (this.menu)
            this.menu.destroy();
        this._extension = null;
        this._settings = null;
        this._sessionSettings = null;
        this._blankManager = null;
        super.destroy();
    }
});

/**
 * System Indicator in Quick Settings
 */
const ScreenBlankSystemIndicator = GObject.registerClass(
class ScreenBlankSystemIndicator extends QuickSettings.SystemIndicator {
    _init(extension) {
        super._init();
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'preferences-desktop-screensaver-symbolic';
        this._indicator.visible = false; // Hidden on panel unless desired

        this.quickToggle = new ScreenBlankQuickToggle(extension);
        this.quickSettingsItems.push(this.quickToggle);
    }

    sync() {
        this.quickToggle.sync();
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});

/**
 * Top Bar Button
 */
const ScreenBlankTopBarButton = GObject.registerClass(
class ScreenBlankTopBarButton extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _('Screen Blank Delay'));
        this._extension = extension;
        this._sessionSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.session'});
        this._extSettings = extension.getSettings();

        const box = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._icon = new St.Icon({
            icon_name: 'preferences-desktop-screensaver-symbolic',
            style_class: 'system-status-icon',
        });
        box.add_child(this._icon);

        this._label = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        box.add_child(this._label);
        this.add_child(box);

        this._styleSignalId = this._extSettings.connect('changed::top-bar-display-style', () => {
            this.sync();
        });

        this._menuOpenSignalId = this.menu.connect('open-state-changed', (m, isOpen) => {
            if (isOpen)
                this._buildMenu();
        });

        this.sync();
    }

    _buildMenu() {
        this.menu.removeAll();

        const currentDelay = this._sessionSettings.get_uint('idle-delay');
        const delayStr = currentDelay === 0 ? _('Never') : formatDelay(currentDelay);

        const titleItem = new PopupMenu.PopupMenuItem(
            `${_('System Delay')}: ${delayStr}`,
            {reactive: false}
        );
        titleItem.add_style_class_name('screen-blank-monitor-title');
        this.menu.addMenuItem(titleItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 11 delays in a tile-fashion grid: 1m, 2m, 3m, 5m, 8m, 10m, 12m, 15m, 30m, 1h, Never
        this.menu.addMenuItem(createDelayChipsGrid(currentDelay, seconds => {
            this._sessionSettings.set_uint('idle-delay', seconds);
            if (seconds > 0)
                this._extSettings.set_uint('last-active-system-delay', seconds);
        }));

        // Multi-Monitor Section
        const monitors = this._extension.blankManager.getMonitorsList();
        if (monitors.length > 1 || this._extSettings.get_boolean('per-monitor-enabled')) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            for (const mon of monitors) {
                const badge = mon.isPrimary ? _('(Primary)') : '';
                const currentDelayStr = mon.delay === -1
                    ? _('Follow System')
                    : formatDelay(mon.delay);
                const title = mon.displayName && mon.displayName !== mon.connector
                    ? `${mon.displayName} (${mon.connector})`
                    : (mon.displayName || mon.connector);
                const itemText = `${title} ${badge}: ${currentDelayStr}`.replace(/\s+/g, ' ').trim();

                const subMenuItem = new PopupMenu.PopupSubMenuMenuItem(itemText, true);
                subMenuItem.icon.icon_name = 'video-display-symbolic';

                subMenuItem.menu.addMenuItem(createMonitorDelayChipsGrid(mon.delay, seconds => {
                    this._extension.blankManager.setMonitorDelay(mon.connector, seconds);
                }));

                subMenuItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                const blankNowItem = new PopupMenu.PopupMenuItem(
                    mon.isOverlayBlanked ? _('Wake Screen Now') : _('Blank This Screen Now')
                );
                blankNowItem.connect('activate', () => {
                    if (mon.isOverlayBlanked)
                        this._extension.blankManager.unblankMonitor(mon.connector);
                    else
                        this._extension.blankManager.blankMonitorNow(mon.connector);
                });
                subMenuItem.menu.addMenuItem(blankNowItem);

                this.menu.addMenuItem(subMenuItem);
            }
        }

        // Action Section
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const blankAllItem = new PopupMenu.PopupMenuItem(_('Blank All Screens Now'));
        blankAllItem.connect('activate', () => {
            this.menu.close();
            this._extension.blankManager.blankAllNow();
        });
        this.menu.addMenuItem(blankAllItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const extSettingsItem = new PopupMenu.PopupMenuItem(_('Screen Blank Settings…'));
        extSettingsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(extSettingsItem);

        const powerSettingsItem = new PopupMenu.PopupMenuItem(_('GNOME Power Settings…'));
        powerSettingsItem.connect('activate', () => {
            try {
                Gio.AppInfo.create_from_commandline('gnome-control-center power', null, Gio.AppInfoCreateFlags.NONE).launch([], null);
            } catch (e) {
                // fallback
            }
        });
        this.menu.addMenuItem(powerSettingsItem);
    }

    sync() {
        const currentDelay = this._sessionSettings.get_uint('idle-delay');
        const style = this._extSettings.get_string('top-bar-display-style');

        this._icon.icon_name = currentDelay === 0
            ? 'display-symbolic'
            : 'preferences-desktop-screensaver-symbolic';

        if (style === 'icon-only') {
            this._label.text = '';
            this._label.visible = false;
        } else if (style === 'full') {
            const delayStr = currentDelay === 0 ? _('Never') : formatDelay(currentDelay);
            this._label.text = delayStr;
            this._label.visible = true;
        } else {
            // Default: 'compact' (e.g. 10m, 1h, Never)
            const delayStr = currentDelay === 0 ? _('Never') : formatDelayCompact(currentDelay);
            this._label.text = delayStr;
            this._label.visible = true;
        }

        this._buildMenu();
    }

    destroy() {
        if (this._menuOpenSignalId) {
            this.menu.disconnect(this._menuOpenSignalId);
            this._menuOpenSignalId = 0;
        }
        if (this._styleSignalId) {
            this._extSettings.disconnect(this._styleSignalId);
            this._styleSignalId = 0;
        }
        this._extSettings = null;
        this._sessionSettings = null;
        this._blankManager = null;
        this._extension = null;
        super.destroy();
    }
});

/**
 * Main Extension Class
 */
export default class ScreenBlankDelayExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._sessionSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.session'});

        this.blankManager = new MonitorBlankManager(this);

        this._indicator = null;
        this._topBarButton = null;

        this._sessionSignalId = this._sessionSettings.connect('changed::idle-delay', () => {
            this.syncUI();
        });

        this._settingsSignals = [
            this._settings.connect('changed::show-in-quick-settings', () => this._updateIndicators()),
            this._settings.connect('changed::show-in-top-bar', () => this._updateIndicators()),
        ];

        this._updateIndicators();
    }

    _updateIndicators() {
        const showQS = this._settings.get_boolean('show-in-quick-settings');
        const showTB = this._settings.get_boolean('show-in-top-bar');

        // Quick Settings
        if (showQS && !this._indicator) {
            this._indicator = new ScreenBlankSystemIndicator(this);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        } else if (!showQS && this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        // Top Bar
        if (showTB && !this._topBarButton) {
            if (Main.panel.statusArea[this.uuid]) {
                try {
                    Main.panel.statusArea[this.uuid].destroy();
                } catch (e) {
                    delete Main.panel.statusArea[this.uuid];
                }
            }
            this._topBarButton = new ScreenBlankTopBarButton(this);
            Main.panel.addToStatusArea(this.uuid, this._topBarButton, 1, 'right');
        } else if (!showTB && this._topBarButton) {
            this._topBarButton.destroy();
            this._topBarButton = null;
        }

        this.syncUI();
    }

    syncUI() {
        if (this._indicator)
            this._indicator.sync();
        if (this._topBarButton)
            this._topBarButton.sync();
    }

    openPreferences() {
        let opened = false;
        try {
            opened = Main.extensionManager.openExtensionPrefs(this.uuid, '', {});
        } catch (e) {
            log(`[ScreenBlankDelay] openExtensionPrefs failed: ${e.message}`);
        }
        if (!opened) {
            try {
                Gio.Subprocess.new(['gnome-extensions', 'prefs', this.uuid], Gio.SubprocessFlags.NONE);
            } catch (err) {
                log(`[ScreenBlankDelay] Failed to launch prefs via subprocess: ${err.message}`);
            }
        }
    }

    disable() {
        if (this._sessionSignalId) {
            this._sessionSettings.disconnect(this._sessionSignalId);
            this._sessionSignalId = 0;
        }

        if (this._settingsSignals) {
            for (const id of this._settingsSignals)
                this._settings.disconnect(id);
            this._settingsSignals = [];
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this._topBarButton) {
            this._topBarButton.destroy();
            this._topBarButton = null;
        }

        if (Main.panel.statusArea[this.uuid]) {
            try {
                Main.panel.statusArea[this.uuid].destroy();
            } catch (e) {
                delete Main.panel.statusArea[this.uuid];
            }
        }

        if (this.blankManager) {
            this.blankManager.destroy();
            this.blankManager = null;
        }

        this._settings = null;
        this._sessionSettings = null;
    }
}
