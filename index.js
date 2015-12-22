var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

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

// TODO: Read Github access token from environment
// TODO: Configure repo location
// TODO: Setup webhook on Github

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


