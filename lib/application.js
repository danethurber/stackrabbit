'use strict'

const EventEmitter = require('events').EventEmitter

module.exports = Application

function Application (config) {
  if (!(this instanceof Application)) return new Application(config)
  this._config = config || {}
}

Object.setPrototypeOf(Application.prototype, EventEmitter.prototype)
