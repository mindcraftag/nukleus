<template>
  <div>
    <div class="option-item d-flex flex-row" v-for="(license, index) in licenses" :key="license._id">
      <table :class="cssClasses" style="width: 100%">
        <tr>
          <td class="fieldName">
            Name
          </td>
          <td class="fieldValue">
            <div class="fieldValueContainer">
              <v-text-field dense v-model="license.name" />
            </div>
          </td>
        </tr>
        <tr>
          <td class="fieldName">
            Short text
          </td>
          <td class="fieldValue">
            <div class="fieldValueContainer">
              <v-text-field dense v-model="license.shorttext" />
            </div>
          </td>
        </tr>
        <tr>
          <td class="fieldName">
            Text
          </td>
          <td class="fieldValue">
            <div class="fieldValueContainerFlexHeight">
              <v-textarea dense no-resize
                          style="height: 108px;"
                          v-model="license.text" />
            </div>
          </td>
        </tr>
        <tr>
          <td class="fieldName">
            Link
          </td>
          <td class="fieldValue">
            <div class="fieldValueContainer">
              <v-text-field dense v-model="license.link" />
            </div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="text-align: right">
            <v-btn text @click="remove(license)">
              <font-awesome-icon :icon="['fal', 'trash']" size="1x" /> Delete above license
            </v-btn>
          </td>
        </tr>
      </table>
    </div>

    <div class="option-item d-flex flex-row">
      <table :class="cssClasses" style="width: 100%">
        <tr>
          <td class="fieldName">
            Name
          </td>
          <td class="fieldValue">
            <div class="fieldValueContainer">
              <v-text-field dense v-model="newLicenseName" />
            </div>
          </td>
        </tr>
        <tr>
          <td class="fieldName">
            Short text
          </td>
          <td class="fieldValue">
            <div class="fieldValueContainer">
              <v-text-field dense v-model="newLicenseShortText" />
            </div>
          </td>
        </tr>
        <tr>
          <td class="fieldName">
            Text
          </td>
          <td class="fieldValue">
            <div class="fieldValueContainerFlexHeight">
              <v-textarea dense no-resize
                          style="height: 108px;"
                          v-model="newLicenseText" />
            </div>
          </td>
        </tr>
        <tr>
          <td class="fieldName">
            Link
          </td>
          <td class="fieldValue">
            <div class="fieldValueContainer">
              <v-text-field dense v-model="newLicenseLink" />
            </div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="text-align: right">
            <v-btn text @click="add">
              <font-awesome-icon :icon="['fal', 'plus']" size="1x" /> Add above license
            </v-btn>
          </td>
        </tr>
      </table>
    </div>
  </div>
</template>
<script>

export default {

  props: {
    value: {
      type: Array
    }
  },

  data: () => ({
    newLicenseName: "",
    newLicenseShortText: "",
    newLicenseText: "",
    newLicenseLink: ""
  }),

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
    licenses: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    }
  },

  methods: {
    add() {
      const newLicenseName = this.newLicenseName.trim();

      if (newLicenseName.length === 0) {
        this.$store.commit("setError", "Please enter a name first");
        return;
      }

      for (const license of this.licenses) {
        if (license.name === newLicenseName) {
          this.$store.commit("setError", "License already exists");
          return;
        }
      }

      this.licenses.push({
        _id: "#" + Math.random(),
        name: newLicenseName,
        text: this.newLicenseText.trim(),
        shorttext: this.newLicenseShortText.trim(),
        link: this.newLicenseLink.trim()

      });

      this.newLicenseName = "";
      this.newLicenseText = "";
      this.newLicenseShortText = "";
      this.newLicenseLink = "";
    },

    remove(license) {
      this.licenses.removeObject(license);
    }
  }

}

</script>
