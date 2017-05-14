const _ = require('lodash')
const express = require('express')
const shortid = require('shortid')
const { log } = require('peasy-log')
const db = require('./lib/db')
const { GameFrame } = require('./lib/game_frame')
const { RemotePlayer } = require('./lib/player')
const { AnalyticsClient } = require('./lib/analytics')

const app = express()

const analytics = new AnalyticsClient()

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
  analytics.event('Service', 'Healthcheck')
  return res.send({
    health: 'healthy',
    nFrames: GameFrame.getNumberOfFrames(),
    nCompletedFrames: GameFrame.getNumberOfCompletedFrames(),
    nWaitingFrames: GameFrame.getNumberOfWaitingFrames(),
  })
})

app.get('/game/new', requireAuth, (req, res) => {
  log(`_New game_ request from player **${req.playerId}**`)
  log(`_Creating_ new RemotePlayer(**${req.playerId}**)`)
  const remotePlayer = new RemotePlayer(req.playerId, { logFn: log })
  if (GameFrame.anyWaitingFrames()) {
    GameFrame.joinWaitingFrame(remotePlayer).then(frame => res.send({ gameId: frame.id }))
  } else {
    GameFrame.createWaitingFrame(remotePlayer).then(frame => res.send({ gameId: frame.id }))
  }
})

app.get('/game/:gameId/status', (req, res) => {
  const { gameId } = req.params
  log(`_Game status_ request for ID **${gameId}** from player **${req.playerId}**`)
  const status = GameFrame.getFrameStatus(gameId)
  status.gameId = gameId
  return res.send(status)
})

app.get('/game/:gameId/move/:move/:hash', requireAuth, (req, res) => {
  const { gameId, move, hash } = req.params
  log(`_Move_ request for game ID **${gameId}** from player **${req.playerId}** with move string **${move}**`)
  try {
    GameFrame.applyMove(gameId, req.playerId, move, hash).then(status => {
      status.gameId = gameId
      return res.send(status)
    })
  } catch(e) {
    // TODO handle properly
    return res.status(400)
  }
})

const port = 8000
db.connect()
.then(db => {
  log(`_Starting app_ on port **${port}**`)
  app.listen(port, () => {
    log(`~~App listening~~ on port **${port}**`)
  })
})
