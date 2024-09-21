"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose          = require('@mindcraftgmbh/nukleus-model').mongoose;
const nodemailer        = require('nodemailer');
const { Resend }        = require('resend');
const handlebars        = require("handlebars");
const fileStorage       = require('./fileStorageService');
const clientService     = require("./clientService");
const logger            = require('../tools/logger');
const decryptorStream   = require("../filters/decryptorStream");

let transporter = null;
let resend = null;
let config = null;
let nukleusClientId = null;

exports.getMailTemplate = async function(name, client) {
    client = client || nukleusClientId;

    const MailTemplate = mongoose.model('MailTemplate');
    const mailTemplate = await MailTemplate.findOne({
        templateName: name,
        client: client,
        deletedAt: { $exists: false}
    }).populate('baseTemplate').exec();

    return mailTemplate;
}

exports.create = async function(templateName, model, client) {
    let mailTemplate = await exports.getMailTemplate(templateName, client);

    if (!mailTemplate && client) {
        // If we found no mail template in the client, try it again without client so the default Nukleus template is used
        mailTemplate = await exports.getMailTemplate(templateName);
    }

    if (!mailTemplate) {
        throw `Mail template '${templateName}' not found in client '${client}'`;
    }

    // Compile and run template for mail subject
    // ----------------------------------------------------------------------------
    const subjectTemplate = handlebars.compile(mailTemplate.subject);
    let subject = subjectTemplate(model);

    // Add the mail's subject into the model
    // ----------------------------------------------------------------------------
    model.title = subject;

    // Compile and run template for mail text
    // ----------------------------------------------------------------------------
    const template = handlebars.compile(mailTemplate.text);
    let html = template(model);

    // Compile and run template for base template if needed
    // ----------------------------------------------------------------------------
    if (mailTemplate.baseTemplate) {
        model.content = new handlebars.SafeString(html);
        const baseTemplate = handlebars.compile(mailTemplate.baseTemplate.text);
        html = baseTemplate(model);
    }

    return {
        subject: subject,
        html: html
    };
};

exports.getMailFrom = async function(clientId) {
    if (!clientId)
        return null;

    const Client = mongoose.model('Client');
    const client = await Client.findOne({
        _id: clientId,
        deletedAt: { $exists: false }
    }).select("mailerName mailerAddress").exec();

    if (!client || !client.mailerName || !client.mailerAddress)
        return null;

    return `${client.mailerName} <${client.mailerAddress}>`;
}

exports.createAndSend = async function(file, model, mailTo, attachments, client) {
    const { subject, html } = await exports.create(file, model, client);
    const mailFrom = await exports.getMailFrom(client);
    await exports.sendMail(mailTo, subject, null, html, attachments, mailFrom);
};

exports.init = async function(configuration) {
    config = configuration;

    if (config.resendKey) {
        resend = new Resend(config.resendKey);
    } else if (config.smtp) {
        transporter = nodemailer.createTransport(config.smtp);
    }

    nukleusClientId = await clientService.getNukleusClient();

    if (!nukleusClientId) {
        logger.error("Mailer: Nukleus client Id not found!");
    }

};

exports.sendMail = async function(mailTo, subject, text, html, attachments, mailFrom) {

    if (!resend && !transporter)
        return Promise.resolve();

    let attachmentEntries;
    if (Array.isArray(attachments) && attachments.length) {
        attachmentEntries = [];

        const Item = mongoose.model('Item');

        for (const attachment of attachments) {

            const item = await Item.findOne({
                _id: new mongoose.Types.ObjectId(attachment)
            }).select("storages filesize filename mimeType encryptionKey").exec();

            if (!item || !item.filesize) {
                logger.error(`Attachment ${attachment} not found for email.`);
            } else {
                const download = await fileStorage.download(attachment.toString(), item.storages);
                let stream;

                if (item.encryptionKey) {
                    const decryptor = decryptorStream.decryptStream(download.stream, item.encryptionKey);
                    stream = decryptor.stream;
                } else {
                    stream = download.stream;
                }

                attachmentEntries.push({
                    filename: item.filename,
                    content: stream,
                    contentType: item.mimeType
                });
            }
        }
    }

    mailFrom = mailFrom || config.from;

    return new Promise(function(resolve, reject) {
        if (transporter) {
            transporter.sendMail({
                from: mailFrom,
                to: mailTo,
                subject: subject,
                text: text,
                html: html,
                attachments: attachmentEntries
            }, function (error, info, response) {
                if (error) {
                    console.error(error);
                    reject(error);
                } else {
                    console.log("Mail to '" + mailTo + "' with subject '" + subject + "' sent: " + info.response);
                    console.log(info);
                    resolve(info);
                }
            });
        }
        else if (resend) {
            resend.emails.send({
                from: mailFrom,
                to: mailTo,
                subject: subject,
                html: html,
                text: text,
                attachments: attachmentEntries,
            }).then(function(info) {
                if (info.error) {
                    console.error(info.error);
                    reject(info.error);
                } else {
                    console.log("Mail to '" + mailTo + "' with subject '" + subject + "' sent: " + info.data.id);
                    resolve(info.data.id);
                }
            }).catch(function(err) {
                console.error(err);
                reject(err);
            });
        } else {
            reject("No email sender configured!");
        }
    });
};
