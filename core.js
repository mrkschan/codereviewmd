/*jshint esnext: true */

var crypto = require('crypto');
var querystring = require('querystring');
var util = require('util');

var bodyParser = require('body-parser');
var co = require('co');
var express = require('express');
var request = require('co-request');
var wrap = require('co-express');

(function(exports) {
  'use strict';

  var config = {};

  exports.configure = function() {
    var hostname = process.env.HOSTNAME || 'localhost';
    var port = process.env.PORT || 5000;

    var username = process.env.GITHUB_USERNAME || null;
    var token = process.env.ACCESS_TOKEN || null;
    var repo = process.env.GITHUB_REPO || null;
    var codereviewmd = process.env.CODEREVIEWMD || 'CODEREVIEW.md';

    if (!username) {
      throw Error("Environment variable 'GITHUB_USERNAME' is required");
    }

    if (!repo) {
      throw Error("Environment variable 'GITHUB_REPO' is required");
    }

    if (!token) {
      throw Error("Environment variable 'ACCESS_TOKEN' is required");
    }

    // Prepare shared secret.
    var payload = username + repo + token;
    var secret = crypto.createHash('md5').update(payload)
                                         .digest('hex');

    config.hostname = hostname;
    config.port = port;

    config.token = token;
    config.username = username;
    config.repo = repo;
    config.secret = secret;

    config.codereviewmd = codereviewmd;
  };

  exports.init = co.wrap(function* () {
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
    var r = yield request({
      method: 'POST',
      url: url,
      auth: {'user': config.username, 'pass': config.token},
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': util.format('codereviewmd by %s', config.username)
      },
      body: data
    });

    var succeed = false;

    if (r.statusCode === 201) {
      succeed = true;
    } else if (r.statusCode === 422) {
      var msg = JSON.parse(r.body).errors[0].message;
      if (msg.toLowerCase().indexOf('already exists') > -1) {
        succeed = true;
      }
    }

    if (!succeed) {
      throw Error(util.format('Http%s - %s', r.statusCode, r.body));
    }
  });

  exports.runserver = function() {
    var app = express();
    app.set('port', config.port);

    var webhookParser = bodyParser.text({'type': 'application/json'});
    app.post('/webhook/pullrequest/', webhookParser, wrap(function* (req, res) {
      var evt = req.header('X-Github-Event');
      var sign = req.header('X-Hub-Signature');
      var payload = req.body;

      if (evt !== 'ping' && evt !== 'pull_request') {
        return res.sendStatus(400);
      }

      // TODO: Use constant-time compare in Hmac verification
      var computed = crypto.createHmac('sha1', config.secret).update(payload)
                                                             .digest('hex');
      if ('sha1=' + computed !== sign) {
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
      var r = yield request({
        method: 'GET',
        url: url,
        auth: {'user': config.username, 'pass': config.token},
        headers: {
          'User-Agent': util.format('codereviewmd by %s', config.username)
        }
      });

      if (r.statusCode !== 200) {
        console.error(util.format('Failed to read checklist: HTTP%s - %s',
                      r.statusCode, r.body));
        return res.sendStatus(202);
      }

      var reply = JSON.parse(r.body);
      if (reply.type !== 'file') {
        console.error(util.format('Please use a text file as the checklist: %s',
                      config.codereviewmd));
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
      var r = yield request({
        method: 'POST',
        url: url,
        auth: {'user': config.username, 'pass': config.token},
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'User-Agent': util.format('codereviewmd by %s', config.username)
        },
        body: data
      });
      if (r.statusCode !== 201) {
        console.error(util.format('Cannot create checklist: HTTP%s - %s'),
                      r.statusCode, r.body);
        return res.sendStatus(202);
      }

      console.info(util.format("Created checklist on github.com/%s/%s/pull/%s",
                   config.username, config.repo, issue));
      return res.sendStatus(202);
    }));

    app.listen(app.get('port'), function() {
      console.log('Node app is running on port', app.get('port'));
    });
  };
}(exports));
