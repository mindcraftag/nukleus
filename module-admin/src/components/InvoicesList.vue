<template>

      <v-data-table
        item-key="_id"
        dense
        :headers="headers"
        :items="invoices"
        :footer-props="{
            itemsPerPageOptions: [100, 200, 500],
            options: {
                itemsPerPage: 100
            }
        }"
        sort-by="remoteHost"
        :sort-desc="false">
        <template v-slot:item="props">
          <tr>
            <td class="text-xs-left" style="cursor: pointer;">
              {{ props.item.number }}
            </td>
            <td class="text-xs-left" style="cursor: pointer;">
              {{ props.item.year }}
            </td>
            <td class="text-xs-left">
              {{ props.item.month | formatMonth }}
            </td>
            <td class="text-xs-left" style="white-space: nowrap;">
              {{ getTotalDue(props.item) | formatPrice }}
            </td>
            <td class="text-xs-left px-0">
              <v-btn v-if="props.item.item"
                     small
                     @click="download(props.item)">
                Download PDF
              </v-btn>
              <v-btn v-if="props.item.item"
                     small
                     @click="regenerate(props.item)">
                Regenerate PDF
              </v-btn>
              <span v-if="!props.item.item">
                PDF is not generated yet. Come back later.
              </span>
            </td>
          </tr>
        </template>
      </v-data-table>

</template>
<script>

import moment from 'moment'

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export default {

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    clientId: {
      type: String,
      required: false
    }
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    invoices: [],
    headers: [
      {
        text: 'InvoiceNo',
        value: 'number',
        sortable: true
      },
      {
        text: 'Year',
        value: 'year',
        sortable: true
      },
      {
        text: 'Month',
        value: 'month',
        sortable: true
      },
      {
        text: 'Total due',
        value: 'total',
        sortable: true
      },
      {
        text: 'Actions',
        value: 'actions',
        sortable: false
      }
    ]
  }),

  // --------------------------------------------------------
  // FILTERS
  // --------------------------------------------------------
  filters: {
    formatDate: function (value) {
      if (!value)
        return "<no date>";

      return moment(value).format('YYYY-MM-DD HH:mm:ss');
    },
    formatPrice: function(value) {
      const formatter = new Intl.NumberFormat('de-CH', {
        style: 'currency',
        currency: 'CHF',
        minimumFractionDigits: 2
      })

      return formatter.format(value / 100);
    },
    formatMonth: function(value) {
      return MONTH_NAMES[value-1];
    }
  },

  watch: {
    clientId: function() {
      this.loadData();
    }
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async download(invoice) {
      try {
        const filename = `invoice_${invoice.year}${invoice.month}.pdf`;
        await this.$store.state.nkclient.downloadInvoice(invoice._id, filename);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    async regenerate(invoice) {
      try {
        await this.$store.state.nkclient.regenerateInvoice(invoice._id);
        this.$store.commit("setMessage", "Triggered regeneration. This might take a while.");
        await this.loadData();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    getTotalDue(invoice) {
      let total = 0;
      for (const position of invoice.positions) {
        total += position.price;
      }
      return total;
    },
    async loadData() {
      try {
        if (this.clientId)
          this.invoices = await this.$store.state.nkclient.getClientInvoices(this.clientId);
        else
          this.invoices = await this.$store.state.nkclient.getMyClientInvoices();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    }
  },

  created() {
    this.loadData();
  }
}
</script>
