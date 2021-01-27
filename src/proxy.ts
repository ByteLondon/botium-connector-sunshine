import * as express from 'express'
import * as Redis from 'ioredis'
import * as bodyParser from 'body-parser'
import * as randomize from 'randomatic'
import debugModule from 'debug'
const debug = debugModule('botium-connector-sunshine')

const processEvent = async (event, { redis, ...rest }) => {
  try {
    debug('Got Message Event:')
    debug(JSON.stringify(event, null, 2))

    if (event.to) {
      redis.publish(event.to, JSON.stringify(event))
      debug(`Published event for recipient id ${event.to}`)
    }
  } catch (err) {
    debug('Error while publishing to redis')
    debug(err)
  }
}

const setupEndpoints = ({ app, endpoint, redisurl, ...rest }: Record<string, any>) => {
  const redis = new Redis(redisurl)
  redis.on('connect', () => {
    debug(`Redis connected to ${JSON.stringify(redisurl || 'default')}`)
  })
  const messagesEndpoint = (endpoint || '/') + 'v2/apps/:appId/conversations/:conversationId/messages'
  const catchAllEndpoint = (endpoint || '/') + '*'

  app.post(messagesEndpoint, (req, res) => {
    if (req.body) {
      const response = {
        conversationId: req.params.conversationId,
        message_id: `mid.${randomize('0', 10)}`
      }
      processEvent({
        to: response.conversationId,
        message_id: response.message_id,
        body: req.body
      }, { redis, ...rest })
      res.status(200).json(response)
    } else {
      res.status(200).end()
    }
  })

  app.all(catchAllEndpoint, (req, res) => {
    res.json({ hint: `Botium Sunshine emulator</br>POST messages to ${messagesEndpoint}` }).end()
  })
}

const startProxy = ({ port, endpoint, ...rest }: Record<string, any>) => {
  const app = express()

  app.use(endpoint, bodyParser.json())
  app.use(endpoint, bodyParser.urlencoded({ extended: true }))

  setupEndpoints({ app, endpoint, ...rest })

  app.listen(port, () => {
    console.log(`Botium Sunshine emulator is listening on port ${port}`)
    console.log(`Sunshine emulator endpoint available at http://127.0.0.1:${port}${endpoint}`)
  })
}

module.exports = {
  setupEndpoints,
  startProxy
}
