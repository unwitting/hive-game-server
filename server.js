const _ = require('lodash')
const express = require('express')
const shortid = require('shortid')
const { log } = require('peasy-log')
const { Game } = require('hive-game-core')
const { RemotePlayer } = require('./lib/player')
const ua = require('universal-analytics')

const app = express()

if (!process.env.GA_ID) { throw 'You must specifiy a GA_ID environment variable for analytics' }
const analytics = ua(process.env.GA_ID, { https: true })

const gamesInProgress = {}
const waitingPlayers = {}

app.use('*', (req, res, next) => {
  // TODO secure auth
  const playerId = req.headers['x-player-id']
  if (!playerId) {
    log(`_No player ID_ in headers, request ends here`)
    return res.status(401).end()
  }
  log(`_Got player ID_ from headers: **${playerId}**`)
  req.playerId = playerId
  next()
})

app.get('/game/free', (req, res) => {
  log(`_Free game_ request from player **${req.playerId}**`)
  log(`_Creating_ new RemotePlayer(**${req.playerId}**)`)
  const remotePlayer = new RemotePlayer(req.playerId, { logFn: log })
  const otherWaitingPlayers = _(waitingPlayers).keys().reject(tok => waitingPlayers[tok].id === req.playerId).value()
  if (!otherWaitingPlayers.length) {
    const waitingToken = shortid.generate()
    log(`_No current waiting player_, will wait for another - waiting token **${waitingToken}**`)
    waitingPlayers[waitingToken] = remotePlayer
    return res.send({ token: waitingToken })
  } else {
    const matchedPlayerToken = otherWaitingPlayers[_.random(otherWaitingPlayers.length - 1)]
    const matchedPlayer = waitingPlayers[matchedPlayerToken]
    log(`~~Found a waiting player~~ with token **${matchedPlayerToken}**, pairing up into a game`)
    const whiteIndex = _.random(1)
    const whitePlayer = [remotePlayer, matchedPlayer][whiteIndex]
    const blackPlayer = [remotePlayer, matchedPlayer][(whiteIndex + 1) % 2]
    const game = new Game(whitePlayer, blackPlayer, { logFn: log })
    analytics.event('Games', 'Create game', game.id).send()
    delete waitingPlayers[matchedPlayerToken]
    gamesInProgress[matchedPlayerToken] = game
    game.begin()
    return res.send({ token: matchedPlayerToken })
  }
})

app.get('/game/status/:token', (req, res) => {
  const { token } = req.params
  log(`_Game status_ request for token **${token}** from player **${req.playerId}**`)
  if (waitingPlayers[token]) {
    return res.send({ status: 'WAITING_FOR_SECOND_PLAYER' })
  }
  const game = gamesInProgress[token]
  if (!game) {
    return res.status(404).end()
  }
  const state = game.state
  return res.send({
    status: state.gameOver ? 'GAME_OVER' : 'IN_PROGRESS',
    token,
    state: state.state,
    hash: state.hash
  })
})

app.get('/game/:token/move/:move/:hash', (req, res) => {
  const { token, move, hash } = req.params
  log(`_Move_ request for token **${token}** from player **${req.playerId}** with move string **${move}**`)
  const game = gamesInProgress[token]
  if (!game) {
    return res.status(404).end()
  }
  const player = game.getPlayerById(req.playerId)
  if (!player) {
    return res.status(404).end()
  }
  if (player.moveByPlayer(game, hash, move)) {
    return res.status(200).send()
  } else {
    return res.status(400).send({ status: 'HASH_MISMATCH' })
  }
})

if (!process.env.PORT) { throw 'You must specifiy a PORT environment variable' }
const port = parseInt(process.env.PORT, 10)
app.listen(port, () => {
  log(`~~App listening~~ on port **${port}**`)
})
