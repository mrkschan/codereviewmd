/*jshint esnext: true */

var crypto = require('crypto');
var querystring = require('querystring');
var util = require('util');

var bodyParser = require('body-parser');
var co = require('co');
var express = require('express');
var request = require('co-request');
var wrap = require('co-express');

var config = {};

exports.configure = function() {
  var hostname = process.env.HOSTNAME || 'localhost';
  var port = process.env.PORT || 5000;

  var username = process.env.GITHUB_USERNAME || null;
  var token = process.env.ACCESS_TOKEN || null;
  var repo = process.env.GITHUB_REPO || null;
  var codereviewmd = process.env.CODEREVIEWMD || 'CODEREVIEW.md';

  if (!username) {
    throw new Error("Environment variable 'GITHUB_USERNAME' is required");
  }

  if (!repo) {
    throw new Error("Environment variable 'GITHUB_REPO' is required");
  }

  if (!token) {
    throw new Error("Environment variable 'ACCESS_TOKEN' is required");
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
  config.useragent = util.format('codereviewmd by %s', config.username);

  console.info(util.format('Using CODEREVIEW.md, https://github.com/%s/%s/%s',
                           username, repo, codereviewmd));
};

exports.init = co.wrap(function* () {
  yield setupWebhook();
});

exports.runserver = function() {
  var app = express();
  app.set('port', config.port);

  var webhookParser = bodyParser.text({'type': 'application/json'});
  app.post('/webhook/pullrequest/', webhookParser, wrap(function* (req, res) {
    // TODO: Use async task to handle webhook event
    var evt = req.header('X-Github-Event');
    var signed = req.header('X-Hub-Signature');
    var payload = req.body;

    if (evt !== 'ping' && evt !== 'pull_request') {
      return res.sendStatus(400);
    }
    // TODO: Use constant-time compare in Hmac verification
    var computed = crypto.createHmac('sha1', config.secret).update(payload)
                                                           .digest('hex');
    if ('sha1=' + computed !== signed) {
      console.warn('Webhook Hmac mismatch');
      return res.sendStatus(403);
    }

    if (evt === 'ping') {
      return res.sendStatus(202);
    }

    var info = JSON.parse(payload);
    if (info.action !== 'opened') {
      return res.sendStatus(202);
    }

    try {
      var content = yield getCodereviewmd();
      yield createChecklist(info.pull_request.number, content.toString());
    } catch (err) {
      console.error(err.message);
      return res.sendStatus(202);
    }

    return res.sendStatus(202);
  }));

  app.listen(app.get('port'), function() {
    console.info('Node app is running on port', app.get('port'));
  });
};

var setupWebhook = function* () {
  var callback_url = util.format('https://%s/webhook/pullrequest/',
                                 config.hostname);
  var data = JSON.stringify({
    'name': 'web',
    'active': true,
    'events': [
      'pull_request'
    ],
    'config': {
      'url': callback_url,
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
      'User-Agent': config.useragent
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
    throw new Error(util.format('Cannot setup webhook, HTTP%s - %s',
                                r.statusCode, r.body));
  }

  console.info(util.format('Registered callback, %s', callback_url));
};

var getCodereviewmd = function* () {
  var url = util.format('https://api.github.com/repos/%s/%s/contents/%s',
                        config.username, config.repo, config.codereviewmd);
  var r = yield request({
    method: 'GET',
    url: url,
    auth: {'user': config.username, 'pass': config.token},
    headers: {
      'User-Agent': config.useragent
    }
  });

  if (r.statusCode !== 200) {
    throw new Error(util.format('Cannot read checklist, HTTP%s - %s',
                    r.statusCode, r.body));
  }

  var reply = JSON.parse(r.body);
  if (reply.type !== 'file') {
    throw new Error(util.format('Expecting a text file, %s',
                    config.codereviewmd));
  }

  return new Buffer(reply.content, reply.encoding);
};

var createChecklist = function* (issue, body) {
  var data = JSON.stringify({
    'body': body
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
      'User-Agent': config.useragent
    },
    body: data
  });

  if (r.statusCode !== 201) {
    throw Error(util.format('Cannot create checklist, HTTP%s - %s'),
                r.statusCode, r.body);
  }

  console.info(
    util.format('Checklist created, https://github.com/%s/%s/pull/%s',
                config.username, config.repo, issue)
  );
};
