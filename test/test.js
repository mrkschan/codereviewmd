var assert = require('assert');
var rewire = require('rewire');

var core = rewire('../core.js');

describe('core', function() {
  describe('#init()', function() {
    it('should run', function() {
      assert.equal(true, true);
    });
  });
});

