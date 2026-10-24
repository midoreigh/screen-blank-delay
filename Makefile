UUID = screen-blank-delay@midoreigh
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMAS_DIR = schemas

.PHONY: all schemas package install uninstall enable disable clean

all: schemas

schemas:
	glib-compile-schemas $(SCHEMAS_DIR)

package: schemas
	gnome-extensions pack --force \
		--extra-source=stylesheet.css \
		--schema=$(SCHEMAS_DIR)/org.gnome.shell.extensions.screen-blank-delay.gschema.xml \
		.

install: schemas
	rm -rf "$(INSTALL_DIR)"
	mkdir -p "$(INSTALL_DIR)"
	cp -r metadata.json extension.js prefs.js stylesheet.css schemas po LICENSE README.md "$(INSTALL_DIR)/"
	glib-compile-schemas "$(INSTALL_DIR)/schemas"
	@echo "Installed $(UUID) to $(INSTALL_DIR)"

uninstall:
	gnome-extensions uninstall $(UUID) || rm -rf "$(INSTALL_DIR)"
	@echo "Uninstalled $(UUID)"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

prefs:
	gnome-extensions prefs $(UUID)

clean:
	rm -f $(SCHEMAS_DIR)/gschemas.compiled
	rm -f $(UUID).shell-extension.zip
