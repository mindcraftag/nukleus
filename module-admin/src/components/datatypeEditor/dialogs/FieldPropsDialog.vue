<template>
  <v-dialog width="600" :value="value" persistent>
    <v-card >
      <v-card-title>Field props</v-card-title>
      <v-divider></v-divider>
      <v-card-text>

        <div style="margin-top: 20px; margin-bottom: 10px; font-size: 12px">Flags:</div>

        <table :class="cssClasses" style="width: 100%">
          <tr v-if="field.type !== 'Separator'">
            <td class="fieldName70">
              Change does not affect thumbnail
            </td>
            <td class="fieldValue">
              <div class="fieldValueContainer">
                <v-checkbox
                  class="slimFormCheckbox"
                  v-model="doesNotAffectThumbnail"
                  dense hide-details />
              </div>
            </td>
          </tr>
          <tr v-if="field.type === 'Link'">
            <td class="fieldName70">
              Should not be preloaded
            </td>
            <td class="fieldValue">
              <div class="fieldValueContainer">
                <v-checkbox
                  class="slimFormCheckbox"
                  v-model="loadingManagerIgnore"
                  dense hide-details />
              </div>
            </td>
          </tr>
        </table>

        <div style="margin-top: 20px; margin-bottom: 10px; font-size: 12px">Help:</div>

        <table :class="cssClasses" style="width: 100%">
          <tr>
            <td class="fieldValue">
              <div class="fieldValueContainerFlexHeight">
                <v-textarea v-model="info"
                            hide-details
                            no-resize />
              </div>
            </td>
          </tr>
        </table>

        <div style="margin-top: 20px; margin-bottom: 10px; font-size: 12px">Feature required:</div>

        <table :class="cssClasses" style="width: 100%">
          <tr>
            <td class="fieldValue">
              <div class="fieldValueContainerFlexHeight">
                <v-text-field v-model="featureRequired"
                            hide-details
                            no-resize />
              </div>
            </td>
          </tr>
        </table>

        <div style="margin-top: 20px; margin-bottom: 10px; font-size: 12px">Conditions:</div>

        <table :class="cssClasses" style="width: 100%">
          <tr>
            <td>
              Field
            </td>
            <td>
              Value
            </td>
            <td>

            </td>
          </tr>
          <tr v-for="condition of conditionArray" :key="condition.field">
            <td class="fieldValue">
              <div class="fieldValueContainer">
                <v-text-field v-model="condition.field"></v-text-field>
              </div>
            </td>
            <td class="fieldValue">
              <div class="fieldValueContainer">
                <v-text-field v-model="condition.value"></v-text-field>
              </div>
            </td>
            <td>
              <v-btn icon @click="removeCondition(condition.field)">
                <font-awesome-icon :icon="['fal', 'trash']" size="1x" />
              </v-btn>
            </td>
          </tr>
          <tr>
            <td class="fieldValue">
              <div class="fieldValueContainer">
                <v-text-field v-model="newConditionField"></v-text-field>
              </div>
            </td>
            <td class="fieldValue">
              <div class="fieldValueContainer">
                <v-text-field v-model="newConditionValue"></v-text-field>
              </div>
            </td>
            <td>
              <v-btn icon @click="addCondition()">
                <font-awesome-icon :icon="['fal', 'plus']" size="1x" />
              </v-btn>
            </td>
          </tr>
        </table>

      </v-card-text>
      <v-divider></v-divider>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" text @click="save">Save</v-btn>
        <v-btn color="primary" text @click="close">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script>

export default {

  props: {
    value: {
      type: Boolean,
      required: true
    },
    field: {
      type: Object,
      required: true
    }
  },

  data: () => ({
    newConditionField: null,
    newConditionValue: null,
    editableField: {},
    conditionArray: []
  }),

  watch: {
    field: function(to) {
      this.init();
    },
    value: function(to) {
      if (to)
        this.init();
    }
  },

  computed: {
    cssClasses: {
      get() {
        if (this.$vuetify.theme.dark) {
          return "slimForm slimFormDark";
        } else {
          return "slimForm slimFormLight";
        }
      }
    },
    doesNotAffectThumbnail: {
      get() {
        return this.editableField.doesNotAffectThumbnail;
      },
      set(value) {
        if (value)
          this.editableField.doesNotAffectThumbnail = true;
        else
          delete this.editableField.doesNotAffectThumbnail;
      }
    },
    loadingManagerIgnore: {
      get() {
        return this.editableField.loadingManager === 'ignore';
      },
      set(value) {
        if (value)
          this.editableField.loadingManager = "ignore";
        else
          delete this.editableField.loadingManager;
      }
    },
    info: {
      get() {
        return this.editableField.info;
      },
      set(value) {
        this.editableField.info = value;
      }
    },
    featureRequired: {
      get() {
        return this.editableField.featureRequired;
      },
      set(value) {
        this.editableField.featureRequired = value;
      }
    }
  },

  methods: {
    init() {
      if (this.field) {
        this.editableField = JSON.parse(JSON.stringify(this.field));

        // Convert condition object into an array for easy editing
        const conditionArray = [];
        if (this.field.if) {
          for (const key in this.field.if) {
            if (this.field.if.hasOwnProperty(key)) {
              conditionArray.push({
                field: key,
                value: this.field.if[key]
              })
            }
          }
        }
        this.conditionArray = conditionArray;

      } else {
        this.editableField = null;
      }

      this.newConditionValue = null;
      this.newConditionField = null;
    },
    removeCondition(field) {
      this.conditionArray = this.conditionArray.filter(x => x.field !== field);
    },
    addCondition() {
      if (!this.newConditionField || !this.newConditionValue) {
        this.$store.commit('setError', "Enter field and value first.");
        return;
      }

      for (const condition of this.conditionArray) {
        if (condition.field === this.newConditionField) {
          this.$store.commit('setError', "This field is already in the list.");
          return;
        }
      }

      this.conditionArray.push({
        field: this.newConditionField,
        value: this.newConditionValue
      });

      this.newConditionField = null;
      this.newConditionValue = null;
    },

    save() {
      if (this.conditionArray.length) {
        const result = {};
        for (const condition of this.conditionArray) {
          result[condition.field] = condition.value;
        }
        this.editableField.if = result;
      } else {
        delete this.editableField.if;
      }

      this.$emit('changed', this.editableField);
      this.close();
    },

    close() {
      this.newConditionField = null;
      this.newConditionValue = null;
      this.$emit('input', false);
    }
  },

  mounted() {
    this.init();
  }

}

</script>
