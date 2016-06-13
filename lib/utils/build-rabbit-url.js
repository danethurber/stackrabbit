module.exports = function(hosts, username, password) {
  if (Array.isArray(hosts)) {
    const index = Math.floor(Math.random() * hosts.length)
    return `amqp://${username}:${password}@${hosts[index]}`
  }
  return `amqp://${username}:${password}@${hosts}`
}
