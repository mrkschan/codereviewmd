var bodyParser = require('body-parser');
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

  var username = process.env.GITHUB_USERNAME || null;
  var token = process.env.ACCESS_TOKEN || null;
  var repo = process.env.GITHUB_REPO || null;
  var mdPath = process.env.CODEREVIEWMD || 'CODEREVIEW.md';

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
    var msg = username + repo + token;
    var secret = crypto.createHash('md5').update(msg)
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
        run_server(username, token, repo, secret, mdPath);
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

  function runserver(username, token, repo, secret, mdPath) {
    app.set('port', port);

    var webhookParser = bodyParser.text({'type': 'application/json'});
    app.post('/webhook/pullrequest/', webhookParser, function(req, res) {
      var evt = req.header('X-Github-Event');
      var sign = req.header('X-Hub-Signature');
      var payload = req.body;

      if (evt!== 'ping' && evt !== 'pull_request') {
        return res.sendStatus(400);
      }

      // TODO: Use constant-time compare in Hmac verification
      var computed = crypto.createHmac('sha1', secret).update(payload)
                                                      .digest('hex');
      if ('sha1='+computed !== sign) {
        return res.sendStatus(400);
      }

      // TODO: Use async task to create a new checklist from CODEREVIEW.md
      var mdReq = https.request({
        hostname: 'api.github.com',
        path: util.format('/repos/%s/%s/contents/%s', username, repo, mdPath),
        method: 'GET',
        headers: {
          'User-Agent': util.format('codereviewmd by %s', username)
        },
        auth: util.format('%s:%s', username, token)
      }, function(mdRes) {
        var buf = '';
        mdRes.on('data', function(chunk) {
          buf += chunk;
        });
        mdRes.on('end', function() {
          var succeed = false;

          if (mdRes.statusCode === 200) {
            succeed = true;
          }

          if (!succeed) {
            var msg = 'Failed to read checklist: HTTP%s - %s';
            console.error(util.format(msg, mdRes.statusCode, buf));
          }

          console.log(buf);
          res.sendStatus(202);

          // TODO: HTTP-POST a new checklist onto the PR
        });
      });

      mdReq.on('error', function(e) {
        var msg = 'Failed to read checklist: %s';
        console.error(util.format(msg, e.message));
      });
      mdReq.end();
    });

    app.listen(app.get('port'), function() {
      console.log('Node app is running on port', app.get('port'));
    });
  }

  init(runserver);
}());
