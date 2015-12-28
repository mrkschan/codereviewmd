var bodyParser = require('body-parser');
var crypto = require('crypto');
var express = require('express');
var querystring = require('querystring');
var request = require('request');
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

    var url = util.format('https://api.github.com/repos/%s/%s/hooks',
                          username, repo);
    request({
      method: 'POST',
      url: url,
      auth: {'user': username, 'pass': token},
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': util.format('codereviewmd by %s', username)
      },
      body: data
    }, function(error, response, body) {
      if (error) {
        var msg = 'Failed to create webhook: HTTP%s - %s';
        console.error(util.format(msg, response.statusCode, body));

        process.exit(1);
        return;
      }

      var succeed = false;

      if (response.statusCode === 201) {
        succeed = true;
      } else if (response.statusCode === 422) {
        var msg = JSON.parse(body).errors[0].message;
        if (msg.toLowerCase().indexOf('already exists') > -1) {
          succeed = true;
        }
      }

      if (!succeed) {
        var msg = 'Failed to create webhook: HTTP%s - %s';
        console.error(util.format(msg, response.statusCode, body));

        process.exit(1);
        return;
      }

      // Run server now.
      run_server(username, token, repo, secret, mdPath);
    });
  }

  function runserver(username, token, repo, secret, mdPath) {
    app.set('port', port);

    var webhookParser = bodyParser.text({'type': 'application/json'});
    app.post('/webhook/pullrequest/', webhookParser, function(req, res) {
      var evt = req.header('X-Github-Event');
      var sign = req.header('X-Hub-Signature');
      var payload = req.body;

      if (evt !== 'ping' && evt !== 'pull_request') {
        return res.sendStatus(400);
      }

      // TODO: Use constant-time compare in Hmac verification
      var computed = crypto.createHmac('sha1', secret).update(payload)
                                                      .digest('hex');
      if ('sha1='+computed !== sign) {
        return res.sendStatus(403);
      }

      if (evt === 'ping') {
        return res.sendStatus(202);
      }

      var info = JSON.parse(payload);
      if (info.action !== 'opened') {
        return res.sendStatus(202);
      }
      var issue = info.pull_request.number;

      // TODO: Use async task to create a new checklist from CODEREVIEW.md
      var url = util.format('https://api.github.com/repos/%s/%s/contents/%s',
                            username, repo, mdPath);
      request({
        method: 'GET',
        url: url,
        auth: {'user': username, 'pass': token},
        headers: {
          'User-Agent': util.format('codereviewmd by %s', username)
        }
      }, function(error, response, body) {
        if (error) {
          var msg = 'Failed to read checklist: HTTP%s - %s';
          console.error(util.format(msg, response.statusCode, error));

          return res.sendStatus(202);
        }

        var succeed = false;

        if (response.statusCode === 200) {
          succeed = true;
        }

        if (!succeed) {
          var msg = 'Failed to read checklist: HTTP%s - %s';
          console.error(util.format(msg, response.statusCode, body));

          return res.sendStatus(202);
        }

        var reply = JSON.parse(body);
        if (reply.type !== 'file') {
          var msg = 'Please use a text file as the checklist: %s';
          console.error(util.format(msg, mdPath));

          return res.sendStatus(202);
        }

        var content = new Buffer(reply.content, reply.encoding);
        var data = JSON.stringify({
          'body': content.toString()
        });
        var url = util.format(
          'https://api.github.com/repos/%s/%s/issues/%s/comments',
          username, repo, issue
        );
        request({
          method: 'POST',
          url: url,
          auth: {'user': username, 'pass': token},
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'User-Agent': util.format('codereviewmd by %s', username)
          },
          body: data
        }, function(error, response, body) {
          if (error) {
            var msg = 'Failed to create checklist: HTTP%s - %s';
            console.error(util.format(msg, response.statusCode, error));

            return res.sendStatus(202);
          }

          return res.sendStatus(202);
        });
      });
    });

    app.listen(app.get('port'), function() {
      console.log('Node app is running on port', app.get('port'));
    });
  }

  init(runserver);
}());
