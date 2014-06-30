blue = require 'bluebird'
mongo = require "mongodb"

client = null

module.exports = (req, res, next) ->
		client or= new blue (resolve, reject) ->
			mongo.MongoClient.connect 'mongodb://127.0.0.1:27017/' + req.settings.database, (err, db) ->
				reject err if err
				resolve db if db
		
		client.then (db) ->
			db.free = db.collection 'ips_free'
			db.paid = db.collection 'ips_paid'
			req.db = db
			next()
