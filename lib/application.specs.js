const expect = require('chai').expect
const Application = require('..')

describe('Application', () => {
  describe('#constructor', () => {
    it('should allow configuration', () => {
      const cfg = { one: 1, two: 2, three: 3 }
      const app = new Application(cfg)

      expect(app._config).to.contain(cfg)
    })
  })
})
