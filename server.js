const _ = require('lodash')
const express = require('express')
const shortid = require('shortid')
const { log } = require('peasy-log')
const { Game } = require('hive-game-core')
const { RemotePlayer } = require('./lib/player')

const app = express()

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
  const remotePlayer = new RemotePlayer(req.playerId)
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
    delete waitingPlayers[matchedPlayerToken]
    gamesInProgress[matchedPlayerToken] = game
    return res.send({ token: matchedPlayerToken })
  }
})

app.listen(8000, () => {
  log(`~~App listening~~ on port **8000**`)
})
