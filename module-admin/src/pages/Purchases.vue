<template>
  <div>
    <h1 class="pageTitle">Purchases</h1>

    <!-- Table of purchases -->
    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>
          <v-card width="100%" align-center>
            <!-- Query options -->
            <v-layout class="searchBar ma-0 px-6 mt-4" style="align-items: baseline !important;" align-center row wrap>
              <v-text-field class="mx-4" v-model="queryEmail" type="text" label="E-Mail" clearable />
              <v-text-field class="mx-4" v-model="queryInvoiceNumber" type="text" label="Invoice" clearable />
              <v-text-field class="mx-4" v-model="queryDateStart" type="datetime-local" label="Created after" clearable />
              <v-text-field class="mx-4" v-model="queryDateEnd" type="datetime-local" label="Created before" />
              <v-btn color="primary" @click="executeQuery">
                Search
              </v-btn>
            </v-layout>

            <!-- Set itemsPerPage to -1 to show all purchases that have been found.  -->
            <v-data-table class="row-pointer" :headers="headers" :items="purchases" :itemsPerPage="-1"
              @click:row="rowClicked" :hide-default-footer="true">
            </v-data-table>
            <div class="d-flex align-center justify-center pa-4">
              <v-btn color="primary" v-if="nextCursor" @click="loadMore">Load More</v-btn>
            </div>
          </v-card>
        </v-flex>
      </v-layout>
    </v-container>

    <!-- Dialog to show information about a purchase and it's invoices. -->
    <v-dialog v-model="purchaseDialog" width="50vw">
      <v-card>
        <v-card-title class="text-h5">
          View Purchase
        </v-card-title>

        <!-- Display relevant fields for the purchase -->
        <div v-if="purchaseDialogData">
          <v-row class="dialog-data">
            <v-col>
              <span class="dialog-text">User:</span>
              <span class="dialog-value">{{ purchaseDialogData.user.name }}</span>
            </v-col>
            <v-col>
              <span class="dialog-text">Account:</span>
              <span class="dialog-value">{{ purchaseDialogData.user.account }}</span>
            </v-col>
            <v-col>
              <span class="dialog-text">Client:</span>
              <span class="dialog-value">{{ purchaseDialogData.client }}</span>
            </v-col>
            <v-col>
              <span class="dialog-text">Active:</span>
              <span class="dialog-value">{{ purchaseDialogData.active }}</span>
            </v-col>
            <v-col>
              <span class="dialog-text">Purchasable:</span>
              <span class="dialog-value">{{ purchaseDialogData.purchasable }}</span>
            </v-col>
            <v-col>
              <span class="dialog-text">Option:</span>
              <span class="dialog-value">{{ purchaseDialogData.option.name }}</span>
            </v-col>
            <v-col>
              <span class="dialog-text">Interval:</span>
              <span class="dialog-value">{{ purchaseDialogData.option.interval }}</span>
            </v-col>
            <v-col>
              <span class="dialog-text">Price:</span>
              <span class="dialog-value">
                {{ supportedCurrencies.map(currency => {
                  if (priceFormatters[currency] && purchaseDialogData.option.prices) {
                    return priceFormatters[currency].format(purchaseDialogData.option.prices[currency] / 100)
                  } else {
                    return "?";
                  }
                }).join(" / ") }}
              </span>
            </v-col>
            <v-col>
              <span class="dialog-text">Paid until:</span>
              <span class="dialog-value">{{ purchaseDialogData.paidUntil }}</span>
            </v-col>
            <v-col>
              <span class="dialog-text">Cancelled at:</span>
              <span class="dialog-value">{{ purchaseDialogData.cancelledAt }}</span>
            </v-col>
            <v-col>
              <span class="dialog-text">Cancellation Reason:</span>
              <span class="dialog-value">{{ purchaseDialogData.cancellationReason || "-" }}</span>
            </v-col>
          </v-row>
        </div>

        <!-- Go over every invoice that is associated with this purchase and show information about it. -->
        <div class="payments" v-if=" purchaseDialogData">
          <h3>Payments</h3>
          <div class="payment" v-for="invoice of purchaseDialogData.paymentHistory" :set="priceFormatter = new Intl.NumberFormat(languages, { style: 'currency', currency: invoice.currency })">

            <!-- The header contains invoice number and date. -->
            <div class="payment--header">
              <span class="invoice-number">Invoice <code>#{{ invoice.number }}</code></span>

              <div>
                <span class="dialog-text">From:</span>
                <span class="dialog-value">{{ formatter.format(new Date(invoice.date)) }}</span>
              </div>
            </div>

            <!-- The positions are the individual items that are part of this invoice. -->
            <h4>Positions:</h4>
            <v-divider></v-divider>
            <v-row no-gutters class="position">
              <v-col cols="5">
                Name
              </v-col>
              <v-col>
                Single Price
              </v-col>
              <v-col>
                Quantity
              </v-col>
              <v-col>
                Price
              </v-col>
            </v-row>
            <v-row no-gutters class="position" v-for="position of invoice.positions">
              <v-col cols="5">
                {{ position.name }}
              </v-col>
              <v-col>
                {{ priceFormatter.format(position.singlePrice / 100) }}
              </v-col>
              <v-col>
                x{{ position.quantity }}
              </v-col>
              <v-col>
                {{ priceFormatter.format(position.price / 100) }}
              </v-col>
            </v-row>

            <v-divider></v-divider>

            <!-- Show some more information about the invoice. -->
            <v-row no-gutters class="bottom--info my-2" style="white-space: nowrap;">
              <v-col cols="auto" class="primary-column">
                <span class="dialog-text">Paid At:</span>
                <span class="dialog-value">{{ formatter.format(new Date(invoice.paidAt)) }}</span>
              </v-col>

              <v-col>
                <span class="dialog-text">Subtotal:</span>
                <span class="dialog-value">{{ priceFormatter.format(invoice.subtotalAmount / 100) }}</span>
              </v-col>

              <v-col>
                <span class="dialog-text">VAT:</span>
                <span class="dialog-value">{{ invoice.vatPercent }}%</span>
              </v-col>

              <v-col class="totalAmount">
                <span class="dialog-text">Total:</span>
                <span class="dialog-value">{{ priceFormatter.format(invoice.totalAmount / 100) }}</span>
              </v-col>
            </v-row>

            <!-- If this invoice has been (partially) refunded, show information about the refunds. -->
            <v-row no-gutters class="mt-4 mb-4" v-if="invoice.refundAmount || invoice.refundedAt"
              style="color: red; white-space: nowrap;">
              <v-col align="center" class="mx-2">
                <span class="dialog-text">Refunded Amount:</span>
                <span class="dialog-value">{{ priceFormatter.format(invoice.refundAmount / 100) }}</span>
              </v-col>
              <v-col align="center" class="mx-2">
                <span class="dialog-text">Last refunded at:</span>
                <span class="dialog-value">{{ formatter.format(new Date(invoice.refundedAt)) }}</span>
              </v-col>
              <v-col align="center" class="mx-2">
                <span class="dialog-text">Last reason:</span>
                <span class="dialog-value">{{ invoice.refundReason || "none" }}</span>
              </v-col>
            </v-row>

            <!-- If the invoice has not been fully refunded, show the option to make a refund.  -->
            <v-btn v-if="getMaxRefund(invoice) > 0" color="#ff0000" text @click="handleRefund(invoice)">
              Refund
            </v-btn>
            <!-- Otherwise mark the invoice as fully refunded. -->
            <v-chip v-else dense color="red" text-color="white">
              Full Amount refunded
            </v-chip>
          </div>
        </div>

        <v-divider></v-divider>

        <!-- Show a button to close the dialog. -->
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" text @click="purchaseDialog = false">
            Close Dialog
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog to guide the user through the process of making a refund. -->
    <v-dialog v-model="refundDialog" width="50vw">
      <v-card v-if="refundDialogData"  :set="priceFormatter = new Intl.NumberFormat(languages, { style: 'currency', currency: refundDialogData.currency })">
        <v-card-title class="text-h5">
          Refund
        </v-card-title>

        <!-- refundDialogState = 0  ->  Prompt the user for refund amount and reason.  -->
        <div v-if="refundDialogData && this.refundDialogState === 0">
          <!-- Show data about the invoice and any refunds that have already been made. -->
          <v-row no-gutters class="ma-0 px-2" style="white-space: nowrap;">
            <v-col class="mx-4 my-2">
              <span class="dialog-text">Invoice:</span>
              <span class="dialog-value">#{{ refundDialogData.number }}</span>
            </v-col>
            <v-col class="mx-4 my-2">
              <span class="dialog-text">Total Amount:</span>
              <span class="dialog-value">{{ priceFormatter.format(refundDialogData.totalAmount / 100) }}</span>
            </v-col>
            <v-col class="mx-4 my-2">
              <span class="dialog-text">Already refunded:</span>
              <span class="dialog-value">{{ priceFormatter.format((refundDialogData.refundAmount || 0) / 100) }}</span>
            </v-col>
            <v-col class="mx-4 my-2">
              <span class="dialog-text">Last refund:</span>
              <span class="dialog-value">{{ refundDialogData.refundedAt
                ? formatter.format(new Date(refundDialogData.refundedAt))
                : "N/A" }}</span>
            </v-col>
          </v-row>

          <!-- Ask the user to enter the amount to refund in the smallest unit of the relevant currency.
               This is also the format Stripe accepts. For convenience also show the "normal" formatting
               of the amount with decimals. -->
          <div class="px-6 refundInput my-0">
            <span>Amount to refund (in smallest unit of {{ refundDialogData.currency }}):</span>
            <span>{{ priceFormatter.format(amountToRefund / 100) }}</span>
            <span>=</span>
            <v-text-field :error-messages="amountToRefundError" v-model="amountToRefund" class="px-4 my-0 pb-0"
              type="number"></v-text-field>
          </div>

          <!-- Give the user the option to specify a reason for the refund. Otherwise the backend will
               use a hardcoded reason. -->
          <v-text-field v-model="refundReason" label="Reason (optional)" class="px-6 my-0 py-0"
            messages='Overwrites the previous reason. Will be set to "manual refund" if left emtpy.'></v-text-field>
        </div>

        <!-- While the user is entering details, they have the option of either going back to the information
             about the purchase or to go to the next step. -->
        <v-card-actions v-if="refundDialogState === 0">
          <v-spacer></v-spacer>
          <v-btn key="goBack" color="secondary" text @click="() => {
            refundDialog = false;
            purchaseDialog = true;
          }">
            Go Back
          </v-btn>

          <v-btn key="nextState" color="primary" :disabled="amountToRefundError.length > 0" text @click="() => {
            this.refundDialogState = 1;
          }">
            Next
          </v-btn>
        </v-card-actions>

        <!-- refundDialogState = 1  ->  Let the user verify the choices.  -->
        <div class="mx-6" v-if="refundDialogData && this.refundDialogState === 1">
          <!-- Show the data on the previous step. -->
          <div>
            You are about to refund <b>{{ formatCurrency(amountToRefund) }} {{ refundDialogData.currency }}</b> of Invoice
            <b>#{{
              refundDialogData.number }}</b>.
          </div>

          <!-- Alert the user that the purchase will be cancelled. -->
          <div class="mt-4">
            <v-icon style="font-size: 1.5rem !important;" color="yellow darken-2">
              mdi-alert-circle-outline
            </v-icon>
            The associated purchase will be cancelled, even if this is only a partial refund!
          </div>
        </div>

        <!-- Give the user the option of either going back to change the details for this refund
             or to execute the refund. -->
        <v-card-actions v-if="this.refundDialogState === 1">
          <v-spacer></v-spacer>
          <v-btn key="previousState" color="secondary" text @click="() => {
            this.refundDialogState = 0;
          }">
            Go Back
          </v-btn>

          <v-btn key="executeRefund" color="red" :disabled="amountToRefundError.length > 0" text
            @click="() => executeRefund(refundDialogData.number, amountToRefund)">
            Execute Refund
          </v-btn>
        </v-card-actions>

        <!-- refundDialogState = 2  ->  Refund is executing. -->
        <div class="mx-6 refundLoading" v-if="this.refundDialogState === 2">
          <v-progress-circular :size="60" indeterminate color="primary"></v-progress-circular>
          <span>
            Executing Refund...
          </span>
        </div>

        <!-- refundDialogState = 3  ->  Refund has finished. -->
        <div class="mx-6 refundResult" v-if="this.refundDialogState === 3">

          <!-- Show a large icon depending on if the refund was successfull or not. -->
          <v-icon style="font-size: 6rem !important;" color="green darken-2"
            v-if="this.refundResult.result === 'success'">
            mdi-check
          </v-icon>

          <v-icon style="font-size: 6rem !important;" color="red darken-2" v-else>
            mdi-close
          </v-icon>

          <!-- Display a message if the refund was successfull. -->
          <span v-if="this.refundResult.result === 'success'">
            Refund successfully executed.
          </span>

          <!-- In case the refund failed, display the error that the backend returned. -->
          <span v-else style="color: red;">
            Refund failed. {{ this.refundResult.error }}
          </span>
        </div>

        <!-- The only action at this step is to close the dialog. -->
        <v-card-actions v-if="this.refundDialogState === 3">
          <v-spacer></v-spacer>
          <v-btn key="closeDialog" color="primary" text @click="closeDialog">
            Close
          </v-btn>
          <v-spacer></v-spacer>
        </v-card-actions>

      </v-card>
    </v-dialog>
  </div>
