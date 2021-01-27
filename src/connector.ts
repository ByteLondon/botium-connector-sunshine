import * as Redis from 'ioredis'
import * as IORedis from 'ioredis'
import {isString} from 'lodash'
import * as randomize from 'randomatic'
import * as request from 'request-promise-native'
import * as crypto from 'crypto'
import debugModule from 'debug'
import { WebHookEvent, WebHookRequest, } from 'sunshine-conversations-client'

const debug = debugModule('botium-connector-sunshine')

type CapabilitiesNames =
  | 'SUNSHINE_WEBHOOKURL'
  | 'SUNSHINE_TIMEOUT'
  | 'SUNSHINE_REDISURL'
  | 'SUNSHINE_PAGEID'
  | 'SUNSHINE_APPSECRET'

const Capabilities = {
  SUNSHINE_WEBHOOKURL: 'SUNSHINE_WEBHOOKURL',
  SUNSHINE_TIMEOUT: 'SUNSHINE_TIMEOUT',
  SUNSHINE_REDISURL: 'SUNSHINE_REDISURL',
  SUNSHINE_PAGEID: 'SUNSHINE_PAGEID',
  SUNSHINE_APPSECRET: 'SUNSHINE_APPSECRET',
}

const Defaults = {
  [Capabilities.SUNSHINE_TIMEOUT]: 10000,
}

const getTimestamp = () => {
  return new Date().getTime()
}

type BotiumMessage = {
  buttons?: Array<{ text: string; payload: string }>
  messageText: string
}

type SourceMessage = {
  sourceData: {
    postback?: { title: string; payload: string }
    message?: { text: string }
    delivery?: {}
  }
}

class BotiumConnectorSunshine {
  queueBotSays: (input: any) => void
  caps: Record<CapabilitiesNames, string>
  redis: IORedis.Redis | null
  sunshineUserId: string | null

