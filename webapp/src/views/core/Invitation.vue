<template>
  <v-app id="login" class="bg-secondary" theme="light">
    <div
      class="background-holder"
    ></div>
    <v-app-bar app flat color="rgba(0, 0, 0, 0)">

    </v-app-bar>
    <v-main>
      <v-container fluid fill-height style="max-width: 500px">
        <v-row align-center justify-center>
          <v-col xs12 sm8 md4 lg4>
            <v-card class="elevation-1 pa-3">
              <v-card-title
                >Hello and welcome to Nukleus. Please choose a new password for
                your account.</v-card-title
              >
              <v-card-text>
                <v-form>
                  <v-text-field
                    id="password"
                    v-model="password"
                    type="password"
                    name="password"
                    label="Password"
                    :error="showError"
                  />
                  <v-text-field
                    id="passwordConfirmation"
                    v-model="passwordConfirmation"
                    type="password"
                    name="passwordConfirmation"
                    label="Password confirmation"
                    :error="showError"
                  />
                </v-form>
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                  id="loginButton"
                  block
                  color="primary"
                  :loading="loading"
                  @click="login"
                  >Login</v-btn
                >
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
      <v-snackbar
        v-model="showError"
        :timeout="4000"
        color="error"
        location="top"
      >
        {{ error }}
      </v-snackbar>
    </v-main>
  </v-app>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      password: "",
      passwordConfirmation: "",
      rules: {
        required: (value) => !!value || "Required.",
      },
    };
  },

  computed: {
    showError: {
      get: function () {
        return this.error != null && this.error.length > 0;
      },
      set: function (value) {
        if (value === false) {
          this.$store.state.error = null;
        }
      },
    },
    error: {
      get: function () {
        return this.$store.state.error;
      },
    },
  },

  created() {
    this.$store.commit({
      type: "setAuthenticated",
      authenticated: false,
      token: "",
    });
  },

  methods: {
    async login() {
      const vm = this;

      if (!vm.passwordConfirmation || !vm.password) {
        vm.result = "Please choose a password";
        vm.showResult = true;
        return;
      }

      if (vm.password !== vm.passwordConfirmation) {
        vm.result = "Passwords do not match";
        vm.showResult = true;
        return;
      }

      try {
        const token = this.$route.params.token;
        await this.$store.state.nkclient.activateUser(vm.password, token);

        this.$store.commit(
          "setMessage",
          "Successfully activated. Please login.",
        );
        vm.$router.push({ name: "Login" });
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

<style scoped lang="css">
#login {
  height: 50%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  content: "";
  z-index: 0;
}
</style>
