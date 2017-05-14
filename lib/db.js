const { log } = require('peasy-log')
const mongoose = require('mongoose')
mongoose.Promise = Promise

const mongooseUrl = process.env.MONGO_URL || 'mongodb://localhost/hive-game-server'

function connect() {
  return new Promise((resolve, reject) => {
    log(`_Connecting to database_`)
    mongoose.connect(mongooseUrl)
    const db = mongoose.connection
    db.on('error', err => {
      log(`Error connecting to database: ${err}`)
      reject(err)
    })
    db.once('open', () => {
      log(`~~Successfully~~ connected to database`)
      resolve(db)
    })
  })
}

module.exports = { connect }
