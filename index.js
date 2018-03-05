'use strict';

const fs = require('fs');
const path = require('path');
const express = require( 'express' );
const _ = require( 'lodash' );
const Diaspora = require( 'diaspora' );
const DiasporaServer = require( 'diaspora-server' );
const https = require('https');

process.env.ITHOUGHTS_CONFIG_DIR = process.env.ITHOUGHTS_CONFIG_DIR || __dirname;

const MATCH_CONFIG_REGEX = /^(?!example)(.+)\.config\.js(?:on)?$/;
// Load config
const config = _(fs.readdirSync(process.env.ITHOUGHTS_CONFIG_DIR))
	.filter(filename => filename.match(MATCH_CONFIG_REGEX))
	.map(filename => _.get(filename.match(MATCH_CONFIG_REGEX), 1, false))
	.reduce((accumulator, baseName) => _.assign(accumulator, {
		apis: {
			[baseName]: require(path.resolve(process.env.ITHOUGHTS_CONFIG_DIR, `${baseName}.config.json`))
		},
	}), _.assign({apis: {}}, require('./config.json')));
console.log(config);

const sendMail = require('./sendMail')(config);

const url = `${_.get(config.api, 'protocol', 'http')}://${ config.api.url }/`;

const app = new express();

// Declare our data source in Diaspora
Diaspora.createNamedDataSource( 'main', config.datasource.type, config.datasource.config);
// Declare our models in Diaspora
const ContactMails = _.mapValues(config.apis, (apiConfig, apiName) => Diaspora.declareModel(`ContactMail${apiName[0].toUpperCase() + apiName.slice(1)}`, {
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
}));

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
		"ContactMail*": {
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
