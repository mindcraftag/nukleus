<template>
  <div>
    <v-data-table
      item-key="_id"
      density="compact"
      return-object
      :headers="headers"
      :items="jobs"
      :footer-props="{
        itemsPerPageOptions: [100, 200, 500],
        options: {
          itemsPerPage: 100,
        },
      }"
      :sort-by="[{ key: 'createdAt', type: 'desc'}]"
      show-expand
    >
      <template #item="props">
        <tr @click="props.expand(!props.isExpanded)">
          <td style="cursor: pointer">
            <v-icon v-if="!props.isExpanded">mdi-chevron-down</v-icon>
            <v-icon v-if="props.isExpanded">mdi-chevron-up</v-icon>
          </td>
          <td style="cursor: pointer" class="text-xs_left px-0">
            <v-icon :style="stateColor(props.item.value.state)">{{
                stateIcon(props.item.value.state)
            }}</v-icon>
            {{ formatState(props.item.value.state) }}
          </td>
          <td class="text-left" style="cursor: pointer">
            {{ props.item.value.type }}
          </td>
          <td class="text-left">
            {{ props.item.value.itemCount }}
          </td>
          <td class="text-left" style="white-space: nowrap">
            {{ props.item.value.createdByUser.name }}
          </td>
          <td class="text-left px-0" style="white-space: nowrap">
            {{ formatDate(props.item.value.createdAt) }}
          </td>
        </tr>
        <tr>
          <td :colspan="headers.length">
            <v-card>
              <v-card-title>Job details</v-card-title>
              <v-card-text>
                <v-text-field
                    :model-value="props.item.value.startedAt | formatDate"
                    readonly
                    label="Started at"
                >
                </v-text-field>
                <v-text-field
                    :model-value="props.item.value.stoppedAt | formatDate"
                    readonly
                    label="Stopped at"
                >
                </v-text-field>
                <v-text-field
                    :model-value="props.item.value.parameters | formatParameters"
                    readonly
                    label="Parameters"
                >
                </v-text-field>
                <v-text-field
                    v-if="props.item.value.error"
                    :model-value="props.item.value.error"
                    readonly
                    label="Error"
                >
                </v-text-field>
                <v-textarea
                    v-if="props.item.value.log"
                    :model-value="props.item.value.log"
                    label="Execution log"
                    readonly
                    rows="4"
                >
                </v-textarea>
              </v-card-text>
            </v-card>
          </td>
        </tr>
      </template>
      <template #expanded-item="{ headers, item }">

      </template>
    </v-data-table>
  </div>
</template>
<script>
import moment from "moment";

export default {

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    jobs: {
      type: Array,
      required: true,
      default: [],
    },
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    headers: [
      {
        title: "State",
        key: "state",
        sortable: true,
      },
      {
        title: "Type",
        key: "type",
        sortable: true,
      },
      {
        title: "Item count",
        key: "itemCount",
        sortable: true,
      },
      {
        title: "Created by",
        key: "createdByUser.name",
        sortable: true,
      },
      {
        title: "Created at",
        key: "createdAt",
        sortable: true,
      },
    ],
  }),

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    formatDate: function (value) {
      if (value) return moment(value).format("YYYY-MM-DD HH:mm:ss");

      return "";
    },
    formatState: function (value) {
      switch (value) {
        case 0:
          return "Pending";
        case 1:
          return "Running";
        case 2:
          return "Failed";
        case 3:
          return "Succeeded";
        default:
          return "Unknown state";
      }
    },
    stateIcon: function (value) {
      switch (value) {
        case 0:
          return "mdi-cog";
        case 1:
          return "mdi-cog";
        case 2:
          return "mdi-alert-circle";
        case 3:
          return "mdi-check";
        default:
          return "Unknown state";
      }
    },
    stateColor: function (value) {
      switch (value) {
        case 0:
          return "color: grey";
        case 1:
          return "color: black";
        case 2:
          return "color: red";
        case 3:
          return "color: green";
        default:
          return "";
      }
    },
    formatParameters: function (value) {
      return JSON.stringify(value);
    },
  }
};
</script>
<style></style>
