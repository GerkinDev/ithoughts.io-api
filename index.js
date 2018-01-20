'use strict';

require('dotenv').config();

const express = require( 'express' );
const _ = require( 'lodash' );
const Diaspora = require( 'diaspora' );
const DiasporaServer = require( 'diaspora-server' );
const https = require('https');

const sendMail = require('./sendMail');

const config = require( process.env.CONFIG_FILE );

const url = `${_.get(config.api, 'protocol', 'http')}://${ config.api.url }/`;

const app = new express();

// Declare our data source in Diaspora
Diaspora.createNamedDataSource( 'main', process.env.ITHOUGHTS_DATASOURCE_TYPE, {
	username: process.env.ITHOUGHTS_DATASOURCE_USERNAME,
	password: process.env.ITHOUGHTS_DATASOURCE_PASSWORD,
	host: process.env.ITHOUGHTS_DATASOURCE_HOST,
	database: process.env.ITHOUGHTS_DATASOURCE_DATABASE,
	authSource: process.env.ITHOUGHTS_DATASOURCE_AUTH_SOURCE,
});
// Declare our models in Diaspora
const ContactMail = Diaspora.declareModel('ContactMail', {
	sources: 'main',
	attributes: {
		senderMail: {
			type: 'string',
			required: true,
		},
		senderName: {
			type: 'string',
			required: true,
		},
		senderCategory: {
			type: 'string',
			required: true,
			enum: ['pro', 'part'],
		},
		message: {
			type: 'string',
			required: true,
		},
		date: {
			type: 'date',
			required: true,
			default: 'Diaspora::Date.now()',
		}
	},
});

app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});
const verifyRecaptcha = async key => {
	return new Promise((resolve, reject) => {
		https.get("https://www.google.com/recaptcha/api/siteverify?secret=" + process.env.ITHOUGHTS_RECAPTCHA_SECRET + "&response=" + key, function(res) {
			let data = "";
			res.on('data', chunk => data += chunk.toString());
			res.on('end', () => {
				try {
					const parsedData = JSON.parse(data);
					if(parsedData.success){
						return resolve();
					} else {
						console.error('Invalid recaptcha response:', parsedData);
						return reject();
					}
				} catch (e) {
					console.error('Invalid recaptcha response:', data);
					reject();
				}
			});
		});
	})
}

// Create our API
app.use( DiasporaServer({
	models: {
		ContactMail: {
			middlewares: {
				// We know that all queries will concern only current session id, so we use the `all` middleware
				all: false,
				async insert(req, res, next) {
					const recaptcha = req.diasporaApi.body.recaptcha;
					delete req.diasporaApi.body.recaptcha;
					try{
						console.info(require('util').inspect(await sendMail.sendContactMail(req.diasporaApi.body), {colors: true, depth: 8}));
						await verifyRecaptcha(recaptcha);
						return next();
					} catch(error){
						console.error('Error during insert mail', error);
						return res.status(403).send({message: 'Invalid recaptcha'});
					};
				},
			},
		},
	},
}));

// Finally, start the app, binding the port provided in the config
app.listen( config.api.port, err => {
	if ( _.isError( err )) {
		console.error( 'An error occured when starting the app: ', err );
	} else {
		console.log( `Hey! Your ToDo-list app is ready & listening on port ${ config.api.port }! Check ${ url }` );
	}
});
