HAVE_YARN != command -v yarn 2>/dev/null
ifdef HAVE_YARN
PM=yarn
else
PM=npm
endif
yarn_INSTALL_ARGS=--ignore-optional
npm_INSTALL_ARGS=--no-optional

all:
	$(PM) run build --production
	echo "(function() {"  > bundle.js
	cat lib/*.js         >> bundle.js
	echo                 >> bundle.js
	echo "}());"         >> bundle.js
	test -d release || mkdir release
	rsync -a --delete-after bundle.js style.css quill.snow.css divvun.ico locales release/
	rm bundle.js

deps: node_modules src/l20n.js

.PHONY: node_modules
node_modules:
	$(PM) install $($(PM)_INSTALL_ARGS)

check:
	./node_modules/.bin/flow
	test -d tmp || mkdir tmp
	closure-compiler				\
			 --warning_level VERBOSE	\
			 --js src/app.js		\
			 --js_output_file tmp/app.closure.js


src/l20n.js: node_modules/l20n/dist/web/l20n.js
	cp $< $@

# TODO: can I make "anything in this dir" depend on pmdeps?
node_modules/l20n/dist/bundle/web/l20n.js: node_modules

deploy: all
	rsync -avh release/ woodwingtest:/Applications/MAMP/htdocs/Enterprise/config/plugins/divvungc/

deployprod: all
	rsync -avh release/ woodwingprod:/opt/local/apache2/htdocs/Enterprise/config/plugins/divvungc/

watch:
	git ls-files |grep -v ^lib | entr -rc make
