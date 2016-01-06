var crypto = require('crypto');

exports.getConfig = function(username, repo, token) {
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

  return {
    hostname: hostname,
    port: port,

    token: token,
    username: username,
    repo: repo,
    secret: secret,

    codereviewmd: codereviewmd
  };
};
