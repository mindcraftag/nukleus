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
                <td class="fieldName">Name</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallTextField v-model="name" required></SmallTextField>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Description</td>
                <td class="fieldValue">
                  <div class="fieldValueContainerFlexHeight">
                    <SmallTextArea
                      v-model="description"
                    ></SmallTextArea>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="fieldName">Has folder</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallCheckbox
                      v-model="hasFolder"
                      class="slimFormCheckbox"
                      hide-details
                      required
                    ></SmallCheckbox>
                  </div>
                </td>
              </tr>
            </table>
          </template>
        </SlimFormCard>
      </v-col>

      <v-col lg="4" md="6" sm="12" xs="12">
        <SlimFormCard title="Members" :divider="false">
          <template #default>
            <UserSelector
              v-if="group && group._id"
              :group-id="group._id"
              :initially-selected-user-ids="userIds"
              :set-modified-users="(u) => (modifiedUsers = u)"
            />
          </template>
        </SlimFormCard>
      </v-col>

      <v-col
        v-if="
          $store.state.activeClientGroupStorageQuotaEnabled ||
          $store.state.activeClientGroupTrafficQuotaEnabled
        "
        lg="4" md="6" sm="12" xs="12"
      >
        <SlimFormCard title="Limits" :divider="false">
          <template #default>
            <table style="width: 100%">
              <tr v-if="$store.state.activeClientGroupStorageQuotaEnabled">
                <td class="fieldName">Storage quota enabled</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallCheckbox
                      v-model="storageQuotaEnabled"
                    ></SmallCheckbox>
                  </div>
                </td>
              </tr>
              <tr
                v-if="
                  $store.state.activeClientGroupStorageQuotaEnabled &&
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
              <tr v-if="$store.state.activeClientGroupTrafficQuotaEnabled">
                <td class="fieldName">Traffic quota enabled</td>
                <td class="fieldValue">
                  <div class="fieldValueContainer">
                    <SmallCheckbox
                      v-model="trafficQuotaEnabled"
                    ></SmallCheckbox>
                  </div>
                </td>
              </tr>
              <tr
                v-if="
                  $store.state.activeClientGroupTrafficQuotaEnabled &&
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
                      :readonly="datatype.inherited"
                      :color="datatype.inherited ? 'white' : 'blue'"
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
                      :readonly="jobtype.inherited"
                      :color="jobtype.inherited ? 'white' : 'blue'"
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
                      :readonly="feature.inherited"
                      :color="feature.inherited ? 'white' : 'blue'"
                    ></SmallCheckbox>
                  </div>
                </td>
              </tr>
            </table>
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
import { SlimFormCard, SmallTextField, SmallTextArea, SmallCheckbox,  UserSelector } from "@mindcraftgmbh/nukleus-vueui";

