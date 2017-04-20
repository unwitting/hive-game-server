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
const gameOverAcked = {}

app.use('*', (req, res, next) => {
  // TODO secure auth
  const playerId = req.headers['x-player-id']
  log(`_Got player ID_ from headers: **${playerId}**`)
  req.playerId = playerId
  next()
})

function requireAuth(req, res, next) {
  if (!req.playerId) {
    log(`_No player ID_ in headers, request ends here`)
    return res.status(401).end()
  }
  next()
}

app.get('/healthcheck', (req, res) => {
  log(`~~Healthcheck~~`)
  analytics.event('Service', 'Healthcheck').send()
  return res.send({
    health: 'healthy',
    gamesInProgress: gamesInProgress.length,
    waitingPlayers: waitingPlayers.length,
    gameOverAcked: gameOverAcked.length,
  })
})

app.get('/game/free', requireAuth, (req, res) => {
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
  if (state.state.gameOver) {
    if (gameOverAcked[token] === undefined) { gameOverAcked[token] = 0 }
    gameOverAcked[token] += 1
    if (gameOverAcked[token] >= 2) {
      log(`_Removing finished game_ **${token}** now that both players know it's over`)
      delete gameOverAcked[token]
      delete gamesInProgress[token]
    }
  }
  return res.send({
    status: state.gameOver ? 'GAME_OVER' : 'IN_PROGRESS',
    token,
    state: state.state,
    hash: state.hash
  })
})

app.get('/game/:token/move/:move/:hash', requireAuth, (req, res) => {
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

function cleanOutOutGames() {
  try {
    log(`_Cleaning out_ old games`)
    for (const token of _.keys(gamesInProgress)) {
      const game = gamesInProgress[token]
      if (game.timeSinceLastChange > 10000 && !game.gameOver) {
        log(`_Cleaning out_ expired game **${token}**`)
        game.finishDueToTimeout()
      }
    }
  } catch(e) {}
  setTimeout(cleanOutOutGames, 10000)
}

const port = 8000
app.listen(port, () => {
  log(`~~App listening~~ on port **${port}**`)
  cleanOutOutGames()
})
