<template>
  <v-container fluid grid-list-xl>
    <v-row wrap>

      <v-col lg="12" sm="12" xs="12">
        <v-card width="100%">
          <v-card-actions>
            <v-btn color="primary" @click="submit">
              <v-icon>mdi-content-save</v-icon>
              save
            </v-btn>
            <v-btn @click="cancel">
              <v-icon>mdi-close</v-icon>
              close
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Basic info" :divider="false">
          <template #default>
            <table style="width: 100%">
              <tr>
                <td class="fieldName">Email</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="account" required></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Name</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="name" required></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Display Name</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="displayName" required></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Country</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallSelect
                      v-model="country"
                      :items="countries"
                      item-title="name"
                      item-value="code"
                      required
                    ></SmallSelect>
                  </div>
                </td>
              </tr>
            </table>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col
        v-if="
          $store.state.activeClientUserStorageQuotaEnabled ||
          $store.state.activeClientUserTrafficQuotaEnabled
        "
        lg="4" md="6" sm="12" xs="12"
      >
        <SlimFormCard title="Limits" :divider="false">
          <template #default>
            <table style="width: 100%">
              <tr v-if="$store.state.activeClientUserStorageQuotaEnabled">
                <td class="fieldName">Storage quota enabled</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallCheckbox
                      v-model="storageQuotaEnabled"
                      class="slimFormCheckbox"
                      hide-details
                      required
                    ></SmallCheckbox>
                  </div>
                </td>
              </tr>
              <tr
                v-if="
                  $store.state.activeClientUserStorageQuotaEnabled &&
                  storageQuotaEnabled
                "
              >
                <td class="fieldName">Storage quota (GiB)</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="storageQuotaGb"
                      type="Number"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr v-if="$store.state.activeClientUserTrafficQuotaEnabled">
                <td class="fieldName">Traffic quota enabled</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallCheckbox
                      v-model="trafficQuotaEnabled"
                      class="slimFormCheckbox"
                      hide-details
                      required
                    ></SmallCheckbox>
                  </div>
                </td>
              </tr>
              <tr
                v-if="
                  $store.state.activeClientUserTrafficQuotaEnabled &&
                  trafficQuotaEnabled
                "
              >
                <td class="fieldName">Traffic quota (GiB)</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="trafficQuotaGb"
                      type="Number"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
            </table>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Permissions" :divider="false">
          <template #default>
            <table style="width: 100%">
              <tr>
                <td class="fieldName70">Is admin</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallCheckbox
                      v-model="admin"
                      class="slimFormCheckbox"
                      :readonly="adminIsReadonly"
                      hide-details
                      required
                    ></SmallCheckbox>
                  </div>
                </td>
              </tr>
            </table>

            <PermissionsEditor v-if="!admin" v-model="permissions" />
          </template>
        </SlimFormCard>
      </v-col>

      <v-col v-if="paymentSetup" lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Payment / Invoice" :divider="false">
          <template #default>
            <div style="font-size: 14px; margin-bottom: 10px">
              Payment is setup: {{ paymentSetupDetails }}
            </div>

            <table style="width: 100%">
              <tr>
                <td class="fieldName">Email address</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressEmail"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Name</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressName"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Street</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressStreet"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Zipcode</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressZipcode"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">City</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressCity"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Country</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-model="paymentSetupAddressCountry"
                      required
                    ></SmallTextField>
                  </div>
                </td>
              </tr>
            </table>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col v-if="datatypes" lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Allowed datatypes" :divider="false">
          <template #default>
            <span v-if="datatypes.length === 0">No datatypes available</span>
            <table style="width: 100%">
              <tr v-for="datatype in datatypes" :key="datatype.name">
                <td class="fieldName70">
                  {{ getFeatureLabel(datatype) }}
                </td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallCheckbox
                      v-model="datatype.active"
                      class="slimFormCheckbox"
                      :readonly="datatype.inherited"
                      :color="datatype.inherited ? 'white' : 'blue'"
                      hide-details
                      density="compact"
                    ></SmallCheckbox>
                  </div>
                </td>
              </tr>
            </table>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col v-if="jobtypes" lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Allowed jobtypes" :divider="false">
          <template #default>
            <span v-if="jobtypes.length === 0">No jobtypes available</span>
            <table style="width: 100%">
              <tr v-for="jobtype in jobtypes" :key="jobtype.name">
                <td class="fieldName70">
                  {{ getFeatureLabel(jobtype) }}
                </td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallCheckbox
                      v-model="jobtype.active"
                      class="slimFormCheckbox"
                      :readonly="jobtype.inherited"
                      :color="jobtype.inherited ? 'white' : 'blue'"
                      hide-details
                      density="compact"
                    ></SmallCheckbox>
                  </div>
                </td>
              </tr>
            </table>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col v-if="features" lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Allowed features" :divider="false">
          <template #default>
            <span v-if="features.length === 0">No features available</span>
            <table style="width: 100%">
              <tr v-for="feature in features" :key="feature.name">
                <td class="fieldName70">
                  {{ getFeatureLabel(feature) }}
                </td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallCheckbox
                      v-model="feature.active"
                      class="slimFormCheckbox"
                      :readonly="feature.inherited"
                      :color="feature.inherited ? 'white' : 'blue'"
                      hide-details
                      density="compact"
                    ></SmallCheckbox>
                  </div>
                </td>
              </tr>
            </table>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Client Properties" :divider="false">
          <template #default>
            <div class="clientProperties">

              <template v-for="(field, fieldName) in clientPropertyTemplate" :key="name">
                <div class="clientPropertyLabel">
                  <span>{{ fieldName }}</span>
                  <span>{{ field.type }}, {{ field.visibility }}</span>
                </div>

                  <div class="fieldValueContainer">
                    <SmallTextField
                      v-if="field.type === 'string'"
                      :model-value="userProperties[fieldName]"
                      @update:model-value="(v) => {
                       userProperties[fieldName] = v;
                      }">
                    </SmallTextField>

                    <SmallSelect
                      v-else-if="field.type === 'string_enum'"
                      :items="field.options"
                      :model-value="userProperties[fieldName]"
                      @update:model-value="(v) => {
                       userProperties[fieldName] = v;
                      }">
                    </SmallSelect>

                    <SmallCheckbox
                      v-else-if="field.type === 'boolean'"
                      :model-value="userProperties[fieldName]"
                      @update:model-value="(v) => {
                       userProperties[fieldName] = v;
                      }">
                    </SmallCheckbox>
                  </div>
              </template>
            </div>

          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="12" sm="12" xs="12">
        <v-card width="100%">
          <v-card-actions>
            <v-btn color="primary" @click="submit">
              <v-icon>mdi-content-save</v-icon>
              save
            </v-btn>
            <v-btn @click="cancel">
              <v-icon>mdi-close</v-icon>
              close
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import PermissionsEditor from "../components/PermissionsEditor.vue";
import permissions from "../modules/permissions";
import { SlimFormCard, SmallTextField, SmallSelect, SmallCheckbox } from "@mindcraftgmbh/nukleus-vueui";
import iso3611 from "iso-3166-1";

