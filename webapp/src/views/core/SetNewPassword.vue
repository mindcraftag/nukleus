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
            <v-card v-if="!passwordWasSet" class="elevation-1 pa-3">
              <v-card-title
                >Please choose a new password for your account.</v-card-title
              >
              <v-card-text>
                <v-form>
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
                  @click="resetPassword"
                  >Set new password</v-btn
                >
                <br />
                <v-btn data-test="loginButton" block @click="login"
                  >Back to login</v-btn
                >
              </v-card-text>
            </v-card>
            <v-card v-else class="elevation-1 pa-3">
              <v-card-title
                >Password was set. Please try and login.</v-card-title
              >
              <v-card-text>
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
      password: "",
      passwordConfirmation: "",
      passwordWasSet: false,
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

  },

  methods: {
    login() {
      this.$router.push({ name: "Login" });
    },

    async resetPassword() {
      if (!this.passwordConfirmation || !this.password) {
        this.result = "Please choose a password";
        this.showResult = true;
        return;
      }

      if (this.password !== this.passwordConfirmation) {
        this.result = "Passwords do not match";
        this.showResult = true;
        return;
      }

      try {
        const token = this.$route.params.token;
        await this.$store.state.nkclient.setNewPassword(token, this.password);

        this.$store.commit("setMessage", "Setting new password was successful");
        this.passwordWasSet = true;
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
  },
};
</script>

<style></style>
