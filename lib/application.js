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

Application.prototype.connect = function(done) {
  const self = this
  const rabbitUrl = this._config.rabbitUrl
  const queueName = this._config.queueName

  return co(function * () {
    self.connection = yield amqp.connect(rabbitUrl)
    self.channel = yield self.connection.createChannel()

    yield self.channel.consume(queueName, self._composedStack)

    if (typeof done === 'function') done.call(self)
  })
}