export default {
  components: {
    PermissionsEditor,
    SlimFormCard,
    SmallTextField,
    SmallSelect,
    SmallCheckbox
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    user: null,
    passwordNew: "",
    passwordConfirmation: "",
    showPassword: false,
    permissionsRaw: [],
    permissions: [],
    jobtypes: null,
    datatypes: null,
    features: null,
    rules: {
      required: (value) => !!value || "Required.",
      min: (v) => v.length >= 8 || "Min 8 characters",
    },
    country: null,
    countries: [],
    clientPropertyTemplate: {}
  }),

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    account: {
      get() {
        if (this.user) {
          return this.user.account;
        }
        return "";
      },
      set(value) {
        if (this.user) {
          this.user.account = value;
        }
      },
    },
    name: {
      get() {
        if (this.user) {
          return this.user.name;
        }
        return "";
      },
      set(value) {
        if (this.user) {
          this.user.name = value;
        }
      },
    },
    displayName: {
      get() {
        if (this.user) {
          return this.user.displayName;
        }
        return undefined;
      },
      set(value) {
        if (this.user) {
          if (value.length === 0) {
            this.user.displayName = undefined;
          } else {
            this.user.displayName = value;
          }
        }
      },
    },
    admin: {
      get() {
        if (this.user) {
          return this.user.admin;
        }
        return "";
      },
      set(value) {
        if (this.user) {
          this.user.admin = value;
        }
      },
    },
    adminIsReadonly: {
      get() {
        return !permissions.isAdmin();
      },
    },
    storageQuotaEnabled: {
      get() {
        if (this.user) {
          return (
            this.user.storageQuotaGb !== null &&
            this.user.storageQuotaGb !== undefined
          );
        }
        return false;
      },
      set(value) {
        if (this.user) {
          if (value) this.user.storageQuotaGb = 0;
          else this.user.storageQuotaGb = null;
        }
      },
    },
    storageQuotaGb: {
      get() {
        if (this.user) {
          return this.user.storageQuotaGb || 0;
        }
        return "";
      },
      set(value) {
        if (this.user) {
          this.user.storageQuotaGb = value;
        }
      },
    },
    trafficQuotaEnabled: {
      get() {
        if (this.user) {
          return (
            this.user.trafficQuotaGb !== null &&
            this.user.trafficQuotaGb !== undefined
          );
        }
        return false;
      },
      set(value) {
        if (this.user) {
          if (value) this.user.trafficQuotaGb = 0;
          else this.user.trafficQuotaGb = null;
        }
      },
    },
    trafficQuotaGb: {
      get() {
        if (this.user) {
          return this.user.trafficQuotaGb || 0;
        }
        return "";
      },
      set(value) {
        if (this.user) {
          this.user.trafficQuotaGb = value;
        }
      },
    },
    paymentSetup: {
      get() {
        if (this.user) return this.user.paymentSetup;

        return null;
      },
    },
    paymentSetupDetails: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.cardInfo
        ) {
          const ci = this.user.paymentSetup.cardInfo;
          return `${ci.brand} (Expires ${ci.exp_month}/${ci.exp_year})`;
        }
      },
    },
    paymentSetupAddressEmail: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.email;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.email = value;
      },
    },
    paymentSetupAddressName: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.name;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.name = value;
      },
    },
    paymentSetupAddressStreet: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.street;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.street = value;
      },
    },
    paymentSetupAddressZipcode: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.zipcode;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.zipcode = value;
      },
    },
    paymentSetupAddressCity: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.city;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.city = value;
      },
    },
    paymentSetupAddressCountry: {
      get() {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          return this.user.paymentSetup.address.country;

        return null;
      },
      set(value) {
        if (
          this.user &&
          this.user.paymentSetup &&
          this.user.paymentSetup.address
        )
          this.user.paymentSetup.address.country = value;
      },
    },
    selectedPermissions: {
      get() {
        const selectedPermissions = [];
        for (const permission of this.permissions) {
          if (permission.checked) {
            selectedPermissions.push(permission.name);
          }
        }
        return selectedPermissions;
      },
      set(value) {
        if (!Array.isArray(value)) return;

        const permissions = this.permissionsRaw.concat();

        for (const hasPermission of value) {
          for (const permission of permissions) {
            if (permission.name === hasPermission) {
              permission.checked = true;
            }
          }
        }

        this.permissions = permissions;
      },
    },
    userProperties: {
      get() {
        if (this.user) {
          return this.user.properties;
        }
        return {};
      },
      set(value) {
        if (this.user) {
          this.user.properties = value;
        }
      },
    },
  },

  // --------------------------------------------------------
  //  CREATED
  // --------------------------------------------------------
  async created() {
    await this.loadUser();

    const regionNames = new Intl.DisplayNames(navigator.languages, {
      type: "region",
    });
    this.countries = iso3611
      .all()
      .map((country) => ({
        code: country.alpha3,
        name: regionNames.of(country.alpha2),
      }))
      .sort((a, b) => {
        if (a.name < b.name) {
          return -1;
        } else if (a.name > b.name) {
          return 1;
        } else {
          return 0;
        }
      });
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    getFeatureLabel(item) {
      const name = item.displayName || item.name;
      return name + (item.inherited ? " (inherited)" : "");
    },

    async loadUser() {
      try {
        const userId = this.$route.params.id;
        const user = await this.$store.state.nkclient.getUser(userId);

        this.country = user.location;

        user.storageQuotaGb = user.storageQuotaGb || null; // make sure this is not undefined or it cannot be reactive
        user.trafficQuotaGb = user.trafficQuotaGb || null; // make sure this is not undefined or it cannot be reactive

        this.permissionsRaw =
          await this.$store.state.nkclient.getPermissionsList();

        const jobtypesForAll =
          await this.$store.state.nkclient.getManualJobTypesOnClientForAll();
        if (jobtypesForAll) {
          const jobtypesForAllNames = jobtypesForAll.map((x) => x.name);
          const jobtypes =
            await this.$store.state.nkclient.getManualJobTypesOnClient();
          jobtypes.sort(function (a, b) {
            return a.name.localeCompare(b.name);
          });
          for (const jobtype of jobtypes) {
            jobtype.inherited = jobtypesForAllNames.includes(jobtype.name);
            jobtype.active =
              jobtype.inherited || user.allowedJobtypes.includes(jobtype.name);
          }
          this.jobtypes = jobtypes;
        } else {
          this.jobtypes = null;
        }

        const datatypesForAll =
          await this.$store.state.nkclient.getDatatypesListOnClientForAll();
        if (datatypesForAll) {
          const datatypesForAllNames = datatypesForAll.map((x) => x.name);
          const datatypes =
            await this.$store.state.nkclient.getDatatypesListOnClient();
          datatypes.sort(function (a, b) {
            return a.name.localeCompare(b.name);
          });
          for (const datatype of datatypes) {
            datatype.inherited = datatypesForAllNames.includes(datatype.name);
            datatype.active =
              datatype.inherited ||
              user.allowedDatatypes.includes(datatype.name);
          }
          this.datatypes = datatypes;
        } else {
          this.datatypes = null;
        }

        const clientData = await this.$store.state.nkclient.getClient(user.client);
        this.clientPropertyTemplate = clientData.userPropertiesTemplate;

        const featuresForAll =
          await this.$store.state.nkclient.getFeaturesOnClientForAll();
        if (featuresForAll) {
          const featuresForAllNames = featuresForAll.map((x) => x.name);
          const features =
            await this.$store.state.nkclient.getFeaturesOnClient();
          features.sort(function (a, b) {
            return a.displayName.localeCompare(b.displayName);
          });
          for (const feature of features) {
            feature.inherited = featuresForAllNames.includes(feature.name);
            feature.active =
              feature.inherited || user.allowedFeatures.includes(feature.name);
          }
          this.features = features;
        } else {
          this.features = null;
        }

        this.user = user;
        this.selectedPermissions = this.user.permissions;
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async submit() {
      try {
        if (this.passwordNew !== this.passwordConfirmation) {
          this.$store.commit("setError", "Passwords don't match!");
          return;
        }

        let allowedDatatypes = undefined;
        if (this.datatypes) {
          allowedDatatypes = [];
          for (const datatype of this.datatypes) {
            if (!datatype.inherited && datatype.active)
              allowedDatatypes.push(datatype.name);
          }
        }

        let allowedJobtypes = undefined;
        if (this.jobtypes) {
          allowedJobtypes = [];
          for (const jobtype of this.jobtypes) {
            if (!jobtype.inherited && jobtype.active)
              allowedJobtypes.push(jobtype.name);
          }
        }

        let allowedFeatures = undefined;
        if (this.features) {
          allowedFeatures = [];
          for (const feature of this.features) {
            if (!feature.inherited && feature.active)
              allowedFeatures.push(feature.name);
          }
        }

        await this.$store.state.nkclient.updateUser({
          _id: this.user._id,
          account: this.account,
          name: this.name,
          displayName: this.displayName,
          admin: this.admin,
          country: this.country,
          storageQuotaGb: this.user.storageQuotaGb,
          trafficQuotaGb: this.user.trafficQuotaGb,
          paymentSetup: this.paymentSetup,
          permissions: this.selectedPermissions,
          password: this.passwordNew,
          allowedDatatypes: allowedDatatypes,
          allowedJobtypes: allowedJobtypes,
          allowedFeatures: allowedFeatures,
          properties: this.userProperties
        });

        this.$router.go(-1);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    cancel() {
      if (window.history.length > 1) this.$router.go(-1);
      else this.$router.push("/users");
    },
  },
};
</script>

<style scoped>
.clientProperties {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-auto-rows: auto;
  font-size: 1rem;
  gap: 0.5rem 1rem;
}

.clientPropertyLabel {
  display: flex;
  flex-direction: column;
}

.clientPropertyLabel > span:nth-child(2) {
  font-size: 0.8rem;
  opacity: 0.6;
}

.clientPropertyField {
  width: 50%;
}
</style>
