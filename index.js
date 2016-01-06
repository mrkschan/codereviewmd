var bodyParser = require('body-parser');
var crypto = require('crypto');
var express = require('express');
var querystring = require('querystring');
var request = require('request');
var util = require('util');

var core = require('./core');

(function() {
  'use strict';
  var app = express();

  try {
    var config = core.getConfig();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  function init(run_server) {
    // Setup webhook.
    var data = JSON.stringify({
      'name': 'web',
      'active': true,
      'events': [
        'pull_request'
      ],
      'config': {
        'url': util.format('https://%s/webhook/pullrequest/', config.hostname),
        'content_type': 'json',
        'secret': config.secret
      }
    });

    var url = util.format('https://api.github.com/repos/%s/%s/hooks',
                          config.username, config.repo);
    request({
      method: 'POST',
      url: url,
      auth: {'user': config.username, 'pass': config.token},
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': util.format('codereviewmd by %s', config.username)
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
      run_server();
    });
  }

  function runserver() {
    app.set('port', config.port);

    var webhookParser = bodyParser.text({'type': 'application/json'});
    app.post('/webhook/pullrequest/', webhookParser, function(req, res) {
      var evt = req.header('X-Github-Event');
      var sign = req.header('X-Hub-Signature');
      var payload = req.body;

      if (evt !== 'ping' && evt !== 'pull_request') {
        return res.sendStatus(400);
      }

      // TODO: Use constant-time compare in Hmac verification
      var computed = crypto.createHmac('sha1', config.secret).update(payload)
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
                            config.username, config.repo, config.codereviewmd);
      request({
        method: 'GET',
        url: url,
        auth: {'user': config.username, 'pass': config.token},
        headers: {
          'User-Agent': util.format('codereviewmd by %s', config.username)
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
          console.error(util.format(msg, config.codereviewmd));

          return res.sendStatus(202);
        }

        var content = new Buffer(reply.content, reply.encoding);
        var data = JSON.stringify({
          'body': content.toString()
        });
        var url = util.format(
          'https://api.github.com/repos/%s/%s/issues/%s/comments',
          config.username, config.repo, issue
        );
        request({
          method: 'POST',
          url: url,
          auth: {'user': config.username, 'pass': config.token},
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'User-Agent': util.format('codereviewmd by %s', config.username)
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
