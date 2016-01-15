[![Build Status](https://travis-ci.org/mrkschan/codereviewmd.svg)](https://travis-ci.org/mrkschan/codereviewmd)
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

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
npm install && npm test
env HOSTNAME=codereviewmd.herokuapp.com GITHUB_USERNAME=mrkschan \
    GITHUB_REPO=codereviewmd ACCESS_TOKEN=ACCESS_TOKEN \
    node --harmony index.js
```

FAQ
---

1. Why a checklist?

   Is it better to write down the engineering principles, put it on the wall,
   and let everyone on the team to share the same goals in a code review?
   Or, is it better to write down the traps and avoid them all?

   E.g. "If this PR adds an online DDL to MySQL table, make sure there is no concurrent INSERTs that could possibly introduce Duplicate Key error on that table."

   More examples? See https://github.com/mrkschan/codereviewmd/blob/master/CODEREVIEW.md.

2. Why not CONTRIBUTING.md?

   As mentioned in https://github.com/dear-github/dear-github,
   one size doesn't fit all.
   And, do you prefer reading a checklist on a separate web page?

3. Why not bookmarklet?

   One size doesn't fit all. If there is a bookmarklet that allows picking a checklist
   for a specific component, that would be NICE.

   Though, it is WIP in [issue #9](https://github.com/mrkschan/codereviewmd/issues/9).

4. Where is Github OAuth support?

   Install once, run on many repositories. On the way, [issue #6](https://github.com/mrkschan/codereviewmd/issues/6).

5. Would a checklist prevent innovation?

   Hopefully not. That really depends on how your team make the checklist.

   If the list says: "No one-liner is allowed". Who would commit a really nice one?
   And, what if it says: "One-liner is nice, only when it improves readability"?

   Remember to update your checklist whenever appropriate.


.
