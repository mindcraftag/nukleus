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
                >Hello and welcome to Nukleus. Please enter your email address
                and choose a new password for your account.</v-card-title
              >
              <v-card-text>
                <v-form>
                  <v-text-field
                    id="regAccount"
                    v-model="account"
                    name="regAccount"
                    label="EMail Address"
                  />
                  <v-text-field
                    id="regName"
                    v-model="name"
                    name="regName"
                    label="Fullname"
                  />
                  <v-text-field
                    id="regPassword"
                    v-model="password"
                    type="password"
                    name="regPassword"
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
                <v-spacer></v-spacer>
                <v-btn
                  id="registerButton"
                  block
                  color="primary"
                  @click="register"
                  >Register</v-btn
                >
                <br />
                <v-btn data-test="loginButton" block @click="login"
                  >Back to login</v-btn
                >
              </v-card-text>
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
      account: "",
      password: "",
      name: "",
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

  methods: {
    login() {
      this.$router.push({ name: "Login" });
    },

    async register() {
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
        await this.$store.state.nkclient.register({
          account: this.account,
          password: this.password,
          name: this.name,
        });

        this.$store.commit("setMessage", "Successfully registered");
        this.$router.push({ name: "RegistrationSuccessful" });
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

<style></style>
