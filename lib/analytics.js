const { log } = require('peasy-log')
const ua = require('universal-analytics')

class AnalyticsClient {
  constructor() {
    this._client = process.env.GA_ID ? ua(process.env.GA_ID, { https: true }) : null
  }

  event(...args) {
    if (!this._client) { return }
    log(`_Sending analytics event_ **${args}**`)
    this._client.event(...args).send()
  }
}

module.exports = { AnalyticsClient }
