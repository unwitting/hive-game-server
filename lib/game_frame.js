const _ = require('lodash')
const { Game } = require('hive-game-core')
const { log } = require('peasy-log')
const mongoose = require('mongoose')
const uuid = require('uuid/v4')

const FRAMES = []
const STATUSES = {
  WAITING_FOR_PLAYERS: 'WAITING_FOR_PLAYERS',
  COMPLETED: 'COMPLETED',
  HASH_MISMATCH: 'HASH_MISMATCH',
  IN_PROGRESS: 'IN_PROGRESS',
  NONEXISTENT: 'NONEXISTENT',
}

class GameFrame {
  static addFrame(frame) {
    GameFrame.getFrames().push(frame)
  }

  static anyWaitingFrames() {
    return GameFrame.getWaitingFrames().length > 0
  }

  static applyMove(id, playerId, moveString, stateHash) {
    const frame = GameFrame.getFrameById(id)
    if (frame.status !== STATUSES.IN_PROGRESS) { return GameFrame.getFrameStatus(id) }
    const player = frame.game.getPlayerById(playerId)
    if (!player) { throw new Error(`NO_SUCH_PLAYER`) }
    const moveSuccess = player.moveByPlayer(frame.game, stateHash, moveString)
    const status = GameFrame.getFrameStatus(id)
    if (!moveSuccess) {
      status.status = STATUSES.HASH_MISMATCH
      return Promise.resolve({ status: status.status })
    }
    return GameFrameModel.commitFrame(frame).then(() => ({ status: status.status }))
  }

  static createWaitingFrame(waitingPlayer) {
    const frame = new GameFrame()
    frame.addPlayer(waitingPlayer)
    GameFrame.addFrame(frame)
    return GameFrameModel.commitFrame(frame).then(() => frame)
  }

  static getCompletedFrames() {
    return _.filter(GameFrame.getFrames(), f => f.status === STATUSES.COMPLETED)
  }

  static getFrameById(id) {
    return _.find(GameFrame.getFrames(), f => f.id === id) || null
  }

  static getFrames() { return FRAMES }

  static getFrameStatus(id) {
    const frame = GameFrame.getFrameById(id)
    if (!frame) {
      return {
        status: STATUSES.NONEXISTENT
      }
    }
    const status = { status: frame.status }
    if (frame.status !== STATUSES.WAITING_FOR_PLAYERS) {
      const gameState = frame.game.state
      status.hash = gameState.hash
      status.state = gameState.state
    }
    return status
  }

  static getNumberOfFrames() {
    return GameFrame.getFrames().length
  }

  static getNumberOfCompletedFrames() {
    return GameFrame.getCompletedFrames().length
  }

  static getNumberOfWaitingFrames() {
    return GameFrame.getWaitingFrames().length
  }

  static getWaitingFrames() {
    return _.filter(GameFrame.getFrames(), f => f.status === STATUSES.WAITING_FOR_PLAYERS)
  }

  static joinWaitingFrame(player) {
    const waitingFrames = GameFrame.getWaitingFrames()
    const frame = waitingFrames[_.random(waitingFrames.length - 1)]
    frame.addPlayer(player)
    const whiteIndex = _.random(1)
    frame.game = new Game(frame.players[whiteIndex], frame.players[(whiteIndex + 1) % 2], { logFn: log })
    frame.game.begin()
    return GameFrameModel.commitFrame(frame).then(() => frame)
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
    if (this.players.length < 2) { return STATUSES.WAITING_FOR_PLAYERS }
    if (this.game && this.game.state.state.gameOver) { return STATUSES.COMPLETED }
    return STATUSES.IN_PROGRESS
  }

  set game(g) { this._game = g }

  addPlayer(player) {
    this._players.push(player)
  }
}

const GameFrameSchema = mongoose.Schema({
  id: { type: String, unique: true },
  players: { type: [String] },
  status: { type: String, enum: _.keys(STATUSES) },
  board: { type: String },
  turn: { type: Number },
})

GameFrameSchema.statics.commitFrame = frame => {
  return (
    GameFrameModel.findOne({ id: frame.id })
    .then(frameDoc => {
      return frameDoc || (new GameFrameModel({}))
    })
    .then(frameDoc => {
      const state = frame.game ? frame.game.state.state : null
      frameDoc.id = frame.id
      frameDoc.players = state ? _.map(state.players, JSON.stringify) : frame.players,
      frameDoc.status = frame.status,
      frameDoc.board = state ? JSON.stringify(state.board) : null
      frameDoc.turn = state ? state.turn : null
      return frameDoc.save()
    })
  )
}

const GameFrameModel = mongoose.model('GameFrame', GameFrameSchema)

module.exports = { GameFrame, GameFrameModel }
