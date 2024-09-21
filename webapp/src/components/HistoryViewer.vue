<template>
  <div>
    <v-container v-if="history.length > 0" fluid pa-0>
      <v-expansion-panels multiple class="historyPanel">
        <v-expansion-panel
          v-for="historyEntry in history"
          :key="historyEntry._id"
        >
          <v-expansion-panel-header>
            <div>
              {{ historyEntry.createdAt | formatDate }} by
              {{ historyEntry.user.name }}
            </div>
          </v-expansion-panel-header>
          <v-expansion-panel-content pa-0>
            <v-data-table
              class="table"
              density="compact"
              :disable-pagination="true"
              :disable-filtering="true"
              :disable-sort="true"
              hide-default-footer
              style="width: 100%"
              :headers="tableHeaders"
              :items="historyChanges(historyEntry.changes)"
            >
              <template #item="props">
                <tr>
                  <td>
                    {{ props.item.field }}
                  </td>
                  <td>
                    <pre>{{ props.item.from }}</pre>
                  </td>
                  <td>
                    <pre>{{ props.item.to }}</pre>
                  </td>
                  <td>
                    {{ props.item.type }}
                  </td>
                </tr>
              </template>
            </v-data-table>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-container>
  </div>
</template>
<script>
import yaml from "js-yaml";
import moment from "moment";

export default {
  // --------------------------------------------------------
  // FILTERS
  // --------------------------------------------------------
  filters: {
    formatDate: function (value) {
      return moment(value).format("YYYY-MM-DD hh:mm:ss");
    },
  },

  // ------------------------------------------------------------
  // PROPS
  // ------------------------------------------------------------
  props: {
    history: {
      type: Array,
      required: true,
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    tableHeaders: [
      {
        text: "Field",
        value: "field",
        sortable: true,
      },
      {
        text: "From",
        value: "from",
        sortable: true,
      },
      {
        text: "To",
        value: "to",
        sortable: true,
      },
      {
        text: "Type",
        value: "type",
        sortable: true,
      },
    ],
  }),

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    toString(val) {
      if (val === null || val === undefined) return "";

      if (typeof val === "object") {
        return yaml.safeDump(val);
      }

      return String(val);
    },

    historyChanges(changes) {
      let rows = [];

      for (const field in changes) {
        const change = changes[field];
        rows.push({
          field: field.replace("#", "."),
          from: this.toString(change.from).wordWrap(40, "\n", 1),
          to: this.toString(change.to).wordWrap(40, "\n", 1),
          type: change.type,
        });
      }

      return rows;
    },
  },
};
</script>
<style>
.historyPanel .v-expansion-panel--active .v-expansion-panel-header {
  min-height: 48px;
}

.historyPanel .v-expansion-panel-header {
  min-height: 48px;
}

.historyPanel pre {
  font-family: sans-serif;
}
</style>
