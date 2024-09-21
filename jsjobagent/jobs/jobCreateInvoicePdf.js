"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const nsvc              = require('@mindcraftgmbh/nukleus-service');
const pdfgen            = require('@mindcraftgmbh/nukleus-pdfgen');
const mongoose          = nsvc.model.mongoose;
const ItemVisibility    = nsvc.model.ItemVisibility;

function formatPrice(price, currency) {
    const formatter = new Intl.NumberFormat('de-CH', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    })

    return formatter.format(price / 100);
}

async function getInvoiceTemplateForClient(client, invoiceName, templateMap, fallbackTemplateSrc) {
    const clientId = client._id.toString();

    if (templateMap.has(clientId))
        return templateMap.get(clientId);

    const templateSrc = await nsvc.invoiceTemplateService.generateInvoice(invoiceName, client);
    if (templateSrc) {
        templateMap.set(clientId, templateSrc);
        return templateSrc;
    }

    return fallbackTemplateSrc;
}

async function getPaymentSetup(invoice, client, user) {
    if (!invoice.user) {
        return client.paymentSetup;
    } else {
        return await nsvc.userService.getPaymentSetup(user._id, client._id);
    }
}

function getNameOnInvoice(invoice, paymentSetup, client, user) {
    if (!invoice.user) {
        return paymentSetup.address.name || client.name;
    } else {
        return paymentSetup.address.name || user.name;
    }
}

module.exports = {

    type: "Job",
    name: "Create invoice PDFs",
    manualStart: false,
    interval: 'immediate',
    watch: "Invoice",

    process: async function(tools, log) {
        const Client = mongoose.model('Client');
        const Invoice = mongoose.model('Invoice');

        // Get the nukleus client, we need its Id to fetch the invoice template
        // -----------------------------------------------------------------------------------------
        const nukleusClient = await Client.findOne({ name: 'Nukleus' }).select("_id").exec();
        if (!nukleusClient) {
            throw "Nukleus client not found! Cannot access invoice template!";
        }

        // Fetch all pending invoices
        // -----------------------------------------------------------------------------------------
        const invoices = await Invoice.find({ item: { $exists: false }}).exec();
        log(`Found ${invoices.length} invoices to generate PDFs for`);

        if (invoices.length) {

            // Fetch the nukleus invoice template and put it in a map
            // -----------------------------------------------------------------------------------------
            const templateMap = new Map();
            const fallbackTemplateSrc = await getInvoiceTemplateForClient(nukleusClient, 'nukleusinvoice', templateMap);

            const systemUserId = tools.getSystemUserId();

            for (const invoice of invoices) {

                try {
                    // Load client and do calculations
                    // --------------------------------------------------------------------
                    const client = await Client.findById(invoice.client).populate("paymentSetup").exec();

                    const Plan = mongoose.model('Plan');
                    const plan = await Plan.findOne({ _id: client.currentPlan }).exec();

                    const invoiceFolder = await nsvc.folderService.getSystemFolderId(client._id, "Invoices");
                    if (!invoiceFolder) {
                        log({severity: "error"}, "Invoices folder not found for client: " + client._id);
                        continue;
                    }

                    if (invoice.user)
                        log(`Creating invoice ${invoice.number} for user ${invoice.user}`);
                    else
                        log(`Creating invoice ${invoice.number} for client ${client._id}`);

                    // If this invoice is to a user within a client, fetch it
                    // --------------------------------------------------------------------------
                    let user;
                    if (invoice.user) {
                        const User = mongoose.model('User');
                        user = await User.findOne({ _id: invoice.user, deletedAt: { $exists: false }}).exec();
                    }

                    // If this client has its own invoices, fetch it
                    // --------------------------------------------------------------------------
                    const templateSrc = await getInvoiceTemplateForClient(client, "invoice", templateMap, fallbackTemplateSrc);

                    // Get the relevant payment setup, either the client's or the user's
                    // --------------------------------------------------------------------------
                    const paymentSetup = await getPaymentSetup(invoice, client, user);

                    // Create invoice
                    // --------------------------------------------------------------------------
                    const positions = [];
                    for (const position of invoice.positions) {
                        positions.push({
                            description: position.name,
                            quantity: Math.floor(position.quantity * 1000) / 1000,
                            price: formatPrice(position.singlePrice, invoice.currency),
                            total: formatPrice(position.price, invoice.currency)
                        });
                    }

                    // Create PDF
                    // --------------------------------------------------------------------
                    log("Creating pdf");
                    let data = {};
                    data["InvoiceNo"] = invoice.number;
                    data["Company"] = getNameOnInvoice(invoice, paymentSetup, client, user);
                    data["Street"] = paymentSetup.address.street;
                    data["City"] = `${paymentSetup.address.zipcode || ""} ${paymentSetup.address.city || ""}`
                    data["Country"] = paymentSetup.address.country;
                    data["VATNo"] = client.vatNo;
                    data["Date"] = `${invoice.date.getDate()}.${invoice.date.getMonth()+1}.${invoice.date.getFullYear()}`;
                    data["Subtotal"] = formatPrice(invoice.subtotalAmount, invoice.currency);
                    data["VAT"] = `VAT ${invoice.vatPercent}%`;
                    data["Total"] = formatPrice(invoice.totalAmount, invoice.currency);
                    data["VATAmount"] = formatPrice(invoice.vatAmount, invoice.currency);
                    data["Positions"] = positions;
                    data["Message"] = invoice.message;

                    const name = `invoice_${invoice.number}`;
                    const filename = `${name}.pdf`;
                    const buffer = await pdfgen.generate(templateSrc, data, true);
                    //fs.writeFileSync(filename, buffer);

                    // Create Item and upload pdf
                    // --------------------------------------------------------------------
                    log("Creating item for invoice");
                    const Item = mongoose.model('Item');
                    let item = await Item.findOne({ name: name, folder: invoiceFolder, client: client._id }).exec();
                    if (!item) {
                        item = new Item({
                            name: name,
                            folder: invoiceFolder,
                            public: false,
                            visibility: ItemVisibility.Private,
                            filename: filename,
                            client: client._id,
                            createdBy: systemUserId,
                            updatedBy: systemUserId,
                            __user: systemUserId
                        });

                        await item.save({__user: systemUserId});
                    } else {
                        item.filename = filename;
                    }

                    log("Uploading pdf to file storage");
                    const stream = nsvc.common.bufferToStream(buffer);
                    await nsvc.itemService.uploadFile(stream, item, false, client, plan);
                    item.__user = systemUserId;
                    await item.save({ __user: systemUserId });

                    // Attach item to invoice
                    // --------------------------------------------------------------------
                    invoice.item = item;
                    await invoice.save();

                    // Send mail
                    // --------------------------------------------------------------------
                    if (paymentSetup.address.email) {
                        await nsvc.mailService.createNewInvoiceMail(paymentSetup.address.email,
                            item._id.toString(),
                            invoice.user ? client : null);
                    }
                }
                catch(err) {
                    log({ severity: "error" }, err);
                }
            }
        }
    }
};
