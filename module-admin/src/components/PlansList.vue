<template>
  <div>
    <v-toolbar flat height="32px">
      <v-toolbar-title></v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn text rounded @click="createNewPlan">
        <v-icon>mdi-plus-circle-outline</v-icon>
        add plan
      </v-btn>
    </v-toolbar>

    <v-data-table
      item-key="_id"
      dense
      :headers="headers"
      :items="plans"
      :footer-props="{
            itemsPerPageOptions: [100, 200, 500],
            options: {
                itemsPerPage: 100
            }
        }"
      sort-by="name"
      :sort-desc="false">
      <template v-slot:item="props">
        <tr>
          <td style="cursor: pointer;" class="text-xs_left px-0" @click="editPlan(props.item)">
            <font-awesome-icon :icon="['fal', 'money-check-alt']" />
            {{ props.item.name }}
          </td>
          <td class="px-0" style="white-space: nowrap;">

            <v-menu offset-y>
              <template v-slot:activator="{ on }">
                <v-btn dark small text fab color="grey" v-on="on">
                  <v-icon>mdi-dots-horizontal</v-icon>
                </v-btn>
              </template>

              <v-list>
                <v-list-item @click="editPlan(props.item)">
                  <v-list-item-title><font-awesome-icon :icon="['fal', 'edit']"/>&nbsp;Edit</v-list-item-title>
                </v-list-item>
                <v-list-item @click="requestDeletePlan(props.item)">
                  <v-list-item-title><span style="color: red;"><font-awesome-icon :icon="['fal', 'trash']"/>&nbsp;Delete</span></v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </td>
          <td style="text-align: center;">
            <font-awesome-icon :icon="['fal', 'check']" v-if="props.item.visible" />
          </td>
          <td style="text-align: center;">
            <font-awesome-icon :icon="['fal', 'check']" v-if="props.item.defaultPlan" />
          </td>
          <td>
            {{ props.item.pricing.monthlyBasePrice | formatPrice }}
          </td>
          <td>
            {{ props.item.pricing.storagePricePerGb | formatPrice }}
          </td>
          <td>
            {{ props.item.pricing.trafficPricePerGb | formatPrice }}
          </td>
          <td style="">
            {{ props.item.pluginsEnabled.length }}
          </td>
          <td>
            {{ props.item.datatypesEnabled.length }}
          </td>
          <td>
            {{ props.item.jobtypesEnabled.length }}
          </td>
          <td>
            {{ props.item.storages.length }}
          </td>
        </tr>
      </template>
    </v-data-table>

    <CreatePlan v-model="showCreateDialog" v-on:created-plan="$emit('reload')"/>

    <v-dialog v-model="showDeleteDialog" persistent max-width="290">
      <v-card>
        <v-card-title class="headline">Delete this plan?</v-card-title>
        <v-card-text>Plan will only be deleted if it is not used anymore and is not the default plan.</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="red darken-1" text @click="confirmDelete">Delete</v-btn>
          <v-btn color="green darken-1" text @click="cancelDelete">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>
<style>

</style>
<script>

import CreatePlan from './CreatePlan'

export default {

  components: {
    CreatePlan
  },

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    plans: {
      type: Array,
      required: true,
      default: []
    }
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    headers: [
      {
        text: 'Name',
        value: 'name',
        sortable: true
      },
      {
        text: '',
        sortable: false
      },
      {
        text: 'User visible',
        value: 'visible',
        sortable: true
      },
      {
        text: 'Default',
        value: 'default',
        sortable: true
      },
      {
        text: 'Base price',
        value: 'basePrice',
        sortable: true
      },
      {
        text: 'Storage price (GiB)',
        value: 'storagePriceGb',
        sortable: true
      },
      {
        text: 'Traffic price (GiB)',
        value: 'trafficPriceGb',
        sortable: true
      },
      {
        text: 'Plugins',
        value: 'pluginCount',
        sortable: true
      },
      {
        text: 'Datatypes',
        value: 'datatypeCount',
        sortable: true
      },
      {
        text: 'Jobtypes',
        value: 'jobtypeCount',
        sortable: true
      },
      {
        text: 'Storages',
        value: 'storagesCount',
        sortable: true
      }
    ],

    planToDelete: null,

    // show dialog values
    showCreateDialog: false,
    showDeleteDialog: false
  }),

  // --------------------------------------------------------
  // FILTERS
  // --------------------------------------------------------
  filters: {
    formatBoolean: function (value) {
      return value ? "Yes" : "No";
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
  // METHODS
  // --------------------------------------------------------
  methods: {
    createNewPlan() {
      this.showCreateDialog = true;
    },

    editPlan(plan) {
      this.$router.push({ name: "EditPlan", params: { id: plan._id }});
    },

    requestDeletePlan(plan) {
      this.planToDelete = plan;
      this.showDeleteDialog = true;
    },

    async confirmDelete() {
      try {
        this.plans = await this.$store.state.nkclient.deletePlan(this.planToDelete._id);
        this.showDeleteDialog = false;
        this.$store.commit("setMessage", "Deleted successfully");
        this.$emit('reload');
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    cancelDelete() {
      this.showDeleteDialog = false;
    }
  }
}
</script>
