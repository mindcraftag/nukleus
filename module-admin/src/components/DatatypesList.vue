<template>
  <div>
    <v-toolbar flat height="32px">

      <v-spacer></v-spacer>

      <v-toolbar flat height="32px">
        <v-toolbar-title></v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn text rounded @click="createNewDatatype">
          <v-icon>mdi-plus-circle-outline</v-icon>
          add datatype
        </v-btn>
      </v-toolbar>

    </v-toolbar>

    <v-data-table
      item-key="_id"
      :headers="headers"
      :items="datatypes"
      dense
      hide-default-footer
      disable-pagination
      sort-by="name"
      :sort-desc="false">
      <template v-slot:item="props">
        <tr @click="editDatatype(props.item)">
          <td class="text-xs-left" style="max-width: 32px;">
            <font-awesome-icon :icon="['fal', 'database']" />
          </td>
          <td class="text-xs-left" style="cursor: pointer;">
            {{ props.item.name }}
          </td>
          <td class="text-xs-left">
            {{ props.item.contentTypes | joinArray }}
          </td>
          <td class="text-xs-left">
            {{ props.item.fieldCount }}
          </td>
          <td class="text-xs-left" style="cursor: pointer;">
            {{ props.item.updateRequiresThumbRefresh | boolean }}
          </td>
          <td class="text-xs-left" style="cursor: pointer; font-size: 16px; font-weight: bold; font-family: monospace;">
            {{ props.item.fields | fingerprint }}
          </td>
        </tr>
      </template>
    </v-data-table>

    <CreateDatatype v-model="showCreateDatatypeDialog" v-on:created-datatype="reload"/>

  </div>
</template>
<style>

</style>
<script>

  import CreateDatatype from './CreateDatatype'

  export default {

    components: {
      CreateDatatype
    },

    // ------------------------------------------------------------
    // PROPERTIES
    // ------------------------------------------------------------
    props: {
      datatypes: {
        type: Array,
        required: true,
        default: [],
      }
    },

    // ------------------------------------------------------------
    // DATA
    // ------------------------------------------------------------
    data: () => ({
      headers: [
        {
          text: '',
          sortable: false
        },
        {
          text: 'Name',
          value: 'name',
          sortable: true
        },
        {
          text: 'Content types',
          value: 'contentTypes',
          sortable: true
        },
        {
          text: 'Field count',
          value: 'fieldcount',
          sortable: true
        },
        {
          text: 'Update requires thumb refresh',
          value: 'updateRequiresThumbRefresh',
          sortable: true
        },
        {
          text: 'Field fingerprint',
          value: 'fingerprint',
          sortable: true
        }
      ],

      showCreateDatatypeDialog: false
    }),

    // --------------------------------------------------------
    // FILTERS
    // --------------------------------------------------------
    filters: {
      joinArray: function(value) {
        if (!Array.isArray(value))
          return value;

        return value.join(', ');
      },
      boolean: function(value) {
        if (value)
          return "Yes";
        else
          return "";
      },
      fingerprint: function(value) {
        if (!value || value.length === 0)
          return "";

        return JSON.stringify(value).hashCode().toString(16);
      }
    },

    // --------------------------------------------------------
    // METHODS
    // --------------------------------------------------------
    methods: {
      reload() {
        this.$emit('reload');
      },

      createNewDatatype() {
        this.showCreateDatatypeDialog = true;
      },

      editDatatype(datatype) {
        this.$router.push({ name: "EditDatatype", params: { id: datatype._id }});
      }
    }
  }
</script>
