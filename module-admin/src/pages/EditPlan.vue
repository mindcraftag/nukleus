<template>
  <div>
    <h1 class="pageTitle" data-test="editPlanTitle">Edit plan</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>

        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-btn color="primary" @click="submit">
                    <v-icon>mdi-content-save</v-icon>
                    save
                  </v-btn>
                  <v-btn @click="close">
                    <v-icon>mdi-close</v-icon>
                    close
                  </v-btn>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>

          <v-card width="100%">
            <v-card-title>Basic info</v-card-title>
            <v-card-text>
              <table :class="cssClasses" style="width: 100%">
                <tr>
                  <td class="fieldName">
                    Name
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="name"
                        required
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Description
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainerFlexHeight">
                      <v-textarea
                        v-model="description"
                        hide-details
                        no-resize
                      ></v-textarea>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Features
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainerFlexHeight">
                      <v-textarea
                        v-model="featuresString"
                        hide-details
                        no-resize
                      ></v-textarea>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Features</v-card-title>
            <v-card-text>
              <table :class="cssClasses" style="width: 100%">
                <tr>
                  <td class="fieldName70">
                    Visible to users
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="visible"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Is default plan
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="defaultPlan"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Public download allowed
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="publicDownloadAllowed"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Branding allowed
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="brandingAllowed"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Conversations allowed
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="conversationsAllowed"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Attribute templates allowed
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="attributeTemplatesAllowed"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Mailing system enabled
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="mailingEnabled"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Payment system enabled
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="paymentEnabled"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr v-if="paymentEnabled">
                  <td class="fieldName70">
                    User purchases enabled
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="userPurchasesEnabled"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Draft Mode
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-select :items="draftModes"
                                v-model="draftMode"
                                item-text="name"
                                item-value="id"
                                dense>
                      </v-select>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Draft Grace Period (Days)
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="draftGracePeriodDays"
                        type="number"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Limits</v-card-title>
            <v-card-text>
              <table :class="cssClasses" style="width: 100%">
                <tr>
                  <td class="fieldName70">
                    Storage quota (GiB)
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        type="number"
                        v-model="storageQuotaGb"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Traffic quota (GiB)
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        type="number"
                        v-model="trafficQuotaGb"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Monthly base price (CHF)
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        type="number"
                        v-model="monthlyBasePrice"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Storage price per GiB (CHF)
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        type="number"
                        v-model="storagePricePerGb"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Traffic price per GiB (CHF)
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        type="number"
                        v-model="trafficPricePerGb"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName70">
                    Max user count
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        type="number"
                        v-model="maxUserCount"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr v-if="userPurchasesEnabled">
                  <td class="fieldName70">
                    User purchase provision (%)
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        type="number"
                        v-model="userPurchaseProvisionPercent"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Allowed datatypes</v-card-title>
            <v-card-text>
              <span v-if="datatypes.length === 0">No datatypes available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="datatype in datatypes" :key="datatype.name">
                  <td class="fieldName70">
                    {{ datatype.name }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="datatype.active"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Allowed jobtypes</v-card-title>
            <v-card-text>
              <span v-if="jobtypes.length === 0">No jobtypes available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="jobtype in jobtypes" :key="jobtype.name">
                  <td class="fieldName70">
                    {{ jobtype.name }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="jobtype.active"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Allowed features</v-card-title>
            <v-card-text>
              <span v-if="features.length === 0">No features available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="feature in features" :key="feature.name">
                  <td class="fieldName70">
                    {{ feature.displayName }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="feature.active"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Allowed modules</v-card-title>
            <v-card-text>
              <span v-if="plugins.length === 0">No plugins available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="plugin in plugins" :key="plugin.name">
                  <td class="fieldName70">
                    {{ plugin.name }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="plugin.active"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Enabled storages</v-card-title>
            <v-card-text>
              <span v-if="storages.length === 0">No storages available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="storage in storages" :key="storage.name">
                  <td class="fieldName70">
                    {{ storage.name }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="storage.active"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-btn color="primary" @click="submit">
                    <v-icon>mdi-content-save</v-icon>
                    save
                  </v-btn>
                  <v-btn @click="close">
                    <v-icon>mdi-close</v-icon>
                    close
                  </v-btn>

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


export default {

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
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
    name: {
      get() {
        if (this.plan) {
          return this.plan.name;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.name = value;
        }
      }
    },
    description: {
      get() {
        if (this.plan) {
          return this.plan.description;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.description = value;
        }
      }
    },
    publicDownloadAllowed: {
      get() {
        if (this.plan) {
          return this.plan.publicDownloadAllowed;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.publicDownloadAllowed = value;
        }
      }
    },
    brandingAllowed: {
      get() {
        if (this.plan) {
          return this.plan.brandingAllowed;
        }
        return false;
      },
      set(value) {
        if (this.plan) {
          this.plan.brandingAllowed = value;
        }
      }
    },
    conversationsAllowed: {
      get() {
        if (this.plan) {
          return this.plan.conversationsAllowed;
        }
        return false;
      },
      set(value) {
        if (this.plan) {
          this.plan.conversationsAllowed = value;
        }
      }
    },
    attributeTemplatesAllowed: {
      get() {
        if (this.plan) {
          return this.plan.attributeTemplatesAllowed;
        }
        return false;
      },
      set(value) {
        if (this.plan) {
          this.plan.attributeTemplatesAllowed = value;
        }
      }
    },
    mailingEnabled: {
      get() {
        if (this.plan) {
          return this.plan.mailingEnabled;
        }
        return false;
      },
      set(value) {
        if (this.plan) {
          this.plan.mailingEnabled = value;
        }
      }
    },
    paymentEnabled: {
      get() {
        if (this.plan) {
          return this.plan.paymentEnabled;
        }
        return false;
      },
      set(value) {
        if (this.plan) {
          this.plan.paymentEnabled = value;
        }
      }
    },
    userPurchasesEnabled: {
      get() {
        if (this.plan) {
          return this.plan.userPurchasesEnabled;
        }
        return false;
      },
      set(value) {
        if (this.plan) {
          this.plan.userPurchasesEnabled = value;
        }
      }
    },
    userPurchaseProvisionPercent: {
      get() {
        if (this.plan) {
          return this.plan.userPurchaseProvisionPercent;
        }
        return false;
      },
      set(value) {
        if (this.plan) {
          this.plan.userPurchaseProvisionPercent = value;
        }
      }
    },
    visible: {
      get() {
        if (this.plan) {
          return this.plan.visible;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.visible = value;
        }
      }
    },
    defaultPlan: {
      get() {
        if (this.plan) {
          return this.plan.defaultPlan;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.defaultPlan = value;
        }
      }
    },
    storageQuotaGb: {
      get() {
        if (this.plan) {
          return this.plan.storageQuotaGb;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.storageQuotaGb = value;
        }
      }
    },
    trafficQuotaGb: {
      get() {
        if (this.plan) {
          return this.plan.trafficQuotaGb;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.trafficQuotaGb = value;
        }
      }
    },
    monthlyBasePrice: {
      get() {
        if (this.plan) {
          return this.plan.pricing.monthlyBasePrice;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.pricing.monthlyBasePrice = value;
        }
      }
    },
    storagePricePerGb: {
      get() {
        if (this.plan) {
          return this.plan.pricing.storagePricePerGb;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.pricing.storagePricePerGb = value;
        }
      }
    },
    trafficPricePerGb: {
      get() {
        if (this.plan) {
          return this.plan.pricing.trafficPricePerGb;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.pricing.trafficPricePerGb = value;
        }
      }
    },
    maxUserCount: {
      get() {
        if (this.plan) {
          return this.plan.maxUserCount;
        }
        return 0;
      },
      set(value) {
        if (this.plan) {
          this.plan.maxUserCount = value;
        }
      }
    },
    draftMode: {
      get() {
        if (this.plan) {
          return this.plan.draftMode;
        }
        return "";
      },
      set(value) {
        if (this.plan) {
          this.plan.draftMode = value;
        }
      }
    },
    draftGracePeriodDays: {
      get() {
        if (this.plan) {
          return this.plan.draftGracePeriodDays;
        }
        return 0;
      },
      set(value) {
        if (this.plan) {
          this.plan.draftGracePeriodDays = value;
        }
      }
    },
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    plan: null,
    featuresString: "",
    datatypes: [],
    jobtypes: [],
    plugins: [],
    storages: [],
    features: [],
    draftModes: [{
      name: "Forever",
      id: "FOREVER"
    },{
      name: "Make Public After Grace Period",
      id: "PUBLIC_AFTER_GRACE"
    },{
      name: "Delete After Grace Period",
      id: "DELETE_AFTER_GRACE"
    }]
  }),

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async loadPlan() {
      try {
        const planId = this.$router.currentRoute.params.id;

        this.plan = await this.$store.state.nkclient.getPlan(planId);

        this.featuresString = this.plan.features.map(n => "- " + n).join("\n");

        const features = await this.$store.state.nkclient.getAllFeatures();
        features.sort((a, b) => { return a.displayName.localeCompare(b.displayName); });
        this.features = features;

        const storages = await this.$store.state.nkclient.getStorages();
        storages.sort((a, b) => { return a.name.localeCompare(b.name); });
        this.storages = storages;

        const datatypes = await this.$store.state.nkclient.getAllDatatypesList();
        datatypes.sort((a, b) => { return a.name.localeCompare(b.name); });
        this.datatypes = datatypes;

        const jobtypes = await this.$store.state.nkclient.getAllManualJobTypes();
        jobtypes.sort((a, b) => { return a.name.localeCompare(b.name); });
        this.jobtypes = jobtypes;

        const plugins = await this.$store.state.nkclient.getPlugins();
        jobtypes.sort((a, b) => { return a.name.localeCompare(b.name); });
        this.plugins = plugins;

        if (Array.isArray(this.plan.storages)) {
          for (const storage of this.storages) {
            storage.active = this.plan.storages.includes(storage._id);
          }
        }

        if (Array.isArray(this.plan.datatypesEnabled)) {
          for (const datatype of this.datatypes) {
            datatype.active = this.plan.datatypesEnabled.includes(datatype.name);
          }
        }

        if (Array.isArray(this.plan.jobtypesEnabled)) {
          for (const jobtype of this.jobtypes) {
            jobtype.active = this.plan.jobtypesEnabled.includes(jobtype.name);
          }
        }

        if (Array.isArray(this.plan.pluginsEnabled)) {
          for (const plugin of this.plugins) {
            plugin.active = this.plan.pluginsEnabled.includes(plugin.name);
          }
        }

        if (Array.isArray(this.plan.featuresEnabled)) {
          for (const feature of this.features) {
            feature.active = this.plan.featuresEnabled.includes(feature.name);
          }
        }
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async submit () {
      try {
        // create a list of all enabled storages
        const storagesEnabled = [];
        for (const storage of this.storages) {
          if (storage.active) {
            storagesEnabled.push(storage._id);
          }
        }

        // create a list of all enabled datatypes
        const datatypesEnabled = [];
        for (const datatype of this.datatypes) {
          if (datatype.active) {
            datatypesEnabled.push(datatype.name);
          }
        }

        // create a list of all enabled jobtypes
        const jobtypesEnabled = [];
        for (const jobtype of this.jobtypes) {
          if (jobtype.active) {
            jobtypesEnabled.push(jobtype.name);
          }
        }

        // create a list of all enabled plugins
        const pluginsEnabled = [];
        for (const plugin of this.plugins) {
          if (plugin.active) {
            pluginsEnabled.push(plugin.name);
          }
        }

        // create a list of all enabled plugins
        const featuresEnabled = [];
        for (const feature of this.features) {
          if (feature.active) {
            featuresEnabled.push(feature.name);
          }
        }

        // create a list of all features
        const features = [];
        for (let feature of this.featuresString.split('\n').map(f => f.trim())) {
          if (feature.startsWith("-"))
            feature = feature.substr(1);

          const trimmed = feature.trim();
          if (trimmed.length)
            features.push(trimmed);
        }

        this.plan.publicDownloadAllowed = !!this.plan.publicDownloadAllowed;
        this.plan.brandingAllowed = !!this.plan.brandingAllowed;
        this.plan.conversationsAllowed = !!this.plan.conversationsAllowed;
        this.plan.attributeTemplatesAllowed = !!this.plan.attributeTemplatesAllowed;
        this.plan.mailingEnabled = !!this.plan.mailingEnabled;
        this.plan.paymentEnabled = !!this.plan.paymentEnabled;
        this.plan.userPurchasesEnabled = !!this.plan.userPurchasesEnabled;
        this.plan.features = features;
        this.plan.datatypesEnabled = datatypesEnabled;
        this.plan.jobtypesEnabled = jobtypesEnabled;
        this.plan.pluginsEnabled = pluginsEnabled;
        this.plan.featuresEnabled = featuresEnabled;
        this.plan.storages = storagesEnabled;

        await this.$store.state.nkclient.updatePlan(this.plan);
        this.close();
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    close () {
      this.$router.push({name: "Plans"});
    }
  },

  created() {
    this.loadPlan();
  }
}
</script>

<style>

</style>
