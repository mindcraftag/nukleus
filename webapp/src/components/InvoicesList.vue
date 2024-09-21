<template>
  <v-data-table
    item-key="_id"
    density="compact"
    return-object
    :headers="headers"
    :items="invoices"
    :footer-props="{
      itemsPerPageOptions: [100, 200, 500],
      options: {
        itemsPerPage: 100,
      },
    }"
    :sort-by="[{ key: 'number', order: 'desc'}]"
  >
    <template #item="props">
      <tr>
        <td class="text-left" style="cursor: pointer">
          {{ props.item.value.number }}
        </td>
        <td v-if="userMode" class="text-left" style="cursor: pointer">
          {{ formatDate(props.item.value.date) }}
        </td>
        <td v-if="!userMode" class="text-left" style="cursor: pointer">
          {{ props.item.value.year }}
        </td>
        <td v-if="!userMode" class="text-left">
          {{ formatMonth(props.item.value.month) }}
        </td>
        <td class="text-left" style="white-space: nowrap">
          {{ getTotalDue(props.item.value) }}
        </td>
        <td class="text-left px-0">
          <v-btn
            v-if="props.item.value.item"
            size="small"
            @click="download(props.item.value)"
          >
            Download PDF
          </v-btn>
          <span v-if="!props.item.value.item">
            PDF is not generated yet. Come back later.
          </span>
        </td>
      </tr>
    </template>
  </v-data-table>
</template>
<script>
import moment from "moment";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default {

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    userMode: {
      type: Boolean,
      default: false,
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    invoices: [],
    headers: [],
  }),

  mounted() {
    if (this.userMode) {
      this.headers = [
        {
          title: "InvoiceNo",
          key: "number",
          sortable: true,
        },
        {
          title: "Date",
          key: "date",
          sortable: true,
        },
        {
          title: "Total due",
          key: "total",
          sortable: true,
        },
        {
          title: "Actions",
          key: "actions",
          sortable: false,
        },
      ];
    } else {
      this.headers = [
        {
          title: "InvoiceNo",
          key: "number",
          sortable: true,
        },
        {
          title: "Year",
          key: "year",
          sortable: true,
        },
        {
          title: "Month",
          key: "month",
          sortable: true,
        },
        {
          title: "Total due",
          key: "total",
          sortable: true,
        },
        {
          title: "Actions",
          key: "actions",
          sortable: false,
        },
      ];
    }
  },

  created() {
    this.loadData();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    formatDate: function (value) {
      if (!value) return "<no date>";

      return moment(value).format("YYYY-MM-DD HH:mm:ss");
    },
    formatPrice: function (value) {
      const formatter = new Intl.NumberFormat("de-CH", {
        style: "currency",
        currency: "CHF",
        minimumFractionDigits: 2,
      });

      return formatter.format(value / 100);
    },
    formatMonth: function (value) {
      return MONTH_NAMES[value - 1];
    },
    async download(invoice) {
      try {
        const filename = `invoice_${invoice.number}_${invoice.year}${invoice.month}.pdf`;
        await this.$store.state.nkclient.downloadInvoice(invoice._id, filename);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    async regenerate(invoice) {
      try {
        await this.$store.state.nkclient.regenerateInvoice(invoice._id);
        this.$store.commit(
          "setMessage",
          "Triggered regeneration. This might take a while.",
        );
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
      return this.formatPrice(total);
    },
    async loadData() {
      try {
        if (this.userMode)
          this.invoices = await this.$store.state.nkclient.getMyUserInvoices();
        else
          this.invoices =
            await this.$store.state.nkclient.getMyClientInvoices();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>
