'use strict';

const fs = require('fs');
const path = require('path');
const express = require( 'express' );
const _ = require( 'lodash' );
const Diaspora = require( 'diaspora' );
const DiasporaServer = require( 'diaspora-server' );
const https = require('https');

process.env.ITHOUGHTS_CONFIG_DIR = process.env.ITHOUGHTS_CONFIG_DIR || __dirname;
console.log(process.env.ITHOUGHTS_CONFIG_DIR)

const MATCH_CONFIG_REGEX = /^(?!example)(.+)\.config\.js(?:on)?$/;
// Load config
const config = _(fs.readdirSync(process.env.ITHOUGHTS_CONFIG_DIR))
    .filter(filename => !!filename.match(MATCH_CONFIG_REGEX))
    .map(filename => ({
        baseName: _.get(filename.match(MATCH_CONFIG_REGEX), 1),
        filename,
    }))
    .compact()
	.reduce((accumulator, desc) => _.merge(accumulator, { apis: {
		[desc.baseName]: require(path.resolve(process.env.ITHOUGHTS_CONFIG_DIR, desc.filename))
	}}), _.assign({apis: {}}, require('../config.json'), require('./config.json')));

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
const verifyRecaptcha = async (key, targetSiteName) => {
    const secret = config.apis[targetSiteName].recaptcha_secret;
	return new Promise((resolve, reject) => {
		https.get("https://www.google.com/recaptcha/api/siteverify?secret=" + secret + "&response=" + key, function(res) {
		let data = "";
		res.on('data', chunk => data += chunk.toString());
		res.on('end', () => {
			try {
				const parsedData = JSON.parse(data);
				if(parsedData.success){
					return resolve();
				} else {
					console.error('Invalid recaptcha response:', parsedData);
					return reject(new Error('Invalid recaptcha response: ' + JSON.stringify(parsedData)));
				}
			} catch (e) {
				console.error('Invalid recaptcha response:', e);
				reject(e);
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
                    const model = req.diasporaApi.model;
                    const targetSiteName = model.name.replace(/^ContactMail(.+)$/, '$1').toLowerCase();
					try{
						await verifyRecaptcha(recaptcha, targetSiteName);
						await sendMail.sendContactMail(req.diasporaApi.body, targetSiteName);
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