  constructor({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
    this.redis = null
    this.sunshineUserId = randomize('0', 10)
  }

  Validate() {
    debug('Validate called')

    Object.assign(this.caps, Defaults)

    if (!this.caps[Capabilities.SUNSHINE_WEBHOOKURL]) throw new Error('SUNSHINE_WEBHOOKURL capability required')

    return Promise.resolve()
  }

  async Build() {
    debug('Build called')
    await this._buildRedis()
  }

  async Start() {
    debug('Start called')
    await this._subscribeRedis()
  }

  async UserSays(msg: BotiumMessage & SourceMessage) {
    debug('UserSays called')
    const msgData: SourceMessage = { sourceData: {} }
    if (msg.buttons && msg.buttons.length > 0 && (msg.buttons[0].text || msg.buttons[0].payload)) {
      msgData.sourceData = {
        postback: {
          title: msg.buttons[0].text,
          payload: msg.buttons[0].payload || msg.buttons[0].text,
        },
      }
    } else {
      msgData.sourceData = {
        message: {
          text: msg.messageText,
        },
      }
    }
    const userSaysData = await this._sendToBot(msgData)
    msg.sourceData = Object.assign(msg.sourceData || {}, userSaysData)
  }

  async Stop() {
    debug('Stop called')
    await this._unsubscribeRedis()
    this.sunshineUserId = null
  }

  async Clean() {
    debug('Clean called')
    await this._cleanRedis()
  }

  _buildRedis() {
    return new Promise<void>((resolve) => {
      this.redis = new Redis(this.caps[Capabilities.SUNSHINE_REDISURL])
      this.redis.on('connect', () => {
        debug(`Redis connected to ${JSON.stringify(this.caps[Capabilities.SUNSHINE_REDISURL] || 'default')}`)
        resolve()
      })
      this.redis.on('message', (channel, event) => {
        if (this.sunshineUserId) {
          if (!isString(event)) {
            return debug(`WARNING: received non-string message from ${channel}, ignoring: ${event}`)
          }
          try {
            event = JSON.parse(event)
          } catch (err) {
            return debug(`WARNING: received non-json message from ${channel}, ignoring: ${event}`)
          }
          if (!event.to || event.to !== this.sunshineUserId) {
            return
          }

          const botMsg = { sender: 'bot', sourceData: event, messageText: '' }

          const fbMessage = event.body.content

          if (fbMessage) {
            if (fbMessage.text) {
              botMsg.messageText = fbMessage.text
            }
            debug(`Received a message to queue ${channel}: ${JSON.stringify(botMsg)}`)
            setTimeout(() => this.queueBotSays(botMsg), 100)
          } else {
            debug(`WARNING: recieved non message fb event from ${channel}, ignoring ${event}`)
          }
        }
      })
    })
  }

  convertToSunshineMessage(msg: SourceMessage): WebHookEvent {
    if(!this.sunshineUserId){
      throw new Error('No sunshineUserId set')
    }

    let output = {
      id: 'string',
      type: 'string',
      createdAt: 'string',
    }

    if (msg.sourceData.message) {
      return {
        ...output,
        type: 'conversation:message' as const,
        payload: {
          conversation: {
            id: this.sunshineUserId,
            type: 'string',
          },
          message: {
            id: `${randomize('0', 10)}`,
            received: `${getTimestamp()}`,
            author: {
              type: 'user',
              userId: this.sunshineUserId,
              displayName: 'WhatsApp User',
              user: {
                id: this.sunshineUserId,
              },
            },
            content: {
              type: 'text',
              text: msg.sourceData.message.text,
            },
          },
        },
      }
    } else {
      return {
        ...output,
        type: 'conversation:postback',
        payload: {
          conversation: {
            id: 'string',
            type: 'string',
          },
          user: {
            id: this.sunshineUserId,
          },
          postback: {
            payload: msg.sourceData.postback?.payload || '{{PAYLOAD}}',
          },
        },
      }
    }
  }

  async _sendToBot(msg: SourceMessage) {
    const timestamp = getTimestamp()

    const msgContainer: WebHookRequest = {
      app: {
        id: this.caps[Capabilities.SUNSHINE_PAGEID],
      },
      webhook: {
        id: 'string',
        version: 'string',
      },
      events: [],
    }

    if (msg.sourceData) {
      msgContainer.events.push(this.convertToSunshineMessage(msg))
    } else {
      debug(`No sourceData given. Ignored. ${msg}`)
      return
    }

    const requestOptions = {
      uri: this.caps[Capabilities.SUNSHINE_WEBHOOKURL],
      method: 'POST',
      headers: { Botium: true },
      body: msgContainer,
      json: true,
      timeout: this.caps[Capabilities.SUNSHINE_TIMEOUT],
    }

    if (this.caps[Capabilities.SUNSHINE_APPSECRET]) {
      const hmac = crypto.createHmac('sha1', this.caps[Capabilities.SUNSHINE_APPSECRET])
      hmac.update(JSON.stringify(msgContainer), 'utf8')
      requestOptions.headers['X-Hub-Signature'] = 'sha1=' + hmac.digest('hex')
    }

    try {
      debug(`Sending message to ${requestOptions.uri}`)
      const response = await request(requestOptions)
      return { fbWebhookRequest: msgContainer, fbWebhookResponse: response }
    } catch (err) {
      throw new Error(`Failed sending message to ${requestOptions.uri}: ${err}`)
    }
  }

  _subscribeRedis(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.redis || !this.sunshineUserId) {
        return reject(new Error('Cannot subscribe: missing redis instance and/or facebookUserID'))
      }
      this.redis.subscribe(this.sunshineUserId, (err, count) => {
        if (err) {
          return reject(new Error(`Redis failed to subscribe channel ${this.sunshineUserId}: ${err}`))
        }
        debug(`Redis subscribed to ${count} channels. Listening for updates on the ${this.sunshineUserId} channel.`)
        resolve()
      })
    })
  }

  _unsubscribeRedis(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.redis || !this.sunshineUserId) {
        return reject(new Error('Cannot subscribe: missing redis instance and/or facebookUserID'))
      }
      this.redis.unsubscribe(this.sunshineUserId, (err) => {
        if (err) {
          return reject(new Error(`Redis failed to unsubscribe channel ${this.sunshineUserId}: ${err}`))
        }
        debug(`Redis unsubscribed from ${this.sunshineUserId} channel.`)
        resolve()
      })
    })
  }

  _cleanRedis() {
    if (this.redis) {
      this.redis.disconnect()
      this.redis = null
    }
  }
}

module.exports = BotiumConnectorSunshine
