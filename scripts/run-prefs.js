#!/usr/bin/env -S gjs -m

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

// Register GNOME Shell Extensions gresource so Shew and ExtensionPreferences are available
const res = Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource');
res._register();

const [thisFile] = GLib.filename_from_uri(import.meta.url);
const thisDir = GLib.path_get_dirname(thisFile);
const rootDir = GLib.path_get_dirname(thisDir);
const path = rootDir + '/prefs.js';
const module = await import(`file://${path}`);

const app = new Adw.Application({
    application_id: 'org.gnome.shell.extensions.screen-blank-delay.TestPrefs',
    flags: Gio.ApplicationFlags.FLAGS_NONE,
});

app.connect('activate', () => {
    const win = new Adw.PreferencesWindow({
        application: app,
        title: 'Screen Blank Delay — Preferences Preview',
    });

    const metadata = {
        uuid: 'screen-blank-delay@midoreigh',
        'settings-schema': 'org.gnome.shell.extensions.screen-blank-delay',
        'gettext-domain': 'screen-blank-delay',
        dir: Gio.File.new_for_path(rootDir),
    };

    const prefsInstance = new module.default(metadata);

    // Bind real compiled schemas
    const schemaSource = Gio.SettingsSchemaSource.new_from_directory(
        metadata.dir.get_child('schemas').get_path(),
        Gio.SettingsSchemaSource.get_default(),
        false
    );
    const schemaObj = schemaSource.lookup(metadata['settings-schema'], true);
    const settings = new Gio.Settings({settings_schema: schemaObj});
    prefsInstance.getSettings = () => settings;

    prefsInstance.fillPreferencesWindow(win);
    win.present();
});

app.run([]);
