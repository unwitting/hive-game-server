const { Player } = require('hive-game-core')

class RemotePlayer extends Player {

  constructor(id, opts={}) {
    super(id, opts)
    this._ackStatePromiseResolve = null
    this._movePromiseResolve = null
  }

  acknowledgeStateByPlayer(game, hash) {
    this._log(`_Acking state_ with hash **${hash}**`)
    const gameHash = game.state.hash
    if (gameHash !== hash) {
      this._log(`_Game hash doesn't match_ with provided hash **${hash}**`)
      return false
    }
    this._log(`_Game hash match_`)
    if (this._ackStatePromiseResolve) {
      this._log(`_Resolving_ waiting ack state promise`)
      this._ackStatePromiseResolve()
      this._ackStatePromiseResolve = null
    }
    return true
  }

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
    return true
  }

  async acknowledgeState(game) {
    return new Promise((resolve, reject) => {
      this._ackStatePromiseResolve = resolve
    })
  }

  async move(game) {
    return new Promise((resolve, reject) => {
      this._movePromiseResolve = resolve
    })
  }

}

module.exports = { RemotePlayer }
