'use strict'

const sinon = require('sinon')

const expect = require('chai').expect
const amqplib = require('amqplib')

const EventEmitter = require('events').EventEmitter
const Application = require('..')

describe('Application', () => {
  let connection, channel
  const settings = { hosts: ['rabbit.local'], username: 'guest', password: 'guest', queueName: 'qwer' }

  beforeEach(function * () {
    channel = new EventEmitter()
    channel.consume = sinon.stub().resolves()
    channel.close = sinon.stub().resolves()

    connection = new EventEmitter()
    connection.createChannel = sinon.stub().resolves(channel)
    connection.close = sinon.stub().resolves()

    sinon.stub(amqplib, 'connect').resolves(connection)
  })

  afterEach(() => {
    amqplib.connect.restore()
  })

  describe('#constructor', () => {
    it('should allow configuration', () => {
      const app = new Application(settings)

      expect(app._config).to.contain(settings)
    })

    it('should require hosts', () => {
      const tmpSettings = Object.assign({}, settings, { hosts: null })

      expect(() => {
        Application(tmpSettings)
      }).to.throw(/array of hosts are required/)
    })

    it('should require a username', () => {
      const tmpSettings = Object.assign({}, settings, { username: null })

      expect(() => {
        Application(tmpSettings)
      }).to.throw(/rabbit username is required/)
    })

    it('should require a password', () => {
      const tmpSettings = Object.assign({}, settings, { password: null })

      expect(() => {
        Application(tmpSettings)
      }).to.throw(/rabbit password is required/)
    })

    it('should require a queueName', () => {
      const tmpSettings = Object.assign({}, settings, { queueName: null })

      expect(() => {
        Application(tmpSettings)
      }).to.throw(/queueName is required/)
    })

    it('should have an array of middleware', () => {
      const app = new Application(settings)

      expect(app.middleware).to.be.an('array')
    })

    it('should be an EventEmitter', () => {
      const EventEmitter = require('events').EventEmitter
      expect(
        Application(settings)
      ).to.be.an.instanceof(EventEmitter)
    })
  })

  describe('#get', () => {
    context('when called without params', () => {
      it('should return all the settings', () => {
        const app = new Application(settings)
        expect(app.get()).to.equal(settings)
      })
    })

    context('when called with a param', () => {
      it('should return the setting value by key', () => {
        const app = new Application(settings)

        for (let key in settings) {
          expect(app.get(key)).to.equal(settings[key])
        }
      })

      it('should return undefined for missing get value', () => {
        const app = new Application(settings)
        expect(app.get('unknown')).to.be.undefined
      })
    })
  })

  describe('#use', () => {
    let app

    beforeEach(() => {
      app = new Application(settings)
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
      app = new Application(settings)
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
      app = new Application(settings)
    })

    it('should throw when a non-generator function is passed', () => {
      expect(() => {
        app.listen()
      }).to.throw(/#listen requires a generator/)

      expect(() => {
        app.listen(() => {})
      }).to.throw(/#listen requires a generator/)
    })

    it('should composed middleware and messageHandler into a new middleware stack', function * () {
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

      yield app._composedStack()

      expect(calls).to.eql([1, 2, 3, 4, 5, 6])
    })

    it('should catch errors and emit an error event', function * () {
      const onError = sinon.stub()

      app.listen(function * (next) {
        throw Error('test error')
      })

      app.on('error', onError)

      yield app._composedStack()

      expect(onError.called).to.be.true
    })
  })

  describe('#getStack', () => {
    it('should throw if listen has not been called yet', () => {
      const app = new Application(settings)

      expect(() => {
        app.getStack()
      }).to.throw(/call #listen first/)
    })

    it('should return the composed stack', () => {
      const app = new Application(settings)
      app.use(function * (next) {
        yield next
      })

      app.listen(function * (next) {
        yield next
      })

      expect(app.getStack()).to.equal(app._composedStack)
    })
  })

  describe('#registerBeforeHook', () => {
    it('should register the before hooks', () => {
      const name = 'connect'
      const gen = function * (next) { yield next }

      let app = new Application(settings)
      app.registerBeforeHook(name, gen)

      expect(app._beforeHooks[name]).to.eql(gen)
    })

    it('should throw without a name', () => {
      const gen = function * (next) { yield next }
      let app = new Application(settings)

      expect(() => {
        app.registerBeforeHook('', gen)
      }).to.throw(/#registerBeforeHook requires a method name/)
    })

    it('should if method does not allow before hook', () => {
      const name = 'something'
      const gen = function * (next) { yield next }
      let app = new Application(settings)

      expect(() => {
        app.registerBeforeHook(name, gen)
      }).to.throw(/#registerBeforeHook hook on method something is unsupported/)
    })

    it('should throw when a non-generator function is passed', () => {
      const name = 'connect'
      let app = new Application(settings)

      expect(() => {
        app.registerBeforeHook(name)
      }).to.throw(/#registerBeforeHook requires a generator/)

      expect(() => {
        app.registerBeforeHook(name, () => {})
      }).to.throw(/#registerBeforeHook requires a generator/)
    })
  })

  describe('#registerAfterHook', () => {
    it('should register the after hooks', () => {
      const name = 'connect'
      const gen = function * (next) { yield next }

      let app = new Application(settings)
      app.registerAfterHook(name, gen)

      expect(app._afterHooks[name]).to.eql(gen)
    })

    it('should throw without a name', () => {
      const gen = function * (next) { yield next }
      let app = new Application(settings)

      expect(() => {
        app.registerAfterHook('', gen)
      }).to.throw(/#registerAfterHook requires a method name/)
    })

    it('should if method does not allow after hook', () => {
      const name = 'something'
      const gen = function * (next) { yield next }
      let app = new Application(settings)

      expect(() => {
        app.registerAfterHook(name, gen)
      }).to.throw(/#registerAfterHook hook on method something is unsupported/)
    })

    it('should throw when a non-generator function is passed', () => {
      const name = 'connect'
      let app = new Application(settings)

      expect(() => {
        app.registerAfterHook(name)
      }).to.throw(/#registerAfterHook requires a generator/)

      expect(() => {
        app.registerAfterHook(name, () => {})
      }).to.throw(/#registerAfterHook requires a generator/)
    })
  })

  describe('#connect', () => {
    let app

    beforeEach(() => {
      app = new Application(settings)
      app._composedStack = sinon.stub()
    })

    it('should connect to a rabbit queue', function * () {
      yield app.connect()

      expect(amqplib.connect.called).to.be.true

      expect(app.connection).to.exist
      expect(app.connection).to.eql(connection)
    })

    it('should create a channel', function * () {
      yield app.connect()
      expect(connection.createChannel.called).to.be.true

      expect(app.channel).to.exist
      expect(app.channel).to.eql(channel)
    })

    it('should setup a consumer using the handler', function * () {
      yield app.connect()
      expect(channel.consume.called).to.be.true
      expect(channel.consume.calledWith(settings.queueName, app._composedStack)).to.be.true
    })

    it('should surface errors', function * () {
      let received = null
      const error = 'Test Error'

      connection.createChannel.rejects(error)

      try {
        yield app.connect()
      } catch (err) {
        received = err
      }

      expect(received).to.be.an('error')
      expect(received.toString()).to.contain(error)
    })

    context('when it has a before hook', function() {
      it('should call the before hook', function * () {
        const stub = sinon.stub()
        const gen = function * () { stub() }

        app.registerBeforeHook('connect', gen)
        yield app.connect()

        expect(stub.called).to.be.true
        expect(stub.calledBefore(amqplib.connect.called)).to.be.true
      })
    })

    context('when it has an after hook', function() {
      it('should call the after hook', function * () {
        const stub = sinon.stub()
        const gen = function * () { stub() }

        app.registerAfterHook('connect', gen)
        yield app.connect()

        expect(stub.called).to.be.true
        expect(stub.calledBefore(amqplib.connect.called)).to.be.true
      })
    })
  })

  describe('#close', () => {
    let app

    beforeEach(function * () {
      app = new Application(settings)
      app._composedStack = sinon.stub()
      yield app.connect()
    })

    it('should close the channel', function * () {
      yield app.close()
      expect(channel.close.called).to.be.true
    })

    it('should close the connection', function * () {
      yield app.close()
      expect(connection.close.called).to.be.true
    })

    context('when it has a before hook', () => {
      it('should call the before hook', function * () {
        const stub = sinon.stub()
        const gen = function * () { stub() }

        app.registerBeforeHook('close', gen)
        yield app.close()

        expect(stub.called).to.be.true
      })
    })

    context('when it has an after hook', () => {
      it('should call the after hook', function * () {
        const stub = sinon.stub()
        const gen = function * () { stub() }

        app.registerAfterHook('close', gen)
        yield app.close()

        expect(stub.called).to.be.true
      })
    })
  })

  context('on a connection `close` event', () => {
    it('should emit a `connection:closed` event', function * () {
      const app = new Application(settings)
      app._composedStack = sinon.stub()

      yield app.connect()

      const err = new Error('Connection Closed Test Error')
      const spy = sinon.spy()

      app.on('connection:closed', spy)
      connection.emit('close', err)

      expect(spy.called).to.be.true
      expect(spy.calledWith(err)).to.be.true
    })
  })
})
