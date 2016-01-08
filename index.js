var core = require('./core');

(function() {
  'use strict';

  try {
    core.configure();
    core.init().then(function() {
      core.runserver();
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}());
