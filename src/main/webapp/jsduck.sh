jsduck --config resources/voyant/current/docs/en/config.json --output docs --ignore-global app; cp docs/index.html docs/index.jsp; chmod 644 docs/extjs/ext-all.js; jsduck --config resources/voyant/current/docs/en/config.json --output docs/ace --export=full --ignore-global app

jsduck --config resources/voyant/current/docs/en/config.json --output docs --ignore-global; cp docs/index.html docs/index.jsp; chmod 644 docs/extjs/ext-all.js;
