var crypto = require('crypto');
var express = require('express');
var https = require('https');
var querystring = require('querystring');
var util = require('util');


(function() {
  'use strict';

  var app = express();

  var hostname = process.env.HOSTNAME || 'localhost';
  var port = process.env.PORT || 5000;

  var seed = process.env.SEED || null;
  var username = process.env.GITHUB_USERNAME || null;
  var token = process.env.ACCESS_TOKEN || null;
  var repo = process.env.GITHUB_REPO || null;

  function init(run_server) {
    // Validate Github config.
    if (!username) {
      var msg = 'Please specify Github %s via environment variable: %s';
      msg = util.format(msg, 'username', 'GITHUB_USERNAME');
      console.warn(msg);

      process.exit(1);
    }

    if (!token) {
      var msg = 'Please specify Github %s via environment variable: %s';
      msg = util.format(msg, 'access token', 'ACCESS_TOKEN');
      console.warn(msg);

      process.exit(1);
    }

    if (!repo) {
      var msg = 'Please specify Github %s via environment variable: %s';
      msg = util.format(msg, 'repository', 'GITHUB_REPO');
      console.warn(msg);

      process.exit(1);
    }

    // Prepare shared secret.
    var buf = (seed)? new Buffer(seed, 'ascii')
                    : new Buffer(crypto.randomBytes(8), 'binary');
    var secret = crypto.createHash('md5').update(buf.toString('binary'))
                                         .digest('hex');

    // Setup webhook.
    var data = JSON.stringify({
      'name': 'web',
      'active': true,
      'events': [
        'pull_request'
      ],
      'config': {
        'url': util.format('https://%s/webhook/pullrequest/', hostname),
        'content_type': 'json',
        'secret': secret
      }
    });

    var req = https.request({
      hostname: 'api.github.com',
      path: util.format('/repos/%s/%s/hooks', username, repo),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': util.format('codereviewmd by %s', username)
      },
      auth: util.format('%s:%s', username, token)
    }, function(res) {
      var buf = '';
      res.on('data', function(chunk) {
        buf += chunk;
      });
      res.on('end', function() {
        var succeed = false;

        if (res.statusCode === 201) {
          succeed = true;
        } else if (res.statusCode === 422) {
          var msg = JSON.parse(buf).errors[0].message;
          if (msg.toLowerCase().indexOf('already exists') > -1) {
            succeed = true;
          }
        }

        if (!succeed) {
          var msg = 'Failed to create webhook: HTTP%s - %s';
          console.error(util.format(msg, res.statusCode, buf));

          process.exit(1);
        }

        // Run server now.
        run_server();
      });
    });

    req.on('error', function(e) {
      var msg = 'Failed to create webhook: %s';
      console.error(util.format(msg, e.message));

      process.exit(1);
    });

    req.write(data);
    req.end();
  }

  function runserver() {
    app.set('port', port);
    app.get('/webhook/pullrequest/', function(request, response) {
      // TODO: Read CODEREVIEW.md at the root of repo
      // TODO: HTTP-POST a new checklist onto the PR
      // TODO: Use async task to create a new checklist
    });

    app.listen(app.get('port'), function() {
      console.log('Node app is running on port', app.get('port'));
    });
  }

  init(runserver);
}());