export default {
  components: {
    UserSelector,
    SlimFormCard,
    SmallTextField,
    SmallTextArea,
    SmallCheckbox
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    group: null,
    jobtypes: null,
    datatypes: null,
    features: null,
    modifiedUsers: {
      added: [],
      removed: [],
    },
    previouslySelectedUsers: null,
  }),

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    name: {
      get() {
        if (this.group) {
          return this.group.name;
        }
        return "";
      },
      set(value) {
        if (this.group) {
          this.group.name = value;
        }
      },
    },
    hasFolder: {
      get() {
        if (this.group) {
          return this.group.hasFolder;
        }
        return false;
      },
      set(value) {
        if (this.group) {
          this.group.hasFolder = value;
        }
      },
    },
    description: {
      get() {
        if (this.group) {
          return this.group.description;
        }
        return "";
      },
      set(value) {
        if (this.group) {
          this.group.description = value;
        }
      },
    },
    storageQuotaEnabled: {
      get() {
        if (this.group) {
          return (
            this.group.storageQuotaGb !== null &&
            this.group.storageQuotaGb !== undefined
          );
        }
        return false;
      },
      set(value) {
        if (this.group) {
          if (value) this.group.storageQuotaGb = 0;
          else this.group.storageQuotaGb = null;
        }
      },
    },
    storageQuotaGb: {
      get() {
        if (this.group) {
          return this.group.storageQuotaGb || 0;
        }
        return "";
      },
      set(value) {
        if (this.group) {
          this.group.storageQuotaGb = value;
        }
      },
    },
    trafficQuotaEnabled: {
      get() {
        if (this.group) {
          return (
            this.group.trafficQuotaGb !== null &&
            this.group.trafficQuotaGb !== undefined
          );
        }
        return false;
      },
      set(value) {
        if (this.group) {
          if (value) this.group.trafficQuotaGb = 0;
          else this.group.trafficQuotaGb = null;
        }
      },
    },
    trafficQuotaGb: {
      get() {
        if (this.group) {
          return this.group.trafficQuotaGb || 0;
        }
        return "";
      },
      set(value) {
        if (this.group) {
          this.group.trafficQuotaGb = value;
        }
      },
    },
    userIds: {
      get() {
        if (this.group) {
          return this.group.users.map(user => user._id);
        }
        
        return [];
      }
    }
  },

  // --------------------------------------------------------
  //  CREATED
  // --------------------------------------------------------
  async created() {
    await this.loadGroup();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    getFeatureLabel(item) {
      const name = item.displayName || item.name;
      return name + (item.inherited ? " (inherited)" : "");
    },

    async loadGroup() {
      try {
        const groupId = this.$route.params.id;
        const group = await this.$store.state.nkclient.getGroup(groupId);

        group.storageQuotaGb = group.storageQuotaGb || null; // make sure this is not undefined or it cannot be reactive
        group.trafficQuotaGb = group.trafficQuotaGb || null; // make sure this is not undefined or it cannot be reactive

        this.group = group;

        // Load members
        // ---------------------------------------------------------------------
        const users = await this.$store.state.nkclient.getUsersList();
        users.sort((a, b) => {
          return a.name.localeCompare(b.name);
        });

        if (Array.isArray(group.users)) {
          for (const user of users) {
            user.selected = group.users.some((e) => e._id === user._id);
          }
        }

        // Because the PUT /api/group endpoint requires a full list of selected users,
        // we need to first fetch all currently selected users, then apply the changes
        // made in UserSelector and then send this list to the API
        let allSelectedUsers = [];
        let nextCursor = null;

        // Go over all pages until there are no more (no more pages -> response.next === null)
        while (true) {
          const response = await this.$store.state.nkclient.queryUser(
            "",
            this.group._id,
            nextCursor,
          );
          allSelectedUsers = allSelectedUsers.concat(response.data);

          if (response.next) {
            nextCursor = response.next;
          } else {
            break;
          }
        }

        // Build the array first and assign it only when it's complete,
        // so the previouslySelectedUsers is never in an incomplete state.
        this.previouslySelectedUsers = allSelectedUsers;

        // Load jobtypes
        // ---------------------------------------------------------------------
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
              jobtype.inherited || group.allowedJobtypes.includes(jobtype.name);
          }
          this.jobtypes = jobtypes;
        } else {
          this.jobtypes = null;
        }

        // Load datatypes
        // ---------------------------------------------------------------------
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
              group.allowedDatatypes.includes(datatype.name);
          }
          this.datatypes = datatypes;
        } else {
          this.datatypes = null;
        }

        // Load features
        // ---------------------------------------------------------------------
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
              feature.inherited || group.allowedFeatures.includes(feature.name);
          }
          this.features = features;
        } else {
          this.features = null;
        }
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async submit() {
      try {
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

        // Create a list of all selected users by first collecting
        // all previously selected IDs.
        let users = [];
        for (const user of this.previouslySelectedUsers) {
          users.push(user._id);
        }

        // Then remove all IDs whose users were marked for removal.
        const removedIDs = this.modifiedUsers.removed.map((a) => a._id);
        users = users.filter((id) => !removedIDs.includes(id));

        // And then add all IDs of users that were marked for addition.
        users = users.concat(this.modifiedUsers.added.map((user) => user._id));

        this.group.users = users;
        this.group.allowedDatatypes = allowedDatatypes;
        this.group.allowedJobtypes = allowedJobtypes;
        this.group.allowedFeatures = allowedFeatures;

        await this.$store.state.nkclient.updateGroup(this.group);

        this.$store.commit("setMessage", "Group updated successfully!",);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    cancel() {
      if (window.history.length > 1) this.$router.go(-1);
      else this.$router.push("/groups");
    },
  },
};
</script>

<style></style>
