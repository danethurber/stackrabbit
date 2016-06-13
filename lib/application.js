'use strict'

const EventEmitter = require('events').EventEmitter
const assert = require('assert')
const co = require('co')
const compose = require('koa-compose')
const amqp = require('amqplib')

const isGenerator = require('./utils/is-generator')
const buildRabbitUrl = require('./utils/build-rabbit-url')

module.exports = Application

function Application(config) {
  if (!(this instanceof Application)) return new Application(config)

  assert(config.hosts, 'array of hosts are required')
  assert(config.username, 'rabbit username is required')
  assert(config.password, 'rabbit password is required')
  assert(config.queueName, 'queueName is required')

  this._config = config || {}

  this._beforeHooks = {}
  this._afterHooks = {}

  this.middleware = []
}

Object.setPrototypeOf(Application.prototype, EventEmitter.prototype)

Application.prototype.use = function(fn) {
  assert(isGenerator(fn), '#use requires a generator')

  this.middleware = this.middleware.concat(fn)
  return this
}

Application.prototype.get = function(key) {
  return key ? this._config[key] : this._config
}

Application.prototype.createContext = function(message) {
  return {
    app: this,
    message,
    onError: function(err) {
      this.err = err
      this.app.emit('error', err, this)
    }
  }
}

Application.prototype.listen = function(handler) {
  assert(isGenerator(handler), '#listen requires a generator')

  const mw = this.middleware.concat(handler)
  const composedMiddleware = co.wrap(compose(mw))

  this._composedStack = (message) => {
    const context = this.createContext(message)
    return composedMiddleware
      .call(context)
      .catch(context.onError.bind(context))
  }

  return this
}

Application.prototype.getStack = function() {
  assert.ok(this._composedStack, 'Stack not composed. You must call #listen first.')

  return this._composedStack
}

Application.prototype.registerBeforeHook = function(name, fn) {
  const supported = ['connect', 'close']

  assert(name, '#registerBeforeHook requires a method name')
  assert(supported.indexOf(name) >= 0, `#registerBeforeHook hook on method ${name} is unsupported`)
  assert(isGenerator(fn), '#registerBeforeHook requires a generator')

  this._beforeHooks[name] = fn

  return this
}

Application.prototype.registerAfterHook = function(name, fn) {
  const supported = ['connect', 'close']

  assert(name, '#registerAfterHook requires a method name')
  assert(supported.indexOf(name) >= 0, `#registerAfterHook hook on method ${name} is unsupported`)
  assert(isGenerator(fn), '#registerAfterHook requires a generator')

  this._afterHooks[name] = fn

  return this
}

Application.prototype.callBeforeHook = function * (name) {
  const hook = this._beforeHooks[name]
  if (typeof hook === 'function') yield hook()
}

Application.prototype.callAfterHook = function * (name) {
  const hook = this._afterHooks[name]
  if (typeof hook === 'function') yield hook()
}

Application.prototype.connect = function() {
  const self = this

  const hosts = this.get('hosts')
  const username = this.get('username')
  const password = this.get('password')
  const rabbitUrl = buildRabbitUrl(hosts, username, password)

  const queueName = this.get('queueName')

  return co(function * () {
    yield self.callBeforeHook('connect')

    self.connection = yield amqp.connect(rabbitUrl)
    self.channel = yield self.connection.createChannel()

    self.connection.on('close', function(err) {
      self.emit('connection:closed', err)
    })

    yield self.channel.consume(queueName, self._composedStack)

    yield self.callAfterHook('connect')
  }).catch((err) => { throw err })
}

Application.prototype.close = function(done) {
  const self = this

  return co(function * () {
    yield self.callBeforeHook('close')

    yield self.channel.close()
    yield self.connection.close()

    yield self.callAfterHook('close')
  }).catch((err) => { throw err })
}
