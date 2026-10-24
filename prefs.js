import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function _(str) {
    try {
        return gettext(str);
    } catch {
        return str;
    }
}

function getDelayOptions() {
    return [
        {seconds: -1, label: _('Follow System')},
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

export default class ScreenBlankDelayPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const sessionSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.session'});
        const delayOptions = getDelayOptions();
        const systemDelayOptions = delayOptions.filter(opt => opt.seconds !== -1);

        window.set_default_size(680, 640);
        window.icon_name = 'preferences-desktop-screensaver-symbolic';
        if (typeof window.set_icon_name === 'function')
            window.set_icon_name('preferences-desktop-screensaver-symbolic');

        const basePath = this.path ?? this.dir?.get_path?.();
        const iconFile = basePath ? Gio.File.new_for_path(GLib.build_filenamev([basePath, 'icon.png'])) : null;
        const iconExists = iconFile && iconFile.query_exists(null);
        const customIconPath = iconExists ? iconFile.get_path() : null;

        // ================= PAGE 1: GENERAL =================
        const generalPage = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });

        // App Banner
        const headerGroup = new Adw.PreferencesGroup();
        const headerBannerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 16,
            margin_top: 6,
            margin_bottom: 10,
            halign: Gtk.Align.CENTER,
        });

        const headerAppIcon = customIconPath
            ? Gtk.Image.new_from_file(customIconPath)
            : new Gtk.Image({
                icon_name: 'preferences-desktop-screensaver-symbolic',
            });
        headerAppIcon.pixel_size = 48;
        headerBannerBox.append(headerAppIcon);

        const headerTitleBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER,
            spacing: 2,
        });
        const headerAppTitle = new Gtk.Label({
            label: '<span size="large" weight="bold">Screen Blank Delay</span>',
            use_markup: true,
            xalign: 0,
        });
        const headerAppSubtitle = new Gtk.Label({
            label: '<span color="#888888">' + _('Per-screen and system idle timeout controls') + '</span>',
            use_markup: true,
            xalign: 0,
        });
        headerTitleBox.append(headerAppTitle);
        headerTitleBox.append(headerAppSubtitle);
        headerBannerBox.append(headerTitleBox);
        headerGroup.add(headerBannerBox);
        generalPage.add(headerGroup);

        // Group 1: Display Location
        const locationGroup = new Adw.PreferencesGroup({
            title: _('Menu Visibility'),
            description: _('Choose where Screen Blank Delay controls appear'),
        });

        const tbRow = new Adw.SwitchRow({
            title: _('Show in Top Bar Panel (Default)'),
            subtitle: _('Display an indicator icon with current delay on the top bar'),
        });
        settings.bind('show-in-top-bar', tbRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        locationGroup.add(tbRow);

        const styleRow = new Adw.ComboRow({
            title: _('Top Bar Display Style'),
            subtitle: _('Choose how the indicator appears in the top panel'),
        });
        const styleModel = new Gtk.StringList();
        styleModel.append(_('Icon and Compact Delay (e.g. 10m)'));
        styleModel.append(_('Icon and Full Delay (e.g. 10 min)'));
        styleModel.append(_('Icon Only'));
        styleRow.model = styleModel;

        const currentStyle = settings.get_string('top-bar-display-style');
        styleRow.selected = currentStyle === 'icon-only' ? 2 : (currentStyle === 'full' ? 1 : 0);

        styleRow.connect('notify::selected', () => {
            const styles = ['compact', 'full', 'icon-only'];
            settings.set_string('top-bar-display-style', styles[styleRow.selected] || 'compact');
        });
        locationGroup.add(styleRow);

        const qsRow = new Adw.SwitchRow({
            title: _('Show in Quick Settings Menu (Optional)'),
            subtitle: _('Display toggle and submenu in GNOME Quick Settings'),
        });
        settings.bind('show-in-quick-settings', qsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        locationGroup.add(qsRow);

        generalPage.add(locationGroup);

        // Group 2: System Screen Blank
        const systemGroup = new Adw.PreferencesGroup({
            title: _('System Screen Blank Delay'),
            description: _('Global idle timeout for all displays (synchronized with GNOME Settings)'),
        });

        const systemComboRow = new Adw.ComboRow({
            title: _('Default Blank Delay'),
            subtitle: _('Duration of inactivity before blanking displays'),
        });
        const systemModel = new Gtk.StringList();
        systemDelayOptions.forEach(opt => systemModel.append(opt.label));
        systemComboRow.model = systemModel;

        const currentSystemDelay = sessionSettings.get_uint('idle-delay');
        let selectedSysIdx = systemDelayOptions.findIndex(opt => opt.seconds === currentSystemDelay);
        if (selectedSysIdx === -1)
            selectedSysIdx = systemDelayOptions.findIndex(opt => opt.seconds === 600); // default 10m
        systemComboRow.selected = selectedSysIdx;

        systemComboRow.connect('notify::selected', () => {
            const opt = systemDelayOptions[systemComboRow.selected];
            if (opt)
                sessionSettings.set_uint('idle-delay', opt.seconds);
        });

        sessionSettings.connect('changed::idle-delay', () => {
            const newDelay = sessionSettings.get_uint('idle-delay');
            const idx = systemDelayOptions.findIndex(opt => opt.seconds === newDelay);
            if (idx !== -1 && systemComboRow.selected !== idx)
                systemComboRow.selected = idx;
        });

        systemGroup.add(systemComboRow);

        // Group 3: Behavior
        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior and Animation'),
        });

        const wakeOnPointerRow = new Adw.SwitchRow({
            title: _('Wake Screen on Pointer Movement'),
            subtitle: _('Automatically wake a blanked screen when the mouse cursor enters it'),
        });
        settings.bind('wake-on-pointer-move', wakeOnPointerRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviorGroup.add(wakeOnPointerRow);

        const fadeRow = new Adw.SwitchRow({
            title: _('Smooth Fade Transition'),
            subtitle: _('Fade screens smoothly when blanking or waking up'),
        });
        settings.bind('fade-animation', fadeRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviorGroup.add(fadeRow);

        generalPage.add(systemGroup);
        generalPage.add(behaviorGroup);
        window.add(generalPage);

        // ================= PAGE 2: PER-SCREEN =================
        const perScreenPage = new Adw.PreferencesPage({
            title: _('Per-Screen'),
            icon_name: 'video-display-symbolic',
        });

        const multiMonitorGroup = new Adw.PreferencesGroup({
            title: _('Multi-Monitor Delay Configuration'),
            description: _('Configure custom idle blank delays for individual screens'),
        });

        const perMonitorSwitch = new Adw.SwitchRow({
            title: _('Enable Per-Screen Blank Delays'),
            subtitle: _('Allow each display to blank independently after its own idle period'),
        });
        settings.bind('per-monitor-enabled', perMonitorSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        multiMonitorGroup.add(perMonitorSwitch);
        perScreenPage.add(multiMonitorGroup);

        const displaysGroup = new Adw.PreferencesGroup({
            title: _('Connected Displays'),
            description: _('Set blank timeout for each detected screen'),
        });

        this._populateDisplayRows(displaysGroup, settings, delayOptions);
        perScreenPage.add(displaysGroup);
        window.add(perScreenPage);

        // ================= PAGE 3: ABOUT =================
        const aboutPage = new Adw.PreferencesPage({
            title: _('About'),
            icon_name: 'help-about-symbolic',
        });

        const aboutGroup = new Adw.PreferencesGroup();

        const aboutBannerBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 24,
            margin_bottom: 24,
            halign: Gtk.Align.CENTER,
        });

        const aboutIcon = customIconPath
            ? Gtk.Image.new_from_file(customIconPath)
            : new Gtk.Image({
                icon_name: 'preferences-desktop-screensaver-symbolic',
            });
        aboutIcon.pixel_size = 72;
        aboutBannerBox.append(aboutIcon);

        const aboutNameLabel = new Gtk.Label({
            label: '<span size="x-large" weight="bold">Screen Blank Delay</span>',
            use_markup: true,
        });
        aboutBannerBox.append(aboutNameLabel);

        const aboutVersionLabel = new Gtk.Label({
            label: '<span color="#888888">Version 1.0.0</span>',
            use_markup: true,
        });
        aboutBannerBox.append(aboutVersionLabel);

        const aboutDescLabel = new Gtk.Label({
            label: _('Control screen blank delay quickly from Quick Settings or Top Bar,\nwith multi-monitor and per-display delay support.'),
            justify: Gtk.Justification.CENTER,
            margin_top: 6,
        });
        aboutBannerBox.append(aboutDescLabel);

        aboutGroup.add(aboutBannerBox);

        const linksGroup = new Adw.PreferencesGroup({
            title: _('Links and Project'),
        });

        const authorRow = new Adw.ActionRow({
            title: _('Author'),
            subtitle: 'midoreigh',
        });
        linksGroup.add(authorRow);

        const githubRow = new Adw.ActionRow({
            title: _('GitHub Repository'),
            subtitle: 'https://github.com/midoreigh/screen-blank-delay',
        });
        const openGithubBtn = new Gtk.Button({
            label: _('Open'),
            valign: Gtk.Align.CENTER,
        });
        openGithubBtn.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri('https://github.com/midoreigh/screen-blank-delay', null);
        });
        githubRow.add_suffix(openGithubBtn);
        linksGroup.add(githubRow);

        const licenseRow = new Adw.ActionRow({
            title: _('License'),
            subtitle: 'GNU General Public License v3.0 (GPL-3.0)',
        });
        linksGroup.add(licenseRow);

        aboutPage.add(aboutGroup);
        aboutPage.add(linksGroup);
        window.add(aboutPage);
    }

    _populateDisplayRows(group, settings, delayOptions) {
        const delaysDict = settings.get_value('per-monitor-delays').deepUnpack();

        try {
            const display = Gdk.Display.get_default();
            const monitorsList = display.get_monitors();
            const nMonitors = monitorsList.get_n_items();

            if (nMonitors === 0) {
                const noMonRow = new Adw.ActionRow({
                    title: _('No connected displays detected'),
                });
                group.add(noMonRow);
                return;
            }

            for (let i = 0; i < nMonitors; i++) {
                const mon = monitorsList.get_item(i);
                const connector = mon.get_connector() || `Display-${i + 1}`;
                let desc = mon.get_description() || mon.get_model() || _('Display %d').format(i + 1);
                if (desc && typeof desc.deepUnpack === 'function')
                    desc = desc.deepUnpack();
                if (typeof desc !== 'string')
                    desc = String(desc);

                const row = new Adw.ComboRow({
                    title: `${desc} (${connector})`,
                    subtitle: _('Blank delay for this display'),
                });

                const model = new Gtk.StringList();
                delayOptions.forEach(opt => model.append(opt.label));
                row.model = model;

                const configuredDelay = delaysDict[connector] !== undefined ? delaysDict[connector] : -1;
                let selectedIdx = delayOptions.findIndex(opt => opt.seconds === configuredDelay);
                if (selectedIdx === -1)
                    selectedIdx = 0; // Follow System

                row.selected = selectedIdx;

                row.connect('notify::selected', () => {
                    const opt = delayOptions[row.selected];
                    const currentDict = settings.get_value('per-monitor-delays').deepUnpack();
                    if (opt.seconds === -1) {
                        delete currentDict[connector];
                    } else {
                        currentDict[connector] = opt.seconds;
                    }

                    const builder = new GLib.VariantBuilder(new GLib.VariantType('a{si}'));
                    for (const [k, v] of Object.entries(currentDict)) {
                        builder.add_value(new GLib.Variant('{si}', [k, v]));
                    }
                    settings.set_value('per-monitor-delays', builder.end());
                });

                group.add(row);
            }
        } catch (e) {
            const errRow = new Adw.ActionRow({
                title: _('Connected Displays'),
                subtitle: e.message,
            });
            group.add(errRow);
        }
    }
}