</template>

<script>


export default {
  data: () => ({
    queryData: [],
    nextCursor: null,
    // Names and values for the columns of the table. The values are keys into the objects from the array above.
    headers: [
      {
        text: 'User',
        align: 'start',
        sortable: false,
        value: 'user.name',
      },
      {
        text: 'E-Mail',
        align: 'start',
        sortable: false,
        value: 'user.account',
      },
      { text: 'Client', value: 'client' },
      { text: 'Active', value: 'active' },
      { text: 'Purchasable', value: 'purchasable' },
      { text: 'Option', value: 'option.name' },
      { text: 'Interval', value: 'option.interval' },
      { text: 'Paid until', align: "end", value: 'paidUntil' },
    ],

    // Query parameters to let the user filter purchases.
    queryEmail: "",
    queryInvoiceNumber: "",
    queryDateStart: new Date(),
    queryDateEnd: new Date(),

    // Whether or not the dialogs are open or closed.
    purchaseDialog: false,
    refundDialog: false,

    // State of the refund dialog.
    // (0 = enter details, 1 = verify details, 2 = loading, 3 = result)
    refundDialogState: 0,

    // Data to show in the dialogs.
    refundDialogData: null,
    purchaseDialogData: null,

    // Inputs by the user while creating a refund.
    amountToRefund: 0,
    // Will contain errors in case the amountToRefund is invalid.
    amountToRefundError: [],

    // Holds the reason the user entered for the refund.
    refundReason: "",
    // The result the API returned when executing a refund.
    refundResult: {},

    // Formatter to format timestamps in the users preferred language.
    formatter: new Intl.DateTimeFormat(navigator.languages, {
      dateStyle: "medium",
      timeStyle: "long"
    }),
    languages: navigator.languages,
    // This object holds the Intl.NumberFormat formatters for each currency.
    priceFormatters: {},
    // An array of all the supported currencies.
    supportedCurrencies: []
  }),
  computed: {
    purchases() {
      // Map the data the API has returned into a more usable form by
      // extracting only the fields we need.
      return this.queryData.map(purchase => ({
        user: purchase.user ? {
          account: purchase.user.account,
          name: purchase.user.name,
        } : {},
        client: purchase.client.name,
        purchasable: purchase.purchasable.name,
        paidUntil: purchase.paidUntil ? this.formatter.format(new Date(purchase.paidUntil)) : "N/A",
        active: purchase.active,
        option: purchase.purchasable.options.filter(option => option._id === purchase.option)[0],
        paymentHistory: purchase.invoices.sort((a, b) => new Date(b.date) - new Date(a.date)),
        cancelledAt: purchase.canceledAt ? this.formatter.format(new Date(purchase.canceledAt)) : "N/A",
        cancellationReason: purchase.cancellationReason || "N/A",
      }));
    }
  },
  methods: {
    // When a row is clicked in the table.
    rowClicked(row) {
      // Update and open the dialog.
      this.purchaseDialogData = row;
      this.purchaseDialog = true;
    },
    // When a user wants to refund an invoice.
    handleRefund(data) {
      // Update and open the dialog.
      this.refundDialogData = data;
      this.refundDialog = true;
      this.refundDialogState = 0; // 0 = let the user enter details about the refund

      // Set the amountToRefund to the max refundable amount by default.
      this.amountToRefund = this.getMaxRefund(data);

      // Close the previous purchase dialog
      this.purchaseDialog = false;
    },
    // Return the highest possible refund.
    getMaxRefund(invoice) {
      // The highest possible refund is the difference between the amount of the original payment
      // and the already refunded amount.
      return invoice.totalAmount - (invoice.refundAmount || 0)
    },
    // Format a currency in a two-decimal format. Works for the most commonly used currencies, but
    // not for currencies that don't have two decimal places.
    formatCurrency(smallestUnit) {
      if (smallestUnit < 0) {
        return "----";
      }
      const full = Math.floor(smallestUnit / 100).toString();
      const cents = Math.round(smallestUnit % 100).toString();

      return full + "." + cents.padStart(2, "0");
    },
    async loadMore() {
      const res = await this.$store.state.nkclient.queryPurchases(
        this.formatDate(new Date(this.queryDateStart), "api"),
        this.formatDate(new Date(this.queryDateEnd), "api"),
        this.queryEmail,
        this.queryInvoiceNumber,
        this.nextCursor, 10
      );

      this.nextCursor = res.nextCursor;
      this.queryData = this.queryData.concat(res.data);
    },
    // Execute a refund.
    async executeRefund(invoice, amount) {
      // Go to the loading screen.
      this.refundDialogState = 2;

      // Try to refund the invoice using the API.
      try {
        const res = await this.$store.state.nkclient.refundInvoice(invoice, amount, this.refundReason);
        this.refundResult = {
          result: res === "ok" ? "success" : "failed",
          message: res
        };
      } catch (e) {
        this.refundResult = {
          result: "failed",
          message: "Server error."
        };
      }

      // Show the result of the refund.
      this.refundDialogState = 3;

      // Reset the refund reason.
      this.refundReason = "";

      // Reload the purchases since they might have changed.
      this.executeQuery();
    },
    // Takes in a data and formats it either in the style Vuetify requires, or
    // in the style the nukleus-api requires.
    formatDate(d, style) {
      const pad = (num) => num.toString().padStart(2, "0");
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const date = pad(d.getDate());
      const hour = pad(d.getHours());
      const minute = pad(d.getMinutes());

      if (style === "vuetify") {
        return year + "-" + month + "-" + date + "T" + hour + ":" + minute;
      } else if (style === "api") {
        return year + month + date + hour + minute + "00";
      } else {
        console.error("Style must be either 'vuetify' or 'api'.");
      }
    },
    // Execute a query for purchases with the filters the user has set.
    async executeQuery() {
      const res = await this.$store.state.nkclient.queryPurchases(
        this.formatDate(new Date(this.queryDateStart), "api"),
        this.formatDate(new Date(this.queryDateEnd), "api"),
        this.queryEmail,
        this.queryInvoiceNumber,
        undefined, 10
      );

      this.nextCursor = res.nextCursor;
      this.queryData = res.data;
    },

    // Close the dialog that shows information about a purchase.
    closeDialog() {
      this.purchaseDialog = false;
      this.refundDialog = false;
    }
  },
  watch: {
    // When the user sets a new amountToRefund, check if it's valid and
    // set an error message when neccessary.
    amountToRefund(data) {
      if (data > this.getMaxRefund(this.refundDialogData)) {
        this.amountToRefundError = ["Refund would result in more than total paid amount."];
      } else if (data < 1) {
        this.amountToRefundError = ["Refund must be more than one cent."];
      } else {
        this.amountToRefundError = [];
      }
    },
    supportedCurrencies(arr) {
      for (const currency of arr) {
        this.priceFormatters[currency] = new Intl.NumberFormat(navigator.languages, {
          style: "currency",
          currency: currency
        });
      }
    }
  },
  async mounted() {
    this.supportedCurrencies = await this.$store.state.nkclient.getSupportedCurrencies();

    // Initialize the query filters to select the last two days.
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 2);
    startDate.setHours(0);
    startDate.setMinutes(0);
    startDate.setSeconds(0);
    startDate.setMilliseconds(0);

    this.queryDateStart = this.formatDate(startDate, "vuetify");
    this.queryDateEnd = this.formatDate(new Date(), "vuetify");

    // Load data with those filters.
    this.executeQuery();
  }
}

</script>

<style scoped>
.searchBar {
  display: flex;
}

.row-pointer>>>tbody tr :hover {
  cursor: pointer;
}

.primary-column {
  margin-right: 28px;
}

.dialog-data {
  padding: 12px;
  margin: 0;
}

.dialog-data>* {
  white-space: nowrap;
}

.dialog-value {
  font-weight: bold;
}

.payments {
  margin: 24px;
}

.payment {
  background-color: #88888822;
  border-radius: 6px;
  padding: 12px;
  margin-top: 12px;
}

.payment--header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.invoice-number {
  font-size: 1.3rem;
}

.bottom--info {
  white-space: nowrap;
  align-items: center;
}

.totalAmount {
  font-size: 1.5rem;
}

.refundInput {
  display: flex;
  align-items: baseline;
  justify-content: flex-start;
}

.refundInput>span:nth-child(2) {
  margin-left: 4rem;
  font-weight: bold;
}

.refundInput>span:nth-child(3) {
  margin-left: 1rem;
}

.refundLoading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 5rem 0;
}

.refundLoading>span {
  margin-top: 1rem;
  font-size: 1.2rem;
}

.refundResult {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 5rem 0;
}
</style>
