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

      <v-col lg="12" sm="12" xs="12">
        <v-card width="100%">
          <v-container fluid grid-list-lg>
            <v-row wrap>
              <v-col xs12>
                <form>
                  <v-text-field
                    v-model="account"
                    :counter="50"
                    label="EMail"
                    density="compact"
                    required
                  ></v-text-field>
                  <v-text-field
                    v-model="name"
                    :counter="50"
                    label="Name"
                    density="compact"
                    required
                  ></v-text-field>
                  <v-checkbox
                    v-model="admin"
                    label="Is Administrator"
                    density="compact"
                    type="checkbox"
                    required
                  ></v-checkbox>

                  <PermissionsEditor v-if="!admin" v-model="permissions" />
                </form>
              </v-col>
            </v-row>
          </v-container>
        </v-card>
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

export default {
  components: {
    PermissionsEditor,
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    account: "",
    name: "",
    passwordNew: "",
    passwordConfirmation: "",
    admin: false,
    permissions: [],
    showPassword: false,
    rules: {
      required: (value) => !!value || "Required.",
      min: (v) => v.length >= 8 || "Min 8 characters",
    },
  }),

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    selectedPermissions() {
      const selectedPermissions = [];
      for (const permission of this.permissions) {
        if (permission.checked) {
          selectedPermissions.push(permission.name);
        }
      }
      return selectedPermissions;
    },
  },

  // --------------------------------------------------------
  //  CREATED
  // --------------------------------------------------------
  async created() {
    return this.loadPermissions();
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async loadPermissions() {
      try {
        this.permissions =
          await this.$store.state.nkclient.getPermissionsList();
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

        const id = await this.$store.state.nkclient.createUser({
          account: this.account,
          name: this.name,
          admin: this.admin,
          permissions: this.selectedPermissions,
          password: this.passwordNew,
        });

        this.$router.go(-1);
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    cancel() {
      this.$router.go(-1);
    },
  },
};
</script>

<style></style>
