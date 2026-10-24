import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
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
        const now = GLib.get_monotonic_time() / 1000000;
        for (const info of this._monitors.values()) {
            info.lastActivityTime = now;
        }
        // re-register active watch
        this._activeWatchId = 0;
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
                const displayName = props['display-name'] || connector;
                connectorNames.set(connector, displayName);
            }

            // Map logical monitors (x, y) to connector
            for (const lm of logicalMonitors) {
                const x = lm[0];
                const y = lm[1];
                const isPrimary = lm[4];
                const monitorsOnLM = lm[5];
                if (monitorsOnLM && monitorsOnLM.length > 0) {
                    const connector = monitorsOnLM[0][0];
                    const displayName = connectorNames.get(connector) || connector;
                    displayMap.set(`${x},${y}`, {connector, displayName, isPrimary});
                }
            }
        } catch (e) {
            // fallback
        }
        return displayMap;
    }

    _syncMonitors(displayMap) {
        const delaysDict = this._settings.get_value('per-monitor-delays').deepUnpack();
        const activeMonitors = Main.layoutManager.monitors;
        const now = GLib.get_monotonic_time() / 1000000;
        const seenConnectors = new Set();

        for (let i = 0; i < activeMonitors.length; i++) {
            const m = activeMonitors[i];
            const key = `${m.x},${m.y}`;
            const info = displayMap.get(key) || {};
            const connector = info.connector || `Display-${i + 1}`;
            const displayName = info.displayName || _('Display %d').format(i + 1);
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

    blankMonitorNow(connector) {
        const mon = this._monitors.get(connector);
        if (mon && !mon.isOverlayBlanked)
            this._blankMonitor(mon);
    }

    blankAllNow() {
        for (const mon of this._monitors.values()) {
            if (!mon.isOverlayBlanked)
                this._blankMonitor(mon);
        }
    }

    unblankMonitor(connector) {
        const mon = this._monitors.get(connector);
        if (!mon || !mon.isOverlayBlanked)
            return;

        mon.isOverlayBlanked = false;
        mon.lastActivityTime = GLib.get_monotonic_time() / 1000000;

        if (mon.overlayActor) {
            const actor = mon.overlayActor;
            mon.overlayActor = null;
            if (this._fadeAnimation) {
                actor.ease({
                    opacity: 0,
                    duration: 250,
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

        const overlay = new Clutter.Actor({
            reactive: true,
            background_color: new Clutter.Color({red: 0, green: 0, blue: 0, alpha: 255}),
            opacity: this._fadeAnimation ? 0 : 255,
        });

        overlay.set_position(mon.geometry.x, mon.geometry.y);
        overlay.set_size(mon.geometry.width, mon.geometry.height);
        overlay.set_name(`screen-blank-overlay-${mon.connector}`);

        overlay.connect('button-press-event', () => {
            this.unblankMonitor(mon.connector);
            return Clutter.EVENT_STOP;
        });

        overlay.connect('scroll-event', () => {
            this.unblankMonitor(mon.connector);
            return Clutter.EVENT_STOP;
        });

        overlay.connect('motion-event', () => {
            if (this._wakeOnPointerMove)
                this.unblankMonitor(mon.connector);
            return Clutter.EVENT_PROPAGATE;
        });

        Main.uiGroup.add_child(overlay);
        mon.overlayActor = overlay;

        if (this._fadeAnimation) {
            overlay.ease({
                opacity: 255,
                duration: 350,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
        this._extension.syncUI();
    }

    _clearAllOverlays() {
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
        if (x === this._lastPointer.x && y === this._lastPointer.y)
            return;

        this._lastPointer.x = x;
        this._lastPointer.y = y;

        const now = GLib.get_monotonic_time() / 1000000;

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
            if (idleDuration >= effectiveDelay)
                this._blankMonitor(mon);
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

        // System Delay Section
        this._systemSection = new PopupMenu.PopupMenuSection();
        const systemHeader = new PopupMenu.PopupMenuItem(_('System Delay (All Screens)'), {reactive: false});
        systemHeader.add_style_class_name('screen-blank-monitor-title');
        this._systemSection.addMenuItem(systemHeader);

        const delayOptions = getDelayOptions();

        this._systemItems = new Map();
        for (const opt of delayOptions) {
            const item = new PopupMenu.PopupMenuItem(opt.label);
            item.connect('activate', () => {
                this._sessionSettings.set_uint('idle-delay', opt.seconds);
                if (opt.seconds > 0)
                    this._extSettings.set_uint('last-active-system-delay', opt.seconds);
            });
            this._systemItems.set(opt.seconds, item);
            this._systemSection.addMenuItem(item);
        }
        this.menu.addMenuItem(this._systemSection);

        // Per-Monitor Section (if multiple monitors or per-monitor enabled)
        const monitors = this._extension.blankManager.getMonitorsList();
        if (monitors.length > 1 || this._extSettings.get_boolean('per-monitor-enabled')) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            const pmHeader = new PopupMenu.PopupMenuItem(_('Per-Screen Delay'), {reactive: false});
            pmHeader.add_style_class_name('screen-blank-monitor-title');
            this.menu.addMenuItem(pmHeader);

            for (const mon of monitors) {
                const badge = mon.isPrimary ? _('(Primary)') : '';
                const currentDelayStr = mon.delay === -1
                    ? _('Follow System')
                    : formatDelay(mon.delay);

                const subMenuItem = new PopupMenu.PopupSubMenuMenuItem(
                    `${mon.displayName} ${badge}: ${currentDelayStr}`,
                    true
                );
                subMenuItem.icon.icon_name = 'video-display-symbolic';

                // Follow System option
                const followItem = new PopupMenu.PopupMenuItem(_('Follow System'));
                followItem.setOrnament(mon.delay === -1 ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
                followItem.connect('activate', () => {
                    this._extension.blankManager.setMonitorDelay(mon.connector, -1);
                });
                subMenuItem.menu.addMenuItem(followItem);

                // Delay options
                for (const opt of delayOptions) {
                    const dItem = new PopupMenu.PopupMenuItem(opt.label);
                    dItem.setOrnament(mon.delay === opt.seconds ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
                    dItem.connect('activate', () => {
                        this._extension.blankManager.setMonitorDelay(mon.connector, opt.seconds);
                    });
                    subMenuItem.menu.addMenuItem(dItem);
                }

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
            this._extension.blankManager.blankAllNow();
        });
        this.menu.addMenuItem(blankAllItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Preferences & System Power Settings
        this.menu.addAction(_('Power Settings…'), () => {
            try {
                Gio.AppInfo.create_from_commandline('gnome-control-center power', null, Gio.AppInfoCreateFlags.NONE).launch([], null);
            } catch (e) {
                // fallback
            }
            Main.panel.closeQuickSettings();
        });

        this.menu.addAction(_('Extension Settings…'), () => {
            this._extension.openPreferences();
            Main.panel.closeQuickSettings();
        });
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

        if (this._systemItems) {
            for (const [sec, item] of this._systemItems.entries()) {
                item.setOrnament(sec === currentDelay ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            }
        }
    }

    destroy() {
        if (this.menu)
            this.menu.destroy();
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

        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        this._icon = new St.Icon({
            icon_name: 'preferences-desktop-screensaver-symbolic',
            style_class: 'system-status-icon',
        });
        box.add_child(this._icon);

        this._label = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._label);
        this.add_child(box);

        this._buildMenu();
        this.sync();
    }

    _buildMenu() {
        this.menu.removeAll();

        const titleItem = new PopupMenu.PopupMenuItem(_('Screen Blank Delay'), {reactive: false});
        titleItem.add_style_class_name('screen-blank-monitor-title');
        this.menu.addMenuItem(titleItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // System Delays
        const delayOptions = getDelayOptions();

        this._systemItems = new Map();
        for (const opt of delayOptions) {
            const item = new PopupMenu.PopupMenuItem(opt.label);
            item.connect('activate', () => {
                this._sessionSettings.set_uint('idle-delay', opt.seconds);
                if (opt.seconds > 0)
                    this._extSettings.set_uint('last-active-system-delay', opt.seconds);
            });
            this._systemItems.set(opt.seconds, item);
            this.menu.addMenuItem(item);
        }

        // Multi-Monitor Section
        const monitors = this._extension.blankManager.getMonitorsList();
        if (monitors.length > 1 || this._extSettings.get_boolean('per-monitor-enabled')) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const pmHeader = new PopupMenu.PopupMenuItem(_('Per-Screen Delay'), {reactive: false});
            pmHeader.add_style_class_name('screen-blank-monitor-title');
            this.menu.addMenuItem(pmHeader);

            for (const mon of monitors) {
                const badge = mon.isPrimary ? _('(Primary)') : '';
                const currentDelayStr = mon.delay === -1
                    ? _('Follow System')
                    : formatDelay(mon.delay);

                const subMenuItem = new PopupMenu.PopupSubMenuMenuItem(
                    `${mon.displayName} ${badge}: ${currentDelayStr}`,
                    true
                );
                subMenuItem.icon.icon_name = 'video-display-symbolic';

                const followItem = new PopupMenu.PopupMenuItem(_('Follow System'));
                followItem.setOrnament(mon.delay === -1 ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
                followItem.connect('activate', () => {
                    this._extension.blankManager.setMonitorDelay(mon.connector, -1);
                });
                subMenuItem.menu.addMenuItem(followItem);

                for (const opt of delayOptions) {
                    const dItem = new PopupMenu.PopupMenuItem(opt.label);
                    dItem.setOrnament(mon.delay === opt.seconds ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
                    dItem.connect('activate', () => {
                        this._extension.blankManager.setMonitorDelay(mon.connector, opt.seconds);
                    });
                    subMenuItem.menu.addMenuItem(dItem);
                }

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
            this._extension.blankManager.blankAllNow();
        });
        this.menu.addMenuItem(blankAllItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addAction(_('Power Settings…'), () => {
            try {
                Gio.AppInfo.create_from_commandline('gnome-control-center power', null, Gio.AppInfoCreateFlags.NONE).launch([], null);
            } catch (e) {
                // fallback
            }
        });

        this.menu.addAction(_('Extension Settings…'), () => {
            this._extension.openPreferences();
        });
    }

    sync() {
        const currentDelay = this._sessionSettings.get_uint('idle-delay');
        const delayStr = currentDelay === 0 ? _('Never') : formatDelay(currentDelay);
        this._label.text = ` ${delayStr}`;

        this._buildMenu();

        if (this._systemItems) {
            for (const [sec, item] of this._systemItems.entries()) {
                item.setOrnament(sec === currentDelay ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
            }
        }
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
            this._topBarButton = new ScreenBlankTopBarButton(this);
            Main.panel.addToStatusArea(this.uuid, this._topBarButton);
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

        if (this.blankManager) {
            this.blankManager.destroy();
            this.blankManager = null;
        }

        this._settings = null;
        this._sessionSettings = null;
    }
}
