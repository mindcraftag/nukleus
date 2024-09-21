"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const nsvc        = require('@mindcraftgmbh/nukleus-service');
const mongoose    = nsvc.model.mongoose;
const moment      = require('moment');

module.exports = {

    type: "Job",
    name: "Create invoice data",
    manualStart: false,
    interval: 'daily',

    process: async function(tools, log) {

        const Invoice = mongoose.model('Invoice');
        const Plan = mongoose.model('Plan');
        const Client = mongoose.model('Client');
        const ClientStat = mongoose.model('ClientStat');
        const ClientMetrics = mongoose.model('ClientMetrics');

        const lastMonthDate = moment().subtract(1, 'month');
        const nextMonthDate = lastMonthDate.clone().add(1, 'month');
        const year = lastMonthDate.year();
        const month = lastMonthDate.month()+1;
        const nextYear = nextMonthDate.year();
        const nextMonth = nextMonthDate.month()+1;
        const bytesInGiB = 1024 * 1024 * 1024;
        const hoursInMonth = lastMonthDate.daysInMonth() * 24;

        log(`Creating invoice data for ${month}/${year}`);

        const processingMonth = new Date(year, month-1, 1);
        const clients = await Client.find({
            deletedAt: { $exists: false },
            $or: [
                { "paymentLastMonthProcessed": { $exists: false } },
                { "paymentLastMonthProcessed": { $lt: processingMonth } }
            ]
        }).select("name metrics refMetrics").populate('paymentSetup').exec();
        log(`Found ${clients.length} clients to process`);

        if (clients.length === 0)
            return;

        const plans = await Plan.find().exec();
        log(`Found ${plans.length} plans`);

        // Build plans map for quick lookup
        // ---------------------------------------------------------
        const plansMap = new Map();
        for (const plan of plans) {
            plansMap.set(plan._id.toString(), plan);
        }

        const promises = [];
        let clientIndex = 0;
        for (const client of clients) {
            log("Processing client stats for client: " + client.name);

            promises.push(new Promise(async (resolve, reject) => {
                try {
                    // Check if we have an invoice for this client already
                    // ---------------------------------------------------------
                    const existsInvoice = await Invoice.findOne({
                        client: client._id,
                        year: year,
                        month: month
                    }).exec();

                    if (existsInvoice) {
                        // We already have an invoice for this month! So quit processing here.
                        // But store the timestamp in the client so we do not try again to process
                        // this month.
                        client.paymentLastMonthProcessed = processingMonth;
                        await client.save();
                        resolve();
                        return;
                    }

                    // Get a list of all stats for the current month
                    // ---------------------------------------------------------
                    const currentStats = await ClientStat.find({
                        client: client._id,
                        year: year,
                        month: month
                    }).sort(
                        [["day", "asc"], ["hour", "asc"]]
                    ).exec();

                    // Get only the first stat of the next month
                    // ---------------------------------------------------------
                    const nextStat = await ClientStat.findOne({
                        client: client._id,
                        year: nextYear,
                        month: nextMonth
                    }).sort(
                        [["day", "asc"], ["hour", "asc"]]
                    ).exec();

                    const stats = nextStat ? [...currentStats, nextStat] : currentStats;
                    if (currentStats.length < 2) {
                        // We have less than 2 stats entries. This means this client is brand new
                        // and was created just recently so did not exist last month
                        client.paymentLastMonthProcessed = processingMonth;
                        await client.save();
                        resolve();
                        return;
                    }

                    //log("Found stat entries: " + stats.length);

                    const usages = new Map();

                    // Now find all periods of time with the same plan
                    // ----------------------------------------------------------------------
                    let currentPlan = null;
                    let statStart = null;
                    let storagesWithinPeriod = [];

                    for (let i = 0; i < stats.length; i++) {
                        const stat = stats[i];
                        const lastStat = i === stats.length-1;
                        const plan = stat.plan.toString();

                        if (!currentPlan) {
                            statStart = stat;
                            currentPlan = plan;
                        } else {
                            storagesWithinPeriod.push(stat.metrics.storedBytes);

                            if (currentPlan !== plan || lastStat) {

                                // Calculate used traffic in the period
                                // ----------------------------------------------------------------------
                                const publicDownloadBytes = stat.metrics.publicDownloadBytes - statStart.metrics.publicDownloadBytes;
                                const secureDownloadBytes = stat.metrics.secureDownloadBytes - statStart.metrics.secureDownloadBytes;
                                const uploadBytes = stat.metrics.uploadBytes - statStart.metrics.uploadBytes;
                                const traffic = publicDownloadBytes + secureDownloadBytes + uploadBytes;
                                const trafficGb = traffic / bytesInGiB;

                                // Calculate period in hours
                                // ----------------------------------------------------------------------
                                const startDate = new Date(statStart.year, statStart.month-1, statStart.day, statStart.hour);
                                const endDate = new Date(stat.year, stat.month-1, stat.day, stat.hour);
                                const diff = endDate - startDate
                                const hours = Math.floor(diff / (3600 * 1000));

                                // Store the usage
                                // ----------------------------------------------------------------------
                                let usage = {
                                    trafficGb: 0,
                                    storageMeasurements: [],
                                    hours: 0
                                };
                                if (usages.has(currentPlan))
                                    usage = usages.get(currentPlan);
                                else
                                    usages.set(currentPlan, usage);

                                usage.trafficGb += trafficGb;
                                usage.storageMeasurements = [...usage.storageMeasurements, ...storagesWithinPeriod];
                                usage.hours += hours;

                                // remember the new start stat and the plan
                                // ----------------------------------------------------------------------
                                statStart = stat;
                                currentPlan = plan;
                                storagesWithinPeriod = [];
                            }
                        }
                    }

                    // Calculate prices
                    // --------------------------------------------------
                    let subtotalAmount = 0;
                    for (const planId of usages.keys()) {
                        const usage = usages.get(planId);
                        const plan = plansMap.get(planId);

                        const storageSumBytes = usage.storageMeasurements.reduce((acc, val) => acc + val);
                        const storageAvgBytes = storageSumBytes / usage.storageMeasurements.length;

                        usage.storageGb = storageAvgBytes / bytesInGiB;
                        usage.plan = plan;
                        usage.trafficSinglePrice = plan.pricing.trafficPricePerGb;
                        usage.storageSinglePrice = plan.pricing.storagePricePerGb;
                        usage.trafficPrice = Math.floor(usage.trafficGb * plan.pricing.trafficPricePerGb);
                        usage.storagePrice = Math.floor(usage.storageGb * plan.pricing.storagePricePerGb);
                        usage.basePrice = Math.floor(plan.pricing.monthlyBasePrice / hoursInMonth * usage.hours);

                        subtotalAmount += usage.basePrice;
                        subtotalAmount += usage.trafficPrice;
                        subtotalAmount += usage.storagePrice;
                    }

                    // If the client pays anything, create an invoice for that.
                    // --------------------------------------------------
                    if (subtotalAmount > 0) {

                        const positions = [];
                        for (const planId of usages.keys()) {
                            const usage = usages.get(planId);

                            positions.push({
                                name: `Base price (${usage.hours} hours) - ${usage.plan.name}`,
                                singlePrice: usage.basePrice,
                                quantity: 1,
                                price: usage.basePrice
                            });

                            positions.push({
                                name: `Storage per GiB - ${usage.plan.name}`,
                                singlePrice: usage.storageSinglePrice,
                                quantity: usage.storageGb,
                                price: usage.storagePrice
                            });

                            positions.push({
                                name: `Traffic per GiB - ${usage.plan.name}`,
                                singlePrice: usage.trafficSinglePrice,
                                quantity: usage.trafficGb,
                                price: usage.trafficPrice
                            });
                        }

                        let invoiceMonth = month+1;
                        let invoiceYear = year;
                        if (invoiceMonth > 12) {
                            invoiceMonth = 1;
                            invoiceYear++;
                        }

                        const date = new Date(invoiceYear, invoiceMonth, 1);
                        await nsvc.invoiceService.createInvoice(date, year, month, null, client, positions, client.paymentSetup, null);
                    }

                    // At last, save a new traffic reference value to measure quota against
                    // -----------------------------------------------------------------------
                    const metricsData = await ClientMetrics.findOne({ client: client._id }).exec();

                    metricsData.refMetrics.trafficCount =
                        metricsData.metrics.publicDownloadCount +
                        metricsData.metrics.secureDownloadCount +
                        metricsData.metrics.uploadCount;

                    metricsData.refMetrics.trafficBytes =
                        metricsData.metrics.publicDownloadBytes +
                        metricsData.metrics.secureDownloadBytes +
                        metricsData.metrics.uploadBytes;

                    client.paymentLastMonthProcessed = processingMonth;
                    await client.save();
                    await metricsData.save();

                    resolve();
                }
                catch(err) {
                    log({ severity: "error"}, err);
                    reject(err);
                }
            }));

            clientIndex++;
        }

        await Promise.all(promises);
    }
};
