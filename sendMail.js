'use strict';

const nodemailer = require('nodemailer');
const Promise = require('bluebird');

const SENDER_TYPES = {
	part: 'particulier',
	pro: 'professionnel',
};

const generateTransport = () => nodemailer.createTransport({
	host: 'mail.ithoughts.io',
	secure: false, // true for 465, false for other ports
	auth: {
		user: process.env.ITHOUGHTS_MAIL_ADDRESS,
		pass: process.env.ITHOUGHTS_MAIL_PASSWORD,
	},
	tls: {
		rejectUnauthorized: false
	}
})

module.exports = {
	sender: `"iThoughts Mailbot 🤖" <${process.env.ITHOUGHTS_MAIL_ADDRESS}>`,
	async sendTestMail(recipient, subject = 'Hello ✔', html = '<b>Hello world?</b>', text = 'Hello world?'){
		return new Promise((resolve, reject) => {
			// Generate test SMTP service account from ethereal.email
			// Only needed if you don't have a real mail account for testing
			nodemailer.createTestAccount((err, account) => {

				// create reusable transporter object using the default SMTP transport
				const transporter = nodemailer.createTransport({
					host: 'smtp.ethereal.email',
					port: 587,
					secure: false, // true for 465, false for other ports
					auth: {
						user: account.user, // generated ethereal user
						pass: account.pass  // generated ethereal password
					}
				});

				// setup email data with unicode symbols
				const mailOptions = {
					from: this.sender, // sender address
					to: recipient, // list of receivers
					subject, // Subject line
					text, // plain text body
					html, // html body
				};

				// send mail with defined transport object
				transporter.sendMail(mailOptions, (error, info) => {
					if (error) {
						return reject(error);
					}
					return resolve({
						message: info,
						previewUrl: nodemailer.getTestMessageUrl(info),
					});
				});
			});
		});
	},
	async sendContactMail(contactMail){
		const transporter = generateTransport();
		const sendMail = Promise.promisify(transporter.sendMail, {
			multiArgs: true
		}).bind(transporter);

		// send mail with defined transport object
		return Promise.all([
			sendMail({
				from: this.sender, // sender address
				to: process.env.ITHOUGHTS_ADMIN_MAIL, // list of receivers
				subject: `Nouveau message de contact de ${contactMail.senderName}`, // Subject line
				text: `Un nouveau message de contact du ${SENDER_TYPES[contactMail.senderCategory]} "${contactMail.senderName}" a été reçu:

=====
${contactMail.message}
=====

Le mail de ${contactMail.senderName} est ${contactMail.senderMail}`, // plain text body
			}),
			sendMail({
				from: this.sender, // sender address
				to: contactMail.senderMail, // list of receivers
				subject: 'Your contact form was submitted', // Subject line
				text: `Your contact form was sent, you'll receive an answer quickly. Your message was:

=====
${contactMail.message}
=====

Have a great day`, // plain text body
			}),
		]);
	}
}
