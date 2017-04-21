const _ = require('lodash')
const { Game } = require('hive-game-core')
const { log } = require('peasy-log')
const uuid = require('uuid/v4')

const FRAMES = []

class GameFrame {
  static addFrame(frame) {
    GameFrame.getFrames().push(frame)
  }

  static anyWaitingFrames() {
    return GameFrame.getWaitingFrames().length > 0
  }

  static applyMove(id, playerId, moveString, stateHash) {
    const frame = GameFrame.getFrameById(id)
    if (frame.status !== 'IN_PROGRESS') { return GameFrame.getFrameStatus(id) }
    const player = frame.game.getPlayerById(playerId)
    if (!player) { throw new Error(`NO_SUCH_PLAYER`) }
    const moveSuccess = player.moveByPlayer(frame.game, stateHash, moveString)
    const status = GameFrame.getFrameStatus(id)
    if (!moveSuccess) {
      status.status = 'HASH_MISMATCH'
    }
    return { status: status.status }
  }

  static createWaitingFrame(waitingPlayer) {
    const frame = new GameFrame()
    frame.addPlayer(waitingPlayer)
    GameFrame.addFrame(frame)
    return frame
  }

  static getFrameById(id) {
    return _.find(GameFrame.getFrames(), f => f.id === id) || null
  }

  static getFrames() { return FRAMES }

  static getFrameStatus(id) {
    const frame = GameFrame.getFrameById(id)
    if (!frame) {
      return {
        status: 'NONEXISTENT'
      }
    }
    const status = { status: frame.status }
    if (frame.status !== 'WAITING_FOR_PLAYERS') {
      const gameState = frame.game.state
      status.hash = gameState.hash
      status.state = gameState.state
    }
    return status
  }

  static getWaitingFrames() {
    return _.filter(GameFrame.getFrames(), f => f.status === 'WAITING_FOR_PLAYERS')
  }

  static joinWaitingFrame(player) {
    const waitingFrames = GameFrame.getWaitingFrames()
    const frame = waitingFrames[_.random(waitingFrames.length - 1)]
    frame.addPlayer(player)
    const whiteIndex = _.random(1)
    frame.game = new Game(frame.players[whiteIndex], frame.players[(whiteIndex + 1) % 2], { logFn: log })
    frame.game.begin()
    return frame
  }

  constructor() {
    this._id = uuid()
    this._players = []
    this._game = null
  }

  get id() { return this._id }
  get game() { return this._game }
  get players() { return this._players }
  get status() {
    if (this.players.length < 2) { return 'WAITING_FOR_PLAYERS' }
    if (this.game && this.game.state.state.gameOver) { return 'COMPLETED' }
    return 'IN_PROGRESS'
  }

  set game(g) { this._game = g }

  addPlayer(player) {
    this._players.push(player)
  }
}

module.exports = { GameFrame }
