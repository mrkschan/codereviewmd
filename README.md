codereviewmd
============

Create code review checklist on Github Pull Request automatically.


Quickstart
----------

1. Create your code review checklist in `CODEREVIEW.md`,
   and put it to the root of your repository.
2. Create a Github personal access token.
3. Deploy this Node.js application onto Heroku.
4. Configure your Heroku instance using the following environment variables.
   - `GITHUB_USERNAME`  # Set this to either your Github username or organization.
   - `GITHUB_REPO`  # Set this to your Github repository.
   - `ACCESS_TOKEN`  # Set this to your Github personal access token.
   - `HOSTNAME`  # Set this to your Heroku Domain.
5. Create Pull Request in your repository and enjoy :)


Build, test, run
----------------

```
npm install
env HOSTNAME=codereviewmd.herokuapp.com GITHUB_USERNAME=mrkschan \
    GITHUB_REPO=codereviewmd ACCESS_TOKEN=ACCESS_TOKEN \
    node --harmony index.js
```


.
