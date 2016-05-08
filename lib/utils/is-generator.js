module.exports = function(fn) {
  return fn && fn.constructor.name === 'GeneratorFunction'
}
