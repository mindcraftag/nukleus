<template>
  <div style="width: 100%">
    <div class="d-flex flex-row" :style="titleCss">
      <h1>{{childType.typeName}}</h1>

      <div style="margin-right: 0; margin-left: auto; padding-top: 4px;">
        <v-tooltip bottom color="primary">
          <template v-slot:activator="{ on }">
            <v-btn v-on="on" @click="deleteChildType" icon color="red">
              <font-awesome-icon :icon="['fal', 'trash']" />
            </v-btn>
          </template>
          <span>Remove child type</span>
        </v-tooltip>
      </div>

    </div>
    <div class="d-flex flex-row">
      <div class="field-name">
        Name:
      </div>
      <div class="field-value">
        <v-text-field dense v-model="childType.typeName" @input="changed" />
      </div>
    </div>
    <div>
      <DataTypeEditor v-model="childType.fields" :datatypes="datatypes" @input="changed" />
    </div>

    <v-dialog v-model="showDeleteDialog" persistent max-width="290">
      <v-card>
        <v-card-title class="headline">Delete this child type?</v-card-title>
        <v-card-text>The type and all fields will be lost!</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="red darken-1" text @click="showDeleteDialog = false; $emit('delete');">Delete</v-btn>
          <v-btn color="green darken-1" text @click="showDeleteDialog = false;">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </div>
</template>
<script>

export default {

  props: {
    value: {
      type: Object,
      required: true
    },
    datatypes: {
      type: Array,
      required: true
    }
  },

  data: () => ({
    showDeleteDialog: false
  }),

  computed: {
    titleCss: {
      get() {
        if (this.$vuetify.theme.dark)
          return "background-color: #101010;";
        else
          return "background-color: #f0f0f0;"
      }
    },
    childType: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    }
  },

  methods: {
    deleteChildType() {
      this.showDeleteDialog = true;
    },

    changed() {
      this.$emit('input', this.value);
    }
  }

}

</script>
