var express = require('express');
var util = require('util');

var app = express();

app.set('port', (process.env.PORT || 5000));

// Github username and access token used for Basic Auth.
var username = process.env.GITHUB_USERNAME || null;
var token = process.env.ACCESS_TOKEN || null;
var repo = process.env.GITHUB_REPO || null;

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

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/webhook/pullrequest/', function(request, response) {
  // TODO: Read CODEREVIEW.md at the root of repo
  // TODO: HTTP-POST a new checklist onto the PR
  // TODO: Use async task to create a new checklist
  response.render('pages/index');
});

// TODO: Setup webhook on Github

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


