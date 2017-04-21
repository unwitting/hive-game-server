jest.unmock('../game_frame')

const { Game } = require('hive-game-core')
const { GameFrame } = require('../game_frame')
const { RemotePlayer } = require('../player')

let FRAMES = []
GameFrame.getFrames = function () { return FRAMES }

describe('GameFrame', () => {
  beforeEach(() => {
    FRAMES = []
  })

  describe('anyWaitingFrames', () => {
    test('returns false if no waiting frames', () => {
      expect(GameFrame.anyWaitingFrames()).toBe(false)
    })

    test('returns true if any waiting frames', () => {
      FRAMES = [
        new GameFrame(), new GameFrame(), new GameFrame()
      ]
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0]._game = new Game()
      FRAMES[0]._game.state = { state: { gameOver: false } }
      FRAMES[1].addPlayer(new RemotePlayer())
      expect(GameFrame.anyWaitingFrames()).toBe(true)
    })
  })

  describe('applyMove', () => {
    test('returns game status without applying move if not in progress', () => {
      FRAMES = [ new GameFrame() ]
      FRAMES[0].addPlayer(new RemotePlayer())
      expect(GameFrame.applyMove(FRAMES[0].id, FRAMES[0].players[0].id, 'A+0,0', 'cneklsnclwk')).toEqual({
        status: 'WAITING_FOR_PLAYERS'
      })
    })

    test('errors if no such player', () => {
      FRAMES = [ new GameFrame() ]
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0].players[0].moveByPlayer = jest.fn()
      FRAMES[0].players[1].moveByPlayer = jest.fn()
      FRAMES[0]._game = new Game()
      FRAMES[0]._game.state = {
        state: { gameOver: false },
        hash: 'abcdef'
      }
      FRAMES[0]._game.getPlayerById = function (id) { return null }
      expect(() => GameFrame.applyMove(FRAMES[0].id, 'cajbcbwak', 'A+0,0', 'cneklsnclwk')).toThrowError('NO_SUCH_PLAYER')
      expect(FRAMES[0].players[0].moveByPlayer.mock.calls.length).toBe(0)
      expect(FRAMES[0].players[1].moveByPlayer.mock.calls.length).toBe(0)
    })

    test('applies a valid move', () => {
      FRAMES = [ new GameFrame() ]
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0].players[0].moveByPlayer = jest.fn().mockReturnValue(true)
      FRAMES[0].players[1].moveByPlayer = jest.fn()
      FRAMES[0]._game = new Game()
      FRAMES[0]._game.state = {
        state: { gameOver: false },
        hash: 'abcdef'
      }
      FRAMES[0]._game.getPlayerById = function (id) { return FRAMES[0].players[0] }
      expect(GameFrame.applyMove(FRAMES[0].id, 'player1', 'A+0,0', 'abcdef')).toEqual({
        status: 'IN_PROGRESS',
      })
      expect(FRAMES[0].players[0].moveByPlayer.mock.calls.length).toBe(1)
      expect(FRAMES[0].players[1].moveByPlayer.mock.calls.length).toBe(0)
    })

    test('returns appropriately on a hash mismatch', () => {
      FRAMES = [ new GameFrame() ]
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0].players[0].moveByPlayer = jest.fn().mockReturnValue(false)
      FRAMES[0].players[1].moveByPlayer = jest.fn()
      FRAMES[0]._game = new Game()
      FRAMES[0]._game.state = {
        state: { gameOver: false },
        hash: 'abcdef'
      }
      FRAMES[0]._game.getPlayerById = function (id) { return FRAMES[0].players[0] }
      expect(GameFrame.applyMove(FRAMES[0].id, 'player1', 'A+0,0', 'ABCDEF')).toEqual({
        status: 'HASH_MISMATCH',
      })
      expect(FRAMES[0].players[0].moveByPlayer.mock.calls.length).toBe(1)
      expect(FRAMES[0].players[1].moveByPlayer.mock.calls.length).toBe(0)
    })
  })

  describe('createWaitingFrame', () => {
    test('creates and adds a new frame with the given player', () => {
      const player = new RemotePlayer()
      const frame = GameFrame.createWaitingFrame(player)
      expect(FRAMES.length).toBe(1)
      expect(FRAMES[0]).toBe(frame)
      expect(FRAMES[0].players.length).toBe(1)
      expect(FRAMES[0].players[0]).toBe(player)
    })
  })

  describe('getFrameStatus', () => {
    test('returns NONEXISTENT for a non-existent game', () => {
      expect(GameFrame.getFrameStatus('abcdefghi')).toEqual({ status: 'NONEXISTENT' })
    })

    test('returns WAITING_FOR_PLAYERS for an unstarted game', () => {
      FRAMES = [ new GameFrame() ]
      FRAMES[0].addPlayer(new RemotePlayer())
      expect(GameFrame.getFrameStatus(FRAMES[0].id)).toEqual({ status: 'WAITING_FOR_PLAYERS' })
    })

    test('returns IN_PROGRESS for a started game', () => {
      FRAMES = [ new GameFrame() ]
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0]._game = new Game()
      FRAMES[0]._game.state = {
        state: { gameOver: false },
        hash: 'abcdef'
      }
      expect(GameFrame.getFrameStatus(FRAMES[0].id)).toEqual({
        status: 'IN_PROGRESS',
        hash: 'abcdef',
        state: { gameOver: false }
      })
    })

    test('returns COMPLETED for a finished game', () => {
      FRAMES = [ new GameFrame() ]
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0]._game = new Game()
      FRAMES[0]._game.state = {
        state: { gameOver: true },
        hash: 'abcdef'
      }
      expect(GameFrame.getFrameStatus(FRAMES[0].id)).toEqual({
        status: 'COMPLETED',
        hash: 'abcdef',
        state: { gameOver: true }
      })
    })
  })

  describe('getWaitingFrames', () => {
    test('should be an empty list when there are no frames', () => {
      expect(GameFrame.getWaitingFrames()).toEqual([])
    })

    test('should filter only frames with WAITING_FOR_PLAYERS status', () => {
      FRAMES = [
        new GameFrame(), new GameFrame(), new GameFrame(), new GameFrame()
      ]
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0].addPlayer(new RemotePlayer())
      FRAMES[0]._game = new Game()
      FRAMES[0]._game.state = { state: { gameOver: false } }
      FRAMES[1].addPlayer(new RemotePlayer())
      FRAMES[1].addPlayer(new RemotePlayer())
      FRAMES[1]._game = new Game()
      FRAMES[1]._game.state = { state: { gameOver: false } }
      FRAMES[2].addPlayer(new RemotePlayer())
      FRAMES[3].addPlayer(new RemotePlayer())
      const waitingFrames = GameFrame.getWaitingFrames()
      expect(waitingFrames.length).toBe(2)
      expect(waitingFrames[0].id).toBe(FRAMES[2].id)
      expect(waitingFrames[1].id).toBe(FRAMES[3].id)
    })
  })
})
