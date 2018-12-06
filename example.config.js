// Copy this file as yourname.config.js or yourname.config.json
module.exports = {
    // With GRecaptcha:
    //"recaptcha_secret": "...",

    // Without recaptcha
    //"recaptcha_secret": false,// Optionnal

    // Address to send contact mails to
    "receiver": "mymail@mail.com", 

    // Send a mail to the contact submitter. Boolean. Defaults to false.
    "confirmationMail": true,


    /*"mailbot": {
        "address": "",
        "name": "iThoughts Mailbot 🤖"
    },
    "mailAccount": {
        "user": "...",
        "password": "...",
        "host": "..."
    }*/
};