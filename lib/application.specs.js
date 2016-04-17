'use strict'

const expect = require('chai').expect
const Application = require('..')

describe('Application', () => {
  describe('#constructor', () => {
    it('should allow configuration', () => {
      const cfg = { one: 1, two: 2, three: 3 }
      const app = new Application(cfg)

      expect(app._config).to.contain(cfg)
    })

    it('should have an array of middleware', () => {
      const app = new Application()

      expect(app.middleware).to.be.an('array')
    })

    it('should have an array of middleware', () => {
      const app = new Application()

      expect(app.middleware).to.be.an('array')
    })

    it('should be an EventEmitter', () => {
      const EventEmitter = require('events').EventEmitter
      expect(Application()).to.be.an.instanceof(EventEmitter)
    })
  })

  describe('#use', () => {
    let app

    beforeEach(() => {
      app = new Application()
    })

    it('should throw when a non-generator function is passed', () => {
      expect(() => {
        app.use()
      }).to.throw(/#use requires a generator/)

      expect(() => {
        app.use(() => {})
      }).to.throw(/#use requires a generator/)
    })

    it('should add generator to middleware', () => {
      const gen = function * (next) { yield next }

      app.use(gen)
      expect(app.middleware).to.contain(gen)
    })
  })

  describe('#createContext', () => {
    let app

    beforeEach(() => {
      app = new Application()
    })

    it('should create a message context', () => {
      const context = app.createContext()
      expect(context).to.exist
    })

    it('should include a reference to the application', () => {
      const context = app.createContext()
      expect(context.app).to.eql(app)
    })

    it('should include the provided message', () => {
      const message = {
        content: new Buffer('message content'),
        fields: {},
        properties: {}
      }
      const context = app.createContext(message)
      expect(context.message).to.eql(message)
    })
  })

  describe('#listen', () => {
    let app

    beforeEach(() => {
      app = new Application()
    })

    it('should throw when a non-generator function is passed', () => {
      expect(() => {
        app.listen()
      }).to.throw(/#use requires a generator/)

      expect(() => {
        app.listen(() => {})
      }).to.throw(/#use requires a generator/)
    })

    it('should create a handler of composed middleware and messageHandler', function * () {
      let calls = []

      app.use(function * (next) {
        calls.push(1)
        yield next
        calls.push(6)
      })

      app.use(function * (next) {
        calls.push(2)
        yield next
        calls.push(5)
      })

      app.listen(function * (next) {
        calls.push(3)
        yield next
        calls.push(4)
      })

      yield app.handler()

      expect(calls).to.eql([1, 2, 3, 4, 5, 6])
    })
  })
})
