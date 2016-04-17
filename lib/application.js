'use strict'

const EventEmitter = require('events').EventEmitter
const assert = require('assert')
const co = require('co')
const compose = require('koa-compose')

module.exports = Application

function Application(config) {
  if (!(this instanceof Application)) return new Application(config)

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
    message
  }
}

Application.prototype.listen = function(messageHandler) {
  this.use(messageHandler)

  const composedMiddleware = co.wrap(compose(this.middleware))

  this.handler = (message) => {
    const context = this.createContext(message)
    return composedMiddleware.call(context)
  }

  return this
}
