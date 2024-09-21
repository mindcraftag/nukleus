"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const model     = require('@mindcraftgmbh/nukleus-model');
const mongoose  = model.mongoose;

let config = null;

exports.init = function(cfg) {
  config = cfg;
};

exports.createMail = async function(address, template, fields, attachments, client) {
  const Mail = mongoose.model('Mail');
  await Mail.create({
    address: address,
    template: template,
    fields: fields,
    attachments: attachments,
    client: client
  });
};

exports.createAdminMail = async function(template, fields, attachments, client) {
  const Mail = mongoose.model('Mail');
  await Mail.create({
    address: "",
    admin: true,
    template: template,
    fields: fields,
    attachments: attachments,
    client: client
  });
};

exports.createNewUserMail = async function(address, invitationToken, client) {
  return exports.createMail(address, "newuser", {
    link: `${config.nukleus_web_url}/invitation/${invitationToken}`,
    invitationToken: invitationToken
  }, undefined, client);
};

exports.createNewMembershipMail = async function(address, clientname, client) {
  return exports.createMail(address, "newmembership", {
    clientname: clientname
  }, undefined, client);
};

exports.createEmailConfirmationMail = async function(address, token, client) {
  return exports.createMail(address, "emailconfirmation", {
    link: `${config.nukleus_web_url}/emailconfirmation/${token}`,
    token: token
  }, undefined, client);
};

exports.createUserApprovedMail = async function(address, client) {
  return exports.createMail(address, "newuserapproved", {
    link: `${config.nukleus_web_url}/login`
  }, undefined, client);
};

exports.createUserRejectionMail = async function(address, client) {
  return exports.createMail(address, "newuserrejected", {}, undefined, client);
};

exports.createNewUserRegistrationMail = async function(userId, name, account, client) {
  return exports.createAdminMail("newuserregistration", {
    link: `${config.nukleus_web_url}/approvals`,
    name: name,
    account: account
  }, undefined, client);
};

exports.createForgotPasswordMail = async function(address, token, client) {
  return exports.createMail(address, "forgotpassword", {
    link: `${config.nukleus_web_url}/newpassword/${token}`,
    token: token
  }, undefined, client);
};

exports.createNewInvoiceMail = async function(address, invoiceItemId, client) {
  return exports.createMail(address, "newinvoice", {}, [invoiceItemId], client);
};

exports.createPlanSwitchedMail = async function(address, clientName, oldplan, newplan, client) {
  return exports.createMail(address, "planswitched", {
    client: clientName,
    oldplan: oldplan,
    newplan: newplan
  }, undefined, client);
};

exports.createPaymentChangedMail = async function(address, client) {
  return exports.createMail(address, "paymentchanged", {}, undefined, client);
};

exports.createEmailChangedConfirmationMail = async function(address, token, client) {
  return exports.createMail(address, "emailchangedconfirmation", {
    link: `${config.nukleus_web_url}/emailchangedconfirmation/${token}`,
    token: token
  }, undefined, client);
};

exports.createCardNearingExpirationMail = async function(address, card, expirationdate, client) {
  return exports.createMail(address, "cardnearingexpiration", {
    card: card,
    expirationdate: expirationdate
  }, undefined, client);
};

exports.createCardExpiredMail = async function(address, card, expirationdate, client) {
  return exports.createMail(address, "cardexpired", {
    card: card,
    expirationdate: expirationdate
  }, undefined, client);
};

exports.createPaymentFailedMail = async function(address, card, invoiceNo, client) {
  return exports.createMail(address, "paymentfailed", {
    card: card,
    invoiceNo: invoiceNo
  }, undefined, client);
};

exports.createExtendingSubscriptionFailedMail = async function(address, card, purchasable, client) {
  return exports.createMail(address, "extendsubscriptionfailed", {
    card: card,
    purchasable: purchasable
  }, undefined, client);
};

exports.createNewConversationEntryMail = async function(address, username, text, conversationId, conversationEntryId, client) {
  return exports.createMail(address, "newconversationentry", {
    username: username,
    text: text,
    base_url: config.nukleus_web_url,
    conversationId: conversationId,
    conversationEntryId: conversationEntryId,
    link: `${config.nukleus_web_url}/conversation/${conversationId}/${conversationEntryId}`,
  }, undefined, client);
};

exports.create2FAMail = async function(address, clientName, code, client) {
  return exports.createMail(address, "twofactorauth", {
    client: clientName,
    code: code
  }, undefined, client);
};

exports.createNewUserJoinedMail = async function(clientName, user, client) {
  return exports.createAdminMail( "newuserjoined", {
    client: clientName,
    user: user
  }, undefined, client);
};

exports.createNewPaymentProcessedMail = async function(clientName, user, amount, purchasable, client) {
  return exports.createAdminMail( "newpaymentprocessed", {
    client: clientName,
    user: user,
    amount: amount,
    purchasable: purchasable
  }, undefined, client);
};

exports.queryMail = async function(filterTemplate, filterDateStart, filterDateEnd, filterSuccess) {
  const Mail = mongoose.model('Mail');
  const query = Mail.find();
  query.sort({"createdAt": "descending"});

  if (filterTemplate) {
    query.where({"template": {$regex: filterTemplate, $options: "i"}});
  }

  if (filterDateStart) {
    query.where({"createdAt": {
      $gte: filterDateStart
    }});
  }

  if (filterDateEnd) {
    query.where({"createdAt": {
      $lte: filterDateEnd
    }});
  }

  if (filterSuccess !== undefined) {
    query.where({"success": filterSuccess});
  }

  return await query.exec();
};
