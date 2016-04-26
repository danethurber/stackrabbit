'use strict'

const EventEmitter = require('events').EventEmitter
const assert = require('assert')
const co = require('co')
const compose = require('koa-compose')
const amqp = require('amqplib')

module.exports = Application

function Application(config) {
  if (!(this instanceof Application)) return new Application(config)

  assert(config.rabbitUrl, 'rabbitUrl is required')
  assert(config.queueName, 'queueName is required')

  this._config = config || {}
  this.middleware = []
}

Object.setPrototypeOf(Application.prototype, EventEmitter.prototype)

Application.prototype.use = function(fn) {
  assert(fn && fn.constructor.name === 'GeneratorFunction', '#use requires a generator')

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

Application.prototype.listen = function(messageHandler) {
  this.use(messageHandler)

  const composedMiddleware = co.wrap(compose(this.middleware))

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

Application.prototype.connect = function(done) {
  const self = this
  const rabbitUrl = this.get('rabbitUrl')
  const queueName = this.get('queueName')

  return co(function * () {
    self.connection = yield amqp.connect(rabbitUrl)
    self.channel = yield self.connection.createChannel()

    yield self.channel.consume(queueName, self._composedStack)

    if (typeof done === 'function') done.call(self)
  }).catch((err) => { throw err })
}
