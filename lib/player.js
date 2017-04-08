const { Player } = require('hive-game-core')
const ua = require('universal-analytics')

class RemotePlayer extends Player {

  constructor(id, opts={}) {
    super(id, opts)
    this._analyticsClient = ua(process.env.GA_ID, id, { https: true })
    this._movePromiseResolve = null
  }

  get analytics() { return this._analyticsClient }

  moveByPlayer(game, stateHash, moveString) {
    this._log(`_Submitting move_ **${moveString}**`)
    this._log(`_Validating player's state hash_ **${stateHash}**`)
    if (stateHash !== game.state.hash) {
      this._log(`_State hash doesn't match_ with provided hash`)
      return false
    }
    if (this._movePromiseResolve) {
      this._log(`_Resolving_ waiting move promise`)
      this._movePromiseResolve(moveString)
      this._movePromiseResolve = null
    }
    this.analytics.event('Moves', 'Submit move', game.id).send()
    return true
  }

  async move(game) {
    return new Promise((resolve, reject) => {
      this._movePromiseResolve = resolve
    })
  }

}

module.exports = { RemotePlayer }
