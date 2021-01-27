declare module 'sunshine-conversations-client' {
  export type Conversation = {
    id: string
    type: string
    // partial
  }
  export type User = {
    id: string
    // partial
  }
  export type UserAuthor = {
    type: 'user'
    userId: string
    displayName: string
    user: User
  }
  export type BusinessAuthor = {
    type: 'business'
  }
  export type Author = UserAuthor | BusinessAuthor
  export type PostbackAction = {
    type: 'postback'
    text: string
    payload: string
    metadata?: {}
  }
  export type LinkAction = {
    type: 'link'
    uri: string
    text: string
  }
  export type TextContent = {
    type: 'text'
    text: string
    // partial
    actions?: Array<PostbackAction>
  }
  export type CarouselItem = {
    title: string
    description?: string
    mediaUrl?: string
    mediaType?: string
    altText?: string
    size?: 'compact' | 'large'
    actions: Array<LinkAction>
  }
  export type CarouselContent = {
    type: 'carousel'
    items: Array<CarouselItem>
  }
  export type BaseContent = {
    type: string
  }
  export type Content = BaseContent | TextContent
  type SunshineChannel = 'whatsapp'
  export type Message = {
    id: string
    received: string
    locale?: string
    author: Author
    content: Content
    metadata?: {}
    //TODO: This might not be optional, check under what circumstances it does not appear.
    source?: MessageSource
    // partial
  }
  export type UserSpecificMessage = {
    parentUserId: string
    conversationId: string
    botId: string
    id: string
    locale?: string
    received: string
    author: Author
    content: Content
    metadata?: {}
    //TODO: This might not be optional, check under what circumstances it does not appear.
    source?: {
      integrationId: string
      originalMessageId: string
      originalMessageTimestamp: string
      type: SunshineChannel
    }
    // partial
  }
  export type ConversationMessage = {
    conversation: Conversation
    message: Message
  }
  export type Postback = {
    payload: string
    metadata?: {}
    // used internally. Not supported by Sunshine as per web-hook docs/
    title?: string
  }
  type MessageSource = {
    integrationId: string
    originalMessageId: string
    originalMessageTimestamp: string
    type: SunshineChannel
  }
  export type ConversationPostback = {
    conversation: Conversation
    postback: Postback
    user: User
    message?: {
      source?: MessageSource
    }
  }
  export type WebHookEventBase = {
    id: string
    type: string
    createdAt: string
  }
  export type ConversationMessageEvent = WebHookEventBase & {
    type: 'conversation:message'
    payload: ConversationMessage
  }
  export type ConversationPostbackEvent = WebHookEventBase & {
    type: 'conversation:postback'
    payload: ConversationPostback
  }
  type WebHookEvent = WebHookEventBase & (ConversationMessageEvent | ConversationPostbackEvent)
  export type WebHookRequest = {
    app: {
      id: string
    }
    webhook: {
      id: string
      version: string
    }
    events: WebHookEvent[]
  }
  export type ConversationUserId = {
    conversationId: string
    userId: string
  }

  export interface SunshinePageConfig {
    after?: string
    before?: string
    size?: number // defaults to 25
  }

  export interface SwitchboardIntegrationWebhook {
    id?: string
    name?: string
    integrationId?: string
    integrationType?: string
  }

  export interface ConversationRecord {
    id: string
    locale?: string
    type?: 'personal' | 'sdkGroup'
    activeSwitchboardIntegration?: SwitchboardIntegrationWebhook
    pendingSwitchboardIntegration?: SwitchboardIntegrationWebhook
    isDefault?: boolean
    displayName?: string
    description?: string
    iconUrl?: string
    metadata?: {}
    businessLastRead?: string
    lastUpdatedAt?: string
  }

  export interface ConversationRecordWithMessages extends ConversationRecord {
    messages: Message[]
  }

  export interface ConversationUpdateBody {
    displayName?: string
    description?: string
    iconUrl?: string
    metadata?: Record<string, unknown>
  }

  export interface ConversationLinks {
    prev: string
    next: string
  }

  export interface ConversationMeta {
    hasMore?: boolean
    afterCursor?: string
    beforeCursor?: string
  }

  export interface ConversationListResponse {
    conversations?: ConversationRecord[]
    meta?: ConversationMeta
    links?: ConversationLinks
  }

  export interface GroupedBotConversationListResponse {
    [userId: string]: {
      conversations: {
        [conversationId: string]: ConversationRecordWithMessages
      }
    }
  }

  export interface ConversationResponse {
    conversation?: ConversationRecord
  }

  export interface ConversationListFilter {
    userId?: string
    userExternalId?: string
  }

  export type ClientType =
    | 'line'
    | 'mailgun'
    | 'messagebird'
    | 'messenger'
    | 'sdk'
    | 'telegram'
    | 'twilio'
    | 'twitter'
    | 'viber'
    | 'wechat'
    | 'whatsapp'

  export interface Participant {
    id: string
    userId: string
    unreadCount?: number
    clientAssociations?: {
      type?: ClientType
      clientId?: string
    }
    userExternalId?: string
    lastRead?: string
  }

  export interface GetConversationParticipantsResponse {
    participants: Participant[] // will usually be one for what we need but we will need allow for multiple users
    meta?: ConversationMeta
    links?: ConversationLinks
  }

  export interface GetBotConversationParticipantsResponse extends GetConversationParticipantsResponse {
    botId: string
  }

  export interface MessageListResponse {
    messages: Message[]
    meta?: ConversationMeta
    links?: ConversationLinks
  }

  export class MessagesApi {
    constructor(apiClient?: ApiClient)
    async postMessage(appId: string, conversationId: string, messagePost: MessagePost): Promise<MessagePostResponse>
    async listMessages(appId: string, conversationId: string, opts?: SunshinePageConfig)
  }

  export class ParticipantsApi {
    async listParticipants(appId: string, conversationId: string, opts?: SunshinePageConfig)
  }

  export class ConversationsApi {
    listConversations(
      appId: string,
      filter: ConversationListFilter,
      opts?: SunshinePageConfig
    ): Promise<ConversationListResponse>
    getConversation(appId: string, conversationId: string): Promise<ConversationResponse>
    updateConversation(
      appId: string,
      conversationId: string,
      conversationUpdateBody: ConversationUpdateBody
    ): Promise<ConversationResponse>
    async deleteConversation(appId: string, conversationId: string): Promise<Record<string, unknown>>
  }

  export class MessagePostResponse {}

  export interface MessagePostInterface {
    author: Author
    content: Content
  }

  export class MessagePost implements MessagePostInterface {
    constructor(author: Author, content: Content)
  }

  export class ApiClient {
    constructFromObject(data: any, obj: ApiClient): ApiClient
    authentications: {
      basicAuth: { type: 'basic'; username: string; password: string }
      bearerAuth: { type: 'bearer' } // JWT
    }
    MessagesApi: MessagesApi
  }
}
