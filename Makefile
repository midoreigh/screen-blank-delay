UUID = screen-blank-delay@midoreigh
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMAS_DIR = schemas

.PHONY: all schemas package install uninstall enable disable clean test-prefs lint

all: schemas

test-prefs: schemas
	GI_TYPELIB_PATH=/usr/lib/gnome-shell/girepository-1.0:/usr/lib/x86_64-linux-gnu/mutter-18 ./scripts/run-prefs.js

lint: package
	@if command -v shexli >/dev/null 2>&1; then \
		shexli $(UUID).shell-extension.zip; \
	elif [ -x /tmp/shexli_venv/bin/shexli ]; then \
		/tmp/shexli_venv/bin/shexli $(UUID).shell-extension.zip; \
	else \
		echo "shexli not found. Install with: pip install -U shexli"; \
	fi

schemas:
	glib-compile-schemas $(SCHEMAS_DIR)

package: schemas
	gnome-extensions pack --force \
		--extra-source=stylesheet.css \
		--extra-source=icon.svg \
		--extra-source=icon.png \
		--schema=$(SCHEMAS_DIR)/org.gnome.shell.extensions.screen-blank-delay.gschema.xml \
		.

install: schemas
	rm -rf "$(INSTALL_DIR)"
	mkdir -p "$(INSTALL_DIR)"
	cp -r metadata.json extension.js prefs.js stylesheet.css reload.js icon.svg icon.png schemas po LICENSE README.md "$(INSTALL_DIR)/"
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
