const PluginClass = require('./lib/connector')
const ProxyClass = require('./lib/proxy')

module.exports = {
  PluginVersion: 1,
  PluginClass: PluginClass
}

module.exports.proxy = ProxyClass
