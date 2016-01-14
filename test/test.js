var assert = require('assert');
var rewire = require('rewire');
var sinon = require('sinon');

var crypto = require('crypto');

var core = rewire('../core.js');

describe('core', function testsuiteCore() {
  describe('#configure()', function testsuiteConfigure() {
    it('should be defined', function() {
      assert.ok(core.configure);
    });

    it('should ask for missing inputs',
    function testcaseMissingInputs() {
      core.__with__({
        // Inputs
        process: {
          env: {
            HOSTNAME: null,
            PORT: null,
            GITHUB_USERNAME: null,
            GITHUB_REPO: null,
            ACCESS_TOKEN: null,
            CODEREVIEWMD: null
          }
        },

        // Outputs
        console: { info: sinon.spy() },
        config: {}
      })(function() {
        assert.throws(function() { core.configure(); }, Error);
        assert(core.__get__('console').info.notCalled);
      });

      core.__with__({
        // Inputs
        process: {
          env: {
            HOSTNAME: null,
            PORT: null,
            GITHUB_USERNAME: 'USER',
            GITHUB_REPO: null,
            ACCESS_TOKEN: null,
            CODEREVIEWMD: null
          }
        },

        // Outputs
        console: { info: sinon.spy() },
        config: {}
      })(function() {
        assert.throws(function() { core.configure(); }, Error);
        assert(core.__get__('console').info.notCalled);
      });

      core.__with__({
        // Inputs
        process: {
          env: {
            HOSTNAME: null,
            PORT: null,
            GITHUB_USERNAME: 'USER',
            GITHUB_REPO: 'REPO',
            ACCESS_TOKEN: null,
            CODEREVIEWMD: null
          }
        },

        // Outputs
        console: { info: sinon.spy() },
        config: {}
      })(function() {
        assert.throws(function() { core.configure(); }, Error);
        assert(core.__get__('console').info.notCalled);
      });

      core.__with__({
        // Inputs
        process: {
          env: {
            HOSTNAME: null,
            PORT: null,
            GITHUB_USERNAME: 'USER',
            GITHUB_REPO: 'REPO',
            ACCESS_TOKEN: 'TOKEN',
            CODEREVIEWMD: null
          }
        },

        // Outputs
        console: { info: sinon.spy() },
        config: {}
      })(function() {
        assert.doesNotThrow(function() { core.configure(); }, Error);
        assert(core.__get__('console').info.calledOnce);
      });
    }); // End missing inputs.

    it('should set default values',
    function testcaseDefaultValues() {
      core.__with__({
        // Inputs
        process: {
          env: {
            HOSTNAME: null,
            PORT: null,
            GITHUB_USERNAME: 'USER',
            GITHUB_REPO: 'REPO',
            ACCESS_TOKEN: 'TOKEN',
            CODEREVIEWMD: null
          }
        },

        // Outputs
        console: { info: sinon.spy() },
        config: {}
      })(function() {
        core.configure();

        assert.equal(core.__get__('config').hostname, 'localhost');
        assert.equal(core.__get__('config').port, 5000);
        assert.equal(core.__get__('config').codereviewmd, 'CODEREVIEW.md');
        assert(core.__get__('console').info.calledOnce);
      });
    }); // End default values.

    it('should use given values',
    function testcaseGivenValues() {
      core.__with__({
        // Inputs
        process: {
          env: {
            HOSTNAME: 'example.com',
            PORT: 8000,
            GITHUB_USERNAME: 'USER',
            GITHUB_REPO: 'REPO',
            ACCESS_TOKEN: 'TOKEN',
            CODEREVIEWMD: 'codereview.md'
          }
        },

        // Outputs
        console: { info: sinon.spy() },
        config: {}
      })(function() {
        core.configure();

        assert.equal(core.__get__('config').hostname, 'example.com');
        assert.equal(core.__get__('config').port, 8000);
        assert.equal(core.__get__('config').codereviewmd, 'codereview.md');
        assert(core.__get__('console').info.calledOnce);
      });
    }); // End given values.

    it('should generate derived values',
    function testcaseDerivedValues() {
      core.__with__({
        // Inputs
        process: {
          env: {
            HOSTNAME: 'example.com',
            PORT: 8000,
            GITHUB_USERNAME: 'USER',
            GITHUB_REPO: 'REPO',
            ACCESS_TOKEN: 'TOKEN',
            CODEREVIEWMD: 'codereview.md'
          }
        },

        // Outputs
        console: { info: sinon.spy() },
        config: {}
      })(function() {
        core.configure();

        var expectedSecret = crypto.createHash('md5').update('USERREPOTOKEN')
                                                     .digest('hex');
        assert.equal(core.__get__('config').secret, expectedSecret);
        assert.equal(core.__get__('config').useragent, 'codereviewmd by USER');
        assert(core.__get__('console').info.calledOnce);
      });
    }); // End derived values.
  }); // End #configure().

  describe('#setupWebhook()', function testsuiteSetupWebhook() {
    it('should be defined', function() {
      assert.ok(core.__get__('setupWebhook'));
    });

    it('should make API call',
    function testcaseMakeAPICall() {
      core.__with__({
        // Inputs
        config: {
          username: 'USER', repo: 'REPO', token: 'TOKEN', secret: 'SECRET',
          hostname: 'HOST', useragent: 'UA', port: 5000
        },
        APIResponse: { statusCode: 201 },

        // Outputs
        console: { info: sinon.spy() },
        request: sinon.spy()
      })(function() {
        var gen = core.__get__('setupWebhook')();
        gen.next(); // Start generator.
        gen.next(core.__get__('APIResponse')); // Inject fake API response.

        var requestSpy = core.__get__('request');
        var call = requestSpy.getCall(0);
        assert(call.args[0].method === 'POST');
        assert(call.args[0].url ===
               'https://api.github.com/repos/USER/REPO/hooks');
        assert(call.args[0].auth.user === 'USER');
        assert(call.args[0].auth.pass === 'TOKEN');
      });
    }); // End make API call.

    it('should recognize new webhook',
    function testcaseRecognizeNewWebhook() {
      core.__with__({
        // Inputs
        config: {
          username: 'USER', repo: 'REPO', token: 'TOKEN', secret: 'SECRET',
          hostname: 'HOST', useragent: 'UA', port: 5000
        },
        APIResponse: { statusCode: 201 },

        // Outputs
        console: { info: sinon.spy() },
        request: sinon.spy()
      })(function() {
        var gen = core.__get__('setupWebhook')();
        gen.next(); // Start generator.
        gen.next(core.__get__('APIResponse')); // Inject fake API response.

        assert(core.__get__('console').info.calledOnce);
      });
    }); // End recognize new webhook.

    it('should recognize existing webhook',
    function testcaseRecognizeExistingWebhook() {
      core.__with__({
        // Inputs
        config: {
          username: 'USER', repo: 'REPO', token: 'TOKEN', secret: 'SECRET',
          hostname: 'HOST', useragent: 'UA', port: 5000
        },
        APIResponse: {
          statusCode: 422,
          body: '{"errors": [{"message": "already exists"}]}'
        },

        // Outputs
        console: { info: sinon.spy() },
        request: sinon.spy()
      })(function() {
        var gen = core.__get__('setupWebhook')();
        gen.next(); // Start generator.
        gen.next(core.__get__('APIResponse')); // Inject fake API response.

        assert(core.__get__('console').info.calledOnce);
      });
    }); // End recognize existing webhook.

    it('should report webhook error',
    function testcaseReportWebhookError() {
      core.__with__({
        // Inputs
        config: {
          username: 'USER', repo: 'REPO', token: 'TOKEN', secret: 'SECRET',
          hostname: 'HOST', useragent: 'UA', port: 5000
        },
        APIResponse: { statusCode: 500, body: 'ERR' },

        // Outputs
        console: { info: sinon.spy() },
        request: sinon.spy()
      })(function() {
        assert.throws(function() {
          var gen = core.__get__('setupWebhook')();
          gen.next(); // Start generator.
          gen.next(core.__get__('APIResponse')); // Inject fake API response.
        }, Error);
        assert(core.__get__('console').info.notCalled);
      });
    }); // End report webhook error.
  }); // End #setupWebhook().
});
