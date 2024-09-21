<template>
  <div>
    <h1 class="pageTitle" data-test="invoicesTitle">Invoices</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>
        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-menu
                    ref="menu"
                    v-model="menu"
                    :close-on-content-click="false"
                    :return-value.sync="date"
                    transition="scale-transition"
                    offset-y
                    max-width="290px"
                    min-width="auto"
                  >
                    <template v-slot:activator="{ on, attrs }">
                      <v-text-field
                        v-model="date"
                        label="Select month"
                        prepend-icon="mdi-calendar"
                        readonly
                        v-bind="attrs"
                        v-on="on"
                      ></v-text-field>
                    </template>
                    <v-date-picker
                      v-model="date"
                      type="month"
                      no-title
                      scrollable
                    ></v-date-picker>
                  </v-menu>

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
                    sort-by="client"
                    :sort-desc="false">
                    <template v-slot:item="props">
                      <tr>
                        <td class="text-xs-left" style="cursor: pointer;">
                          {{ props.item.client }}
                        </td>
                        <td class="text-xs-left" style="cursor: pointer;">
                          {{ props.item.number }}
                        </td>
                        <td class="text-xs-left" style="cursor: pointer;">
                          {{ props.item.paidAt | formatDate }}
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

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

        </v-flex>
      </v-layout>

    </v-container>
  </div>
</template>
<script>

import moment from 'moment'

export default {

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    menu: false,
    dateValue: moment().add(-1, 'month').toDate().toISOString().substr(0, 7),
    invoices: [],
    clientsMap: new Map(),
    headers: [
      {
        text: 'Client',
        value: 'client',
        sortable: true
      },
      {
        text: 'InvoiceNo',
        value: 'number',
        sortable: true
      },
      {
        text: 'Paid at',
        value: 'paidAt',
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
        return "";

      return moment(value).format('YYYY-MM-DD HH:mm:ss');
    },
    formatPrice: function(value) {
      const formatter = new Intl.NumberFormat('de-CH', {
        style: 'currency',
        currency: 'CHF',
        minimumFractionDigits: 2
      })

      return formatter.format(value / 100);
    }
  },

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    date: {
      get() {
        return this.dateValue;
      },
      set(value) {
        this.dateValue = value;
        this.$refs.menu.save(value);
        this.menu = false;
        this.loadInvoices();
      }
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
        await this.loadInvoices();
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
    async loadClients() {
      const clients = await this.$store.state.nkclient.getClientsList();
      const clientsMap = new Map();
      for (const client of clients) {
        clientsMap.set(client._id, client.name);
      }
      this.clientsMap = clientsMap;
    },
    async loadInvoices() {
      try {
        this.invoices = [];

        const [year, month] = this.date.split("-");
        const invoices = await this.$store.state.nkclient.getInvoicesForMonth(year, month);

        for (const invoice of invoices) {
          if (this.clientsMap.has(invoice.client))
            invoice.client = this.clientsMap.get(invoice.client);
        }

        this.invoices = invoices;
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    }
  },

  async mounted() {
    await this.loadClients();
    await this.loadInvoices();
  }
}

</script>
